import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const GH_MAX_BUFFER = 10 * 1024 * 1024;
const GH_DEFAULT_TIMEOUT_MS = 60_000;

async function gh(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: GH_MAX_BUFFER,
    timeout: GH_DEFAULT_TIMEOUT_MS,
    encoding: "utf-8",
  });
  return (stdout as string).trim();
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  stateReason: string | null;
  labels: { name: string }[];
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: { login: string } | null;
  pullRequestUrls: string[];
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  labels: { name: string }[];
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  headRefName: string;
  headRefOid: string;
}

export interface GitHubReviewComment {
  id: number;
  user: { login: string };
  body: string;
  path: string;
  line: number | null;
  diff_hunk: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubReview {
  id: number;
  user: { login: string };
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  submitted_at: string | null;
}

/** List open issues on a repo, optionally filtered by label. */
export async function listOpenIssues(repo: string, opts: { labels?: string[]; limit?: number } = {}): Promise<GitHubIssue[]> {
  const args = [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    String(opts.limit ?? 100),
    "--json",
    "number,title,body,state,stateReason,labels,url,createdAt,updatedAt,closedAt,author",
  ];
  if (opts.labels && opts.labels.length > 0) args.push("--label", opts.labels.join(","));
  const raw = await gh(args);
  const parsed = JSON.parse(raw) as Omit<GitHubIssue, "pullRequestUrls">[];
  return parsed.map((i) => ({ ...i, pullRequestUrls: [] }));
}

/** Get a single issue by number. */
export async function getIssue(repo: string, n: number): Promise<GitHubIssue | null> {
  try {
    const raw = await gh([
      "issue",
      "view",
      String(n),
      "--repo",
      repo,
      "--json",
      "number,title,body,state,stateReason,labels,url,createdAt,updatedAt,closedAt,author",
    ]);
    return { ...(JSON.parse(raw) as Omit<GitHubIssue, "pullRequestUrls">), pullRequestUrls: [] };
  } catch {
    return null;
  }
}

/** Apply labels to an issue (additive — does not remove existing labels). */
export async function labelIssue(repo: string, n: number, labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  await gh(["issue", "edit", String(n), "--repo", repo, "--add-label", labels.join(",")]);
}

/** Close an issue with an optional comment. */
export async function closeIssue(repo: string, n: number, comment?: string): Promise<void> {
  const args = ["issue", "close", String(n), "--repo", repo];
  if (comment) args.push("--comment", comment);
  await gh(args);
}

/** Add a comment to an issue. */
export async function commentOnIssue(repo: string, n: number, body: string): Promise<void> {
  await gh(["issue", "comment", String(n), "--repo", repo, "--body", body]);
}

/** List open PRs on the repo, optionally filtered by label. */
export async function listOpenPRs(repo: string, opts: { labels?: string[]; limit?: number } = {}): Promise<GitHubPR[]> {
  const args = [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    String(opts.limit ?? 100),
    "--json",
    "number,title,body,state,isDraft,labels,url,createdAt,updatedAt,mergedAt,headRefName,headRefOid",
  ];
  if (opts.labels && opts.labels.length > 0) args.push("--label", opts.labels.join(","));
  const raw = await gh(args);
  return JSON.parse(raw) as GitHubPR[];
}

/** Get a single PR. */
export async function getPR(repo: string, n: number): Promise<GitHubPR | null> {
  try {
    const raw = await gh([
      "pr",
      "view",
      String(n),
      "--repo",
      repo,
      "--json",
      "number,title,body,state,isDraft,labels,url,createdAt,updatedAt,mergedAt,headRefName,headRefOid",
    ]);
    return JSON.parse(raw) as GitHubPR;
  } catch {
    return null;
  }
}

export interface GitHubIssueComment {
  id: number;
  user: { login: string };
  body: string;
  created_at: string;
  updated_at: string;
}

/** Get comments on an ISSUE (distinct from PR review-line comments). */
export async function getIssueComments(repo: string, n: number): Promise<GitHubIssueComment[]> {
  const raw = await gh(["api", `repos/${repo}/issues/${n}/comments`, "--paginate"]);
  return JSON.parse(raw) as GitHubIssueComment[];
}

/** Get line-level review comments on a PR (gh api passthrough). */
export async function getPRComments(repo: string, n: number): Promise<GitHubReviewComment[]> {
  const raw = await gh(["api", `repos/${repo}/pulls/${n}/comments`, "--paginate"]);
  return JSON.parse(raw) as GitHubReviewComment[];
}

/** Get reviews on a PR (each review may include a body + state). */
export async function getPRReviews(repo: string, n: number): Promise<GitHubReview[]> {
  const raw = await gh(["api", `repos/${repo}/pulls/${n}/reviews`, "--paginate"]);
  return JSON.parse(raw) as GitHubReview[];
}

/** Return the patch (unified diff) for a PR. */
export async function prDiff(repo: string, n: number): Promise<string> {
  return await gh(["pr", "diff", String(n), "--repo", repo]);
}

/** Flip a PR's draft state. true = make draft, false = mark ready for review. */
export async function prDraft(repo: string, n: number, draft: boolean): Promise<void> {
  if (draft) {
    await gh(["pr", "ready", String(n), "--repo", repo, "--undo"]);
  } else {
    await gh(["pr", "ready", String(n), "--repo", repo]);
  }
}

/** Add a comment to a PR. */
export async function commentOnPR(repo: string, n: number, body: string): Promise<void> {
  await gh(["pr", "comment", String(n), "--repo", repo, "--body", body]);
}

export interface CreatePROpts {
  title: string;
  body: string;
  head: string;
  base?: string;
  draft?: boolean;
  labels?: string[];
  assignees?: string[];
  reviewers?: string[];
}

/** Create a PR. Returns the new PR URL. */
export async function createPR(repo: string, opts: CreatePROpts): Promise<string> {
  const args = [
    "pr",
    "create",
    "--repo",
    repo,
    "--title",
    opts.title,
    "--body",
    opts.body,
    "--head",
    opts.head,
    "--base",
    opts.base ?? "main",
  ];
  if (opts.draft) args.push("--draft");
  for (const l of opts.labels ?? []) args.push("--label", l);
  for (const a of opts.assignees ?? []) args.push("--assignee", a);
  for (const r of opts.reviewers ?? []) args.push("--reviewer", r);
  return await gh(args);
}

/** Detect whether an issue is in the "reopened" state. */
export function isReopened(issue: GitHubIssue): boolean {
  return issue.state === "open" && issue.stateReason === "reopened";
}

/** Convenience: check whether an issue carries a label by name. */
export function hasLabel(issue: GitHubIssue, name: string): boolean {
  return issue.labels.some((l) => l.name === name);
}
