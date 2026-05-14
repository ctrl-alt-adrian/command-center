<script lang="ts">
  let { data } = $props();
  const t = $derived(data.task);

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-foreground",
    running: "text-accent",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    completed: "text-muted",
    failed: "text-danger",
    cleared_stale: "text-muted",
  };

  async function approve() {
    await fetch(`/api/tasks/${t.id}/approve`, { method: "POST" });
    location.reload();
  }
  async function reject() {
    await fetch(`/api/tasks/${t.id}/reject`, { method: "POST" });
    location.reload();
  }
</script>

<div class="space-y-6">
  <div>
    <a href="/tasks" class="text-xs text-muted hover:text-foreground">← tasks</a>
    <div class="flex items-center justify-between mt-1">
      <h2 class="text-2xl font-semibold font-mono">{t.id}</h2>
      <span class="text-sm {STATUS_COLORS[t.status] ?? ''}">{t.status}</span>
    </div>
    <div class="text-sm text-muted mt-1">
      <a href={`/pipelines/${t.pipelineId}`} class="hover:text-foreground underline">{t.pipelineId}</a>
      &middot; phase <span class="font-mono">{t.phaseId}</span>
    </div>
  </div>

  {#if t.status === "needs_review"}
    <div class="flex gap-2">
      <button class="px-3 py-1.5 bg-ok/20 border border-ok text-ok rounded text-sm" onclick={approve}>approve</button>
      <button class="px-3 py-1.5 bg-danger/20 border border-danger text-danger rounded text-sm" onclick={reject}>reject</button>
    </div>
  {/if}

  <section class="grid grid-cols-4 gap-2 text-sm">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">created</div>
      <div class="text-xs font-mono">{new Date(t.createdAt).toLocaleString()}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">updated</div>
      <div class="text-xs font-mono">{new Date(t.updatedAt).toLocaleString()}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">retries</div>
      <div class="font-mono">{t.retryCount ?? 0}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">attempts</div>
      <div class="font-mono">{t.attempts.length}</div>
    </div>
  </section>

  {#if t.gateFailReason}
    <section class="bg-warn/10 border border-warn rounded p-3 text-sm">
      <strong class="text-warn">Last gate fail:</strong> {t.gateFailReason}
    </section>
  {/if}

  {#if t.error}
    <section class="bg-danger/10 border border-danger rounded p-3 text-sm">
      <strong class="text-danger">Error:</strong> {t.error}
    </section>
  {/if}

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Input</h3>
    <pre class="bg-card border border-border rounded p-3 text-xs overflow-x-auto">{JSON.stringify(t.input, null, 2)}</pre>
  </section>

  {#if t.output}
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Output</h3>
      <pre class="bg-card border border-border rounded p-3 text-xs overflow-x-auto">{JSON.stringify(t.output, null, 2)}</pre>
    </section>
  {/if}

  {#if data.phaseOutputs.length > 0}
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Phase outputs (disk)</h3>
      {#each data.phaseOutputs as po}
        <div class="bg-card border border-border rounded p-3 space-y-2">
          <div class="font-mono text-sm">{po.phaseId}</div>
          {#if po.output}
            <pre class="text-xs overflow-x-auto bg-sidebar p-2 rounded">{po.output}</pre>
          {/if}
        </div>
      {/each}
    </section>
  {/if}

  {#if t.attempts.length > 0}
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Attempts</h3>
      <table class="w-full text-xs">
        <thead class="text-muted text-left">
          <tr class="border-b border-border">
            <th class="py-2">phase</th>
            <th>outcome</th>
            <th>reason</th>
            <th>started</th>
            <th>finished</th>
          </tr>
        </thead>
        <tbody>
          {#each t.attempts as a}
            <tr class="border-b border-border/40">
              <td class="py-1 font-mono">{a.phaseId}</td>
              <td>{a.outcome}</td>
              <td class="text-muted">{a.reason ?? ""}</td>
              <td class="text-muted">{new Date(a.startedAt).toLocaleTimeString()}</td>
              <td class="text-muted">{a.finishedAt ? new Date(a.finishedAt).toLocaleTimeString() : ""}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</div>
