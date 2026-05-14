import type { DraftStatus } from "./types.ts";

export const PLATFORMS = ["linkedin", "x", "instagram", "facebook", "reddit", "blog"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn", x: "X", instagram: "Instagram", facebook: "Facebook", reddit: "Reddit", blog: "Blog",
};

export const DRAFT_STATUS_COLORS: Record<DraftStatus, string> = {
  draft: "bg-yellow-400 text-yellow-950",
  "slop-checked": "bg-orange-400 text-orange-950",
  reviewed: "bg-blue-400 text-blue-950",
  posted: "bg-green-400 text-green-950",
};

export const TASK_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  running: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  "needs-review": "bg-orange-400/10 text-orange-400 border-orange-400/20",
  completed: "bg-green-400/10 text-green-400 border-green-400/20",
  failed: "bg-red-400/10 text-red-400 border-red-400/20",
};

export const ALL_STAGES = ["discover", "generate", "slop-check", "review"] as const;

export const STAGE_LABELS: Record<string, string> = {
  discover: "Discover", generate: "Generate", "slop-check": "Slop Check", review: "Review",
};

export const STAGE_DESCRIPTIONS: Record<string, string> = {
  discover: "Scan KB + signals for content-worthy topics",
  generate: "Write platform drafts (LinkedIn, X, Instagram)",
  "slop-check": "Detect and fix AI writing patterns",
  review: "Final human review before publishing",
};

// Pipeline configuration
export const CLAUDE_TIMEOUT_MS = 180_000;
export const CLAUDE_MAX_BUFFER = 1024 * 1024;
export const MAX_SLOP_RETRIES = 3;
// Per-stage worker timeouts. Each runWithRetry attempt is bounded by these.
// Generate makes parallel Claude calls per platform (each capped by CLAUDE_TIMEOUT_MS=2min).
// Discover runs KB scanner + signal analyzer sequentially (each ~2min max).
// Slop-check is pure regex — should complete in ms.
export const STAGE_TIMEOUTS_MS: Record<"discover" | "generate" | "slop-check", number> = {
  discover: 5 * 60 * 1000,
  generate: 4 * 60 * 1000,
  "slop-check": 30 * 1000,
};
export const META_DUPLICATE_THRESHOLD = 0.4;
export const BODY_DUPLICATE_THRESHOLD = 0.35;
export const SLUG_MAX_LENGTH = 50;
export const AUTOMATED_STAGES = ["discover", "generate", "slop-check"] as const;

// Scoring weights
export const SCORE_WEIGHTS: Record<string, number> = {
  audienceRelevance: 0.30,
  uniqueness: 0.25,
  hookStrength: 0.20,
  timeliness: 0.15,
  personalRelevance: 0.10,
};
