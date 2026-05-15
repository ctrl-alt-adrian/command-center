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
    await fetch("/api/tasks/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: ["failed", "cleared_stale"], pipelineId: "vault-nuggets" }),
    });
    location.reload();
  }

  async function rerunFailed() {
    await fetch("/api/tasks/rerun", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipelineId: "vault-nuggets" }),
    });
    location.reload();
  }

  let copiedPath = $state(false);
  async function openInObsidian() {
    // Obsidian's URL scheme: obsidian://open?path=<absolute-path>
    // On Linux this only works if Obsidian's protocol handler is registered.
    // If the browser doesn't navigate to it (no registered handler), fall back
    // to copying the absolute path so the captain can paste it into File → Open vault.
    const url = `obsidian://open?path=${encodeURIComponent(data.vaultRoot)}`;
    window.location.href = url;
    // Best-effort fallback: copy path to clipboard after a beat.
    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText(data.vaultRoot);
        copiedPath = true;
        setTimeout(() => (copiedPath = false), 3000);
      } catch {
        // clipboard blocked, no-op
      }
    }, 500);
  }

  async function runExtract() {
    if (running) return;
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
      <button
        class="px-3 py-2 border border-border text-muted rounded hover:bg-card text-sm"
        onclick={openInObsidian}
        title={`Opens obsidian://open?path=${data.vaultRoot}. If Obsidian's URL handler isn't registered on this machine, the absolute path is copied to your clipboard so you can paste it into File → Open vault.`}
      >
        {copiedPath ? "path copied" : "Open in Obsidian"}
      </button>
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
        disabled={running}
        onclick={runExtract}
      >
        {running ? "starting…" : "Run extract"}
      </button>
    </div>
  </div>

  {#if data.runningExtract}
    <section class="bg-accent/10 border border-accent/40 rounded p-4 text-sm flex items-center justify-between">
      <div>
        <strong class="text-accent">Extract running</strong>
        <span class="text-muted ml-2">
          started {new Date(data.runningExtract.startedAt).toLocaleTimeString()} — scanning sources via Haiku.
          Candidates appear in "Pending review" once the scan completes (writes happen at the end).
        </span>
      </div>
      <a href={`/tasks/${data.runningExtract.id}`} class="text-xs text-accent hover:underline">view task →</a>
    </section>
  {:else if data.totalNotes === 0 && data.pendingReview.length === 0}
    <section class="bg-card border border-border rounded p-4 text-sm space-y-2">
      <div class="text-foreground font-medium">Vault is empty</div>
      <p class="text-muted text-xs leading-relaxed">
        No atomic notes have been embedded yet. The <em>orphan wikilinks</em> count below is hidden in this state
        because the only links present are placeholder <code class="font-mono">[[targets]]</code> in each pillar's
        Map of Content stub — not broken cross-references between real notes.
      </p>
      <p class="text-muted text-xs leading-relaxed">
        Press <strong>Run extract</strong> to scan rolenext sessions + build-journal via Haiku, dedupe against the
        live vault, and stage candidate atomic notes for your review at <code class="font-mono">/vault/staging/&lt;task-id&gt;</code>.
      </p>
    </section>
  {/if}

  <section class="grid gap-3 {data.totalNotes > 0 ? 'grid-cols-4' : 'grid-cols-3'}">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">notes</div>
      <div class="text-2xl font-mono mt-1">{data.totalNotes}</div>
      <div class="text-xs text-muted mt-1">atomic notes embedded across {data.pillars.length} pillars</div>
    </div>
    {#if data.totalNotes > 0}
      <a
        href="/vault/orphans"
        class="bg-card border border-border rounded p-3 hover:border-accent transition-colors block"
      >
        <div class="text-xs text-muted">orphan wikilinks</div>
        <div class="text-2xl font-mono mt-1 {data.orphanCount > 0 ? 'text-warn' : ''}">{data.orphanCount}</div>
        <div class="text-xs text-muted mt-1">[[target]] pointers with no matching note — click to inspect</div>
      </a>
    {/if}
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">pending review</div>
      <div class="text-2xl font-mono mt-1 {data.pendingReview.length > 0 ? 'text-warn' : ''}">{data.pendingReview.length}</div>
      <div class="text-xs text-muted mt-1">staged candidates awaiting your approve/reject</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">total tasks</div>
      <div class="text-2xl font-mono mt-1">{data.taskCount}</div>
      <div class="text-xs text-muted mt-1">all extract + embed runs (any status, all time)</div>
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
