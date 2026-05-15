import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import type { Candidate } from "../lib/types.ts";

const DEFAULT_LIMIT = 50;

export async function runSelect(task: Task, ctx: PhaseContext): Promise<PhaseOutput> {
  const candidatesPath = (task.input.candidatesPath as string | undefined)
    ?? (task.output?.candidatesPath as string | undefined);
  if (!candidatesPath) throw new Error("select: previous phase did not emit candidatesPath");

  const raw = await readFile(candidatesPath, "utf-8");
  const all = JSON.parse(raw) as Candidate[];

  const limit = (task.input.applyLimit as number | undefined) ?? DEFAULT_LIMIT;
  const picked = all.slice(0, limit);

  const reviewPath = path.join(ctx.outputDir, "review.md");
  await writeFile(reviewPath, renderReview(picked, all.length, limit), "utf-8");

  const pickedPath = path.join(ctx.outputDir, "selected.json");
  await writeFile(pickedPath, JSON.stringify(picked, null, 2), "utf-8");

  return {
    output: {
      selectedCount: picked.length,
      poolSize: all.length,
      pickedPath,
    },
  };
}

export async function fanOutSelect(task: Task): Promise<Array<Record<string, unknown>>> {
  const pickedPath = task.output?.pickedPath as string | undefined;
  if (!pickedPath) return [];
  const picked = JSON.parse(await readFile(pickedPath, "utf-8")) as Candidate[];
  const resumeId = task.input.resumeId as number | undefined;
  return picked.map((c) => ({
    candidate: c,
    resumeId,
  }));
}

function renderReview(picked: Candidate[], poolSize: number, limit: number): string {
  const lines: string[] = [];
  lines.push(`# Select — ${picked.length} of ${poolSize} candidates queued`);
  lines.push("");
  lines.push(
    `Approving this task fans out ${picked.length} prep tasks (one per job). Each calls optimize + cover-letter, which spend optimize budget. Reject to abort.`,
  );
  lines.push("");
  lines.push(`Limit applied: ${limit}.`);
  lines.push("");
  lines.push("## Queued jobs");
  for (const [i, c] of picked.entries()) {
    const score = c.result.opportunityScore ?? c.result.matchScore;
    const remote = c.result.job.isRemote ? " · remote" : "";
    const type = c.result.job.employmentTypeText ? ` · ${c.result.job.employmentTypeText}` : "";
    lines.push(`${i + 1}. **${c.result.job.title}** — ${c.result.job.company} (score ${score}${remote}${type})`);
    lines.push(`   - keyword: \`${c.searchKeyword}\``);
    lines.push(`   - ${c.result.job.url}`);
  }
  return lines.join("\n");
}
