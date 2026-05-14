<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDate } from "$lib/format";
  let { data } = $props();

  type Tab = "top" | "outliers" | "niche" | "channels" | "shorts" | "archive";
  let tab = $state<Tab>("top");
  let running = $state(false);

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  async function clearFailed() {
    if (!confirm(`Remove ${data.failedCount} failed competitors task(s)? This is irreversible.`)) return;
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId: "competitors" }),
    });
    location.reload();
  }

  async function rerunFailed() {
    if (!confirm(`Re-queue ${data.failedCount} failed competitors task(s)?`)) return;
    await fetch("/api/tasks/rerun", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId: "competitors" }),
    });
    location.reload();
  }

  async function runScrape() {
    if (running) return;
    const ok = confirm(
      "Run competitors scrape now?\n\n" +
        "Fetches recent uploads from 15 tracked channels and runs ~22 niche queries " +
        "via yt-dlp. No claude tokens. Takes ~2-5 minutes.\n\n" +
        "Continue?",
    );
    if (!ok) return;
    running = true;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "competitors" }),
      });
      if (res.ok) {
        await fetch("/api/cron", { method: "POST" });
        // The scrape can take a while; just refresh the page so they can see status.
        location.href = "/tasks";
      }
    } finally {
      running = false;
    }
  }

  function fmtNum(n: number | undefined): string {
    if (n == null) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  }

  type Snap = NonNullable<typeof data.snapshot>;
  type Vid = Snap["channels"][number];

  const channelGroups = $derived(() => {
    if (!data.snapshot) return [] as Array<{ channelId: string; channelTitle: string; handle?: string; videos: Vid[] }>;
    const map = new Map<string, { channelId: string; channelTitle: string; handle?: string; videos: Vid[] }>();
    for (const v of data.snapshot.channels) {
      const key = v.channelId || v.channelTitle || v.channelHandle || "unknown";
      const g = map.get(key) ?? { channelId: key, channelTitle: v.channelTitle, handle: v.channelHandle, videos: [] };
      g.videos.push(v);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.channelTitle.localeCompare(b.channelTitle));
  });

  const activeVideos = $derived(() => {
    if (!data.snapshot) return [];
    switch (tab) {
      case "top": return data.snapshot.top;
      case "outliers": return data.snapshot.outliers;
      case "niche": return data.snapshot.niche;
      case "channels": return [];
      case "shorts": return data.snapshot.shorts;
      case "archive": return [];
    }
  });
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Competitors</h2>
      <p class="text-muted text-sm mt-1">
        YouTube outlier feed for the SWE / career / indie-hacker niche ·
        <a href="/pipelines/competitors" class="text-accent hover:underline">pipeline</a>
      </p>
    </div>
    <div class="flex gap-2">
      {#if data.failedCount > 0}
        <button class="px-3 py-2 border border-accent/40 text-accent rounded hover:bg-accent/10 text-sm" onclick={rerunFailed}>
          rerun failed ({data.failedCount})
        </button>
        <button class="px-3 py-2 border border-danger/40 text-danger rounded hover:bg-danger/10 text-sm" onclick={clearFailed}>
          clear failed ({data.failedCount})
        </button>
      {/if}
      <button
        class="px-4 py-2 bg-accent text-background rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
        disabled={running}
        onclick={runScrape}
      >
        {running ? "starting…" : "Run scrape"}
      </button>
    </div>
  </div>

  {#if !data.snapshot}
    <div class="bg-card border border-border rounded p-8 text-center space-y-3">
      <p class="text-muted">No competitor snapshot yet — click <strong class="text-foreground">Run scrape</strong> to fetch the first one.</p>
      <p class="text-xs text-muted">First 3 days build the rolling-median baseline. Outlier detection activates from day 3.</p>
    </div>
  {:else}
    <section class="grid grid-cols-5 gap-3 text-sm">
      <div class="bg-card border border-border rounded p-3">
        <div class="text-xs text-muted">snapshot</div>
        <div class="text-sm font-mono mt-1">{formatDate(data.snapshot.date)}</div>
      </div>
      <div class="bg-card border border-border rounded p-3">
        <div class="text-xs text-muted">outliers</div>
        <div class="text-xl font-mono mt-1 text-warn">{data.snapshot.outliers.length}</div>
      </div>
      <div class="bg-card border border-border rounded p-3">
        <div class="text-xs text-muted">niche hits</div>
        <div class="text-xl font-mono mt-1 text-accent">{data.snapshot.niche.length}</div>
      </div>
      <div class="bg-card border border-border rounded p-3">
        <div class="text-xs text-muted">channels</div>
        <div class="text-xl font-mono mt-1">{channelGroups().length}</div>
      </div>
      <div class="bg-card border border-border rounded p-3">
        <div class="text-xs text-muted">warnings</div>
        <div class="text-xl font-mono mt-1 {data.snapshot.warnings.length > 0 ? 'text-danger' : ''}">{data.snapshot.warnings.length}</div>
      </div>
    </section>

    {#if data.snapshot.warnings.length > 0}
      <details class="bg-danger/10 border border-danger rounded p-3 text-xs">
        <summary class="cursor-pointer text-danger">{data.snapshot.warnings.length} warning(s) during scrape</summary>
        <ul class="mt-2 space-y-1 text-muted">
          {#each data.snapshot.warnings as w}<li>{w}</li>{/each}
        </ul>
      </details>
    {/if}

    <div class="flex gap-1 border-b border-border">
      {#each ["top", "outliers", "niche", "channels", "shorts", "archive"] as t (t)}
        <button
          class="px-3 py-2 text-sm border-b-2 transition-colors capitalize {tab === t ? 'border-accent text-foreground' : 'border-transparent text-muted hover:text-foreground'}"
          onclick={() => (tab = t as Tab)}
        >
          {t}
          {#if t === "outliers"}<span class="ml-1 text-xs">{data.snapshot.outliers.length}</span>{/if}
          {#if t === "niche"}<span class="ml-1 text-xs">{data.snapshot.niche.length}</span>{/if}
          {#if t === "shorts"}<span class="ml-1 text-xs">{data.snapshot.shorts.length}</span>{/if}
          {#if t === "channels"}<span class="ml-1 text-xs">{channelGroups().length}</span>{/if}
          {#if t === "archive"}<span class="ml-1 text-xs">{data.archive.length}</span>{/if}
        </button>
      {/each}
    </div>

    {#if tab === "channels"}
      <section class="space-y-4">
        {#each channelGroups() as g}
          <div class="bg-card border border-border rounded p-4">
            <div class="flex items-baseline justify-between mb-3">
              <h3 class="font-semibold">{g.channelTitle || g.handle}</h3>
              <span class="text-xs text-muted font-mono">{g.handle ?? ""}</span>
            </div>
            <div class="grid grid-cols-3 gap-3">
              {#each g.videos.slice(0, 6) as v}
                <a href={v.url} target="_blank" rel="noreferrer" class="block hover:border-accent border border-transparent rounded p-2 -m-2 transition-colors">
                  {#if v.thumbnails.medium || v.thumbnails.default}
                    <img src={v.thumbnails.medium ?? v.thumbnails.default} alt="" class="w-full aspect-video rounded object-cover" loading="lazy" />
                  {/if}
                  <div class="mt-1 text-xs line-clamp-2">{v.title}</div>
                  <div class="text-xs text-muted mt-0.5">
                    {fmtNum(v.viewCount)} views
                    {#if v.outlierRatio}<span class="ml-1 text-warn">· {v.outlierRatio}× median</span>{/if}
                  </div>
                </a>
              {/each}
            </div>
          </div>
        {/each}
      </section>
    {:else if tab === "archive"}
      <section class="space-y-1">
        {#each data.archive as a}
          <a href={`/competitors/archive/${a.date}`} class="block bg-card border border-border rounded p-3 hover:border-accent transition-colors text-sm flex items-center justify-between">
            <span class="font-mono">{formatDate(a.date)}</span>
            <span class="text-xs text-muted">{a.path}</span>
          </a>
        {/each}
        {#if data.archive.length === 0}
          <p class="text-muted text-sm text-center p-8">no archived snapshots yet</p>
        {/if}
      </section>
    {:else}
      <section class="grid grid-cols-3 gap-4">
        {#each activeVideos() as v}
          <a href={v.url} target="_blank" rel="noreferrer" class="bg-card border border-border rounded p-3 hover:border-accent transition-colors space-y-2">
            {#if v.thumbnails.medium || v.thumbnails.default}
              <img src={v.thumbnails.medium ?? v.thumbnails.default} alt="" class="w-full aspect-video rounded object-cover" loading="lazy" />
            {/if}
            <div class="text-sm font-medium line-clamp-2">{v.title}</div>
            <div class="text-xs text-muted">{v.channelTitle}</div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted">{fmtNum(v.viewCount)} views</span>
              {#if v.outlierRatio}
                <span class="text-warn">{v.outlierRatio}× median</span>
              {:else if v.viewsPerDay}
                <span class="text-accent">{fmtNum(v.viewsPerDay)}/day</span>
              {/if}
            </div>
            {#if v.matchedQuery}
              <div class="text-xs text-muted font-mono truncate">"{v.matchedQuery}"</div>
            {/if}
          </a>
        {/each}
        {#if activeVideos().length === 0}
          <p class="text-muted text-sm text-center p-8 col-span-3">nothing in {tab} for this snapshot</p>
        {/if}
      </section>
    {/if}
  {/if}
</div>
