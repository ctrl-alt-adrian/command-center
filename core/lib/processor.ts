import fs from "fs/promises";
import type { PhaseConfig, PipelineConfig, Task } from "./types.ts";
import { DEFAULT_BACKPRESSURE_CAP, DEFAULT_PROCESSOR_PER_TICK_CAP, DEFAULT_RETRY_MAX } from "./types.ts";
import { getPipeline, listPipelines, nextPhase, getPhase, isFirstPhase } from "./registry.ts";
import {
  appendAttempt,
  createTask,
  getTask,
  listTasks,
  listTasksByPipeline,
  updateTask,
  writePhaseOutput,
} from "./tasks.ts";
import { LOGS_DIR, PROCESSOR_STATE_FILE, phaseDir, taskDir } from "./paths.ts";
import { logEvent, consoleLog } from "./log.ts";
import { nowIso } from "./utils.ts";

export interface ProcessorResult {
  processed: number;
  byPipeline: Record<string, number>;
  paused: number;
  resumed: number;
  deferred: number;
}

function globalPerTickCap(): number {
  const raw = process.env.PROCESSOR_PER_TICK_CAP;
  if (!raw) return DEFAULT_PROCESSOR_PER_TICK_CAP;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PROCESSOR_PER_TICK_CAP;
}

async function persistProcessorState(result: ProcessorResult): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.writeFile(
      PROCESSOR_STATE_FILE,
      JSON.stringify({ ...result, lastRunAt: nowIso() }, null, 2),
      "utf-8",
    );
  } catch {
    // best-effort; processor state is observability, not correctness
  }
}

export async function readLastProcessorState(): Promise<
  (ProcessorResult & { lastRunAt: string }) | null
> {
  try {
    const raw = await fs.readFile(PROCESSOR_STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Main entry. Returns counts. Safe to call when no work exists. */
export async function runProcessor(): Promise<ProcessorResult> {
  const result: ProcessorResult = { processed: 0, byPipeline: {}, paused: 0, resumed: 0, deferred: 0 };

  // Step 1: try to resume paused_backpressure tasks (cap may have cleared).
  // Resume happens regardless of the per-tick cap — resumed tasks just take
  // their FIFO place in the pending queue and may or may not dispatch this tick.
  const resumedCount = await tryResumePaused();
  result.resumed = resumedCount;

  // Step 2: dispatch pending tasks in FIFO order (oldest createdAt first),
  // honoring the per-tick cap.
  const allTasks = await listTasks();
  const pending = allTasks
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const globalCap = globalPerTickCap();
  let globalUsed = 0;
  const perPipelineUsed: Record<string, number> = {};

  for (const task of pending) {
    const pipeline = getPipeline(task.pipelineId);
    if (!pipeline) {
      await fail(task, `unknown pipeline: ${task.pipelineId}`);
      continue;
    }
    const phase = getPhase(pipeline, task.phaseId);
    if (!phase) {
      await fail(task, `unknown phase: ${task.pipelineId}/${task.phaseId}`);
      continue;
    }

    // Per-tick cap check. Pipelines declaring `perTickCap` get an independent
    // budget; pipelines without an override share the global pool.
    if (pipeline.perTickCap != null) {
      const used = perPipelineUsed[pipeline.id] ?? 0;
      if (used >= pipeline.perTickCap) {
        result.deferred++;
        continue;
      }
    } else if (globalUsed >= globalCap) {
      result.deferred++;
      continue;
    }

    // Backpressure check on top-of-pipeline tasks only.
    if (isFirstPhase(pipeline, phase.id) && (await isCapped(pipeline))) {
      await updateTask(task.id, { status: "paused_backpressure" });
      result.paused++;
      consoleLog("paused_backpressure", { taskId: task.id, pipelineId: pipeline.id });
      await logEvent("paused_backpressure", { taskId: task.id, pipelineId: pipeline.id });
      continue;
    }

    await runPhase(pipeline, phase, task);
    result.processed++;
    result.byPipeline[pipeline.id] = (result.byPipeline[pipeline.id] ?? 0) + 1;
    if (pipeline.perTickCap != null) {
      perPipelineUsed[pipeline.id] = (perPipelineUsed[pipeline.id] ?? 0) + 1;
    } else {
      globalUsed++;
    }
  }

  await persistProcessorState(result);
  return result;
}

async function tryResumePaused(): Promise<number> {
  const all = await listTasks();
  const paused = all.filter((t) => t.status === "paused_backpressure");
  let resumed = 0;
  for (const t of paused) {
    const pipeline = getPipeline(t.pipelineId);
    if (!pipeline) continue;
    if (!(await isCapped(pipeline))) {
      await updateTask(t.id, { status: "pending" });
      resumed++;
      consoleLog("resumed", { taskId: t.id, pipelineId: pipeline.id });
      await logEvent("resumed", { taskId: t.id, pipelineId: pipeline.id });
    }
  }
  return resumed;
}

async function isCapped(pipeline: PipelineConfig): Promise<boolean> {
  const cap = pipeline.backpressureCap ?? DEFAULT_BACKPRESSURE_CAP;
  const inPipeline = await listTasksByPipeline(pipeline.id);
  const needsReviewCount = inPipeline.filter((t) => t.status === "needs_review").length;
  return needsReviewCount >= cap;
}

async function runPhase(pipeline: PipelineConfig, phase: PhaseConfig, task: Task): Promise<void> {
  await updateTask(task.id, { status: "running" });
  const startedAt = nowIso();
  consoleLog("phase_start", { taskId: task.id, pipelineId: pipeline.id, phaseId: phase.id });
  await logEvent("phase_start", { taskId: task.id, pipelineId: pipeline.id, phaseId: phase.id });

  try {
    let output: Record<string, unknown> | undefined;
    if (phase.run) {
      const dir = phaseDir(task.id, phase.id);
      await fs.mkdir(dir, { recursive: true });
      const result = await phase.run(task, {
        taskDir: taskDir(task.id),
        inputDir: prevPhaseDir(pipeline, phase, task),
        outputDir: dir,
        log: (msg, data) => consoleLog("phase_log", { taskId: task.id, phaseId: phase.id, msg, data }),
      });
      output = result.output;
      if (output) {
        await writePhaseOutput(task.id, phase.id, JSON.stringify(output, null, 2), output);
      }
    }
    await updateTask(task.id, { output });
    await applyGate(pipeline, phase, task, startedAt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "error", reason: msg });
    await fail(task, msg);
  }
}

function prevPhaseDir(pipeline: PipelineConfig, phase: PhaseConfig, task: Task): string {
  const idx = pipeline.phases.findIndex((p) => p.id === phase.id);
  if (idx <= 0) return taskDir(task.id);
  return phaseDir(task.id, pipeline.phases[idx - 1].id);
}

async function applyGate(pipeline: PipelineConfig, phase: PhaseConfig, task: Task, startedAt: string): Promise<void> {
  if (phase.gateType === "needs_review") {
    await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "ok" });
    await updateTask(task.id, { status: "needs_review" });
    consoleLog("gate_needs_review", { taskId: task.id, phaseId: phase.id });
    await logEvent("gate_needs_review", { taskId: task.id, phaseId: phase.id });
    return;
  }

  if (phase.gateType === "auto_pass") {
    await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "ok" });
    await advanceOrComplete(pipeline, phase, task);
    return;
  }

  // deterministic
  if (!phase.check) {
    await fail(task, `phase ${phase.id} has gate deterministic but no check function`);
    return;
  }
  const result = await phase.check(task);
  if (result.pass) {
    await appendAttempt(task.id, { phaseId: phase.id, startedAt, finishedAt: nowIso(), outcome: "ok" });
    await advanceOrComplete(pipeline, phase, task);
    return;
  }

  // Gate failed. Retry policy.
  const max = phase.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_MAX;
  const fresh = await getTask(task.id);
  const retries = (fresh?.retryCount ?? 0) + 1;
  await appendAttempt(task.id, {
    phaseId: phase.id,
    startedAt,
    finishedAt: nowIso(),
    outcome: "gate_fail",
    reason: result.reason,
  });

  if (retries < max) {
    await updateTask(task.id, { status: "pending", retryCount: retries, gateFailReason: result.reason });
    consoleLog("gate_retry", { taskId: task.id, phaseId: phase.id, retries, reason: result.reason });
    await logEvent("gate_retry", { taskId: task.id, phaseId: phase.id, retries, reason: result.reason });
  } else {
    await updateTask(task.id, { status: "needs_review", gateFailReason: result.reason });
    consoleLog("gate_exhausted", { taskId: task.id, phaseId: phase.id, retries, reason: result.reason });
    await logEvent("gate_exhausted", { taskId: task.id, phaseId: phase.id, retries, reason: result.reason });
  }
}

async function advanceOrComplete(pipeline: PipelineConfig, phase: PhaseConfig, task: Task): Promise<void> {
  const next = nextPhase(pipeline, phase.id);
  if (!next) {
    await updateTask(task.id, { status: "completed" });
    consoleLog("completed", { taskId: task.id, pipelineId: pipeline.id });
    await logEvent("completed", { taskId: task.id, pipelineId: pipeline.id });
    return;
  }
  const fresh = await getTask(task.id);
  const baseInput = { ...task.input, ...(fresh?.output ?? {}), previousTaskId: task.id };

  if (phase.fanOut) {
    const elements = await phase.fanOut(fresh ?? task);
    if (elements.length === 0) {
      await updateTask(task.id, { status: "completed" });
      consoleLog("fanout_empty", { taskId: task.id, nextPhase: next });
      await logEvent("fanout_empty", { taskId: task.id, nextPhase: next });
      return;
    }
    // Honor pipeline.fanOutBatchSize: first N go pending, the rest get
    // paused_user so the captain can drain them in controlled batches via
    // the /api/tasks/resume endpoint rather than spawning everything at once.
    const batchSize = pipeline.fanOutBatchSize ?? elements.length;
    let pendingCount = 0;
    let pausedCount = 0;
    for (let i = 0; i < elements.length; i++) {
      const status = i < batchSize ? "pending" : "paused_user";
      await createTask({
        pipelineId: pipeline.id,
        phaseId: next,
        input: { ...baseInput, ...elements[i] },
        parentId: task.parentId ?? task.id,
        status,
      });
      if (status === "pending") pendingCount++;
      else pausedCount++;
    }
    await updateTask(task.id, { status: "completed" });
    consoleLog("fanned_out", { taskId: task.id, nextPhase: next, total: elements.length, pending: pendingCount, paused: pausedCount });
    await logEvent("fanned_out", { taskId: task.id, nextPhase: next, total: elements.length, pending: pendingCount, paused: pausedCount });
    return;
  }

  // Default: single next-phase task as a child.
  await createTask({
    pipelineId: pipeline.id,
    phaseId: next,
    input: baseInput,
    parentId: task.parentId ?? task.id,
    status: "pending",
  });
  await updateTask(task.id, { status: "completed" });
  consoleLog("advanced", { taskId: task.id, nextPhase: next });
  await logEvent("advanced", { taskId: task.id, nextPhase: next });
}

async function fail(task: Task, msg: string): Promise<void> {
  await updateTask(task.id, { status: "failed", error: msg });
  consoleLog("failed", { taskId: task.id, msg });
  await logEvent("failed", { taskId: task.id, msg });
}

/** Approve a needs_review task — advance to the next phase. */
export async function approveTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task || task.status !== "needs_review") return null;
  const pipeline = getPipeline(task.pipelineId);
  if (!pipeline) return null;
  const phase = getPhase(pipeline, task.phaseId);
  if (!phase) return null;
  await advanceOrComplete(pipeline, phase, task);
  return await getTask(id);
}

/** Reject a needs_review task — mark failed with a reason. */
export async function rejectTask(id: string, reason?: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task) return null;
  await updateTask(task.id, { status: "failed", error: reason ?? "rejected" });
  return await getTask(id);
}

/** Flip the next N paused_user tasks for a pipeline back to pending,
 *  oldest createdAt first. Returns the count of tasks actually resumed.
 *  When pipelineId is omitted, drains across every pipeline. */
export async function resumePausedUserTasks(
  pipelineId: string | undefined,
  count: number,
): Promise<{ resumed: number; ids: string[] }> {
  if (count <= 0) return { resumed: 0, ids: [] };
  const all = await listTasks();
  const candidates = all
    .filter((t) => t.status === "paused_user")
    .filter((t) => (pipelineId ? t.pipelineId === pipelineId : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, count);
  const ids: string[] = [];
  for (const t of candidates) {
    await updateTask(t.id, { status: "pending" });
    ids.push(t.id);
    consoleLog("resumed_user", { taskId: t.id, pipelineId: t.pipelineId });
    await logEvent("resumed_user", { taskId: t.id, pipelineId: t.pipelineId });
  }
  return { resumed: ids.length, ids };
}

/** Re-queue a failed task: flip status back to pending, clear the error,
 *  reset the retry counter so the phase's retryPolicy starts fresh. The
 *  `attempts` history is preserved so prior failures stay visible. */
export async function rerunTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task || task.status !== "failed") return null;
  await updateTask(task.id, {
    status: "pending",
    error: "",
    retryCount: 0,
    gateFailReason: "",
  });
  consoleLog("rerun", { taskId: id, pipelineId: task.pipelineId, phaseId: task.phaseId });
  await logEvent("rerun", { taskId: id, pipelineId: task.pipelineId, phaseId: task.phaseId });
  return await getTask(id);
}

export async function pipelineStatus(): Promise<
  Array<{ id: string; phases: { id: string; gateType: string }[]; backpressureCap: number; counts: Record<string, number> }>
> {
  const result = [];
  for (const p of listPipelines()) {
    const tasks = await listTasksByPipeline(p.id);
    const counts: Record<string, number> = {};
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
    result.push({
      id: p.id,
      phases: p.phases.map((ph) => ({ id: ph.id, gateType: ph.gateType })),
      backpressureCap: p.backpressureCap ?? DEFAULT_BACKPRESSURE_CAP,
      counts: { needs_review: 0, pending: 0, running: 0, completed: 0, failed: 0, paused_backpressure: 0, paused_user: 0, ...counts },
    });
  }
  return result;
}
