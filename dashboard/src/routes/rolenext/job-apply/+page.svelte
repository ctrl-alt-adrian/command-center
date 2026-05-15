<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDateTime } from "$lib/format";
  import Failures from "$lib/Failures.svelte";

  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  const STATUS_COLORS: Record<string, string> = {
    completed: "text-ok",
    running: "text-accent",
    failed: "text-danger",
    pending: "text-foreground",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    paused_user: "text-muted",
    cleared_stale: "text-muted",
  };

  let starting = $state(false);
  let startResult = $state<{ ok: boolean; message: string } | null>(null);

  let keywords = $state("");
  let location = $state("");
  let employmentTypes = $state("");
  let applyLimit = $state<number | "">("");
  let minMatchScore = $state<number | "">(75);

  async function startRun() {
    if (starting) return;
    if (!data.config.jwtSet) {
      startResult = { ok: false, message: "ROLENEXT_JWT is not set — cannot start a run" };
      return;
    }
    starting = true;
    startResult = null;
    try {
      const input: Record<string, unknown> = {};
      const k = keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (k.length) input.keywords = k;
      if (location.trim()) input.location = location.trim();
      if (employmentTypes.trim()) input.employmentTypes = employmentTypes.trim();
      if (typeof applyLimit === "number" && applyLimit > 0) input.applyLimit = applyLimit;
      if (typeof minMatchScore === "number" && minMatchScore >= 0) input.minMatchScore = minMatchScore;

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "rolenext-job-apply", input }),
      });
      if (!res.ok) {
        startResult = { ok: false, message: `task creation failed: ${res.status}` };
        return;
      }
      await fetch("/api/cron", { method: "POST" }).catch(() => undefined);
      startResult = { ok: true, message: "discover task queued — refreshing in a moment" };
      keywords = "";
      location = "";
      employmentTypes = "";
      applyLimit = "";
      minMatchScore = 75;
      await invalidateAll();
    } catch (err) {
      startResult = { ok: false, message: (err as Error).message };
    } finally {
      starting = false;
    }
  }

  let expanded = $state<Record<string, boolean>>({});
  function toggleRun(id: string) {
    expanded[id] = !expanded[id];
  }

  let acting = $state<Record<string, "approving" | "rejecting" | undefined>>({});
  let actionMsg = $state<Record<string, { ok: boolean; message: string } | undefined>>({});

  async function approveOne(taskId: string, label: string) {
    if (acting[taskId]) return;
    acting[taskId] = "approving";
    actionMsg[taskId] = undefined;
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, { method: "POST" });
      if (!res.ok) {
        actionMsg[taskId] = { ok: false, message: `approve failed: ${res.status}` };
        return;
      }
      // Kick the processor so the next phase advances immediately.
      await fetch("/api/cron", { method: "POST" }).catch(() => undefined);
      actionMsg[taskId] = { ok: true, message: `approved: ${label}` };
      await invalidateAll();
    } catch (err) {
      actionMsg[taskId] = { ok: false, message: (err as Error).message };
    } finally {
      acting[taskId] = undefined;
    }
  }

  async function rejectOne(taskId: string, label: string) {
    if (acting[taskId]) return;
    acting[taskId] = "rejecting";
    actionMsg[taskId] = undefined;
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, { method: "POST" });
      if (!res.ok) {
        actionMsg[taskId] = { ok: false, message: `reject failed: ${res.status}` };
        return;
      }
      actionMsg[taskId] = { ok: true, message: `rejected: ${label}` };
      await invalidateAll();
    } catch (err) {
      actionMsg[taskId] = { ok: false, message: (err as Error).message };
    } finally {
      acting[taskId] = undefined;
    }
  }

  let kicking = $state(false);
  let kickResult = $state<{ ok: boolean; message: string } | null>(null);

  async function kickProcessor() {
    if (kicking) return;
    kicking = true;
    kickResult = null;
    try {
      const res = await fetch("/api/cron", { method: "POST" });
      if (!res.ok) {
        kickResult = { ok: false, message: `cron failed: ${res.status}` };
        return;
      }
      kickResult = { ok: true, message: "processor tick fired" };
      await invalidateAll();
    } catch (err) {
      kickResult = { ok: false, message: (err as Error).message };
    } finally {
      kicking = false;
      setTimeout(() => (kickResult = null), 4000);
    }
  }

</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">RoleNext job apply</h2>
      <p class="text-muted text-sm mt-1">
        Bulk job-application prep against the rolenext API. Discover → review → optimize + cover-letter per
        job → download PDFs → mark applied after manual submission.
      </p>
      <p class="text-muted text-xs mt-2">
        api: <code>{data.config.apiBase}</code> · jwt:
        <span class={data.config.jwtSet ? "text-ok" : "text-danger"}>
          {data.config.jwtSet ? "set" : "missing"}
        </span>
        {#if data.config.fanOutBatchSize !== null}
          · fan-out batch <code>{data.config.fanOutBatchSize}</code>
        {/if}
        {#if data.config.perTickCap !== null}
          · per-tick cap <code>{data.config.perTickCap}</code>
        {/if}
      </p>
    </div>
    <div class="flex items-center gap-3">
      <button
        onclick={kickProcessor}
        disabled={kicking}
        class="px-3 py-1.5 rounded bg-accent text-background text-sm hover:bg-accent/80 disabled:opacity-50 whitespace-nowrap"
        title="POST /api/cron — drains up to perTickCap pending tasks immediately instead of waiting for the 5-min cron"
      >
        {kicking ? "kicking…" : "Kick processor"}
      </button>
      {#if kickResult}
        <span class="text-xs {kickResult.ok ? 'text-ok' : 'text-danger'}">{kickResult.message}</span>
      {/if}
      <a href="/rolenext" class="text-xs text-muted hover:text-foreground">← rolenext</a>
    </div>
  </div>

  {#if !data.config.jwtSet}
    <div class="rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
      <p class="font-semibold mb-1">ROLENEXT_JWT not set</p>
      <p>
        Log into rolenext, open DevTools console, run
        <code>await window.Clerk.session.getToken()</code>, then set
        <code>ROLENEXT_JWT=&lt;paste&gt;</code> in <code>.env</code> and restart the dashboard. Default
        Clerk tokens last ~60s — create a long-TTL JWT template in the Clerk dashboard for hour-long
        sessions.
      </p>
    </div>
  {/if}

  <!-- Start a run -->
  <section class="space-y-2 bg-card border border-border rounded p-4">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Start a run</h3>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
      <label class="flex flex-col gap-1 md:col-span-2">
        <span class="text-muted">Keywords (comma-separated, blank = use resume's suggested titles)</span>
        <input
          bind:value={keywords}
          class="bg-sidebar border border-border rounded px-2 py-1.5 text-sm"
          placeholder="Senior Backend Engineer, Staff Engineer"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-muted">Location</span>
        <input
          bind:value={location}
          class="bg-sidebar border border-border rounded px-2 py-1.5 text-sm"
          placeholder="Remote (default)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-muted">Employment types</span>
        <input
          bind:value={employmentTypes}
          class="bg-sidebar border border-border rounded px-2 py-1.5 text-sm"
          placeholder="FULLTIME,CONTRACTOR (default)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-muted">Apply limit</span>
        <input
          type="number"
          min="1"
          max="200"
          bind:value={applyLimit}
          class="bg-sidebar border border-border rounded px-2 py-1.5 text-sm"
          placeholder="50"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-muted">Min match score</span>
        <input
          type="number"
          min="0"
          max="100"
          bind:value={minMatchScore}
          class="bg-sidebar border border-border rounded px-2 py-1.5 text-sm"
          placeholder="75"
        />
      </label>
    </div>
    <div class="flex items-center gap-3 pt-1">
      <button
        onclick={startRun}
        disabled={starting || !data.config.jwtSet}
        class="px-3 py-1.5 rounded bg-accent text-background text-sm hover:bg-accent/80 disabled:opacity-50"
      >
        {starting ? "starting…" : "Start run"}
      </button>
      {#if startResult}
        <span class="text-xs {startResult.ok ? 'text-ok' : 'text-danger'}">{startResult.message}</span>
      {/if}
    </div>
  </section>

  <Failures failures={data.failures} title="Job-apply failures" hidePipelineColumn pipelineId="rolenext-job-apply" />

  <!-- Awaiting approval -->
  <section class="space-y-2">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
      Awaiting your approval ({data.awaitingApproval.length})
    </h3>
    {#if data.awaitingApproval.length === 0}
      <p class="text-sm text-muted">Nothing waiting on you right now.</p>
    {:else}
      <ul class="space-y-1 text-sm">
        {#each data.awaitingApproval as a}
          <li class="flex items-center gap-3 bg-card border border-border rounded px-3 py-2">
            <span class="font-mono text-xs text-warn whitespace-nowrap">{a.phaseId}</span>
            <span class="text-xs flex-1">{a.hint}</span>
            {#if actionMsg[a.taskId]}
              <span class="text-xs {actionMsg[a.taskId]!.ok ? 'text-ok' : 'text-danger'}">
                {actionMsg[a.taskId]!.message}
              </span>
            {/if}
            <button
              onclick={() => approveOne(a.taskId, a.hint)}
              disabled={!!acting[a.taskId]}
              class="px-2 py-1 rounded bg-ok/20 border border-ok text-ok text-xs hover:bg-ok/30 disabled:opacity-50 whitespace-nowrap"
              title={a.phaseId === "mark-applied" ? "Confirms you submitted; PATCHes rolenext to status: applied" : "Advance to the next phase"}
            >
              {acting[a.taskId] === "approving" ? "approving…" : a.phaseId === "mark-applied" ? "I applied" : "approve"}
            </button>
            <button
              onclick={() => rejectOne(a.taskId, a.hint)}
              disabled={!!acting[a.taskId]}
              class="px-2 py-1 rounded bg-danger/10 border border-danger/40 text-danger text-xs hover:bg-danger/20 disabled:opacity-50 whitespace-nowrap"
            >
              {acting[a.taskId] === "rejecting" ? "rejecting…" : "reject"}
            </button>
            <a
              href={`/tasks/${a.taskId}`}
              class="text-xs text-muted hover:text-foreground whitespace-nowrap"
            >open →</a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Runs -->
  <section class="space-y-2">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Runs ({data.runs.length})</h3>
    {#if data.runs.length === 0}
      <p class="text-sm text-muted">No runs yet. Start one above.</p>
    {:else}
      <ul class="space-y-2">
        {#each data.runs as run}
          <li class="bg-card border border-border rounded">
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-card/60"
              onclick={() => toggleRun(run.discoverId)}
            >
              <span class="font-mono text-xs text-muted whitespace-nowrap">{formatDateTime(run.createdAt)}</span>
              <span class="text-xs {STATUS_COLORS[run.discoverStatus] ?? ''}">discover: {run.discoverStatus}</span>
              {#if run.selectStatus}
                <span class="text-xs {STATUS_COLORS[run.selectStatus] ?? ''}">select: {run.selectStatus}</span>
              {/if}
              {#if run.candidateCount !== null}
                <span class="text-xs text-muted">
                  {run.candidateCount} candidates{run.minMatchScore !== null ? ` ≥ ${run.minMatchScore}` : ""}
                  {#if run.droppedBelowFloor}({run.droppedBelowFloor} dropped){/if}
                </span>
              {/if}
              {#if run.selectedCount !== null}
                <span class="text-xs text-muted">→ {run.selectedCount} queued</span>
              {/if}
              <span class="text-xs text-muted ml-auto">
                prep: {run.prep.length} · applied: {run.appliedCount}
              </span>
              <span class="text-xs text-muted">{expanded[run.discoverId] ? "▼" : "▶"}</span>
            </button>

            {#if expanded[run.discoverId]}
              <div class="px-3 py-3 border-t border-border space-y-3 text-sm">
                <div class="flex items-center gap-3 text-xs flex-wrap">
                  <a class="text-accent hover:underline" href={`/tasks/${run.discoverId}`}>discover task</a>
                  {#if run.candidatesMdExists}
                    <span class="text-muted">candidates.md ✓</span>
                  {/if}
                  {#if run.selectId}
                    <a class="text-accent hover:underline" href={`/tasks/${run.selectId}`}>select task</a>
                  {/if}
                  {#if run.reviewMdExists}
                    <span class="text-muted">review.md ✓</span>
                  {/if}
                </div>

                {#if Object.keys(run.prepCounts).length > 0}
                  <div class="text-xs flex items-center gap-2 flex-wrap">
                    <span class="text-muted">prep:</span>
                    {#each Object.entries(run.prepCounts) as [status, count]}
                      <span class={STATUS_COLORS[status] ?? "text-muted"}>{status}: {count}</span>
                    {/each}
                  </div>
                {/if}

                {#if run.prep.length > 0}
                  <table class="w-full text-xs">
                    <thead class="text-muted text-left">
                      <tr class="border-b border-border">
                        <th class="py-1.5 pr-3">job</th>
                        <th class="py-1.5 pr-3">status</th>
                        <th class="py-1.5 pr-3">files</th>
                        <th class="py-1.5 pr-3">applied</th>
                        <th class="py-1.5 pr-2">task</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each run.prep as p}
                        <tr class="border-b border-border/40 align-top hover:bg-sidebar/40">
                          <td class="py-1.5 pr-3">
                            <div class="font-medium">{p.title}</div>
                            <div class="text-muted">{p.company}</div>
                            {#if p.url}
                              <a href={p.url} target="_blank" rel="noopener" class="text-accent hover:underline">apply ↗</a>
                            {/if}
                          </td>
                          <td class="py-1.5 pr-3 {STATUS_COLORS[p.status] ?? ''}">{p.status}</td>
                          <td class="py-1.5 pr-3 text-muted">
                            {#if p.resumePdfExists}
                              <a
                                href={`/api/tasks/${p.taskId}/files/resume.pdf?phase=prep&download=1`}
                                class="text-accent hover:underline"
                                download={`resume_${p.company}_${p.title}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "_")}
                              >resume</a>
                            {/if}
                            {#if p.resumePdfExists && p.coverPdfExists}
                              <span class="text-muted"> · </span>
                            {/if}
                            {#if p.coverPdfExists}
                              <a
                                href={`/api/tasks/${p.taskId}/files/cover.pdf?phase=prep&download=1`}
                                class="text-accent hover:underline"
                                download={`cover_${p.company}_${p.title}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "_")}
                              >cover</a>
                            {/if}
                            {#if !p.resumePdfExists && !p.coverPdfExists}—{/if}
                          </td>
                          <td class="py-1.5 pr-3">
                            {#if p.appliedTaskId}
                              <a href={`/tasks/${p.appliedTaskId}`} class="text-accent hover:underline">
                                {p.appliedStatus}
                              </a>
                            {:else}
                              —
                            {/if}
                          </td>
                          <td class="py-1.5 pr-2">
                            <a href={`/tasks/${p.taskId}`} class="text-accent hover:underline font-mono">{p.taskId.slice(0, 8)}</a>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
