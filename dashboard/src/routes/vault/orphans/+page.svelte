<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  function pillarOf(source: string): string {
    // relPath like "engineering/foo.md" → "engineering"
    const idx = source.indexOf("/");
    return idx === -1 ? "" : source.slice(0, idx);
  }
  function basename(source: string): string {
    const slash = source.lastIndexOf("/");
    const name = slash === -1 ? source : source.slice(slash + 1);
    return name.replace(/\.md$/, "");
  }
</script>

<div class="space-y-4">
  <div>
    <a href="/vault" class="text-xs text-muted hover:text-foreground">← vault</a>
    <h2 class="text-2xl font-semibold mt-1">Orphan wikilinks</h2>
    <p class="text-muted text-sm mt-1">
      {data.total} unresolved <code class="font-mono">[[target]]</code> pointer{data.total === 1 ? "" : "s"}
      across {data.grouped.length} note{data.grouped.length === 1 ? "" : "s"}. Each row is a real note that
      references a wikilink target which doesn't match any existing note's filename, title, or alias —
      either the target needs to be created as a new note, or the source note's link needs to be fixed.
    </p>
  </div>

  {#if data.grouped.length === 0}
    <section class="bg-card border border-border rounded p-6 text-center text-muted text-sm">
      No orphan wikilinks. Every <code class="font-mono">[[target]]</code> in the vault resolves.
    </section>
  {:else}
    <section class="space-y-3">
      {#each data.grouped as g}
        {@const pillar = pillarOf(g.source)}
        {@const name = basename(g.source)}
        <div class="bg-card border border-border rounded p-3 space-y-2">
          <div class="flex items-baseline justify-between gap-3">
            <a
              href={pillar ? `/vault/${pillar}/${encodeURIComponent(name)}` : "#"}
              class="font-mono text-sm hover:text-accent truncate"
            >
              {g.source}
            </a>
            <span class="text-xs text-muted whitespace-nowrap">{g.targets.length} dead link{g.targets.length === 1 ? "" : "s"}</span>
          </div>
          <ul class="space-y-1 text-xs text-muted">
            {#each g.targets as t}
              <li>
                → <code class="font-mono text-warn">[[{t}]]</code>
                <span class="ml-2 text-muted/70">no note matches this target</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
  {/if}
</div>
