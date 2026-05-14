import type { PipelineConfig, PhaseConfig, Task, PhaseContext } from "../../core/lib/types.ts";
import { discoverContent, discoverFromCandidates, generateDrafts, type ContentCandidate } from "./lib/generate.ts";
import { getKBEntries, getKBEntry, markUsedForContent } from "./lib/kb.ts";
import { runRules } from "../../core/lib/slop.ts";
import { MARKETING_SLOP_PACK, loadMarketingSlopPack } from "./lib/slop-loader.ts";
import { getDraftSet, updateDraftStatus } from "./lib/drafts.ts";
import { STAGE_TIMEOUTS_MS, MAX_SLOP_RETRIES } from "./lib/constants.ts";
import type { ScoredCandidate } from "./lib/types.ts";

let slopBootstrapped = false;
async function ensureSlopLoaded() {
  if (slopBootstrapped) return;
  await loadMarketingSlopPack();
  slopBootstrapped = true;
}

// ---------------- Phase 1: Discovery ----------------
const discoveryPhase: PhaseConfig = {
  id: "discovery",
  gateType: "needs_review",
  timeoutMs: STAGE_TIMEOUTS_MS.discover,
  run: async (task: Task, ctx: PhaseContext) => {
    ctx.log("discovery scanning KB");
    const all = await getKBEntries();
    const analyzed = all.filter((e) => !e.usedForContent && e.contentWorthy === true);

    let result;
    if (analyzed.length > 0) {
      const candidates: ContentCandidate[] = analyzed.map((e) => ({
        id: e.id,
        type: e.contentType ?? "technical",
        hook: e.hook ?? "",
        angle: e.angle ?? "",
        tags: e.tags ?? [],
      }));
      result = await discoverFromCandidates(candidates, all.length, all.filter((e) => e.shareworthy).length);
    } else {
      const unanalyzed = all.filter((e) => !e.usedForContent && e.contentWorthy === undefined);
      if (unanalyzed.length === 0) {
        return { output: { candidatesFound: 0, message: "No unused content-worthy KB entries" } };
      }
      result = await discoverContent(unanalyzed);
    }

    ctx.log("discovery produced candidates", { count: result.candidates.length });
    return { output: { candidates: result.candidates as unknown as Record<string, unknown>[], summary: result.summary as unknown as Record<string, unknown> } };
  },
  /**
   * On approval, fan out one generate task per candidate. Each downstream
   * task gets a single ScoredCandidate plus that candidate's KB context.
   */
  fanOut: async (task) => {
    const candidates = (task.output?.candidates as ScoredCandidate[] | undefined) ?? [];
    const out: Array<Record<string, unknown>> = [];
    for (const candidate of candidates) {
      const kbEntry = await getKBEntry(candidate.id).catch(() => null);
      const kbContext = kbEntry?.body ?? "";
      out.push({ candidate, kbContext });
    }
    return out;
  },
};

// ---------------- Phase 2: Generate ----------------
const generatePhase: PhaseConfig = {
  id: "generate",
  gateType: "auto_pass",
  timeoutMs: STAGE_TIMEOUTS_MS.generate,
  run: async (task: Task, ctx: PhaseContext) => {
    const candidate = task.input.candidate as ScoredCandidate | undefined;
    if (!candidate) throw new Error("generate phase needs `candidate` in task.input");
    const kbContext = (task.input.kbContext as string) ?? "";
    const slopFeedback = (task.input.slopFeedback as string) ?? "";
    const existingDir = task.input.draftDir as string | undefined;

    const topic = candidate.hook || candidate.angle || candidate.id;
    const augmentedKbContext = slopFeedback ? `${kbContext}\n\nPRIOR SLOP VIOLATIONS — avoid these:\n${slopFeedback}` : kbContext;

    ctx.log("generate fanning out", { topic, hasFeedback: !!slopFeedback, existingDir });
    const result = await generateDrafts(topic, augmentedKbContext, {
      angle: candidate.angle,
      tags: candidate.tags,
    }, existingDir);

    return {
      output: {
        draftDir: result.date,
        platforms: Object.keys(result.platforms),
        candidate: candidate as unknown as Record<string, unknown>,
      },
    };
  },
};

// ---------------- Phase 3: Slop-check (deterministic gate) ----------------
const slopCheckPhase: PhaseConfig = {
  id: "slop-check",
  gateType: "deterministic",
  timeoutMs: STAGE_TIMEOUTS_MS["slop-check"],
  retryPolicy: { maxAttempts: MAX_SLOP_RETRIES },
  run: async (_task, ctx) => {
    await ensureSlopLoaded();
    ctx.log("slop pack ready");
    return { output: {} };
  },
  check: async (task) => {
    await ensureSlopLoaded();
    const draftDir = task.input.draftDir as string | undefined;
    if (!draftDir) return { pass: false, reason: "slop-check requires draftDir" };
    const set = await getDraftSet(draftDir);
    if (!set) return { pass: false, reason: `draft set not found: ${draftDir}` };

    const violations: Array<{ platform: string; rule: string; line: number; excerpt: string }> = [];
    for (const [platform, draft] of Object.entries(set.platforms)) {
      const result = runRules(draft.content, MARKETING_SLOP_PACK);
      if (!result.pass) {
        for (const v of result.violations) {
          if (v.severity === "fail") {
            violations.push({ platform, rule: v.ruleId, line: v.line, excerpt: v.excerpt });
          }
        }
      } else {
        await updateDraftStatus(draftDir, platform, "slop-checked");
      }
    }

    if (violations.length === 0) {
      return { pass: true };
    }

    // Feedback string for retry
    const feedback = violations
      .slice(0, 20)
      .map((v) => `${v.platform} L${v.line} [${v.rule}]: "${v.excerpt}"`)
      .join("\n");
    return { pass: false, reason: feedback };
  },
};

// ---------------- Phase 4: Review (human gate) ----------------
const reviewPhase: PhaseConfig = {
  id: "review",
  gateType: "needs_review",
  timeoutMs: 5_000,
  run: async (_task, ctx) => {
    ctx.log("review awaiting captain");
    return { output: {} };
  },
};

export const marketingPipeline: PipelineConfig = {
  id: "marketing",
  description:
    "Daily content pipeline: KB scanner + signal analyzer + dedup discover candidates → captain approves one → per-platform fan-out → deterministic slop gate (3 retries) → captain final review. Six platforms: linkedin, x, instagram, facebook, reddit, blog.",
  backpressureCap: 5,
  // Approve once → fan out 25 generate tasks pending, rest paused_user.
  // Captain advances next batch via 'Resume next batch' on /tasks or /marketing.
  fanOutBatchSize: 25,
  cronSchedule: "0 11 * * *",
  phases: [discoveryPhase, generatePhase, slopCheckPhase, reviewPhase],
};
