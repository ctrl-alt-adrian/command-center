<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDate } from "$lib/format";

  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });
</script>

<div class="space-y-4">
  <div>
    <a href="/personal-brand" class="text-xs text-muted hover:text-foreground">← personal-brand</a>
    <h2 class="text-2xl font-semibold mt-1">Brand Drafts</h2>
    <p class="text-muted text-sm mt-1">
      Per-platform drafts generated from approved vault notes.
      {data.drafts.length} draft set{data.drafts.length === 1 ? "" : "s"} total.
    </p>
  </div>

  {#if data.drafts.length === 0}
    <section class="bg-card border border-border rounded p-6 text-center text-muted text-sm">
      No brand drafts yet. Approve a discovery task on <a href="/personal-brand" class="text-accent hover:underline">/personal-brand</a>
      to fan out generate tasks — each picked vault note produces a draft set.
    </section>
  {:else}
    <ul class="space-y-2">
      {#each data.drafts as d}
        <li class="bg-card border border-border rounded hover:border-accent transition-colors">
          <a href={`/personal-brand/drafts/${d.slug}`} class="block p-3">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-mono text-xs text-muted">{formatDate(d.date)}</span>
              <span class="text-xs text-muted/70">{d.platforms.length} platform{d.platforms.length === 1 ? "" : "s"}</span>
            </div>
            <div class="mt-1 font-medium hover:text-accent">{d.title ?? d.slug}</div>
            {#if d.pillar || (d.tags && d.tags.length > 0)}
              <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                {#if d.pillar}<span class="font-mono">{d.pillar}</span>{/if}
                {#each (d.tags ?? []).slice(0, 5) as tag}<span>#{tag}</span>{/each}
              </div>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
