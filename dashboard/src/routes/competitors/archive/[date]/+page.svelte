<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();

  function fmtNum(n: number | undefined): string {
    if (n == null) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  }
</script>

<div class="space-y-4">
  <div>
    <a href="/competitors" class="text-xs text-muted hover:text-foreground">← competitors</a>
    <h2 class="text-2xl font-semibold mt-1">Snapshot · {formatDate(data.snapshot.date)}</h2>
    <p class="text-xs text-muted mt-1 font-mono">{data.snapshot.fetchedAt}</p>
  </div>

  <section class="grid grid-cols-4 gap-3 text-sm">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">outliers</div>
      <div class="text-xl font-mono text-warn">{data.snapshot.outliers.length}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">niche hits</div>
      <div class="text-xl font-mono text-accent">{data.snapshot.niche.length}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">channel videos</div>
      <div class="text-xl font-mono">{data.snapshot.channels.length}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">shorts</div>
      <div class="text-xl font-mono">{data.snapshot.shorts.length}</div>
    </div>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Outliers</h3>
    <div class="grid grid-cols-3 gap-3">
      {#each data.snapshot.outliers as v}
        <a href={v.url} target="_blank" rel="noreferrer" class="bg-card border border-border rounded p-3 hover:border-accent transition-colors space-y-2">
          {#if v.thumbnails.medium || v.thumbnails.default}
            <img src={v.thumbnails.medium ?? v.thumbnails.default} alt="" class="w-full aspect-video rounded object-cover" loading="lazy" />
          {/if}
          <div class="text-sm font-medium line-clamp-2">{v.title}</div>
          <div class="text-xs text-muted">{v.channelTitle}</div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted">{fmtNum(v.viewCount)} views</span>
            <span class="text-warn">{v.outlierRatio}× median</span>
          </div>
        </a>
      {/each}
    </div>
  </section>
</div>
