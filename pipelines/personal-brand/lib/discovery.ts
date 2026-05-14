import { listNotes } from "../../../core/lib/vault.ts";

export interface BrandCandidate {
  id: string;          // vault:<pillar>:<filename>
  pillar: string;
  title: string;
  tier: number;
  tags: string[];
  summary: string;
  body: string;
  reason: string;      // why this note made the cut
}

/**
 * Brand discovery is deterministic for Phase A — no claude call, just filters
 * the vault for notes that read as personal-brand material:
 *
 *   - tier === 1 (framework / principle notes only — supporting notes skipped)
 *   - content_ready === true (captain has vouched for the prose)
 *   - audience !== "product" (untagged is fine; treat as both)
 *   - pillar !== "build-journal" unless audience === "brand" (build-journal is
 *     project-minutiae by default; explicit opt-in only)
 *
 * Phase B will layer claude-based ranking on top of this seed set.
 */
export async function discoverBrandCandidates(): Promise<BrandCandidate[]> {
  const all = await listNotes();
  const out: BrandCandidate[] = [];

  for (const n of all) {
    const fm = n.frontmatter;
    const tier = typeof fm.tier === "number" ? fm.tier : 0;
    const contentReady = fm.content_ready === true;
    const audience = typeof fm.audience === "string" ? fm.audience.toLowerCase() : null;

    if (tier !== 1) continue;
    if (!contentReady) continue;
    if (audience === "product") continue;
    if (n.pillar === "build-journal" && audience !== "brand") continue;

    out.push({
      id: `vault:${n.pillar}:${n.filename}`,
      pillar: String(n.pillar),
      title: (fm.title as string) || n.filename,
      tier,
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
      summary: n.summary,
      body: n.body,
      reason: audience === "brand"
        ? "explicit audience:brand"
        : `tier-1 ${n.pillar} principle (untagged audience)`,
    });
  }

  return out;
}
