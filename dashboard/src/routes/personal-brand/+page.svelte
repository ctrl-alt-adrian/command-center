<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  let { data } = $props();
  let running = $state(false);

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  async function runDiscovery() {
    if (running) return;
    const ok = confirm(
      `Run personal-brand discovery now?\n\n` +
        `Scans the vault and picks tier-1 framework notes flagged content_ready ` +
        `with audience not set to product. ` +
        `Currently ${data.eligibleCount} note(s) match the filter.\n\n` +
        `Phase A: discovery only — output lands in needs_review for you to inspect. ` +
        `Continue?`,
    );
    if (!ok) return;
    running = true;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "personal-brand" }),
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

  async function rerunFailed() {
    if (!confirm(`Re-queue ${data.failedCount} failed personal-brand task(s)?`)) return;
    await fetch("/api/tasks/rerun", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId: "personal-brand" }),
    });
    await invalidateAll();
  }

  async function clearFailed() {
    if (!confirm(`Remove ${data.failedCount} failed personal-brand task(s)? This is irreversible.`)) return;
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId: "personal-brand" }),
    });
    await invalidateAll();
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-foreground",
    running: "text-accent",
    needs_review: "text-warn",
    completed: "text-muted",
    failed: "text-danger",
    paused_backpressure: "text-danger",
    cleared_stale: "text-muted",
  };
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Personal Brand</h2>
      <p class="text-muted text-sm mt-1">
        Phase A scaffold: discovery picks tier-1 framework notes from the vault
        (audience ≠ <code class="font-mono">product</code>) for brand-shaped content.
        Generate + slop + drafts editor ship in Phases B and C.
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
        disabled={running || data.eligibleCount === 0}
        onclick={runDiscovery}
        title={data.eligibleCount === 0 ? "no eligible vault notes yet — embed some tier-1 content_ready notes first" : "scan the vault for brand candidates"}
      >
        {running ? "starting…" : "Run discovery"}
      </button>
    </div>
  </div>

  <section class="grid grid-cols-4 gap-3">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">eligible notes</div>
      <div class="text-2xl font-mono mt-1 {data.eligibleCount === 0 ? 'text-muted' : ''}">{data.eligibleCount}</div>
      <div class="text-xs text-muted mt-1">vault notes matching the brand filter</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">running</div>
      <div class="text-2xl font-mono mt-1 {data.runningCount > 0 ? 'text-accent' : ''}">{data.runningCount}</div>
      <div class="text-xs text-muted mt-1">active discovery tasks</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">needs review</div>
      <div class="text-2xl font-mono mt-1 {data.needsReview > 0 ? 'text-warn' : ''}">{data.needsReview}</div>
      <div class="text-xs text-muted mt-1">discovery results awaiting captain</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">total tasks</div>
      <div class="text-2xl font-mono mt-1">{data.taskCount}</div>
      <div class="text-xs text-muted mt-1">all-time, any status</div>
    </div>
  </section>

  {#if data.eligibleCount === 0}
    <section class="bg-card border border-border rounded p-4 text-sm space-y-2">
      <div class="text-foreground font-medium">No eligible notes yet</div>
      <p class="text-muted text-xs leading-relaxed">
        The brand filter requires <code class="font-mono">tier: 1</code> AND
        <code class="font-mono">content_ready: true</code> in a note's frontmatter,
        with <code class="font-mono">audience</code> not set to <code class="font-mono">product</code>.
        Build-journal notes are skipped unless explicitly tagged <code class="font-mono">audience: brand</code>.
      </p>
      <p class="text-muted text-xs leading-relaxed">
        After you embed approved candidates from <a href="/vault" class="text-accent hover:underline">vault staging</a>,
        flip <code class="font-mono">content_ready: true</code> on the framework notes you want eligible. Notes can be edited
        in Obsidian or via direct frontmatter writes.
      </p>
    </section>
  {:else}
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Sample eligible notes (preview)</h3>
      <ul class="space-y-1.5">
        {#each data.eligiblePreview as c}
          <li class="bg-card border border-border rounded text-sm hover:border-accent transition-colors">
            <a
              href={`/vault/${c.pillar}/${encodeURIComponent(c.filename)}`}
              class="block p-3"
              title="Open note in vault"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="font-mono text-xs text-muted">{c.pillar}</span>
                <span class="text-xs text-muted/70">{c.reason}</span>
              </div>
              <div class="mt-1 font-medium hover:text-accent">{c.title}</div>
            </a>
          </li>
        {/each}
      </ul>
      {#if data.eligibleCount > data.eligiblePreview.length}
        <p class="text-xs text-muted">…and {data.eligibleCount - data.eligiblePreview.length} more. Run discovery to land the full list as a needs_review task.</p>
      {/if}
    </section>
  {/if}

  {#if data.recentTasks.length > 0}
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Recent tasks</h3>
      <table class="w-full text-sm">
        <thead class="text-xs text-muted text-left">
          <tr class="border-b border-border">
            <th class="py-2 pr-4">id</th>
            <th class="py-2 pr-4">phase</th>
            <th class="py-2 pr-4">status</th>
            <th class="py-2 pr-4">picked</th>
            <th class="py-2 pr-4">updated</th>
          </tr>
        </thead>
        <tbody>
          {#each data.recentTasks as t}
            <tr class="border-b border-border/40">
              <td class="py-2 pr-4 font-mono text-xs">
                <a href={`/tasks/${t.id}`} class="hover:text-accent">{t.id.slice(0, 8)}</a>
              </td>
              <td class="py-2 pr-4 text-xs">{t.phaseId}</td>
              <td class="py-2 pr-4 text-xs whitespace-nowrap {STATUS_COLORS[t.status] ?? ''}">{t.status}</td>
              <td class="py-2 pr-4 text-xs font-mono">{(t.output as { picked?: number })?.picked ?? "—"}</td>
              <td class="py-2 pr-4 text-xs text-muted whitespace-nowrap">{new Date(t.updatedAt).toLocaleTimeString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</div>
