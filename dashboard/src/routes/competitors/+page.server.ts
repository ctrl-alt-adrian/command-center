import { loadLatest, listArchive } from "../../../../pipelines/competitors/lib/scrape.ts";

export async function load() {
  const [snapshot, archive] = await Promise.all([
    loadLatest().catch(() => null),
    listArchive().catch(() => []),
  ]);
  return { snapshot, archive };
}
