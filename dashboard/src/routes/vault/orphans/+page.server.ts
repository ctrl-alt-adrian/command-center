import { listOrphanLinks } from "../../../../../core/lib/vault.ts";

export async function load() {
  const orphans = await listOrphanLinks().catch(() => []);
  // Group by source so the captain can see "this note has 3 dead links" at a glance.
  const bySource = new Map<string, string[]>();
  for (const o of orphans) {
    const targets = bySource.get(o.source) ?? [];
    targets.push(o.target);
    bySource.set(o.source, targets);
  }
  const grouped = [...bySource.entries()]
    .map(([source, targets]) => ({ source, targets: [...new Set(targets)].sort() }))
    .sort((a, b) => a.source.localeCompare(b.source));

  return {
    grouped,
    total: orphans.length,
  };
}
