import fs from "fs/promises";
import type { PhaseConfig, PipelineConfig, Task } from "./types.ts";
import { DEFAULT_BACKPRESSURE_CAP, DEFAULT_RETRY_MAX } from "./types.ts";
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
import { phaseDir, taskDir } from "./paths.ts";
import { logEvent, consoleLog } from "./log.ts";
import { nowIso } from "./utils.ts";

export interface ProcessorResult {
  processed: number;
  byPipeline: Record<string, number>;
  paused: number;
  resumed: number;
}

/** Main entry. Returns counts. Safe to call when no work exists. */
export async function runProcessor(): Promise<ProcessorResult> {
  const result: ProcessorResult = { processed: 0, byPipeline: {}, paused: 0, resumed: 0 };

  // Step 1: try to resume paused_backpressure tasks (cap may have cleared).
  const resumedCount = await tryResumePaused();
  result.resumed = resumedCount;

  // Step 2: dispatch pending tasks one at a time.
  const tasks = await listTasks();
  for (const task of tasks) {
    if (task.status !== "pending") continue;
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
  }

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
  // Create the next-phase task as a child.
  const fresh = await getTask(task.id);
  await createTask({
    pipelineId: pipeline.id,
    phaseId: next,
    input: { ...task.input, ...(fresh?.output ?? {}), previousTaskId: task.id },
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
      counts: { needs_review: 0, pending: 0, running: 0, completed: 0, failed: 0, paused_backpressure: 0, ...counts },
    });
  }
  return result;
}
