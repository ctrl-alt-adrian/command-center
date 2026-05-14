<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();

  const STATUS_BADGE: Record<string, string> = {
    draft: "bg-warn/20 text-warn border-warn/30",
    "slop-checked": "bg-accent/20 text-accent border-accent/30",
    reviewed: "bg-ok/20 text-ok border-ok/30",
    posted: "bg-muted/20 text-muted border-muted/30",
  };
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-semibold">Drafts</h2>
    <a href="/marketing" class="text-xs text-muted hover:text-foreground">← marketing</a>
  </div>

  <table class="w-full text-sm table-fixed">
    <colgroup>
      <col class="w-28" />
      <col />
      <col class="w-[28rem]" />
      <col class="w-32" />
    </colgroup>
    <thead class="text-xs text-muted text-left">
      <tr class="border-b border-border">
        <th class="py-2 pr-4">date</th>
        <th class="py-2 pr-4">title</th>
        <th class="py-2 pr-4">platforms</th>
        <th class="py-2 pr-2">dup?</th>
      </tr>
    </thead>
    <tbody>
      {#each data.drafts as d}
        <tr class="border-b border-border/40 align-top hover:bg-card/40 cursor-pointer transition-colors" onclick={() => (location.href = `/marketing/drafts/${d.date}`)}>
          <td class="py-2 pr-4 font-mono text-xs whitespace-nowrap">
            <a href={`/marketing/drafts/${d.date}`} class="hover:text-accent">{formatDate(d.date.slice(0, 10))}</a>
          </td>
          <td class="py-2 pr-4">
            <a href={`/marketing/drafts/${d.date}`} class="hover:text-accent">{d.title ?? "(untitled)"}</a>
          </td>
          <td class="py-2 pr-4 space-x-1 space-y-1">
            {#each d.platforms as p}
              <span class="text-xs px-2 py-0.5 rounded border whitespace-nowrap inline-block {STATUS_BADGE[p.status] ?? 'border-border text-muted'}">
                {p.platform}:{p.status}
              </span>
            {/each}
          </td>
          <td class="py-2 pr-2">
            {#if d.possibleDuplicateOf}
              <span class="text-xs text-warn" title={`Jaccard ${d.bodyDupSimilarity?.toFixed(2)}`}>~ {d.possibleDuplicateOf}</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if data.drafts.length === 0}
    <p class="text-muted text-sm text-center p-8">no drafts yet — discovery + generate hasn't produced any</p>
  {/if}
</div>
