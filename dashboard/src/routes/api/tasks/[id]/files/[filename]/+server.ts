import { error } from "@sveltejs/kit";
import fs from "node:fs/promises";
import path from "node:path";
import { taskDir } from "../../../../../../../../core/lib/paths.ts";
import { getTask } from "../../../../../../../../core/lib/tasks.ts";

// Serves files written by phase.run() to a task's output dirs. The taskId +
// phaseId scoping keeps this from being a directory traversal foothold —
// callers can only fetch files from <taskDir>/<phaseId>/<filename> for a
// known task and a phase that actually exists in the task's pipeline.
const ALLOWED_FILES = new Set(["resume.pdf", "cover.pdf", "apply.md", "candidates.md", "review.md", "applied.md"]);

const CONTENT_TYPE: Record<string, string> = {
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET({ params, url }) {
  const { id, filename } = params;
  if (!ALLOWED_FILES.has(filename)) {
    throw error(404, `file not allowed: ${filename}`);
  }
  const phaseId = url.searchParams.get("phase");
  if (!phaseId || !/^[a-z0-9-]+$/i.test(phaseId)) {
    throw error(400, "phase query param required (e.g. ?phase=prep)");
  }

  const task = await getTask(id);
  if (!task) throw error(404, `task ${id} not found`);

  const filePath = path.join(taskDir(id), phaseId, filename);

  // Defensive: confirm the resolved path is still under the task dir.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(taskDir(id)) + path.sep)) {
    throw error(400, "invalid file path");
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(resolved);
  } catch {
    throw error(404, `file not found: ${filename}`);
  }

  const ext = path.extname(filename).toLowerCase();
  const headers = new Headers({
    "content-type": CONTENT_TYPE[ext] ?? "application/octet-stream",
  });
  if (url.searchParams.get("download") === "1") {
    headers.set("content-disposition", `attachment; filename="${filename}"`);
  }
  return new Response(new Uint8Array(buf), { headers });
}
