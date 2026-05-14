<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();
</script>

<div class="space-y-6">
  <div>
    <a href="/marketing/kb" class="text-xs text-muted hover:text-foreground">← knowledge base</a>
  </div>

  <header class="bg-card border border-border rounded p-5 space-y-3">
    <div class="flex items-center gap-3 flex-wrap text-sm">
      <span class="font-mono text-muted">{formatDate(data.entry.date)}</span>
      <span class="font-semibold">{data.entry.project}</span>
      {#if data.entry.shareworthy}
        <span class="text-xs px-2 py-0.5 rounded border bg-warn/10 border-warn/30 text-warn">shareworthy</span>
      {/if}
      {#if data.entry.contentWorthy === true}
        <span class="text-xs px-2 py-0.5 rounded border bg-ok/10 border-ok/30 text-ok">content-worthy</span>
      {/if}
      {#if data.entry.contentType}
        <span class="text-xs px-2 py-0.5 rounded border border-border text-muted">{data.entry.contentType}</span>
      {/if}
      {#if data.entry.usedForContent}
        <span class="text-xs px-2 py-0.5 rounded border bg-muted/10 border-muted/30 text-muted">used</span>
      {/if}
    </div>

    {#if data.entry.summary}
      <p class="text-sm leading-relaxed">{data.entry.summary}</p>
    {/if}

    {#if data.entry.tags && data.entry.tags.length > 0}
      <div class="flex flex-wrap gap-1.5">
        {#each data.entry.tags as tag}
          <span class="text-xs px-2 py-0.5 rounded bg-sidebar border border-border text-muted">#{tag}</span>
        {/each}
      </div>
    {/if}

    {#if data.entry.hook || data.entry.angle}
      <div class="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
        {#if data.entry.hook}
          <div>
            <div class="text-xs text-muted mb-1">hook</div>
            <div>{data.entry.hook}</div>
          </div>
        {/if}
        {#if data.entry.angle}
          <div>
            <div class="text-xs text-muted mb-1">angle</div>
            <div>{data.entry.angle}</div>
          </div>
        {/if}
      </div>
    {/if}
  </header>

  <section>
    <div class="bg-card border border-border rounded p-5">
      <div class="markdown-body">{@html data.bodyHtml}</div>
    </div>
  </section>

  <footer class="text-xs text-muted">
    <span>id: <code>{data.entry.id}</code></span>
    {#if data.entry.analyzedAt}
      · <span>analyzed: {data.entry.analyzedAt}</span>
    {/if}
    · <span>file: <code>{data.entry.filename}</code></span>
  </footer>
</div>

<style>
  .markdown-body {
    font-size: 0.875rem;
    line-height: 1.65;
    color: var(--color-foreground, inherit);
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4),
  .markdown-body :global(h5),
  .markdown-body :global(h6) {
    font-weight: 600;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    color: var(--color-foreground, inherit);
  }
  .markdown-body :global(h1) { font-size: 1.5rem; }
  .markdown-body :global(h2) {
    font-size: 1.25rem;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--color-border, #2a2a2a);
  }
  .markdown-body :global(h3) { font-size: 1.05rem; }
  .markdown-body :global(h4) { font-size: 0.95rem; }
  .markdown-body :global(> *:first-child) { margin-top: 0; }
  .markdown-body :global(p) { margin: 0.75em 0; }
  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    margin: 0.75em 0;
    padding-left: 1.5em;
  }
  .markdown-body :global(ul) { list-style: disc; }
  .markdown-body :global(ol) { list-style: decimal; }
  .markdown-body :global(li) { margin: 0.25em 0; }
  .markdown-body :global(li > ul),
  .markdown-body :global(li > ol) { margin: 0.25em 0; }
  .markdown-body :global(a) {
    color: var(--color-accent, #5ea0ff);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .markdown-body :global(a:hover) { text-decoration: none; }
  .markdown-body :global(strong) { font-weight: 600; }
  .markdown-body :global(em) { font-style: italic; }
  .markdown-body :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85em;
    padding: 0.15em 0.35em;
    background: var(--color-sidebar, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--color-border, #2a2a2a);
    border-radius: 3px;
  }
  .markdown-body :global(pre) {
    margin: 1em 0;
    padding: 0.9em 1em;
    background: var(--color-sidebar, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--color-border, #2a2a2a);
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .markdown-body :global(pre code) {
    padding: 0;
    background: transparent;
    border: 0;
    font-size: inherit;
  }
  .markdown-body :global(blockquote) {
    margin: 1em 0;
    padding: 0.25em 1em;
    border-left: 3px solid var(--color-border, #2a2a2a);
    color: var(--color-muted, #999);
  }
  .markdown-body :global(hr) {
    margin: 1.5em 0;
    border: 0;
    border-top: 1px solid var(--color-border, #2a2a2a);
  }
  .markdown-body :global(table) {
    width: 100%;
    margin: 1em 0;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .markdown-body :global(th),
  .markdown-body :global(td) {
    padding: 0.5em 0.75em;
    border: 1px solid var(--color-border, #2a2a2a);
    text-align: left;
  }
  .markdown-body :global(th) {
    background: var(--color-sidebar, rgba(255, 255, 255, 0.04));
    font-weight: 600;
  }
  .markdown-body :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }
</style>
