import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { listTasksByPipeline } from "../../../../../core/lib/tasks.ts";
import { COMMAND_CENTER_ROOT } from "../../../../../core/lib/paths.ts";
import { parseFrontmatter } from "../../../../../core/lib/vault.ts";
import type { Task } from "../../../../../core/lib/types.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG } from "../../../../../pipelines/rolenext/bug-resolver/pipeline.config.ts";
import { extractFailures } from "$lib/failures";

const INCIDENTS_DIR = path.join(COMMAND_CENTER_ROOT, "vault", "incidents");
const PIPELINE_ID = "rolenext-bug-resolver";

marked.setOptions({ gfm: true, breaks: false });

interface FrontmatterRecord {
  type?: string;
  issueNumber?: number;
  prNumber?: number | null;
  date?: string;
  status?: "resolved" | "escalated" | "cannot-reproduce";
  botAttempt?: number;
  featureArea?: string;
  rootCauseClass?: string;
  filesTouched?: number;
  linesChanged?: number;
  durationMinutes?: number;
  fixRetryCount?: number;
  specsReferenced?: string[];
  ciStatus?: "passed" | "failed" | "skipped";
  tags?: string[];
}

export interface IncidentSummary {
  slug: string;
  dir: string;
  postMortemPath: string;
  meta: FrontmatterRecord;
}

async function loadIncidents(): Promise<IncidentSummary[]> {
  const entries = await fs.readdir(INCIDENTS_DIR, { withFileTypes: true }).catch(() => []);
  const dirs = entries.filter((e) => e.isDirectory());
  const loaded = await Promise.all(
    dirs.map(async (e) => {
      const pmPath = path.join(INCIDENTS_DIR, e.name, "post-mortem.md");
      const raw = await fs.readFile(pmPath, "utf-8").catch(() => null);
      if (!raw) return null;
      const { meta } = parseFrontmatter(raw);
      if ((meta as FrontmatterRecord).type !== "incident") return null;
      return {
        slug: e.name,
        dir: path.join(INCIDENTS_DIR, e.name),
        postMortemPath: pmPath,
        meta: meta as FrontmatterRecord,
      } satisfies IncidentSummary;
    }),
  );
  const incidents = loaded.filter((i): i is IncidentSummary => i !== null);
  // Sort by date descending.
  incidents.sort((a, b) => (b.meta.date ?? "").localeCompare(a.meta.date ?? ""));
  return incidents;
}

export interface QueueRow {
  id: string;
  phaseId: string;
  status: string;
  issueNumber: number | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  gateFailReason: string | null;
  prUrl: string | null;
}

export async function load() {
  const tasks = await listTasksByPipeline(PIPELINE_ID);

  const queue: QueueRow[] = tasks
    .filter((t: Task) => t.status !== "completed" && t.status !== "failed" && t.status !== "cleared_stale")
    .map((t: Task) => ({
      id: t.id,
      phaseId: t.phaseId,
      status: t.status,
      issueNumber: (t.input as { issueNumber?: number }).issueNumber ?? null,
      attempt: (t.input as { attempt?: number }).attempt ?? 1,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      gateFailReason: t.gateFailReason ?? null,
      prUrl: (t.output as { prUrl?: string } | undefined)?.prUrl ?? null,
    }))
    .sort((a: QueueRow, b: QueueRow) => b.updatedAt.localeCompare(a.updatedAt));

  // Recent PRs: scrape from tasks that produced one.
  interface PrRow {
    taskId: string;
    issueNumber: number | null;
    prUrl: string;
    status: string;
    updatedAt: string;
  }
  const recentPRs: PrRow[] = [];
  for (const t of tasks) {
    const prUrl = (t.output as { prUrl?: string } | undefined)?.prUrl;
    if (!prUrl) continue;
    recentPRs.push({
      taskId: t.id,
      issueNumber: (t.input as { issueNumber?: number }).issueNumber ?? null,
      prUrl,
      status: t.status,
      updatedAt: t.updatedAt,
    });
  }
  recentPRs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  recentPRs.splice(20);

  const incidents = await loadIncidents();

  // Pre-render each post-mortem's body (sans frontmatter) into sanitized HTML
  // so the dashboard can flip cards open without an extra fetch.
  const incidentCards = await Promise.all(
    incidents.map(async (i) => {
      const raw = await fs.readFile(i.postMortemPath, "utf-8").catch(() => "");
      const { body } = parseFrontmatter(raw);
      const html = DOMPurify.sanitize(await marked.parse(body));
      return {
        slug: i.slug,
        meta: i.meta,
        bodyHtml: html,
      };
    }),
  );

  const failures = extractFailures(tasks);

  return {
    pipelineId: PIPELINE_ID,
    config: {
      repo: ROLENEXT_BUG_RESOLVER_CONFIG.repo,
      enableBrowserRepro: ROLENEXT_BUG_RESOLVER_CONFIG.enableBrowserRepro,
      caps: ROLENEXT_BUG_RESOLVER_CONFIG.caps,
    },
    queue,
    recentPRs,
    incidents: incidentCards,
    failures,
  };
}
