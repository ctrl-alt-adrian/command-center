import type { PipelineConfig } from "../../core/lib/types.ts";
import { runExtract } from "./lib/extract.ts";
import { runEmbed } from "./lib/embed.ts";

export const vaultNuggetsPipeline: PipelineConfig = {
  id: "vault-nuggets",
  description:
    "Daily extraction of atomic notes from session exports and the build journal. " +
    "Phase 1 (extract) scans new sources, calls claude -p to surface candidate nuggets, dedupes against the live vault, " +
    "and stages survivors in vault/.staging/<task-id>/ for captain review. " +
    "Phase 2 (embed) writes approved candidates into their pillar directory, " +
    "creates stub files for missing wikilink targets, and appends to each pillar's Map of Content.",
  backpressureCap: 5,
  cronSchedule: "0 9 * * *",
  phases: [
    {
      id: "extract",
      gateType: "needs_review",
      timeoutMs: 10 * 60 * 1000,
      run: async (task, ctx) => {
        ctx.log("nuggets extract starting");
        const result = await runExtract(task.id, ctx.outputDir);
        ctx.log("extract complete", { scanned: result.scanned, staged: result.candidates.length, dropped: result.dropped.length });
        return {
          output: {
            scanned: result.scanned,
            staged: result.candidates.length,
            dropped: result.dropped.length,
            stagingTaskId: task.id,
          },
        };
      },
    },
    {
      id: "embed",
      gateType: "auto_pass",
      timeoutMs: 60 * 1000,
      run: async (task, ctx) => {
        const stagingTaskId = (task.input.stagingTaskId as string) ?? (task.input.previousTaskId as string) ?? task.id;
        ctx.log("nuggets embed starting", { stagingTaskId });
        const result = await runEmbed(stagingTaskId, ctx.outputDir);
        ctx.log("embed complete", { embedded: result.embedded.length, stubs: result.stubsCreated.length });
        return {
          output: {
            embedded: result.embedded.length,
            stubs: result.stubsCreated.length,
            skipped: result.skipped.length,
          },
        };
      },
    },
  ],
};
