import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhaseContext, PhaseOutput, Task } from "../../../../core/lib/types.ts";
import { RoleNextClient } from "../lib/api-client.ts";
import type { Candidate } from "../lib/types.ts";

const DEFAULT_LOCATION = "Remote";
const DEFAULT_EMPLOYMENT_TYPES = "FULLTIME,CONTRACTOR";
const DEFAULT_MIN_MATCH_SCORE = 75;
const MAX_TITLES = 6;
const POOL_CAP = 200;

export interface DiscoverInput {
  resumeId?: number;
  keywords?: string[];
  location?: string;
  employmentTypes?: string;
  minMatchScore?: number;
}

interface KeywordCount {
  returned: number;
  matched: number;
}

export async function runDiscover(task: Task, ctx: PhaseContext): Promise<PhaseOutput> {
  const input = task.input as DiscoverInput;
  const client = new RoleNextClient();

  const resumeId = input.resumeId ?? (await client.latestResume()).id;
  ctx.log("discover: using resume", { resumeId });

  const usage = await client.billingUsage("optimize").catch(() => null);
  if (usage) ctx.log("discover: optimize budget", usage);

  const keywords = await resolveKeywords(client, resumeId, input.keywords);
  ctx.log("discover: keywords", { keywords });

  const location = input.location ?? DEFAULT_LOCATION;
  const employmentTypes = input.employmentTypes ?? DEFAULT_EMPLOYMENT_TYPES;
  const minMatchScore = input.minMatchScore ?? DEFAULT_MIN_MATCH_SCORE;

  // Sequential per-keyword: rolenext rate limit is 5 req/s and analyze itself
  // is multi-second; firing in parallel buys nothing but rate-limit retries.
  const seenUrls = new Set<string>();
  const candidates: Candidate[] = [];
  const perKeywordCounts: Record<string, KeywordCount> = {};
  let belowFloor = 0;

  for (const keyword of keywords) {
    if (candidates.length >= POOL_CAP) break;
    try {
      const results = await client.analyze({
        keyword,
        location,
        remoteOnly: true,
        employmentTypes,
        resumeId,
      });
      let matched = 0;
      for (const r of results) {
        if (seenUrls.has(r.job.url)) continue;
        seenUrls.add(r.job.url);
        if (r.matchScore < minMatchScore) {
          belowFloor++;
          continue;
        }
        candidates.push({ searchKeyword: keyword, result: r });
        matched++;
      }
      perKeywordCounts[keyword] = { returned: results.length, matched };
      ctx.log("discover: keyword complete", { keyword, returned: results.length, matched });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log("discover: keyword failed", { keyword, error: msg });
      perKeywordCounts[keyword] = { returned: 0, matched: 0 };
    }
  }

  candidates.sort(byScoreDesc);
  const top = candidates.slice(0, POOL_CAP);

  ctx.log("discover: pool", { kept: top.length, droppedBelowFloor: belowFloor, minMatchScore });

  const candidatesPath = path.join(ctx.outputDir, "candidates.json");
  await writeFile(candidatesPath, JSON.stringify(top, null, 2), "utf-8");

  const summaryMd = renderSummary(resumeId, keywords, perKeywordCounts, top, minMatchScore, belowFloor);
  await writeFile(path.join(ctx.outputDir, "candidates.md"), summaryMd, "utf-8");

  return {
    output: {
      resumeId,
      location,
      employmentTypes,
      keywords,
      minMatchScore,
      candidateCount: top.length,
      droppedBelowFloor: belowFloor,
      perKeywordCounts,
      candidatesPath,
    },
  };
}

async function resolveKeywords(
  client: RoleNextClient,
  resumeId: number,
  override: string[] | undefined,
): Promise<string[]> {
  if (override && override.length > 0) return override.slice(0, MAX_TITLES);
  const { suggestions } = await client.suggestedTitles(resumeId);
  if (suggestions.length === 0) {
    throw new Error(
      `resume ${resumeId} returned no suggested titles — open rolenext, ensure the resume's analysis status is "ready", then retry`,
    );
  }
  return suggestions.slice(0, MAX_TITLES).map((s) => s.title);
}

function byScoreDesc(a: Candidate, b: Candidate): number {
  const sa = a.result.opportunityScore ?? a.result.matchScore;
  const sb = b.result.opportunityScore ?? b.result.matchScore;
  return sb - sa;
}

function renderSummary(
  resumeId: number,
  keywords: string[],
  counts: Record<string, KeywordCount>,
  candidates: Candidate[],
  minMatchScore: number,
  droppedBelowFloor: number,
): string {
  const lines: string[] = [];
  lines.push(`# Discover — ${candidates.length} candidates at matchScore ≥ ${minMatchScore}`);
  lines.push("");
  lines.push(`Resume: ${resumeId}`);
  lines.push(`Dropped below floor: ${droppedBelowFloor}`);
  lines.push("");
  lines.push("## Keywords");
  for (const k of keywords) {
    const c = counts[k] ?? { returned: 0, matched: 0 };
    lines.push(`- ${k} → ${c.matched} matched / ${c.returned} returned`);
  }
  lines.push("");
  lines.push("## Top 50");
  for (const [i, c] of candidates.slice(0, 50).entries()) {
    const opp = c.result.opportunityScore ?? c.result.matchScore;
    lines.push(
      `${i + 1}. **${c.result.job.title}** — ${c.result.job.company} (match ${c.result.matchScore}, opportunity ${opp})`,
    );
    lines.push(`   - ${c.result.job.url}`);
  }
  return lines.join("\n");
}
