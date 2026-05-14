import { error } from "@sveltejs/kit";
import { marked } from "marked";
import { getDraftSet } from "../../../../../../pipelines/marketing/lib/drafts.ts";

marked.setOptions({ gfm: true, breaks: true });

export async function load({ params }) {
  const set = await getDraftSet(params.slug);
  if (!set) throw error(404, `draft set not found: ${params.slug}`);
  const platforms = await Promise.all(
    Object.entries(set.platforms).map(async ([platform, d]) => ({
      platform,
      status: d.status,
      content: d.content,
      contentHtml: await marked.parse(d.content ?? ""),
    })),
  );
  return {
    set: {
      date: set.date,
      title: set.title,
      createdDate: set.createdDate,
      possibleDuplicateOf: set.possibleDuplicateOf,
      bodyDupSimilarity: set.bodyDupSimilarity,
      platforms,
    },
  };
}
