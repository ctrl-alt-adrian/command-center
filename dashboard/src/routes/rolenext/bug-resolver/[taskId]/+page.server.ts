import { error } from "@sveltejs/kit";
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { getTask } from "../../../../../../core/lib/tasks.ts";
import { phaseDir } from "../../../../../../core/lib/paths.ts";

marked.setOptions({ gfm: true, breaks: false });

const PIPELINE_ID = "rolenext-bug-resolver";
const PHASE_ORDER = [
  "poll-issues",
  "triage",
  "write-handoff",
  "fix",
  "verify",
  "pr",
  "post-mortem",
];

interface PhaseSlice {
  phaseId: string;
  exists: boolean;
  artifacts: { name: string; size: number }[];
  outputJson: unknown | null;
  log: string | null;
}

async function readJsonOrNull(p: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

async function readPhaseSlice(taskId: string, phaseId: string): Promise<PhaseSlice> {
  const dir = phaseDir(taskId, phaseId);
  let entries: { name: string; size: number }[] = [];
  let outputJson: unknown | null = null;
  let log: string | null = null;
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const d of dirents) {
      if (!d.isFile()) continue;
      const full = path.join(dir, d.name);
      const stat = await fs.stat(full).catch(() => null);
      entries.push({ name: d.name, size: stat?.size ?? 0 });
    }
  } catch {
    return { phaseId, exists: false, artifacts: [], outputJson: null, log: null };
  }
  // Try to surface the meta.json (the structured phase output the processor writes).
  outputJson = await readJsonOrNull(path.join(dir, "meta.json"));
  // Surface make-ci.log if present.
  try {
    log = await fs.readFile(path.join(dir, "make-ci.log"), "utf-8");
  } catch {
    log = null;
  }
  return { phaseId, exists: true, artifacts: entries, outputJson, log };
}

export async function load({ params }) {
  const task = await getTask(params.taskId);
  if (!task) throw error(404, `task not found: ${params.taskId}`);
  if (task.pipelineId !== PIPELINE_ID) {
    throw error(400, `task ${params.taskId} is not in ${PIPELINE_ID}`);
  }

  const phaseSlices: PhaseSlice[] = [];
  for (const ph of PHASE_ORDER) {
    phaseSlices.push(await readPhaseSlice(task.id, ph));
  }

  // Render handoff.md (if present) to HTML for inline display.
  let handoffHtml: string | null = null;
  const handoffPath = path.join(phaseDir(task.id, "write-handoff"), "handoff.md");
  try {
    const raw = await fs.readFile(handoffPath, "utf-8");
    handoffHtml = DOMPurify.sanitize(await marked.parse(raw));
  } catch {
    handoffHtml = null;
  }

  // Pull derived state for the detail header.
  const issueNumber = (task.input as { issueNumber?: number }).issueNumber ?? null;
  const issueTitle = (task.input as { issueTitle?: string }).issueTitle ?? "";
  const issueUrl = (task.input as { issueUrl?: string }).issueUrl ?? null;
  const attempt = (task.input as { attempt?: number }).attempt ?? 1;
  const prUrl = (task.output as { prUrl?: string } | undefined)?.prUrl ?? null;
  const prNumber = prUrl ? Number(prUrl.match(/\/pull\/(\d+)/)?.[1] ?? 0) || null : null;

  return {
    task,
    phaseSlices,
    handoffHtml,
    issueNumber,
    issueTitle,
    issueUrl,
    attempt,
    prUrl,
    prNumber,
    pipelineId: PIPELINE_ID,
  };
}
