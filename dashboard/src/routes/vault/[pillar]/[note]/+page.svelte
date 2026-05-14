<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();
  const n = $derived(data.note);
</script>

<div class="space-y-6">
  <div>
    <a href={`/vault/${data.pillar}`} class="text-xs text-muted hover:text-foreground">← {data.pillar}</a>
  </div>

  <header class="bg-card border border-border rounded p-5 space-y-3">
    <div class="flex items-center gap-3 flex-wrap text-sm">
      <span class="font-mono text-muted">{formatDate(n.created)}</span>
      <a href={`/vault/${data.pillar}`} class="font-semibold hover:text-accent">{data.pillar}</a>
      <span class="text-xs px-2 py-0.5 rounded border border-border text-muted">tier {n.tier}</span>
      {#if n.content_ready}
        <span class="text-xs px-2 py-0.5 rounded border bg-ok/10 border-ok/30 text-ok">content-ready</span>
      {:else}
        <span class="text-xs px-2 py-0.5 rounded border border-border text-muted">stub</span>
      {/if}
    </div>

    <h1 class="text-xl font-semibold">{n.title}</h1>

    {#if n.tags.length > 0}
      <div class="flex flex-wrap gap-1.5">
        {#each n.tags as tag}
          <span class="text-xs px-2 py-0.5 rounded bg-sidebar border border-border text-muted">#{tag}</span>
        {/each}
      </div>
    {/if}

    {#if n.aliases.length > 0}
      <div class="text-xs text-muted">aliases: {n.aliases.join(", ")}</div>
    {/if}

    {#if n.warnings.length > 0}
      <ul class="text-xs text-warn space-y-0.5">
        {#each n.warnings as w}
          <li>⚠ {w}</li>
        {/each}
      </ul>
    {/if}
  </header>

  <article class="bg-card border border-border rounded p-5 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</article>

  {#if data.related.length > 0}
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Related</h3>
      <ul class="space-y-1">
        {#each data.related as r}
          <li class="text-sm">
            {#if r.resolved}
              <a href={`/vault/${r.resolved.pillar}/${encodeURIComponent(r.resolved.filename)}`} class="text-accent hover:underline">{r.target}</a>
              <span class="text-xs text-muted">· {r.resolved.pillar}</span>
            {:else}
              <span class="text-warn">{r.target}</span>
              <span class="text-xs text-muted">· unresolved</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <footer class="text-xs text-muted font-mono">{n.relPath}</footer>
</div>
