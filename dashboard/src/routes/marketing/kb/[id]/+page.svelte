<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();

  interface Section {
    heading: string;
    content: string;
  }

  function parseSections(body: string): Section[] {
    const lines = body.split("\n");
    const sections: Section[] = [];
    let heading = "";
    let buffer: string[] = [];
    const flush = () => {
      if (heading || buffer.length > 0) {
        sections.push({ heading, content: buffer.join("\n").trim() });
      }
    };
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)/);
      if (m) {
        flush();
        heading = m[1];
        buffer = [];
      } else {
        buffer.push(line);
      }
    }
    flush();
    return sections.filter((s) => s.content.length > 0);
  }

  const sections = $derived(parseSections(data.entry.body));
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

  <section class="space-y-4">
    {#each sections as section}
      <div class="bg-card border border-border rounded p-4">
        {#if section.heading}
          <h3 class="text-sm font-semibold text-foreground mb-2">{section.heading}</h3>
        {/if}
        <div class="text-sm leading-relaxed whitespace-pre-wrap">{section.content}</div>
      </div>
    {/each}
    {#if sections.length === 0}
      <div class="bg-card border border-border rounded p-4">
        <div class="text-sm leading-relaxed whitespace-pre-wrap">{data.entry.body}</div>
      </div>
    {/if}
  </section>

  <footer class="text-xs text-muted">
    <span>id: <code>{data.entry.id}</code></span>
    {#if data.entry.analyzedAt}
      · <span>analyzed: {data.entry.analyzedAt}</span>
    {/if}
    · <span>file: <code>{data.entry.filename}</code></span>
  </footer>
</div>
