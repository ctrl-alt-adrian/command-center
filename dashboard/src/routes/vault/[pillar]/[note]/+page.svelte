<script lang="ts">
  import { marked } from "marked";
  import { formatDate } from "$lib/format";

  marked.setOptions({ gfm: true, breaks: true });

  let { data } = $props();
  const n = $derived(data.note);

  // Resolve [[wikilinks]] to /vault/<pillar>/<filename> links using the
  // already-resolved map from the server load, then run the result through
  // marked. Unresolved targets render as text marked with a warn underline.
  const wikilinkMap = $derived.by(() => {
    const m = new Map<string, { pillar: string; filename: string } | null>();
    for (const r of data.related) {
      m.set(r.target, r.resolved ? { pillar: r.resolved.pillar, filename: r.resolved.filename } : null);
    }
    return m;
  });

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  }

  function rewriteWikilinks(body: string): string {
    return body.replace(/\[\[([^\]]+)\]\]/g, (_match, raw: string) => {
      const target = raw.split("|")[0].trim();
      const display = raw.includes("|") ? raw.split("|")[1].trim() : target;
      const resolved = wikilinkMap.get(target);
      const text = escapeHtml(display);
      if (resolved) {
        return `[${text}](/vault/${resolved.pillar}/${encodeURIComponent(resolved.filename)})`;
      }
      // Unresolved — render as inline span the marked output preserves
      return `<span class="text-warn underline decoration-dotted" title="unresolved wikilink: ${escapeHtml(target)}">${text}</span>`;
    });
  }

  const bodyHtml = $derived(marked.parse(rewriteWikilinks(n.body)));
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

  <article class="note-rendered bg-card border border-border rounded p-5 text-sm leading-relaxed">
    {@html bodyHtml}
  </article>

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

<style>
  .note-rendered :global(h1) { font-size: 1.5rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  .note-rendered :global(h2) { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  .note-rendered :global(h3) { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; }
  .note-rendered :global(p) { margin: 0.5rem 0; }
  .note-rendered :global(ul), .note-rendered :global(ol) { margin: 0.5rem 0; padding-left: 1.5rem; }
  .note-rendered :global(ul) { list-style: disc; }
  .note-rendered :global(ol) { list-style: decimal; }
  .note-rendered :global(li) { margin: 0.25rem 0; }
  .note-rendered :global(strong) { font-weight: 600; }
  .note-rendered :global(em) { font-style: italic; }
  .note-rendered :global(code) { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.06); padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.875em; }
  .note-rendered :global(pre) { background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 0.25rem; overflow-x: auto; margin: 0.75rem 0; }
  .note-rendered :global(pre code) { background: none; padding: 0; }
  .note-rendered :global(blockquote) { border-left: 3px solid var(--color-border, #444); padding-left: 0.75rem; color: var(--color-muted, #888); margin: 0.5rem 0; }
  .note-rendered :global(a) { color: var(--color-accent, #6cf); text-decoration: underline; }
  .note-rendered :global(hr) { border: 0; border-top: 1px solid var(--color-border, #444); margin: 1rem 0; }
</style>
