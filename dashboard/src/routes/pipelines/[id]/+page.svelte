<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatCron } from "$lib/format";
  let { data } = $props();
  const p = $derived(data.pipeline);

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  const GATE_DESC: Record<string, string> = {
    needs_review: "human approval required — task pauses here",
    deterministic: "auto-advance on check() pass, retry on fail",
    auto_pass: "advance unconditionally",
  };
</script>

<div class="space-y-6">
  <div>
    <a href="/" class="text-xs text-muted hover:text-foreground">← overview</a>
    <h2 class="text-2xl font-semibold mt-1 font-mono">{p.id}</h2>
    {#if p.description}
      <p class="text-muted mt-2">{p.description}</p>
    {/if}
  </div>

  <section class="grid grid-cols-3 gap-3 text-sm">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">backpressure cap</div>
      <div class="text-lg font-mono">{p.backpressureCap}</div>
      <div class="text-xs text-muted mt-1">max needs_review tasks before pause</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">cron</div>
      <div class="text-lg">{p.cronSchedule ? formatCron(p.cronSchedule) : "—"}</div>
      <div class="text-xs text-muted mt-1 font-mono">{p.cronSchedule || "manual / chained only"}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">tasks</div>
      <div class="text-lg font-mono">{p.taskCount}</div>
      <div class="text-xs text-muted mt-1">{p.counts.needs_review ?? 0} awaiting review</div>
    </div>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Phases (DAG order)</h3>
    <div class="space-y-2">
      {#each p.phases as ph, i}
        <div class="bg-card border border-border rounded p-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs text-muted mr-2">{i + 1}.</span>
              <span class="font-mono">{ph.id}</span>
            </div>
            <span class="text-xs px-2 py-0.5 rounded bg-sidebar text-warn font-mono">{ph.gateType}</span>
          </div>
          <div class="text-xs text-muted mt-1">{GATE_DESC[ph.gateType]}</div>
          <div class="grid grid-cols-4 gap-2 mt-2 text-xs">
            <div>
              <span class="text-muted">timeout</span> <span class="font-mono">{ph.timeoutMs}ms</span>
            </div>
            <div>
              <span class="text-muted">retry max</span> <span class="font-mono">{ph.retryMax}</span>
            </div>
            <div>
              <span class="text-muted">run fn</span>
              <span class="font-mono {ph.hasRun ? 'text-ok' : 'text-danger'}">{ph.hasRun ? 'yes' : 'no'}</span>
            </div>
            <div>
              <span class="text-muted">check fn</span>
              <span class="font-mono {ph.hasCheck ? 'text-ok' : 'text-muted'}">{ph.hasCheck ? 'yes' : '—'}</span>
            </div>
          </div>
          {#if ph.slashCommand}
            <div class="text-xs mt-2"><span class="text-muted">slash:</span> <code>{ph.slashCommand}</code></div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Status counts</h3>
    <div class="grid grid-cols-4 gap-2 text-sm">
      {#each Object.entries(p.counts) as [status, count]}
        <div class="bg-card border border-border rounded px-3 py-2">
          <div class="text-xs text-muted">{status}</div>
          <div class="font-mono">{count}</div>
        </div>
      {/each}
      {#if Object.keys(p.counts).length === 0}
        <div class="text-muted text-xs col-span-4">no tasks yet</div>
      {/if}
    </div>
  </section>
</div>
