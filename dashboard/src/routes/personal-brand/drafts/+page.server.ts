import { getBrandDraftSets } from "../../../../../pipelines/personal-brand/lib/drafts.ts";

export async function load() {
  const sets = await getBrandDraftSets();
  return {
    drafts: sets.map((d) => ({
      slug: d.slug,
      date: d.date,
      title: d.title,
      pillar: d.pillar,
      tags: d.tags ?? [],
      platforms: Object.keys(d.platforms),
    })),
  };
}
