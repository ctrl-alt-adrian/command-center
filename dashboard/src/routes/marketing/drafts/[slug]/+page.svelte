<script lang="ts">
  let { data } = $props();
  let selected = $state<string | null>(null);
  let view = $state<"rendered" | "raw">("rendered");
  const activePlatform = $derived(selected ?? data.set.platforms[0]?.platform ?? "");

  const STATUS_BADGE: Record<string, string> = {
    draft: "bg-warn/20 text-warn border-warn/30",
    "slop-checked": "bg-accent/20 text-accent border-accent/30",
    reviewed: "bg-ok/20 text-ok border-ok/30",
    posted: "bg-muted/20 text-muted border-muted/30",
  };

  const current = $derived(data.set.platforms.find((p) => p.platform === activePlatform));
</script>

<div class="space-y-4">
  <div>
    <a href="/marketing/drafts" class="text-xs text-muted hover:text-foreground">← drafts</a>
    <h2 class="text-xl font-semibold mt-1">{data.set.title ?? data.set.date}</h2>
    <div class="text-xs text-muted mt-1">
      <span class="font-mono">{data.set.date}</span>
      {#if data.set.possibleDuplicateOf}
        · <span class="text-warn">possible duplicate of {data.set.possibleDuplicateOf}</span>
      {/if}
    </div>
  </div>

  <div class="flex gap-2 border-b border-border">
    {#each data.set.platforms as p}
      <button
        class="px-3 py-2 text-sm border-b-2 transition-colors {activePlatform === p.platform ? 'border-accent text-foreground' : 'border-transparent text-muted hover:text-foreground'}"
        onclick={() => (selected = p.platform)}
      >
        {p.platform}
        <span class="ml-1 text-xs px-1.5 py-0.5 rounded border {STATUS_BADGE[p.status] ?? 'border-border'}">
          {p.status}
        </span>
      </button>
    {/each}
  </div>

  {#if current}
    <div class="flex gap-2 text-xs">
      <button
        class="px-2 py-1 rounded {view === 'rendered' ? 'bg-accent text-background' : 'bg-card text-muted hover:text-foreground'}"
        onclick={() => (view = "rendered")}
      >
        rendered
      </button>
      <button
        class="px-2 py-1 rounded {view === 'raw' ? 'bg-accent text-background' : 'bg-card text-muted hover:text-foreground'}"
        onclick={() => (view = "raw")}
      >
        raw
      </button>
    </div>

    {#if view === "rendered"}
      <article class="draft-rendered bg-card border border-border rounded p-4 text-sm leading-relaxed">
        {@html current.contentHtml}
      </article>
    {:else}
      <article class="bg-card border border-border rounded p-4 whitespace-pre-wrap text-sm leading-relaxed font-mono">{current.content}</article>
    {/if}
  {/if}
</div>

<style>
  .draft-rendered :global(h1) { font-size: 1.5rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  .draft-rendered :global(h2) { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  .draft-rendered :global(h3) { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
  .draft-rendered :global(p) { margin: 0.5rem 0; }
  .draft-rendered :global(ul), .draft-rendered :global(ol) { margin: 0.5rem 0; padding-left: 1.5rem; }
  .draft-rendered :global(ul) { list-style: disc; }
  .draft-rendered :global(ol) { list-style: decimal; }
  .draft-rendered :global(li) { margin: 0.25rem 0; }
  .draft-rendered :global(strong) { font-weight: 600; }
  .draft-rendered :global(em) { font-style: italic; }
  .draft-rendered :global(code) { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.06); padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.875em; }
  .draft-rendered :global(pre) { background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 0.25rem; overflow-x: auto; margin: 0.75rem 0; }
  .draft-rendered :global(pre code) { background: none; padding: 0; }
  .draft-rendered :global(blockquote) { border-left: 3px solid var(--color-border, #444); padding-left: 0.75rem; color: var(--color-muted, #888); margin: 0.5rem 0; }
  .draft-rendered :global(a) { color: var(--color-accent, #6cf); text-decoration: underline; }
  .draft-rendered :global(hr) { border: 0; border-top: 1px solid var(--color-border, #444); margin: 1rem 0; }
</style>
