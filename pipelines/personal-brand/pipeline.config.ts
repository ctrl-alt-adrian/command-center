import type { PipelineConfig } from "../../core/lib/types.ts";
import { discoverBrandCandidates } from "./lib/discovery.ts";

export const personalBrandPipeline: PipelineConfig = {
  id: "personal-brand",
  description:
    "Personal-brand content pipeline (Phase A scaffold). Discovery filters the " +
    "vault for tier-1 framework notes flagged content_ready with audience !== " +
    "'product' — yields a candidate list for captain review. Phases B (generate) " +
    "and C (slop-check + review + drafts editor) layer on top.",
  backpressureCap: 5,
  phases: [
    {
      id: "discovery",
      gateType: "needs_review",
      timeoutMs: 60_000,
      run: async (_task, ctx) => {
        ctx.log("brand discovery scanning vault");
        const candidates = await discoverBrandCandidates();
        ctx.log("brand discovery complete", { picked: candidates.length });
        return {
          output: {
            picked: candidates.length,
            candidates: candidates.map((c) => ({
              id: c.id,
              pillar: c.pillar,
              title: c.title,
              tier: c.tier,
              tags: c.tags,
              summary: c.summary,
              reason: c.reason,
            })),
          },
        };
      },
    },
  ],
};
