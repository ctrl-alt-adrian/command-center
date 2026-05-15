import { error } from "@sveltejs/kit";
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { getTask } from "../../../../../../core/lib/tasks.ts";
import { phaseDir } from "../../../../../../core/lib/paths.ts";
import { readJsonOrNull } from "../../../../../../core/lib/io.ts";

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

async function readPhaseSlice(taskId: string, phaseId: string): Promise<PhaseSlice> {
  const dir = phaseDir(taskId, phaseId);
  let dirents: import("fs").Dirent[];
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { phaseId, exists: false, artifacts: [], outputJson: null, log: null };
  }
  const fileEntries = dirents.filter((d) => d.isFile());
  const [stats, outputJson, log] = await Promise.all([
    Promise.all(
      fileEntries.map((d) =>
        fs.stat(path.join(dir, d.name)).then(
          (s) => ({ name: d.name, size: s.size }),
          () => ({ name: d.name, size: 0 }),
        ),
      ),
    ),
    readJsonOrNull(path.join(dir, "meta.json")),
    fs.readFile(path.join(dir, "make-ci.log"), "utf-8").catch(() => null),
  ]);
  return { phaseId, exists: true, artifacts: stats, outputJson, log };
}

export async function load({ params }) {
  const task = await getTask(params.taskId);
  if (!task) throw error(404, `task not found: ${params.taskId}`);
  if (task.pipelineId !== PIPELINE_ID) {
    throw error(400, `task ${params.taskId} is not in ${PIPELINE_ID}`);
  }

  const phaseSlices = await Promise.all(PHASE_ORDER.map((ph) => readPhaseSlice(task.id, ph)));

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

  const failingAttempts = (task.attempts ?? []).filter(
    (a) => a.outcome === "error" || a.outcome === "gate_fail",
  );

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
    failingAttempts,
  };
}
