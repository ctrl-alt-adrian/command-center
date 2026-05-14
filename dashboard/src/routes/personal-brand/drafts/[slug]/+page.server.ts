import { error } from "@sveltejs/kit";
import { getBrandDraftSet } from "../../../../../../pipelines/personal-brand/lib/drafts.ts";

export async function load({ params }) {
  const set = await getBrandDraftSet(params.slug);
  if (!set) throw error(404, `brand draft set not found: ${params.slug}`);
  return {
    slug: params.slug,
    set: {
      date: set.date,
      title: set.title,
      pillar: set.pillar,
      tags: set.tags ?? [],
      platforms: Object.entries(set.platforms).map(([platform, d]) => ({
        platform,
        content: d.content,
      })),
    },
  };
}
