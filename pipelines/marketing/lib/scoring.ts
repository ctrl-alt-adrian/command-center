import type {
  CandidateScores,
  ScoredCandidate,
  SignalSnapshot,
} from "./types.ts";
import type { ContentCandidate } from "./generate.ts";
import type { DedupResult } from "./dedup.ts";
import { SCORE_WEIGHTS } from "./constants.ts";

const WEIGHTS = SCORE_WEIGHTS as Record<keyof CandidateScores, number>;

function candidateText(candidate: ContentCandidate): string {
  return `${candidate.hook} ${candidate.angle} ${candidate.tags.join(" ")}`.toLowerCase();
}

// Keywords that signal audience relevance for Adrian's rolenext audience
const AUDIENCE_KEYWORDS = [
  "interview", "hiring", "career", "react", "typescript", "testing",
  "vitest", "next", "nextjs", "frontend", "fullstack", "prep",
  "resume", "job", "coding", "algorithm", "system design", "behavioral",
  "developer", "engineer", "tech", "startup", "founder", "building",
];

function scoreAudienceRelevance(candidate: ContentCandidate): number {
  const text = candidateText(candidate);
  const matches = AUDIENCE_KEYWORDS.filter((kw) => text.includes(kw));
  // Marketing posts about the product score higher
  const typeBonus = candidate.type === "marketing" ? 0.1 : 0;
  return Math.min(1, matches.length * 0.15 + typeBonus);
}

function scoreUniqueness(
  candidate: ContentCandidate,
  dedupMap: Map<string, DedupResult>
): number {
  const result = dedupMap.get(candidate.id);
  if (!result) return 1;
  return Math.max(0, 1 - result.similarity * 2);
}

function scoreHookStrength(candidate: ContentCandidate): number {
  const hook = candidate.hook;
  let score = 0.5;

  // Short, punchy hooks score higher
  if (hook.length <= 60) score += 0.15;
  else if (hook.length <= 80) score += 0.05;

  // Hooks with numbers/specifics score higher
  if (/\d/.test(hook)) score += 0.1;

  // Hooks with contrast words score higher
  if (/\b(but|instead|not|wrong|actually|myth|stop|never|why)\b/i.test(hook)) {
    score += 0.15;
  }

  // Question hooks score well
  if (hook.endsWith("?")) score += 0.1;

  return Math.min(1, score);
}

function scoreTimeliness(
  candidate: ContentCandidate,
  signals: SignalSnapshot | null
): number {
  if (!signals || signals.signals.length === 0) return 0.5;

  const text = candidateText(candidate);
  const candidateWords = new Set(
    text.split(/\s+/).filter((w) => w.length > 3)
  );

  let maxOverlap = 0;
  for (const signal of signals.signals) {
    const signalText = `${signal.title} ${signal.description ?? ""} ${(signal.tags ?? []).join(" ")}`.toLowerCase();
    const signalWords = signalText.split(/\s+/).filter((w) => w.length > 3);
    let overlap = 0;
    for (const w of signalWords) {
      if (candidateWords.has(w)) overlap++;
    }
    const score = signalWords.length > 0 ? overlap / signalWords.length : 0;
    if (score > maxOverlap) maxOverlap = score;
  }

  return Math.min(1, 0.3 + maxOverlap * 2);
}

function scorePersonalRelevance(candidate: ContentCandidate): number {
  const text = `${candidate.hook} ${candidate.angle}`.toLowerCase();
  let score = 0.5;

  // Content about rolenext or interview prep is highly personal
  if (/rolenext|interview.?prep/i.test(text)) score += 0.3;

  // Building in public / founder story
  if (/build|founder|ship|launch|decision/i.test(text)) score += 0.15;

  // Tags that match Adrian's stack
  const personalTags = ["react", "nextjs", "typescript", "vitest", "testing"];
  const tagOverlap = candidate.tags.filter((t) =>
    personalTags.includes(t.toLowerCase())
  ).length;
  score += tagOverlap * 0.05;

  return Math.min(1, score);
}

export function scoreCandidates(
  candidates: ContentCandidate[],
  dedupResults: DedupResult[],
  signals: SignalSnapshot | null
): ScoredCandidate[] {
  const dedupMap = new Map(dedupResults.map(r => [r.candidate.id, r]));

  const scored = candidates.map((candidate) => {
    const dedupResult = dedupMap.get(candidate.id);

    const scores: CandidateScores = {
      audienceRelevance: Math.round(scoreAudienceRelevance(candidate) * 100) / 100,
      uniqueness: Math.round(scoreUniqueness(candidate, dedupMap) * 100) / 100,
      hookStrength: Math.round(scoreHookStrength(candidate) * 100) / 100,
      timeliness: Math.round(scoreTimeliness(candidate, signals) * 100) / 100,
      personalRelevance: Math.round(scorePersonalRelevance(candidate) * 100) / 100,
    };

    const totalScore = Math.round(
      Object.entries(scores).reduce(
        (sum, [key, val]) => sum + val * WEIGHTS[key as keyof CandidateScores],
        0
      ) * 100
    ) / 100;

    return {
      ...candidate,
      scores,
      totalScore,
      rank: 0,
      duplicateOf: dedupResult?.isDuplicate ? dedupResult.duplicateOf : undefined,
    } satisfies ScoredCandidate;
  });

  // Sort by score descending, assign ranks
  scored.sort((a, b) => b.totalScore - a.totalScore);
  scored.forEach((c, i) => (c.rank = i + 1));

  return scored;
}
