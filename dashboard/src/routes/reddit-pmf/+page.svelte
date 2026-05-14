<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();
  let running = $state(false);

  async function runWeek() {
    if (running) return;
    const ok = confirm(
      "Run the Reddit PMF pipeline now?\n\n" +
        "• Scrapes top-of-week posts from 5 subreddits (public JSON, no auth)\n" +
        "• Calls Claude Sonnet to cluster complaints into 3-7 landing hypotheses (real tokens)\n" +
        "• Deploy phase: " + (data.deployMode === "vercel" ? "pushes branches to Vercel" : "writes files locally (DRY RUN — VERCEL_TOKEN not set)") + "\n\n" +
        "Continue?",
    );
    if (!ok) return;
    running = true;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "reddit-pmf" }),
      });
      if (res.ok) {
        await fetch("/api/cron", { method: "POST" });
        location.href = "/tasks";
      }
    } finally {
      running = false;
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    live: "bg-ok/15 border-ok/30 text-ok",
    dry_run: "bg-warn/15 border-warn/30 text-warn",
    failed_deploy: "bg-danger/15 border-danger/30 text-danger",
    archived: "bg-muted/15 border-muted/30 text-muted",
    winner: "bg-accent/15 border-accent/30 text-accent",
  };
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Reddit PMF</h2>
      <p class="text-muted text-sm mt-1">
        Weekly zero-gate Reddit → landing-page hypotheses. Market signal gates the offer ·
        <a href="/pipelines/reddit-pmf" class="text-accent hover:underline">pipeline</a>
      </p>
    </div>
    <button
      class="px-4 py-2 bg-accent text-background rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
      disabled={running}
      onclick={runWeek}
    >
      {running ? "starting…" : "Run this week"}
    </button>
  </div>

  {#if data.deployMode === "dry_run"}
    <div class="bg-warn/10 border border-warn rounded p-3 text-sm">
      <strong class="text-warn">Deploy mode: dry-run.</strong>
      Vercel env vars not set — deploy phase will write content files to
      <code>signals/reddit-pmf/&lt;week&gt;/&lt;cluster&gt;/</code> only. See
      <a href="/pipelines/reddit-pmf" class="underline">pipeline page</a>
      and <code>pipelines/reddit-pmf/landing-template/README.md</code> for the Vercel setup.
    </div>
  {/if}

  {#if data.awaitingPlacement.length > 0}
    <div class="bg-warn/10 border border-warn rounded p-3 space-y-2">
      <strong class="text-warn text-sm">Links awaiting placement</strong>
      <p class="text-xs text-muted">These hypotheses deployed recently but show zero clicks — drop the URLs into Reddit comments.</p>
      <ul class="space-y-1 text-sm">
        {#each data.awaitingPlacement as h}
          <li class="flex items-center gap-2">
            <code class="text-xs">{h.id}</code>
            <span class="text-muted">·</span>
            <span>{h.name}</span>
            {#if h.deployUrl}
              <a href={h.deployUrl} target="_blank" rel="noreferrer" class="text-accent hover:underline ml-auto text-xs">{h.deployUrl}</a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <section class="grid grid-cols-6 gap-3 text-sm">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">total</div>
      <div class="text-xl font-mono">{data.counts.total}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">live</div>
      <div class="text-xl font-mono text-ok">{data.counts.live}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">dry-run</div>
      <div class="text-xl font-mono text-warn">{data.counts.dryRun}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">winners</div>
      <div class="text-xl font-mono text-accent">{data.counts.winners}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">archived</div>
      <div class="text-xl font-mono text-muted">{data.counts.archived}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">failed</div>
      <div class="text-xl font-mono text-danger">{data.counts.failed}</div>
    </div>
  </section>

  {#if data.hypotheses.length === 0}
    <p class="text-muted text-sm text-center p-8">no hypotheses yet — click <strong>Run this week</strong> to fire the pipeline</p>
  {:else}
    <table class="w-full text-sm table-fixed">
      <colgroup>
        <col class="w-28" />
        <col />
        <col class="w-28" />
        <col class="w-24" />
        <col class="w-24" />
        <col class="w-72" />
      </colgroup>
      <thead class="text-xs text-muted text-left">
        <tr class="border-b border-border">
          <th class="py-2 pr-4">week of</th>
          <th class="py-2 pr-4">cluster</th>
          <th class="py-2 pr-4">status</th>
          <th class="py-2 pr-4">CTR</th>
          <th class="py-2 pr-4">signups</th>
          <th class="py-2 pr-2">URL</th>
        </tr>
      </thead>
      <tbody>
        {#each data.hypotheses as h}
          <tr class="border-b border-border/40 align-top">
            <td class="py-2 pr-4 font-mono text-xs text-muted whitespace-nowrap">{formatDate(h.weekOf)}</td>
            <td class="py-2 pr-4">
              <div>{h.name}</div>
              <div class="text-xs text-muted font-mono">{h.id}</div>
            </td>
            <td class="py-2 pr-4">
              <span class="text-xs px-2 py-0.5 rounded border {STATUS_BADGE[h.status] ?? 'border-border text-muted'}">
                {h.status}
              </span>
            </td>
            <td class="py-2 pr-4 text-xs font-mono">{h.ctr ?? "—"}</td>
            <td class="py-2 pr-4 text-xs font-mono">{h.signups ?? "—"}</td>
            <td class="py-2 pr-2">
              {#if h.deployUrl}
                <a href={h.deployUrl} target="_blank" rel="noreferrer" class="text-xs text-accent hover:underline truncate block">{h.deployUrl}</a>
              {:else if h.notes}
                <span class="text-xs text-muted">{h.notes}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
