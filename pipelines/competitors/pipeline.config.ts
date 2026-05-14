import type { PipelineConfig } from "../../core/lib/types.ts";
import { runScrape } from "./lib/scrape.ts";

export const competitorsPipeline: PipelineConfig = {
  id: "competitors",
  description:
    "Daily YouTube competitor outlier feed. Pulls recent uploads from tracked channels, " +
    "maintains rolling 30-day per-channel medians, flags videos ≥ 2.0x median as outliers. " +
    "Also runs niche-query searches with a velocity filter (≥5k vpd or ≥100k total). " +
    "Writes a six-tab snapshot to signals/competitors/<date>.json consumed by both " +
    "/competitors and marketing discovery's External Signals subagent.",
  backpressureCap: 5,
  // yt-dlp scrape per task is slow but cheap (no claude spend).
  perTickCap: 5,
  cronSchedule: "0 10 * * *",
  phases: [
    {
      id: "scrape",
      gateType: "auto_pass",
      timeoutMs: 30 * 60 * 1000,
      run: async (_task, ctx) => {
        ctx.log("competitors scrape starting");
        const result = await runScrape();
        ctx.log("scrape complete", {
          top: result.snapshot.top.length,
          outliers: result.snapshot.outliers.length,
          niche: result.snapshot.niche.length,
          warnings: result.snapshot.warnings.length,
        });
        return {
          output: {
            date: result.snapshot.date,
            outliers: result.snapshot.outliers.length,
            niche: result.snapshot.niche.length,
            top: result.snapshot.top.length,
            shorts: result.snapshot.shorts.length,
            warnings: result.snapshot.warnings.length,
            filePath: result.filePath,
          },
        };
      },
    },
  ],
};
