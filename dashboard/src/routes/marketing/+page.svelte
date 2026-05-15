<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDate } from "$lib/format";
  let { data } = $props();

  // Local mirror of enabled platforms, seeded once from the server load.
  // svelte-ignore state_referenced_locally
  let enabled = $state(new Set(data.enabledPlatforms));
  let savingPlatforms = $state(false);
  let running = $state(false);

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  async function togglePlatform(p: string) {
    if (savingPlatforms) return;
    savingPlatforms = true;
    const next = new Set(enabled);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    const disabled = data.allPlatforms.filter((x) => !next.has(x));
    try {
      const res = await fetch("/api/marketing/platforms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      if (res.ok) {
        const body = await res.json();
        enabled = new Set(body.enabled);
      }
    } finally {
      savingPlatforms = false;
    }
  }

  async function clearFailed() {
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId: "marketing" }),
    });
    location.reload();
  }

  async function rerunFailed() {
    await fetch("/api/tasks/rerun", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId: "marketing" }),
    });
    location.reload();
  }

  async function runDiscovery() {
    if (running) return;
    running = true;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "marketing" }),
      });
      if (res.ok) {
        await fetch("/api/cron", { method: "POST" });
        location.href = "/tasks";
      } else {
        const text = await res.text();
        alert(`Failed to start: ${text}`);
      }
    } finally {
      running = false;
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-foreground",
    running: "text-accent",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    completed: "text-muted",
    failed: "text-danger",
    cleared_stale: "text-muted",
  };
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Marketing</h2>
      <p class="text-muted text-sm mt-1">
        KB → discovery → captain approval → per-platform drafts → slop gate → final review ·
        <a href="/pipelines/marketing" class="text-accent hover:underline">full DAG</a>
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
      disabled={running || enabled.size === 0}
      title={enabled.size === 0 ? "Enable at least one platform first" : "Trigger marketing discovery"}
      onclick={runDiscovery}
    >
      {running ? "starting…" : "Run discovery"}
    </button>
    </div>
  </div>

  <section class="grid grid-cols-3 gap-3">
    <a href="/marketing/kb" class="bg-card border border-border rounded p-3 hover:border-accent transition-colors">
      <div class="text-xs text-muted">knowledge base</div>
      <div class="text-2xl font-mono mt-1">{data.kbCount}</div>
      <div class="text-xs text-muted mt-1">entries</div>
    </a>
    <a href="/marketing/drafts" class="bg-card border border-border rounded p-3 hover:border-accent transition-colors">
      <div class="text-xs text-muted">drafts</div>
      <div class="text-2xl font-mono mt-1">{data.draftCount}</div>
      <div class="text-xs text-muted mt-1">sets across all platforms</div>
    </a>
    <a href="/tasks" class="bg-card border border-border rounded p-3 hover:border-accent transition-colors">
      <div class="text-xs text-muted">marketing tasks</div>
      <div class="text-2xl font-mono mt-1">{data.taskCount}</div>
      <div class="text-xs mt-1 {data.needsReview > 0 ? 'text-warn' : 'text-muted'}">
        {data.needsReview} awaiting review
      </div>
    </a>
  </section>

  <section class="bg-card border border-border rounded p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Platforms</h3>
      <span class="text-xs text-muted">click to toggle · {enabled.size} of {data.allPlatforms.length} enabled</span>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each data.allPlatforms as p}
        {@const on = enabled.has(p)}
        <button
          class="px-3 py-1.5 rounded border text-sm font-mono transition-colors disabled:opacity-50 {on
            ? 'bg-ok/15 border-ok/40 text-ok hover:bg-ok/25'
            : 'bg-sidebar border-border text-muted hover:text-foreground hover:border-foreground/30'}"
          onclick={() => togglePlatform(p)}
          disabled={savingPlatforms}
        >
          {on ? "✓" : "○"} {p}
        </button>
      {/each}
    </div>
  </section>

  <section class="bg-card border border-border rounded p-4 space-y-3">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Pipeline phases</h3>
    <div class="flex items-center gap-2 flex-wrap text-sm">
      {#each data.phases as ph, i}
        <a href="/pipelines/marketing" class="hover:text-accent">
          <span class="font-mono">{ph.id}</span>
          <span class="ml-1 text-xs text-muted">[{ph.gateType}]</span>
        </a>
        {#if i < data.phases.length - 1}
          <span class="text-muted">→</span>
        {/if}
      {/each}
    </div>
  </section>

  <section class="grid grid-cols-3 gap-4">
    <div class="space-y-2 min-w-0">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Recent KB</h3>
        <a href="/marketing/kb" class="text-xs text-muted hover:text-foreground">all →</a>
      </div>
      <ul class="space-y-2">
        {#each data.kbRecent as e}
          <li class="text-sm flex gap-3">
            <a href={`/marketing/kb/${e.id}`} class="text-xs text-muted font-mono whitespace-nowrap pt-0.5 hover:text-accent">{formatDate(e.date)}</a>
            <a href={`/marketing/kb/${e.id}`} class="flex-1 hover:text-accent">{e.summary || e.id}</a>
          </li>
        {/each}
        {#if data.kbRecent.length === 0}
          <li class="text-muted text-xs">no KB entries yet</li>
        {/if}
      </ul>
    </div>

    <div class="space-y-2 min-w-0">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Recent drafts</h3>
        <a href="/marketing/drafts" class="text-xs text-muted hover:text-foreground">all →</a>
      </div>
      <ul class="space-y-2">
        {#each data.draftRecent as d}
          <li class="text-sm flex gap-3">
            <a href={`/marketing/drafts/${d.date}`} class="text-xs text-muted font-mono whitespace-nowrap pt-0.5 hover:text-accent">{formatDate(d.date.slice(0, 10))}</a>
            <span class="flex-1 min-w-0">
              <a href={`/marketing/drafts/${d.date}`} class="hover:text-accent">{d.title ?? "(untitled)"}</a>
              <span class="text-xs text-muted">· {d.platforms.length} platforms</span>
            </span>
          </li>
        {/each}
        {#if data.draftRecent.length === 0}
          <li class="text-muted text-xs">no drafts yet — click "Run discovery" to start</li>
        {/if}
      </ul>
    </div>

    <div class="space-y-2 min-w-0">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Recent tasks</h3>
        <a href="/tasks" class="text-xs text-muted hover:text-foreground">all →</a>
      </div>
      <ul class="space-y-2">
        {#each data.recentTasks as t}
          <li class="text-sm flex gap-3">
            <a href={`/tasks/${t.id}`} class="text-xs font-mono whitespace-nowrap pt-0.5 hover:text-accent {STATUS_COLORS[t.status] ?? ''}">{t.status}</a>
            <a href={`/tasks/${t.id}`} class="flex-1 hover:text-accent">
              <span class="font-mono text-xs">{t.id.slice(0, 8)}</span>
              <span class="text-xs text-muted">· {t.phaseId}</span>
            </a>
          </li>
        {/each}
        {#if data.recentTasks.length === 0}
          <li class="text-muted text-xs">no tasks yet</li>
        {/if}
      </ul>
    </div>
  </section>
</div>
