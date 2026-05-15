// Mirror of the rolenext types we touch. Kept narrow on purpose — only the
// fields this pipeline reads. Source: backend/models/models.go +
// backend/db/types.go.

export interface RoleNextJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  employmentTypeText?: string;
  postedAt?: string;
  publisher?: string;
  isRemote?: boolean;
  source?: string;
}

export interface RoleNextSkillGap {
  skill: string;
  displayName?: string;
  explanation: string;
  learnable?: boolean;
  category?: string;
  disqualifier?: boolean;
  possiblyUnsurfaced?: boolean;
}

export interface RoleNextAnalysisResult {
  job: RoleNextJob;
  matchScore: number;
  missingSkills: RoleNextSkillGap[];
  domain?: string;
  roleFamily?: string;
  retrievalScore?: number;
  retrievalBucket?: string;
  opportunityScore?: number;
  candidateFit?: unknown;
}

export interface RoleNextResume {
  id: number;
  filename: string;
  analysisStatus: "pending" | "analyzing" | "ready" | "failed";
  createdAt: string;
}

export interface SuggestedTitle {
  title: string;
  reason?: string;
}

export interface SuggestedTitlesResponse {
  suggestions: SuggestedTitle[];
}

export interface SavedJobBody {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salaryMin?: number;
  salaryMax?: number;
  matchScore?: number;
  missingSkills?: RoleNextSkillGap[];
  status?: "saved" | "applied" | "interview" | "offer" | "rejected" | "accepted";
  isRemote?: boolean;
  resumeId?: number;
  publisher?: string;
  postedAt?: string;
  employmentTypeText?: string;
  candidateFit?: unknown;
}

export interface SavedJobResponse extends SavedJobBody {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface OptimizeResponse {
  optimizedResume: string;
  changeRationale?: unknown;
  unresolvedGaps?: unknown;
}

export interface BillingUsage {
  feature: string;
  used: number;
  limit: number;
}

// Candidate is the discover phase's output row — one per deduped job, ranked.
export interface Candidate {
  searchKeyword: string;
  result: RoleNextAnalysisResult;
}
