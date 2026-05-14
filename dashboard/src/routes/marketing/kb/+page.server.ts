import { getKBEntries } from "../../../../../pipelines/marketing/lib/kb.ts";

export async function load() {
  const entries = await getKBEntries().catch(() => []);
  return {
    entries: entries.slice(0, 100).map((e) => ({
      id: e.id,
      date: e.date,
      project: e.project,
      summary: e.summary,
      tags: e.tags,
      shareworthy: e.shareworthy,
      usedForContent: e.usedForContent,
      contentWorthy: e.contentWorthy,
      contentType: e.contentType,
    })),
  };
}
