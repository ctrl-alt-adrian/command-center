<script lang="ts">
  let { data } = $props();
  let selected = $state<string | null>(null);
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
    <article class="bg-card border border-border rounded p-4 whitespace-pre-wrap text-sm leading-relaxed font-mono">{current.content}</article>
  {/if}
</div>
