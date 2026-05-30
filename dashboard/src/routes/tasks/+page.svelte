<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import Failures from "$lib/Failures.svelte";

  let { data } = $props();
  let filter = $state<"all" | "pending" | "needs_review" | "failed" | "completed" | "paused_backpressure" | "paused_user">("all");

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 3000);
    return () => clearInterval(id);
  });

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-foreground",
    running: "text-accent",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    paused_user: "text-warn",
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
  async function rerun(id: string) {
    await fetch(`/api/tasks/${id}/rerun`, { method: "POST" });
    await invalidateAll();
  }
  async function disable(id: string) {
    await fetch(`/api/tasks/${id}/disable`, { method: "POST" });
    await invalidateAll();
  }
  async function enable(id: string) {
    await fetch(`/api/tasks/${id}/enable`, { method: "POST" });
    await invalidateAll();
  }
  async function rerunFailed(pipelineId?: string) {
    await fetch("/api/tasks/rerun", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId }),
    });
    await invalidateAll();
  }
  async function resumeBatch(pipelineId?: string, count = 25) {
    await fetch("/api/tasks/resume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId, count }),
    });
    await invalidateAll();
  }
  async function clearFailed(pipelineId?: string) {
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId }),
    });
    await invalidateAll();
  }
  async function clearCompleted(pipelineId?: string) {
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
  // Set of "pipelineId:phaseId" strings for deterministic gates. Tasks at
  // these phases with gateFailReason can't be approved past — they need a
  // gate rerun or rejection.
  const deterministicPhases = $derived.by(() => {
    const s = new Set<string>();
    for (const p of data.pipelines) {
      for (const ph of p.phases) if (ph.gateType === "deterministic") s.add(`${p.id}:${ph.id}`);
    }
    return s;
  });
  const isGateBlocked = (t: typeof data.tasks[number]) =>
    t.status === "needs_review" && !!t.gateFailReason && deterministicPhases.has(`${t.pipelineId}:${t.phaseId}`);
  const needsReviewCount = $derived(
    data.tasks.filter((t) => t.status === "needs_review" && !isGateBlocked(t)).length,
  );
  const isSlopFailed = (t: typeof data.tasks[number]) =>
    t.status === "needs_review" && t.phaseId === "slop-check" && !!t.gateFailReason;
  const slopFailedTotal = $derived(data.tasks.filter(isSlopFailed).length);
  const slopFailedByPipeline = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const t of data.tasks) if (isSlopFailed(t)) m[t.pipelineId] = (m[t.pipelineId] ?? 0) + 1;
    return m;
  });
  /** Per-pipeline → per-phase → {running, pending} in-flight breakdown.
   *  Only phases with at least one in-flight task end up in the map so the
   *  card renders nothing when everything's idle. */
  const inFlightByPipelinePhase = $derived.by(() => {
    const m: Record<string, Record<string, { running: number; pending: number }>> = {};
    for (const t of data.tasks) {
      if (t.status !== "running" && t.status !== "pending") continue;
      const byPhase = m[t.pipelineId] ?? (m[t.pipelineId] = {});
      const slot = byPhase[t.phaseId] ?? (byPhase[t.phaseId] = { running: 0, pending: 0 });
      if (t.status === "running") slot.running++;
      else slot.pending++;
    }
    return m;
  });
  const removable = (s: string) => s === "failed" || s === "completed" || s === "cleared_stale";

  async function approveAll(pipelineId?: string) {
    await fetch("/api/tasks/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId }),
    });
    await invalidateAll();
  }
  async function togglePipeline(pipelineId: string, enabled: boolean) {
    await fetch(`/api/pipelines/${pipelineId}/enabled`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await invalidateAll();
  }
  async function rerunGate(id: string) {
    await fetch(`/api/tasks/${id}/rerun-gate`, { method: "POST" });
    await invalidateAll();
  }
  async function rerunSlopBulk(pipelineId?: string) {
    await fetch("/api/tasks/rerun-gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId, phaseId: "slop-check" }),
    });
    await invalidateAll();
  }
  async function clearFailures(pipelineId?: string) {
    await fetch("/api/tasks/clear-failures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId }),
    });
    await invalidateAll();
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-semibold">Tasks</h2>
    <div class="flex gap-2 flex-wrap">
      {#if needsReviewCount > 0}
        <button class="px-3 py-1.5 border border-warn/40 text-warn rounded hover:bg-warn/10 text-sm" onclick={() => approveAll()}>
          approve all ({needsReviewCount})
        </button>
      {/if}
      {#if slopFailedTotal > 0}
        <button class="px-3 py-1.5 border border-accent/40 text-accent rounded hover:bg-accent/10 text-sm" onclick={() => rerunSlopBulk()}>
          rerun slop-check ({slopFailedTotal})
        </button>
      {/if}
      {#if data.failures.length > 0}
        <button class="px-3 py-1.5 border border-danger/40 text-danger rounded hover:bg-danger/10 text-sm" onclick={() => clearFailures()}>
          clear failures ({data.failures.length})
        </button>
      {/if}
      {#if failedCount > 0}
        <button class="px-3 py-1.5 border border-accent/40 text-accent rounded hover:bg-accent/10 text-sm" onclick={() => rerunFailed()}>
          rerun failed ({failedCount})
        </button>
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

  <Failures failures={data.failures} title="Failures across all pipelines" />

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
        <div class="bg-card border {p.enabled ? 'border-border' : 'border-warn/40'} rounded p-3 text-sm hover:border-accent transition-colors">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <button
                type="button"
                role="switch"
                aria-checked={p.enabled}
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 {p.enabled ? 'bg-ok' : 'bg-muted/40'}"
                onclick={() => togglePipeline(p.id, !p.enabled)}
                title={p.enabled ? 'Disable — processor skips all tasks for this pipeline' : 'Enable — pipeline resumes processing'}
              >
                <span class="inline-block h-3 w-3 transform rounded-full bg-background transition-transform {p.enabled ? 'translate-x-5' : 'translate-x-1'}"></span>
              </button>
              <a href={`/pipelines/${p.id}`} class="font-mono hover:text-accent truncate {p.enabled ? '' : 'text-muted'}">{p.id}</a>
              {#if !p.enabled}
                <span class="text-xs text-warn shrink-0">disabled</span>
              {/if}
            </div>
            {#if p.counts.failed > 0}
              <div class="flex gap-2 text-xs shrink-0">
                <button class="text-accent hover:underline" onclick={() => rerunFailed(p.id)}>
                  rerun failed ({p.counts.failed})
                </button>
                <button class="text-danger hover:underline" onclick={() => clearFailed(p.id)}>
                  clear
                </button>
              </div>
            {/if}
          </div>
          <div class="mt-2 grid grid-cols-3 gap-1 text-xs text-muted">
            <span>pending: {p.counts.pending}</span>
            <span>running: {p.counts.running}</span>
            <span class="text-warn">needs_review: {p.counts.needs_review} / {p.backpressureCap}</span>
            <span>completed: {p.counts.completed}</span>
            <span class="text-danger">failed: {p.counts.failed}</span>
            <span class="text-warn">paused: {(p.counts.paused_backpressure ?? 0) + (p.counts.paused_user ?? 0)}</span>
          </div>
          {#if inFlightByPipelinePhase[p.id]}
            <div class="mt-2 pt-2 border-t border-border/40 text-xs text-muted">
              <div class="text-[10px] uppercase tracking-wider text-muted/60 mb-1">in flight by phase</div>
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                {#each p.phases as ph}
                  {@const slot = inFlightByPipelinePhase[p.id]?.[ph.id]}
                  {#if slot && (slot.running > 0 || slot.pending > 0)}
                    <span class="font-mono">
                      {ph.id}:
                      {#if slot.running > 0}<span class="text-accent">{slot.running} running</span>{/if}
                      {#if slot.running > 0 && slot.pending > 0}<span class="text-muted/50"> · </span>{/if}
                      {#if slot.pending > 0}<span class="text-foreground">{slot.pending} pending</span>{/if}
                    </span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
          {#if (slopFailedByPipeline[p.id] ?? 0) > 0}
            <div class="mt-2 flex items-center justify-between text-xs">
              <span class="text-warn">{slopFailedByPipeline[p.id]} stuck at slop-check</span>
              <button class="text-accent hover:underline" onclick={() => rerunSlopBulk(p.id)}>
                rerun slop-check ({slopFailedByPipeline[p.id]})
              </button>
            </div>
          {/if}
          {#if (p.counts.paused_user ?? 0) > 0}
            <div class="mt-2 flex items-center justify-between text-xs">
              <span class="text-warn">{p.counts.paused_user} held back from fan-out</span>
              <div class="flex gap-2">
                <button class="text-accent hover:underline" onclick={() => resumeBatch(p.id, 25)}>
                  resume next 25
                </button>
                <button class="text-accent hover:underline" onclick={() => resumeBatch(p.id, p.counts.paused_user ?? 0)}>
                  resume all
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-2">
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted">filter:</span>
      {#each ["all", "pending", "needs_review", "paused_user", "paused_backpressure", "failed", "completed"] as f}
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
          <th class="py-2 pr-4" title="Toggle to manually disable a pending task or re-enable a disabled one. Default: enabled.">enabled</th>
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
            <td class="py-2 pr-4">
              {#if t.status === "pending" || t.status === "paused_backpressure" || t.status === "paused_user"}
                {@const enabled = t.status !== "paused_user"}
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors {enabled ? 'bg-ok' : 'bg-muted/40'}"
                  onclick={() => (enabled ? disable(t.id) : enable(t.id))}
                  title={enabled ? 'Disable — keep task out of the processor' : 'Enable — return task to pending queue'}
                >
                  <span class="inline-block h-3 w-3 transform rounded-full bg-background transition-transform {enabled ? 'translate-x-5' : 'translate-x-1'}"></span>
                </button>
              {:else}
                <span class="text-xs text-muted/60">—</span>
              {/if}
            </td>
            <td class="py-2 pr-4 text-xs text-muted whitespace-nowrap">{new Date(t.updatedAt).toLocaleTimeString()}</td>
            <td class="py-2 pr-2 whitespace-nowrap">
              {#if t.status === "needs_review"}
                {#if t.phaseId === "slop-check" && t.gateFailReason}
                  <button class="text-accent text-xs mr-2" onclick={() => rerunGate(t.id)} title="Re-run the slop-check gate with a fresh retry budget — required before this task can advance">rerun slop</button>
                  <button class="text-danger text-xs mr-2" onclick={() => reject(t.id)}>reject</button>
                {:else}
                  <button class="text-ok text-xs mr-2" onclick={() => approve(t.id)}>approve</button>
                  <button class="text-danger text-xs mr-2" onclick={() => reject(t.id)}>reject</button>
                {/if}
              {/if}
              {#if t.status === "failed"}
                <button class="text-accent text-xs mr-2" onclick={() => rerun(t.id)}>rerun</button>
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
