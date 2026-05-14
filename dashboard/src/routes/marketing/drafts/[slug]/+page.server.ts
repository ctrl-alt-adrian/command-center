import { error } from "@sveltejs/kit";
import { getDraftSet } from "../../../../../../pipelines/marketing/lib/drafts.ts";

export async function load({ params }) {
  const set = await getDraftSet(params.slug);
  if (!set) throw error(404, `draft set not found: ${params.slug}`);
  return {
    set: {
      date: set.date,
      title: set.title,
      createdDate: set.createdDate,
      possibleDuplicateOf: set.possibleDuplicateOf,
      bodyDupSimilarity: set.bodyDupSimilarity,
      platforms: Object.entries(set.platforms).map(([platform, d]) => ({
        platform,
        status: d.status,
        content: d.content,
      })),
    },
  };
}
