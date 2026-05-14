import { getDraftSets } from "../../../../../pipelines/marketing/lib/drafts.ts";

export async function load() {
  const sets = await getDraftSets().catch(() => []);
  return {
    drafts: sets.map((s) => ({
      date: s.date,
      title: s.title,
      createdDate: s.createdDate,
      platforms: Object.entries(s.platforms).map(([p, d]) => ({ platform: p, status: d.status })),
      possibleDuplicateOf: s.possibleDuplicateOf,
      bodyDupSimilarity: s.bodyDupSimilarity,
    })),
  };
}
