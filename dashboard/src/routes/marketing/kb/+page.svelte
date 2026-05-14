<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();
  let filter = $state<"all" | "shareworthy" | "unused" | "content_worthy">("all");

  const visible = $derived(
    filter === "all" ? data.entries
    : filter === "shareworthy" ? data.entries.filter((e) => e.shareworthy)
    : filter === "unused" ? data.entries.filter((e) => !e.usedForContent)
    : data.entries.filter((e) => e.contentWorthy === true)
  );
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-semibold">Knowledge Base</h2>
      <p class="text-xs text-muted mt-1">Reading from <code>$VAULT_ROOT</code> + <code>$LEGACY_SESSIONS_ROOT</code></p>
    </div>
    <a href="/marketing" class="text-xs text-muted hover:text-foreground">← marketing</a>
  </div>

  <div class="flex items-center gap-2 text-sm">
    <span class="text-muted">filter:</span>
    {#each ["all", "shareworthy", "unused", "content_worthy"] as f}
      <button
        class="px-2 py-1 rounded text-xs {filter === f ? 'bg-accent text-background' : 'bg-card text-muted hover:text-foreground'}"
        onclick={() => (filter = f as typeof filter)}
      >
        {f}
      </button>
    {/each}
    <span class="text-muted text-xs ml-auto">{visible.length} of {data.entries.length}</span>
  </div>

  <table class="w-full text-sm table-fixed">
    <colgroup>
      <col class="w-28" />
      <col class="w-28" />
      <col />
      <col class="w-56" />
      <col class="w-28" />
    </colgroup>
    <thead class="text-xs text-muted text-left">
      <tr class="border-b border-border">
        <th class="py-2 pr-4">date</th>
        <th class="py-2 pr-4">project</th>
        <th class="py-2 pr-4">summary</th>
        <th class="py-2 pr-4">tags</th>
        <th class="py-2 pr-2">flags</th>
      </tr>
    </thead>
    <tbody>
      {#each visible as e}
        <tr class="border-b border-border/40 align-top hover:bg-card/40 cursor-pointer transition-colors" onclick={() => (location.href = `/marketing/kb/${e.id}`)}>
          <td class="py-2 pr-4 font-mono text-xs text-muted whitespace-nowrap">
            <a href={`/marketing/kb/${e.id}`} class="hover:text-accent">{formatDate(e.date)}</a>
          </td>
          <td class="py-2 pr-4 text-xs">{e.project}</td>
          <td class="py-2 pr-4">
            <a href={`/marketing/kb/${e.id}`} class="hover:text-accent">{e.summary || e.id}</a>
          </td>
          <td class="py-2 pr-4 text-xs text-muted truncate">{(e.tags ?? []).slice(0, 3).join(", ")}</td>
          <td class="py-2 pr-2 text-xs whitespace-nowrap">
            {#if e.shareworthy}<span class="text-warn">★</span>{/if}
            {#if e.contentWorthy === true}<span class="text-ok ml-1">✓</span>{/if}
            {#if e.usedForContent}<span class="text-muted ml-1 line-through">used</span>{/if}
            {#if e.contentType}<span class="ml-1 text-muted">{e.contentType}</span>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if visible.length === 0}
    <p class="text-muted text-sm text-center p-8">no entries match filter "{filter}"</p>
  {/if}
</div>
