import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { listTasksByPipeline } from "../../../../../core/lib/tasks.ts";
import type { Task } from "../../../../../core/lib/types.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG } from "../../../../../pipelines/rolenext/bug-resolver/pipeline.config.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// dashboard/src/routes/rolenext/bug-resolver/+page.server.ts → command-center/
const COMMAND_CENTER_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
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

function parseFrontmatter(raw: string): { meta: FrontmatterRecord; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const meta: Record<string, unknown> = {};
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const valueRaw = line.slice(colon + 1).trim();
    if (valueRaw === "null") meta[key] = null;
    else if (valueRaw.startsWith("[") && valueRaw.endsWith("]")) {
      const inner = valueRaw.slice(1, -1).trim();
      meta[key] = inner.length === 0
        ? []
        : inner.split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1"));
    } else if (/^-?\d+$/.test(valueRaw)) meta[key] = parseInt(valueRaw, 10);
    else meta[key] = valueRaw.replace(/^"(.*)"$/, "$1");
  }
  return { meta: meta as FrontmatterRecord, body };
}

async function loadIncidents(): Promise<IncidentSummary[]> {
  const entries = await fs.readdir(INCIDENTS_DIR, { withFileTypes: true }).catch(() => []);
  const incidents: IncidentSummary[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const pmPath = path.join(INCIDENTS_DIR, e.name, "post-mortem.md");
    const raw = await fs.readFile(pmPath, "utf-8").catch(() => null);
    if (!raw) continue;
    const { meta } = parseFrontmatter(raw);
    if (meta.type !== "incident") continue;
    incidents.push({
      slug: e.name,
      dir: path.join(INCIDENTS_DIR, e.name),
      postMortemPath: pmPath,
      meta,
    });
  }
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
  };
}
