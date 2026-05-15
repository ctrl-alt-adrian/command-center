import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { GateCheckResult, PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { RoleNextClient, RoleNextRateLimitError } from "../lib/api-client.ts";
import type { Candidate, SavedJobBody } from "../lib/types.ts";

export async function runPrep(task: Task, ctx: PhaseContext): Promise<PhaseOutput> {
  const candidate = task.input.candidate as Candidate | undefined;
  if (!candidate) throw new Error("prep: missing candidate input");

  const resumeId = task.input.resumeId as number | undefined;
  const client = new RoleNextClient();

  // 1. Save
  const body = toSaveBody(candidate, resumeId);
  ctx.log("prep: save", { title: body.title, company: body.company });
  const saved = await retryOnRateLimit(() => client.saveJob(body), ctx);
  ctx.log("prep: saved", { jobId: saved.id });

  // 2. Optimize
  ctx.log("prep: optimize start");
  const optimize = await retryOnRateLimit(() => client.optimizeResume(saved.id), ctx);
  ctx.log("prep: optimize done", { resumeChars: optimize.optimizedResume?.length ?? 0 });

  // 3. Cover letter
  ctx.log("prep: cover-letter start");
  await retryOnRateLimit(() => client.generateCoverLetter(saved.id), ctx);
  ctx.log("prep: cover-letter done");

  // 4. Download both PDFs
  const [resumePdf, coverPdf] = await Promise.all([
    retryOnRateLimit(() => client.downloadResume(saved.id), ctx),
    retryOnRateLimit(() => client.downloadCoverLetter(saved.id), ctx),
  ]);

  const resumePath = path.join(ctx.outputDir, "resume.pdf");
  const coverPath = path.join(ctx.outputDir, "cover.pdf");
  const jobPath = path.join(ctx.outputDir, "job.json");
  const indexPath = path.join(ctx.outputDir, "apply.md");

  await Promise.all([
    writeFile(resumePath, resumePdf),
    writeFile(coverPath, coverPdf),
    writeFile(jobPath, JSON.stringify({ saved, candidate }, null, 2), "utf-8"),
    writeFile(indexPath, renderApplyNotes(saved.id, candidate, resumePath, coverPath), "utf-8"),
  ]);

  return {
    output: {
      jobId: saved.id,
      title: saved.title,
      company: saved.company,
      url: saved.url,
      resumePath,
      coverPath,
    },
  };
}

export async function checkPrep(task: Task): Promise<GateCheckResult> {
  const out = task.output ?? {};
  if (!out.jobId) return { pass: false, reason: "no jobId — save failed" };
  if (!out.resumePath || !out.coverPath) return { pass: false, reason: "missing output PDFs" };
  return { pass: true };
}

function toSaveBody(candidate: Candidate, resumeId: number | undefined): SavedJobBody {
  const r = candidate.result;
  return {
    title: r.job.title,
    company: r.job.company,
    location: r.job.location,
    description: r.job.description,
    url: r.job.url,
    salaryMin: r.job.salaryMin,
    salaryMax: r.job.salaryMax,
    matchScore: r.matchScore,
    missingSkills: r.missingSkills,
    status: "saved",
    isRemote: r.job.isRemote,
    publisher: r.job.publisher,
    postedAt: r.job.postedAt,
    employmentTypeText: r.job.employmentTypeText,
    candidateFit: r.candidateFit,
    resumeId,
  };
}

async function retryOnRateLimit<T>(fn: () => Promise<T>, ctx: PhaseContext): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RoleNextRateLimitError && attempt < 2) {
        ctx.log("prep: rate-limited, sleeping", { ms: err.retryAfterMs, attempt });
        await sleep(err.retryAfterMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("retryOnRateLimit: exhausted");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function renderApplyNotes(jobId: number, candidate: Candidate, resumePath: string, coverPath: string): string {
  const j = candidate.result.job;
  const score = candidate.result.opportunityScore ?? candidate.result.matchScore;
  return [
    `# ${j.title} — ${j.company}`,
    "",
    `Score: ${score}`,
    `Apply URL: ${j.url}`,
    `RoleNext job id: ${jobId}`,
    "",
    "## Files",
    `- Resume: ${resumePath}`,
    `- Cover letter: ${coverPath}`,
    "",
    "## Next",
    "Open the apply URL, paste the resume + cover letter PDFs, then approve the `mark-applied` task to flip status to `applied` in rolenext.",
  ].join("\n");
}
