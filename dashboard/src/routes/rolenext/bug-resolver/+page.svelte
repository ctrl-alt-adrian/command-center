<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDateTime } from "$lib/format";
  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  type IncidentMeta = (typeof data.incidents)[number]["meta"];

  let featureFilter = $state<string>("");
  let rootCauseFilter = $state<string>("");
  let statusFilter = $state<string>("");
  let expanded = $state<Record<string, boolean>>({});

  const featureAreas = $derived(
    Array.from(new Set(data.incidents.map((i) => i.meta.featureArea ?? ""))).filter(Boolean).sort(),
  );
  const rootCauses = $derived(
    Array.from(new Set(data.incidents.map((i) => i.meta.rootCauseClass ?? ""))).filter(Boolean).sort(),
  );
  const statuses = $derived(
    Array.from(new Set(data.incidents.map((i) => i.meta.status ?? ""))).filter(Boolean).sort(),
  );

  const filteredIncidents = $derived(
    data.incidents.filter((i) => {
      if (featureFilter && i.meta.featureArea !== featureFilter) return false;
      if (rootCauseFilter && i.meta.rootCauseClass !== rootCauseFilter) return false;
      if (statusFilter && i.meta.status !== statusFilter) return false;
      return true;
    }),
  );

  const STATUS_COLORS: Record<string, string> = {
    completed: "text-ok",
    running: "text-accent",
    failed: "text-danger",
    pending: "text-foreground",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    cleared_stale: "text-muted",
  };

  const INCIDENT_STATUS_COLORS: Record<string, string> = {
    resolved: "text-ok",
    escalated: "text-warn",
    "cannot-reproduce": "text-muted",
  };

  function toggle(slug: string) {
    expanded[slug] = !expanded[slug];
  }

  let polling = $state(false);
  let pollResult = $state<{ ok: boolean; message: string } | null>(null);

  async function runNow() {
    if (polling) return;
    polling = true;
    pollResult = null;
    try {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "rolenext-bug-resolver" }),
      });
      if (!taskRes.ok) {
        pollResult = { ok: false, message: `task creation failed: ${taskRes.status}` };
        return;
      }
      await fetch("/api/cron", { method: "POST" }).catch(() => undefined);
      pollResult = { ok: true, message: "poll triggered — refreshing in a moment" };
      await invalidateAll();
    } catch (err) {
      pollResult = { ok: false, message: (err as Error).message };
    } finally {
      polling = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">RoleNext bug resolver</h2>
      <p class="text-muted text-sm mt-1">
        Autonomous pipeline polling <code>{data.config.repo}</code> for GitHub issues. Investigate-only triage
        (browser repro <code>enabled: {data.config.enableBrowserRepro ? "yes" : "no"}</code>) →
        fix → verify → draft PR → post-mortem.
      </p>
      <p class="text-muted text-xs mt-2">
        Caps: {data.config.caps.maxTicketsPerDay}/day · queue depth {data.config.caps.maxQueueDepth} ·
        concurrency {data.config.caps.concurrency} · stale {data.config.caps.ticketStaleAfterDays}d
      </p>
    </div>
    <div class="flex items-center gap-3">
      <button
        onclick={runNow}
        disabled={polling}
        class="px-3 py-1.5 rounded bg-accent text-background text-sm hover:bg-accent/80 disabled:opacity-50 whitespace-nowrap"
        title="Run the poll-issues phase immediately (picks up new issues + new comments on existing issues)"
      >
        {polling ? "polling…" : "Run now"}
      </button>
      <a href="/" class="text-xs text-muted hover:text-foreground">← home</a>
    </div>
  </div>
  {#if pollResult}
    <div class="text-xs {pollResult.ok ? 'text-ok' : 'text-danger'}">{pollResult.message}</div>
  {/if}

  <!-- Queue -->
  <section class="space-y-2">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Current queue ({data.queue.length})</h3>
    {#if data.queue.length === 0}
      <p class="text-sm text-muted">No active tasks.</p>
    {:else}
      <table class="w-full text-sm">
        <thead class="text-xs text-muted text-left">
          <tr class="border-b border-border">
            <th class="py-2 pr-4">phase</th>
            <th class="py-2 pr-4">status</th>
            <th class="py-2 pr-4">issue</th>
            <th class="py-2 pr-4">attempt</th>
            <th class="py-2 pr-4">updated</th>
            <th class="py-2 pr-2">reason</th>
          </tr>
        </thead>
        <tbody>
          {#each data.queue as row}
            <tr class="border-b border-border/40 align-top hover:bg-card/40">
              <td class="py-2 pr-4 font-mono text-xs">{row.phaseId}</td>
              <td class="py-2 pr-4 text-xs {STATUS_COLORS[row.status] ?? ''}">{row.status}</td>
              <td class="py-2 pr-4 font-mono text-xs">
                {#if row.issueNumber}
                  <a href={`https://github.com/${data.config.repo}/issues/${row.issueNumber}`} target="_blank" rel="noopener" class="hover:text-accent">#{row.issueNumber}</a>
                {:else}
                  —
                {/if}
              </td>
              <td class="py-2 pr-4 font-mono text-xs">{row.attempt}</td>
              <td class="py-2 pr-4 font-mono text-xs text-muted">{formatDateTime(row.updatedAt)}</td>
              <td class="py-2 pr-2 text-xs text-muted">{row.gateFailReason ?? ""}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <!-- Recent PRs -->
  <section class="space-y-2">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Recent PRs ({data.recentPRs.length})</h3>
    {#if data.recentPRs.length === 0}
      <p class="text-sm text-muted">No PRs opened yet.</p>
    {:else}
      <ul class="space-y-1 text-sm">
        {#each data.recentPRs as pr}
          <li class="flex items-center gap-3">
            <a href={pr.prUrl} target="_blank" rel="noopener" class="hover:text-accent">{pr.prUrl}</a>
            <span class="text-xs {STATUS_COLORS[pr.status] ?? 'text-muted'}">{pr.status}</span>
            <span class="text-xs text-muted ml-auto">{formatDateTime(pr.updatedAt)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Post-mortem feed -->
  <section class="space-y-3">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
        Post-mortems ({filteredIncidents.length}/{data.incidents.length})
      </h3>
      <div class="flex items-center gap-2 text-xs">
        <select bind:value={featureFilter} class="bg-card border border-border rounded px-2 py-1 text-xs">
          <option value="">all areas</option>
          {#each featureAreas as a}<option value={a}>{a}</option>{/each}
        </select>
        <select bind:value={rootCauseFilter} class="bg-card border border-border rounded px-2 py-1 text-xs">
          <option value="">all root causes</option>
          {#each rootCauses as r}<option value={r}>{r}</option>{/each}
        </select>
        <select bind:value={statusFilter} class="bg-card border border-border rounded px-2 py-1 text-xs">
          <option value="">all statuses</option>
          {#each statuses as s}<option value={s}>{s}</option>{/each}
        </select>
      </div>
    </div>

    {#if filteredIncidents.length === 0}
      <p class="text-sm text-muted">No incidents match these filters.</p>
    {:else}
      <ul class="space-y-2">
        {#each filteredIncidents as inc}
          {@const meta = inc.meta as IncidentMeta}
          <li class="bg-card border border-border rounded">
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-card/60"
              onclick={() => toggle(inc.slug)}
            >
              <span class="font-mono text-xs text-muted whitespace-nowrap">{meta.date}</span>
              <span class="font-mono text-xs">#{meta.issueNumber}</span>
              <span class="text-xs {INCIDENT_STATUS_COLORS[meta.status ?? ''] ?? 'text-muted'}">{meta.status}</span>
              <span class="text-xs text-muted">{meta.featureArea}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-sidebar border border-border text-muted">{meta.rootCauseClass}</span>
              <span class="text-xs text-muted ml-auto">
                {meta.fixRetryCount ? `${meta.fixRetryCount} retr${meta.fixRetryCount === 1 ? "y" : "ies"} · ` : ""}{meta.durationMinutes}m
              </span>
              <span class="text-xs text-muted">{expanded[inc.slug] ? "▼" : "▶"}</span>
            </button>
            {#if expanded[inc.slug]}
              <div class="px-5 py-3 border-t border-border markdown-body">{@html inc.bodyHtml}</div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .markdown-body {
    font-size: 0.875rem;
    line-height: 1.65;
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3) {
    font-weight: 600;
    margin-top: 1em;
    margin-bottom: 0.4em;
  }
  .markdown-body :global(h1) { font-size: 1.15rem; }
  .markdown-body :global(h2) { font-size: 1rem; }
  .markdown-body :global(h3) { font-size: 0.95rem; }
  .markdown-body :global(> *:first-child) { margin-top: 0; }
  .markdown-body :global(p) { margin: 0.6em 0; }
  .markdown-body :global(ul),
  .markdown-body :global(ol) { margin: 0.6em 0; padding-left: 1.5em; }
  .markdown-body :global(ul) { list-style: disc; }
  .markdown-body :global(ol) { list-style: decimal; }
  .markdown-body :global(li) { margin: 0.2em 0; }
  .markdown-body :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85em;
    padding: 0.1em 0.3em;
    background: var(--color-sidebar, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--color-border, #2a2a2a);
    border-radius: 3px;
  }
  .markdown-body :global(pre) {
    margin: 0.8em 0;
    padding: 0.7em 0.9em;
    background: var(--color-sidebar, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--color-border, #2a2a2a);
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.85rem;
  }
  .markdown-body :global(pre code) { padding: 0; background: transparent; border: 0; }
  .markdown-body :global(a) { color: var(--color-accent, #5ea0ff); text-decoration: underline; }
</style>
