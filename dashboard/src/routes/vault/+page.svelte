<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDate } from "$lib/format";
  let { data } = $props();
  let running = $state(false);

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  async function clearFailed() {
    if (!confirm(`Remove ${data.failedCount} failed vault-nuggets task(s)? This is irreversible.`)) return;
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId: "vault-nuggets" }),
    });
    location.reload();
  }

  async function runExtract() {
    if (running) return;
    const ok = confirm(
      "Run nuggets extract now?\n\n" +
        "Scans new session exports + build-journal entries, calls claude -p " +
        "(real token spend), dedupes against the live vault, and stages " +
        "candidate atomic notes for your review.\n\n" +
        "Continue?",
    );
    if (!ok) return;
    running = true;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pipelineId: "vault-nuggets" }),
      });
      if (res.ok) {
        await fetch("/api/cron", { method: "POST" });
        location.href = "/tasks";
      }
    } finally {
      running = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Vault</h2>
      <p class="text-muted text-sm mt-1">
        MACHINE-framework atomic-note KB. Every downstream marketing phase reads from here ·
        <a href="/pipelines/vault-nuggets" class="text-accent hover:underline">nuggets pipeline DAG</a>
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
        onclick={runExtract}
      >
        {running ? "starting…" : "Run extract"}
      </button>
    </div>
  </div>

  <section class="grid grid-cols-4 gap-3">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">notes</div>
      <div class="text-2xl font-mono mt-1">{data.totalNotes}</div>
      <div class="text-xs text-muted mt-1">across {data.pillars.length} pillars</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">orphan wikilinks</div>
      <div class="text-2xl font-mono mt-1 {data.orphanCount > 0 ? 'text-warn' : ''}">{data.orphanCount}</div>
      <div class="text-xs text-muted mt-1">unresolved [[targets]]</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">pending review</div>
      <div class="text-2xl font-mono mt-1 {data.pendingReview.length > 0 ? 'text-warn' : ''}">{data.pendingReview.length}</div>
      <div class="text-xs text-muted mt-1">extract task(s) awaiting captain</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">total tasks</div>
      <div class="text-2xl font-mono mt-1">{data.taskCount}</div>
      <div class="text-xs text-muted mt-1">all-time</div>
    </div>
  </section>

  {#if data.pendingReview.length > 0}
    <section class="bg-warn/10 border border-warn rounded p-4 space-y-3">
      <h3 class="text-sm font-medium text-warn uppercase tracking-wider">Pending review</h3>
      <ul class="space-y-2">
        {#each data.pendingReview as p}
          <li class="text-sm flex items-center justify-between">
            <a href={`/vault/staging/${p.id}`} class="hover:text-accent">
              <span class="font-mono text-xs">{p.id.slice(0, 8)}</span>
              · {p.candidateCount} candidate(s)
              {#if p.approved > 0}<span class="text-ok">· {p.approved} approved</span>{/if}
              {#if p.rejected > 0}<span class="text-muted">· {p.rejected} rejected</span>{/if}
            </a>
            <a href={`/vault/staging/${p.id}`} class="text-xs text-warn hover:underline">review →</a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="grid grid-cols-3 gap-3">
    {#each data.pillars as p}
      <a href={`/vault/${p.slug}`} class="bg-card border border-border rounded p-3 hover:border-accent transition-colors">
        <div class="flex items-baseline justify-between">
          <div class="font-mono text-sm">{p.slug}</div>
          <div class="text-xs text-muted">{p.count} {p.count === 1 ? "note" : "notes"}</div>
        </div>
        {#if p.recent.length > 0}
          <ul class="mt-2 space-y-1 text-xs text-muted">
            {#each p.recent as r}
              <li class="truncate">{r.title}</li>
            {/each}
          </ul>
        {:else}
          <div class="mt-2 text-xs text-muted/60">empty</div>
        {/if}
      </a>
    {/each}
  </section>
</div>
