<script lang="ts">
  let { data } = $props();

  // svelte-ignore state_referenced_locally
  let candidates = $state(data.candidates);
  let savingFile = $state<string | null>(null);
  let finalizing = $state(false);
  let bulking = $state(false);

  const counts = $derived({
    total: candidates.length,
    approved: candidates.filter((c) => c.status === "approved").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
    pending: candidates.filter((c) => !c.status).length,
  });

  async function setStatus(file: string, status: "approved" | "rejected") {
    if (savingFile) return;
    savingFile = file;
    try {
      const res = await fetch(`/api/vault/staging/${data.taskId}/${encodeURIComponent(file)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        candidates = candidates.map((c) => (c.file === file ? { ...c, status } : c));
      }
    } finally {
      savingFile = null;
    }
  }

  async function bulkApprovePending() {
    if (bulking) return;
    const n = counts.pending;
    if (n === 0) return;
    bulking = true;
    try {
      const res = await fetch(`/api/vault/staging/${data.taskId}/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve-pending" }),
      });
      if (res.ok) {
        candidates = candidates.map((c) => (!c.status ? { ...c, status: "approved" } : c));
      }
    } finally {
      bulking = false;
    }
  }

  async function finalize() {
    if (finalizing) return;
    finalizing = true;
    try {
      const res = await fetch(`/api/tasks/${data.taskId}/approve`, { method: "POST" });
      if (res.ok) {
        await fetch("/api/cron", { method: "POST" });
        location.href = "/vault";
      }
    } finally {
      finalizing = false;
    }
  }

  const PILLAR_COLORS: Record<string, string> = {
    mapping: "text-purple-400",
    agents: "text-blue-400",
    context: "text-cyan-400",
    harness: "text-teal-400",
    intuition: "text-yellow-400",
    "natural-language": "text-pink-400",
    engineering: "text-orange-400",
    general: "text-muted",
    mindset: "text-rose-400",
    "free-lunch": "text-ok",
    "youtube-videos": "text-red-400",
    "build-journal": "text-accent",
  };
</script>

<div class="space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <a href="/vault" class="text-xs text-muted hover:text-foreground">← vault</a>
      <h2 class="text-2xl font-semibold mt-1">Staging review</h2>
      <p class="text-xs text-muted mt-1 font-mono">{data.taskId}</p>
    </div>
    <div class="flex gap-2">
      {#if counts.pending > 0}
        <button
          class="px-4 py-2 border border-ok/40 text-ok rounded text-sm font-medium hover:bg-ok/10 disabled:opacity-50"
          disabled={bulking}
          onclick={bulkApprovePending}
          title="Mark every undecided candidate as approved"
        >
          {bulking ? "approving…" : `Approve all pending (${counts.pending})`}
        </button>
      {/if}
      <button
        class="px-4 py-2 bg-accent text-background rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
        disabled={finalizing || data.taskStatus !== "needs_review"}
        onclick={finalize}
        title={data.taskStatus !== "needs_review" ? `task is ${data.taskStatus}` : "approve task and run embed phase"}
      >
        {finalizing ? "embedding…" : "Embed approved"}
      </button>
    </div>
  </div>

  <section class="grid grid-cols-4 gap-3 text-sm">
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">candidates</div>
      <div class="text-2xl font-mono mt-1">{counts.total}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">approved</div>
      <div class="text-2xl font-mono mt-1 text-ok">{counts.approved}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">rejected</div>
      <div class="text-2xl font-mono mt-1 text-danger">{counts.rejected}</div>
    </div>
    <div class="bg-card border border-border rounded p-3">
      <div class="text-xs text-muted">pending</div>
      <div class="text-2xl font-mono mt-1 {counts.pending > 0 ? 'text-warn' : ''}">{counts.pending}</div>
    </div>
  </section>

  <section class="space-y-3">
    {#each candidates as c}
      <article class="bg-card border border-border rounded p-4 space-y-2 {c.status === 'approved' ? 'border-ok/40' : c.status === 'rejected' ? 'border-danger/40 opacity-60' : ''}">
        <header class="flex items-start justify-between gap-3">
          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="font-semibold">{c.candidate.title}</h3>
            <div class="flex items-center gap-2 text-xs flex-wrap">
              <a
                href={`/vault/${c.candidate.pillar}`}
                class="font-mono hover:underline {PILLAR_COLORS[c.candidate.pillar] ?? 'text-muted'}"
                title={`see all ${c.candidate.pillar} notes`}
              >
                {c.candidate.pillar}
              </a>
              <span class="text-muted">· tier {c.candidate.tier}</span>
              {#if c.candidate.content_ready}<span class="text-ok">· content-ready</span>{/if}
              {#each c.candidate.tags as tag}
                <span class="text-muted">#{tag}</span>
              {/each}
            </div>
          </div>
          <div class="flex items-center gap-2 whitespace-nowrap">
            {#if c.status === "approved"}
              <span class="text-xs px-2 py-1 rounded bg-ok/15 border border-ok/30 text-ok">approved</span>
            {:else if c.status === "rejected"}
              <span class="text-xs px-2 py-1 rounded bg-danger/15 border border-danger/30 text-danger">rejected</span>
            {/if}
            {#if c.status !== "approved"}
              <button
                class="text-xs px-2 py-1 rounded border border-ok/30 text-ok hover:bg-ok/10 disabled:opacity-40"
                disabled={savingFile === c.file}
                onclick={() => setStatus(c.file, "approved")}
              >approve</button>
            {/if}
            {#if c.status !== "rejected"}
              <button
                class="text-xs px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/10 disabled:opacity-40"
                disabled={savingFile === c.file}
                onclick={() => setStatus(c.file, "rejected")}
              >reject</button>
            {/if}
          </div>
        </header>

        {#if c.candidate.summary}
          <p class="text-sm">{c.candidate.summary}</p>
        {/if}
        <div class="text-sm whitespace-pre-wrap text-muted">{c.candidate.body}</div>

        {#if c.candidate.related && c.candidate.related.length > 0}
          <div class="text-xs text-muted pt-1">
            related:
            {#each c.candidate.related as r, i}
              <code>[[{r}]]</code>{#if i < (c.candidate.related?.length ?? 0) - 1}, {/if}
            {/each}
          </div>
        {/if}

        <footer class="text-xs text-muted/70 font-mono pt-1">source: {c.candidate.sourceId}</footer>
      </article>
    {/each}

    {#if candidates.length === 0}
      <p class="text-muted text-sm text-center p-8">no candidates in this staging batch</p>
    {/if}
  </section>
</div>
