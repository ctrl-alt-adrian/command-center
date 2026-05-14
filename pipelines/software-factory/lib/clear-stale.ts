import fs from "fs/promises";
import path from "path";
import { listTasks, updateTask } from "../../../core/lib/tasks.ts";
import { LOGS_DIR } from "../../../core/lib/paths.ts";
import { nowIso } from "../../../core/lib/utils.ts";

const STALE_AFTER_DAYS = 7;
const HOUSEKEEPING_LOG_DIR = path.join(LOGS_DIR, "housekeeping");

export interface ClearStaleResult {
  cleared: Array<{ taskId: string; pipelineId: string; updatedAt: string; ageDays: number }>;
  scanned: number;
}

export async function runClearStale(): Promise<ClearStaleResult> {
  const tasks = await listTasks();
  const cutoff = Date.now() - STALE_AFTER_DAYS * 86_400_000;

  const stale = tasks.filter((t) => {
    if (t.status !== "paused_backpressure") return false;
    const updated = Date.parse(t.updatedAt);
    return Number.isFinite(updated) && updated < cutoff;
  });

  const cleared: ClearStaleResult["cleared"] = [];
  for (const t of stale) {
    const ageDays = (Date.now() - Date.parse(t.updatedAt)) / 86_400_000;
    await updateTask(t.id, { status: "cleared_stale", error: `Cleared by daily-housekeeping after ${ageDays.toFixed(1)}d paused` });
    cleared.push({
      taskId: t.id,
      pipelineId: t.pipelineId,
      updatedAt: t.updatedAt,
      ageDays: Math.round(ageDays * 10) / 10,
    });
  }

  await fs.mkdir(HOUSEKEEPING_LOG_DIR, { recursive: true });
  const day = nowIso().slice(0, 10);
  const logPath = path.join(HOUSEKEEPING_LOG_DIR, `${day}.log`);
  const lines = cleared.length === 0
    ? [`${nowIso()} daily-housekeeping no-op (scanned ${tasks.length}, no stale paused tasks)`]
    : cleared.map((c) => `${nowIso()} cleared taskId=${c.taskId} pipeline=${c.pipelineId} age=${c.ageDays}d updatedAt=${c.updatedAt}`);
  await fs.appendFile(logPath, lines.join("\n") + "\n", "utf-8");

  return { cleared, scanned: tasks.length };
}
