import type { PipelineConfig } from "../../core/lib/types.ts";

export const testPipeline: PipelineConfig = {
  id: "test-pipeline",
  description:
    "Phase 1 validator. Single 'echo' phase that copies its input to its output, then gates on needs_review. " +
    "Used to exercise the backpressure cap (default 5 needs_review tasks per pipeline) and the approve/reject flow. " +
    "Will be removed when the real pipelines (marketing, vault-nuggets, competitors, reddit-pmf) ship.",
  backpressureCap: 5,
  phases: [
    {
      id: "echo",
      gateType: "needs_review",
      timeoutMs: 5_000,
      run: async (task, ctx) => {
        ctx.log("echo phase ran", { taskId: task.id, input: task.input });
        return { output: { echoed: task.input } };
      },
    },
  ],
};
