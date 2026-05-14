<script lang="ts">
  import { formatCron, formatDate, formatDateTime } from "$lib/format";
  let { data } = $props();
  let running = $state(false);

  async function clearFailed() {
    if (!confirm(`Remove ${data.failedCount} failed software-factory task(s)? This is irreversible.`)) return;
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId: "software-factory-housekeeping" }),
    });
    location.reload();
  }

  async function runHousekeeping() {
    if (running) return;
    running = true;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "software-factory-housekeeping" }),
      });
      if (res.ok) {
        await fetch("/api/cron", { method: "POST" });
        location.href = "/tasks";
      }
    } finally {
      running = false;
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    completed: "text-ok",
    running: "text-accent",
    failed: "text-danger",
    pending: "text-foreground",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    cleared_stale: "text-muted",
  };
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Software Factory</h2>
      <p class="text-muted text-sm mt-1">
        Domain namespace for the system maintaining itself and its own development workflow.
        See <a href="/pipelines/software-factory-housekeeping" class="text-accent hover:underline">housekeeping DAG</a>
        and the <code>pipelines/software-factory/README.md</code> for the add-a-pipeline pattern.
      </p>
    </div>
    <div class="flex gap-2">
      {#if data.failedCount > 0}
        <button class="px-3 py-2 border border-danger/40 text-danger rounded hover:bg-danger/10 text-sm" onclick={clearFailed}>
          clear failed ({data.failedCount})
        </button>
      {/if}
      <button
        class="px-4 py-2 bg-accent text-background rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
        disabled={running}
        onclick={runHousekeeping}
      >
        {running ? "starting…" : "Run housekeeping"}
      </button>
    </div>
  </div>

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Active pipelines</h3>
    {#each data.active as p}
      <a href={`/pipelines/${p.id}`} class="block bg-card border border-border rounded p-4 hover:border-accent transition-colors">
        <div class="flex items-baseline justify-between">
          <div class="font-mono">{p.id}</div>
          <div class="text-xs text-muted">{formatCron(p.cronSchedule)}</div>
        </div>
        <p class="text-sm text-muted mt-2">{p.description}</p>
        <div class="flex gap-4 mt-3 text-xs text-muted">
          <span>tasks: <span class="font-mono">{p.taskCount}</span></span>
          {#if p.lastRun}
            <span>
              last run: <span class="font-mono">{formatDateTime(p.lastRun)}</span>
              {#if p.lastStatus}<span class="ml-1 {STATUS_COLORS[p.lastStatus] ?? ''}">· {p.lastStatus}</span>{/if}
            </span>
          {:else}
            <span>never run yet</span>
          {/if}
        </div>
      </a>
    {/each}
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Reserved (not implemented)</h3>
    <ul class="space-y-2">
      {#each data.reserved as r}
        <li class="bg-card border border-border/40 border-dashed rounded p-3">
          <div class="flex items-baseline justify-between">
            <div class="font-mono">{r.id}</div>
            <span class="text-xs text-muted uppercase tracking-wider">reserved</span>
          </div>
          <p class="text-sm text-muted mt-1">{r.description}</p>
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Recent housekeeping logs</h3>
    {#if data.logs.length === 0}
      <p class="text-muted text-sm">no logs yet — housekeeping hasn't run</p>
    {:else}
      <table class="w-full text-sm table-fixed">
        <colgroup>
          <col class="w-32" />
          <col class="w-24" />
          <col />
        </colgroup>
        <thead class="text-xs text-muted text-left">
          <tr class="border-b border-border">
            <th class="py-2 pr-4">date</th>
            <th class="py-2 pr-4">tasks cleared</th>
            <th class="py-2 pr-2">log lines</th>
          </tr>
        </thead>
        <tbody>
          {#each data.logs as l}
            <tr class="border-b border-border/40">
              <td class="py-2 pr-4 font-mono text-xs">{formatDate(l.date)}</td>
              <td class="py-2 pr-4 text-xs {l.cleared > 0 ? 'text-warn' : 'text-muted'}">{l.cleared}</td>
              <td class="py-2 pr-2 text-xs text-muted">{l.lineCount}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</div>
