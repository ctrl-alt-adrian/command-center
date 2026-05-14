import { error } from "@sveltejs/kit";
import { getPipeline } from "../../../../../core/lib/registry.ts";
import { listTasksByPipeline } from "../../../../../core/lib/tasks.ts";
import { DEFAULT_BACKPRESSURE_CAP, DEFAULT_RETRY_MAX, DEFAULT_TIMEOUT_MS } from "../../../../../core/lib/types.ts";

export async function load({ params }) {
  const p = getPipeline(params.id);
  if (!p) throw error(404, `unknown pipeline: ${params.id}`);
  const tasks = await listTasksByPipeline(p.id);

  const phases = p.phases.map((ph) => ({
    id: ph.id,
    gateType: ph.gateType,
    timeoutMs: ph.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retryMax: ph.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_MAX,
    hasRun: typeof ph.run === "function",
    hasCheck: typeof ph.check === "function",
    slashCommand: ph.slashCommand,
  }));

  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;

  return {
    pipeline: {
      id: p.id,
      description: p.description ?? "",
      cronSchedule: p.cronSchedule ?? "",
      backpressureCap: p.backpressureCap ?? DEFAULT_BACKPRESSURE_CAP,
      phases,
      counts,
      taskCount: tasks.length,
    },
  };
}
