import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { RoleNextClient } from "../lib/api-client.ts";

export async function runMarkApplied(task: Task, ctx: PhaseContext): Promise<PhaseOutput> {
  const jobId = task.input.jobId as number | undefined;
  if (!jobId) throw new Error("mark-applied: missing jobId");

  const client = new RoleNextClient();
  const updated = await client.patchJob(jobId, { status: "applied" });
  ctx.log("mark-applied", { jobId, newStatus: updated.status });

  await writeFile(
    path.join(ctx.outputDir, "applied.md"),
    `Marked job ${jobId} (${updated.title} — ${updated.company}) as applied at ${new Date().toISOString()}.`,
    "utf-8",
  );

  return {
    output: {
      jobId,
      status: updated.status,
      appliedAt: new Date().toISOString(),
    },
  };
}
