import type { PipelineConfig, PhaseConfig, Task, PhaseContext } from "../../core/lib/types.ts";
import { discoverContent, discoverFromCandidates, generateDrafts, type ContentCandidate } from "./lib/generate.ts";
import { getKBEntries, getKBEntry, markUsedForContent } from "./lib/kb.ts";
import { runRules } from "../../core/lib/slop.ts";
import { MARKETING_SLOP_PACK, loadMarketingSlopPack } from "./lib/slop-loader.ts";
import { getDraftSet, updateDraftStatus, deleteDraftPlatform } from "./lib/drafts.ts";
import { getPlatformConfig } from "./lib/config.ts";
import { STAGE_TIMEOUTS_MS, MAX_SLOP_RETRIES } from "./lib/constants.ts";
import type { ScoredCandidate } from "./lib/types.ts";

// Single-flight: concurrent first-callers share one load instead of racing
// each other into a duplicate registerSlopPack().
let slopBootstrap: Promise<void> | null = null;
async function ensureSlopLoaded() {
  if (!slopBootstrap) slopBootstrap = loadMarketingSlopPack();
  await slopBootstrap;
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
    // gateRetryFeedback is set by the processor when a deterministic gate
    // (slop-check) fails and the task is rewound to this phase. The string
    // contains the formatted violations the gate caught, fed back so Claude
    // can avoid them on the next attempt.
    const gateRetryFeedback = (task.input.gateRetryFeedback as string) ?? "";
    const existingDir = task.input.draftDir as string | undefined;

    const topic = candidate.hook || candidate.angle || candidate.id;
    const augmentedKbContext = gateRetryFeedback ? `${kbContext}\n\nPRIOR SLOP VIOLATIONS — avoid these:\n${gateRetryFeedback}` : kbContext;

    ctx.log("generate fanning out", { topic, hasFeedback: !!gateRetryFeedback, existingDir });
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
    // Only consider currently-enabled platforms. A platform that was disabled
    // after generate ran shouldn't gate the task — and shouldn't be treated
    // as publishable output either. The retry path in generate already
    // unlinks stale .md files, so this is belt-and-suspenders.
    const { enabled } = await getPlatformConfig();
    const enabledSet = new Set<string>(enabled);

    const violations: Array<{ platform: string; rule: string; line: number; excerpt: string }> = [];
    for (const [platform, draft] of Object.entries(set.platforms)) {
      if (!enabledSet.has(platform)) continue;
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
  // When slop-check exhausts its retry budget, delete every platform draft
  // that still has fail-severity violations. Drafts that already passed are
  // kept (status `slop-checked`). The captain must then rerun the gate
  // (which triggers a fresh generate via the retry path) or reject the task.
  onExhausted: async (task) => {
    const draftDir = task.input.draftDir as string | undefined;
    if (!draftDir) return;
    const set = await getDraftSet(draftDir);
    if (!set) return;
    const { enabled } = await getPlatformConfig();
    const enabledSet = new Set<string>(enabled);
    await Promise.all(
      Object.entries(set.platforms).map(async ([platform, draft]) => {
        // Drafts for disabled platforms get deleted unconditionally — they
        // shouldn't be sitting on disk regardless of slop. For enabled ones,
        // delete only if they still have fail-severity violations.
        if (!enabledSet.has(platform)) {
          await deleteDraftPlatform(draftDir, platform);
          return;
        }
        const result = runRules(draft.content, MARKETING_SLOP_PACK);
        const hasFailViolation = !result.pass && result.violations.some((v) => v.severity === "fail");
        if (hasFailViolation) {
          await deleteDraftPlatform(draftDir, platform);
        }
      }),
    );
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
  // Marketing gets its own per-tick budget so it doesn't share the global
  // 10-slot pool with every other pipeline. Combined with parallel dispatch
  // in core/lib/processor.ts, this lets the fan-out drain quickly.
  perTickCap: 25,
  // Approve once → fan out 50 generate tasks pending, rest paused_user.
  // Captain advances next batch via 'Resume next batch' on /tasks or /marketing.
  fanOutBatchSize: 50,
  cronSchedule: "0 11 * * *",
  phases: [discoveryPhase, generatePhase, slopCheckPhase, reviewPhase],
};
