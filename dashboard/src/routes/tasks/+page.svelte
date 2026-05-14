<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  let { data } = $props();
  let filter = $state<"all" | "pending" | "needs_review" | "failed" | "completed" | "paused_backpressure">("all");

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-foreground",
    running: "text-accent",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    completed: "text-muted",
    failed: "text-danger",
    cleared_stale: "text-muted",
  };

  const visibleTasks = $derived(
    filter === "all" ? data.tasks : data.tasks.filter((t) => t.status === filter),
  );

  const cappedPipelines = $derived(
    data.pipelines.filter((p) => (p.counts.needs_review ?? 0) >= p.backpressureCap),
  );

  async function approve(id: string) {
    await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
    await invalidateAll();
  }
  async function reject(id: string) {
    await fetch(`/api/tasks/${id}/reject`, { method: "POST" });
    await invalidateAll();
  }
  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await invalidateAll();
  }
  async function clearFailed(pipelineId?: string) {
    const scope = pipelineId ? `for ${pipelineId}` : "across every pipeline";
    if (!confirm(`Remove every failed task ${scope}? This is irreversible.`)) return;
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId }),
    });
    await invalidateAll();
  }
  async function clearCompleted(pipelineId?: string) {
    const scope = pipelineId ? `for ${pipelineId}` : "across every pipeline";
    if (!confirm(`Remove every completed task ${scope}?`)) return;
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["completed"], pipelineId }),
    });
    await invalidateAll();
  }
  async function runCron() {
    await fetch("/api/cron", { method: "POST" });
    await invalidateAll();
  }

  const failedCount = $derived(data.tasks.filter((t) => t.status === "failed").length);
  const completedCount = $derived(data.tasks.filter((t) => t.status === "completed").length);
  const removable = (s: string) => s === "failed" || s === "completed" || s === "cleared_stale";
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-semibold">Tasks</h2>
    <div class="flex gap-2">
      {#if failedCount > 0}
        <button class="px-3 py-1.5 border border-danger/40 text-danger rounded hover:bg-danger/10 text-sm" onclick={() => clearFailed()}>
          clear failed ({failedCount})
        </button>
      {/if}
      {#if completedCount > 0}
        <button class="px-3 py-1.5 border border-border text-muted rounded hover:bg-card text-sm" onclick={() => clearCompleted()}>
          clear completed ({completedCount})
        </button>
      {/if}
      <button class="px-3 py-1.5 bg-accent text-background rounded text-sm font-medium" onclick={runCron}>
        run /api/cron
      </button>
    </div>
  </div>

  {#if data.lastProcessor && data.lastProcessor.deferred > 0}
    <div class="bg-warn/10 border border-warn/40 rounded p-3 text-sm">
      <strong class="text-warn">{data.lastProcessor.deferred} task{data.lastProcessor.deferred === 1 ? "" : "s"} deferred to next tick</strong>
      <span class="text-muted ml-2">
        last /api/cron ran {new Date(data.lastProcessor.lastRunAt).toLocaleTimeString()}
        · processed {data.lastProcessor.processed}
      </span>
    </div>
  {/if}

  {#if cappedPipelines.length > 0}
    <div class="bg-danger/10 border border-danger rounded p-3 text-sm">
      <strong class="text-danger">Backpressure cap reached</strong>
      <ul class="mt-1 ml-4 list-disc">
        {#each cappedPipelines as p}
          <li>
            <span class="font-mono">{p.id}</span>: {p.counts.needs_review} / {p.backpressureCap} needs_review · new
            top-of-pipeline tasks will be paused
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Pipelines</h3>
    <div class="grid grid-cols-2 gap-3">
      {#each data.pipelines as p}
        <div class="bg-card border border-border rounded p-3 text-sm hover:border-accent transition-colors">
          <div class="flex items-baseline justify-between">
            <a href={`/pipelines/${p.id}`} class="font-mono hover:text-accent">{p.id}</a>
            {#if p.counts.failed > 0}
              <button class="text-xs text-danger hover:underline" onclick={() => clearFailed(p.id)}>
                clear failed ({p.counts.failed})
              </button>
            {/if}
          </div>
          <div class="mt-2 grid grid-cols-3 gap-1 text-xs text-muted">
            <span>pending: {p.counts.pending}</span>
            <span>running: {p.counts.running}</span>
            <span class="text-warn">needs_review: {p.counts.needs_review} / {p.backpressureCap}</span>
            <span>completed: {p.counts.completed}</span>
            <span class="text-danger">failed: {p.counts.failed}</span>
            <span class="text-danger">paused: {p.counts.paused_backpressure ?? 0}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-2">
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted">filter:</span>
      {#each ["all", "pending", "needs_review", "paused_backpressure", "failed", "completed"] as f}
        <button
          class="px-2 py-1 rounded text-xs {filter === f ? 'bg-accent text-background' : 'bg-card text-muted hover:text-foreground'}"
          onclick={() => (filter = f as typeof filter)}
        >
          {f}
        </button>
      {/each}
    </div>

    <table class="w-full text-sm table-fixed">
      <colgroup>
        <col class="w-24" />
        <col class="w-32" />
        <col class="w-32" />
        <col class="w-44" />
        <col class="w-20" />
        <col class="w-28" />
        <col />
      </colgroup>
      <thead class="text-xs text-muted text-left">
        <tr class="border-b border-border">
          <th class="py-2 pr-4">id</th>
          <th class="py-2 pr-4">pipeline</th>
          <th class="py-2 pr-4">phase</th>
          <th class="py-2 pr-4">status</th>
          <th class="py-2 pr-4">retries</th>
          <th class="py-2 pr-4">updated</th>
          <th class="py-2 pr-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each visibleTasks as t}
          <tr class="border-b border-border/40 align-top hover:bg-card/40 cursor-pointer transition-colors" onclick={(e) => {
            // don't navigate when clicking the approve/reject buttons
            if ((e.target as HTMLElement).closest('button')) return;
            location.href = `/tasks/${t.id}`;
          }}>
            <td class="py-2 pr-4 font-mono text-xs whitespace-nowrap">
              <a href={`/tasks/${t.id}`} class="hover:text-accent">{t.id.slice(0, 8)}</a>
            </td>
            <td class="py-2 pr-4 font-mono text-xs">{t.pipelineId}</td>
            <td class="py-2 pr-4 text-xs">{t.phaseId}</td>
            <td class="py-2 pr-4 whitespace-nowrap {STATUS_COLORS[t.status] ?? ''}">{t.status}</td>
            <td class="py-2 pr-4 text-xs">{t.retryCount ?? 0}</td>
            <td class="py-2 pr-4 text-xs text-muted whitespace-nowrap">{new Date(t.updatedAt).toLocaleTimeString()}</td>
            <td class="py-2 pr-2 whitespace-nowrap">
              {#if t.status === "needs_review"}
                <button class="text-ok text-xs mr-2" onclick={() => approve(t.id)}>approve</button>
                <button class="text-danger text-xs mr-2" onclick={() => reject(t.id)}>reject</button>
              {/if}
              {#if removable(t.status)}
                <button class="text-muted hover:text-danger text-xs" onclick={() => remove(t.id)} title="Remove task">remove</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if visibleTasks.length === 0}
      <p class="text-muted text-sm p-4 text-center">no tasks{filter !== "all" ? ` in ${filter}` : ""}</p>
    {/if}
  </section>
</div>
