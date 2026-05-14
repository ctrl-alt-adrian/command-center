import type { PipelineConfig, Task } from "../../core/lib/types.ts";
import { discoverBrandCandidates, type BrandCandidate } from "./lib/discovery.ts";
import { generateBrandDrafts } from "./lib/generate.ts";

interface DiscoveryOutput extends Record<string, unknown> {
  picked: number;
  candidates: BrandCandidate[];
}

export const personalBrandPipeline: PipelineConfig = {
  id: "personal-brand",
  description:
    "Personal-brand content pipeline. Discovery filters the vault for tier-1 " +
    "framework notes with audience !== 'product' → captain reviews picks → " +
    "fan-out to per-pick generate tasks → per-platform drafts land in /personal-brand/drafts " +
    "for captain edit + refine + final review.",
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
            candidates,
          },
        };
      },
      // When the captain approves a discovery task, fan out one generate task per
      // picked candidate. Each carries the source note's body forward so generate
      // can call Sonnet against it.
      fanOut: async (task: Task) => {
        const output = task.output as DiscoveryOutput | undefined;
        const candidates = output?.candidates ?? [];
        return candidates.map((c) => ({
          candidate: {
            id: c.id,
            pillar: c.pillar,
            filename: c.filename,
            title: c.title,
            tier: c.tier,
            tags: c.tags,
            summary: c.summary,
            body: c.body,
          },
        }));
      },
    },
    {
      id: "generate",
      gateType: "auto_pass",
      timeoutMs: 15 * 60 * 1000, // 6 parallel claude calls per task; Sonnet on most platforms
      run: async (task, ctx) => {
        const candidate = (task.input as { candidate?: BrandCandidate }).candidate;
        if (!candidate) {
          throw new Error("personal-brand generate: task.input.candidate missing");
        }
        ctx.log("brand generate starting", { title: candidate.title, pillar: candidate.pillar });
        const result = await generateBrandDrafts({
          title: candidate.title,
          pillar: candidate.pillar,
          body: candidate.body,
          tags: candidate.tags ?? [],
        });
        const platforms = Object.keys(result.platforms);
        const failed = platforms.filter((p) => "error" in (result.platforms[p] as object));
        ctx.log("brand generate complete", { slug: result.slug, platforms, failed });
        return {
          output: {
            date: result.date,
            draftSlug: result.slug,
            draftDir: result.draftDir,
            platforms,
            failedPlatforms: failed,
          },
        };
      },
    },
    {
      id: "review",
      gateType: "needs_review",
      timeoutMs: 5_000,
      run: async (_task, ctx) => {
        ctx.log("brand review awaiting captain");
        return { output: { awaitingReview: true } };
      },
    },
  ],
};
