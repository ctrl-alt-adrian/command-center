// RoleNext HTTP client. Auth is a Clerk JWT pasted into ROLENEXT_JWT —
// extract via `await window.Clerk.session.getToken()` in DevTools after logging
// in. Default-template tokens last ~60s; create a long-TTL JWT template in the
// Clerk dashboard and pass it: getToken({ template: "long-lived" }).

import type {
  RoleNextResume,
  SuggestedTitlesResponse,
  RoleNextAnalysisResult,
  SavedJobBody,
  SavedJobResponse,
  OptimizeResponse,
  BillingUsage,
} from "./types.ts";

const DEFAULT_BASE = "http://localhost:8080";
const DEFAULT_TIMEOUT_MS = 60_000;
// LLM endpoints (analyze, optimize, cover-letter) can take 30-60s each.
const LLM_TIMEOUT_MS = 5 * 60_000;

export class RoleNextAuthError extends Error {}
export class RoleNextRateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super(`rate limited; retry after ${retryAfterMs}ms`);
  }
}
export class RoleNextHttpError extends Error {
  constructor(public status: number, public body: string, public path: string) {
    super(`${path} → ${status}: ${body.slice(0, 200)}`);
  }
}

export interface ClientOptions {
  baseUrl?: string;
  jwt?: string;
}

export class RoleNextClient {
  private readonly baseUrl: string;
  private readonly jwt: string;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.ROLENEXT_API_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
    const jwt = opts.jwt ?? process.env.ROLENEXT_JWT ?? "";
    if (!jwt) {
      throw new RoleNextAuthError(
        "ROLENEXT_JWT not set. Get one by logging into rolenext, opening DevTools, and running `await window.Clerk.session.getToken()`.",
      );
    }
    this.jwt = jwt;
  }

  // --- Resumes ---

  async listResumes(): Promise<RoleNextResume[]> {
    return this.json<RoleNextResume[]>("GET", "/api/resumes");
  }

  async latestResume(): Promise<RoleNextResume> {
    const resumes = await this.listResumes();
    if (resumes.length === 0) {
      throw new Error("no resumes uploaded — upload one in rolenext Settings first");
    }
    // listResumes returns newest-first per backend; defensive sort anyway.
    return [...resumes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  async suggestedTitles(resumeId: number): Promise<SuggestedTitlesResponse> {
    return this.json<SuggestedTitlesResponse>("GET", `/api/resumes/${resumeId}/suggested-titles`);
  }

  // --- Search ---

  // analyze posts multipart and consumes SSE. Per-result events arrive as
  // `data: <AnalysisResult JSON>` lines (no `event:` prefix). Lifecycle events
  // (sources / source_progress / cached / source_counts) carry an `event:`
  // prefix and are ignored. Stream terminates with `event: done`.
  async analyze(params: {
    keyword: string;
    location?: string;
    remoteOnly?: boolean;
    employmentTypes?: string;
    resumeId?: number;
    page?: number;
  }): Promise<RoleNextAnalysisResult[]> {
    const form = new FormData();
    form.set("keyword", params.keyword);
    form.set("location", params.location ?? "");
    form.set("remoteOnly", params.remoteOnly ? "true" : "false");
    if (params.employmentTypes) form.set("employmentTypes", params.employmentTypes);
    if (params.resumeId !== undefined) form.set("resumeId", String(params.resumeId));
    if (params.page !== undefined) form.set("page", String(params.page));

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), LLM_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.jwt}` },
        body: form,
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401) throw new RoleNextAuthError("JWT rejected by rolenext (expired?)");
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? "5") * 1000;
      throw new RoleNextRateLimitError(retry);
    }
    if (!res.ok) {
      throw new RoleNextHttpError(res.status, await res.text(), "/api/analyze");
    }

    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("application/json")) {
      // Non-streaming fallback (test harness path).
      return (await res.json()) as RoleNextAnalysisResult[];
    }

    return await consumeAnalyzeSSE(res);
  }

  // --- Jobs ---

  async saveJob(body: SavedJobBody): Promise<SavedJobResponse> {
    return this.json<SavedJobResponse>("POST", "/api/jobs", body);
  }

  async optimizeResume(jobId: number): Promise<OptimizeResponse> {
    return this.json<OptimizeResponse>("POST", `/api/jobs/${jobId}/optimize`, undefined, {
      timeoutMs: LLM_TIMEOUT_MS,
    });
  }

  async generateCoverLetter(jobId: number): Promise<unknown> {
    return this.json<unknown>("POST", `/api/jobs/${jobId}/cover-letter`, undefined, {
      timeoutMs: LLM_TIMEOUT_MS,
    });
  }

  async downloadResume(jobId: number): Promise<Buffer> {
    return this.binary(`/api/jobs/${jobId}/download`);
  }

  async downloadCoverLetter(jobId: number): Promise<Buffer> {
    return this.binary(`/api/jobs/${jobId}/cover-letter/download`);
  }

  async patchJob(jobId: number, patch: Partial<SavedJobBody>): Promise<SavedJobResponse> {
    return this.json<SavedJobResponse>("PATCH", `/api/jobs/${jobId}`, patch);
  }

  async billingUsage(feature: "optimize" | "interview" | "analyze"): Promise<BillingUsage> {
    return this.json<BillingUsage>("GET", `/api/billing/usage/${feature}`);
  }

  // --- Internals ---

  private async json<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { timeoutMs?: number } = {},
  ): Promise<T> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.jwt}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401) throw new RoleNextAuthError(`JWT rejected by rolenext (expired?) on ${path}`);
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? "5") * 1000;
      throw new RoleNextRateLimitError(retry);
    }
    if (!res.ok) throw new RoleNextHttpError(res.status, await res.text(), path);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async binary(path: string): Promise<Buffer> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.jwt}` },
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new RoleNextHttpError(res.status, await res.text(), path);
    return Buffer.from(await res.arrayBuffer());
  }
}

// SSE parser tuned to /api/analyze. Per backend/sse.go: events are separated
// by blank lines; each event has zero-or-more `event: <name>` and one or more
// `data: <json>` lines. Per-result events have NO event line (default "message"
// per spec) — those are AnalysisResults. Lifecycle events have `event:` set.
// Terminator: `event: done`.
async function consumeAnalyzeSSE(res: Response): Promise<RoleNextAnalysisResult[]> {
  if (!res.body) throw new Error("/api/analyze returned no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const results: RoleNextAnalysisResult[] = [];
  let buf = "";

  const flushEvent = (raw: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;
    if (event === "done") return;
    if (event !== "message") return; // sources / cached / source_progress etc.
    try {
      const parsed = JSON.parse(dataLines.join("\n")) as RoleNextAnalysisResult;
      if (parsed?.job?.url) results.push(parsed);
    } catch {
      // Malformed event — skip rather than abort the whole search.
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      flushEvent(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
    }
  }
  if (buf.trim()) flushEvent(buf);
  return results;
}
