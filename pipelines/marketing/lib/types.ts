export interface KBEntry {
  id: string;
  filename: string;
  date: string;
  project: string;
  summary: string;
  tags: string[];
  contentAngles: string[];
  shareworthy: boolean;
  usedForContent: boolean;
  body: string;
  // Populated by Parse KB / discoverContent — absent on unanalyzed entries
  contentWorthy?: boolean;
  contentType?: "technical" | "marketing";
  hook?: string;
  angle?: string;
  analyzedAt?: string;
}

export interface DraftSet {
  date: string;
  title?: string;
  createdDate?: string;
  platforms: Record<string, Draft>;
  possibleDuplicateOf?: string;
  bodyDupSimilarity?: number;
}

export interface Draft {
  platform: string;
  content: string;
  status: DraftStatus;
}

export type DraftStatus = "draft" | "slop-checked" | "reviewed" | "posted";

export interface SlopViolation {
  severity: "warn" | "fail";
  rule: string;
  line: number;
  content: string;
}

export interface SlopResult {
  pass: boolean;
  violations: SlopViolation[];
}

export interface PipelineStats {
  kb: { total: number; recent: number };
  drafts: { total: number; pending: number; posted: number };
}

// Task / status / stage orchestration types now live in core/lib/types.
// Marketing imports core.Task etc. directly. Marketing-specific types continue below.

// --- External Signals ---

export interface Signal {
  source: "github-trending" | "hackernews" | "devto";
  title: string;
  url?: string;
  description?: string;
  score?: number;
  tags?: string[];
}

export interface SignalSnapshot {
  date: string;
  fetchedAt: string;
  signals: Signal[];
}

// --- Candidate Scoring ---

export interface ScoredCandidate {
  id: string;
  type: "technical" | "marketing";
  hook: string;
  angle: string;
  tags: string[];
  scores: CandidateScores;
  totalScore: number;
  rank: number;
  duplicateOf?: string;
}

export interface CandidateScores {
  audienceRelevance: number;
  uniqueness: number;
  hookStrength: number;
  timeliness: number;
  personalRelevance: number;
}

// --- Discovery Summary ---

export interface DiscoverySummary {
  totalEntries: number;
  scannedEntries: number;
  shareworthyCount: number;
  candidatesFound: number;
  signalsUsed: number;
  duplicatesFiltered: number;
}
