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

  // Marketing tasks carry draftDir + candidate context through their input chain.
  // Surface them as a real action panel instead of forcing the captain to read JSON.
  const marketingContext = $derived.by(() => {
    if (t.pipelineId !== "marketing") return null;
    const input = (t.input ?? {}) as Record<string, unknown>;
    const candidate = (input.candidate ?? {}) as Record<string, unknown>;
    const draftDir = typeof input.draftDir === "string" ? input.draftDir : null;
    const hook = typeof candidate.hook === "string" ? candidate.hook : null;
    const angle = typeof candidate.angle === "string" ? candidate.angle : null;
    const candidateId = typeof candidate.id === "string" ? candidate.id : null;
    const platforms = Array.isArray(input.platforms) ? (input.platforms as string[]) : null;
    if (!draftDir && !hook && !angle) return null;
    return { draftDir, hook, angle, candidateId, platforms };
  });

  // Personal-brand discovery tasks land their candidate list in `output`. Render
  // it as a scrollable picker so the captain can read what was picked, drill into
  // source notes, and judge whether to approve the whole batch.
  type BrandPick = { id: string; pillar: string; title: string; tier?: number; tags?: string[]; summary?: string; reason?: string };
  const brandContext = $derived.by<{ picked: number; candidates: BrandPick[] } | null>(() => {
    if (t.pipelineId !== "personal-brand") return null;
    if (t.phaseId !== "discovery") return null;
    const output = (t.output ?? {}) as Record<string, unknown>;
    const candidates = Array.isArray(output.candidates) ? (output.candidates as BrandPick[]) : null;
    if (!candidates) return null;
    return {
      picked: typeof output.picked === "number" ? output.picked : candidates.length,
      candidates,
    };
  });
  function vaultNoteHref(c: BrandPick): string {
    // c.id is `vault:<pillar>:<filename>` — decode to /vault/<pillar>/<encoded filename>
    return `/vault/${c.pillar}/${encodeURIComponent(c.title)}`;
  }

  // Personal-brand generate/review tasks carry the draft slug forward in their
  // input chain. Surface a direct link to the editor + a summary of the source pick.
  const brandDraftContext = $derived.by(() => {
    if (t.pipelineId !== "personal-brand") return null;
    if (t.phaseId !== "review" && t.phaseId !== "generate") return null;
    const input = (t.input ?? {}) as Record<string, unknown>;
    const output = (t.output ?? {}) as Record<string, unknown>;
    const candidate = (input.candidate ?? {}) as Record<string, unknown>;
    const draftSlug =
      (typeof output.draftSlug === "string" ? output.draftSlug : null) ??
      (typeof input.draftSlug === "string" ? input.draftSlug : null);
    const platforms = Array.isArray(output.platforms)
      ? (output.platforms as string[])
      : Array.isArray(input.platforms)
        ? (input.platforms as string[])
        : null;
    const failedPlatforms = Array.isArray(output.failedPlatforms)
      ? (output.failedPlatforms as string[])
      : Array.isArray(input.failedPlatforms)
        ? (input.failedPlatforms as string[])
        : null;
    const title = typeof candidate.title === "string" ? candidate.title : null;
    const pillar = typeof candidate.pillar === "string" ? candidate.pillar : null;
    if (!draftSlug && !title) return null;
    return { draftSlug, platforms, failedPlatforms, title, pillar };
  });

  async function approve() {
    await fetch(`/api/tasks/${t.id}/approve`, { method: "POST" });
    location.reload();
  }
  async function reject() {
    await fetch(`/api/tasks/${t.id}/reject`, { method: "POST" });
    location.reload();
  }
  async function remove() {
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    location.href = "/tasks";
  }
  async function rerun() {
    await fetch(`/api/tasks/${t.id}/rerun`, { method: "POST" });
    location.reload();
  }
  const removable = $derived(t.status === "failed" || t.status === "completed" || t.status === "cleared_stale");
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

  <div class="flex gap-2">
    {#if t.status === "needs_review"}
      <button class="px-3 py-1.5 bg-ok/20 border border-ok text-ok rounded text-sm" onclick={approve}>approve</button>
      <button class="px-3 py-1.5 bg-danger/20 border border-danger text-danger rounded text-sm" onclick={reject}>reject</button>
    {/if}
    {#if t.status === "failed"}
      <button class="px-3 py-1.5 bg-accent/20 border border-accent text-accent rounded text-sm" onclick={rerun}>rerun</button>
    {/if}
    {#if removable}
      <button class="px-3 py-1.5 border border-danger/40 text-danger rounded hover:bg-danger/10 text-sm" onclick={remove}>
        delete task
      </button>
    {/if}
  </div>

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

  {#if marketingContext}
    <section class="bg-card border border-border rounded p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Marketing context</h3>
        {#if marketingContext.draftDir}
          <a
            href={`/marketing/drafts/${marketingContext.draftDir}`}
            class="text-xs px-3 py-1.5 rounded bg-accent text-background font-medium hover:opacity-90"
          >
            Open drafts editor →
          </a>
        {/if}
      </div>
      {#if marketingContext.hook}
        <div>
          <div class="text-xs text-muted uppercase tracking-wider mb-1">Hook</div>
          <p class="text-sm">{marketingContext.hook}</p>
        </div>
      {/if}
      {#if marketingContext.angle}
        <div>
          <div class="text-xs text-muted uppercase tracking-wider mb-1">Angle</div>
          <p class="text-sm text-muted">{marketingContext.angle}</p>
        </div>
      {/if}
      <div class="flex flex-wrap gap-3 text-xs text-muted pt-1">
        {#if marketingContext.draftDir}
          <span><span class="text-muted/70">slug:</span> <code class="font-mono">{marketingContext.draftDir}</code></span>
        {/if}
        {#if marketingContext.candidateId}
          <span><span class="text-muted/70">source kb:</span> <code class="font-mono">{marketingContext.candidateId}</code></span>
        {/if}
        {#if marketingContext.platforms}
          <span><span class="text-muted/70">platforms:</span> {marketingContext.platforms.join(", ")}</span>
        {/if}
      </div>
      {#if t.phaseId === "review" && t.status === "needs_review"}
        <p class="text-xs text-muted/80 pt-1 border-t border-border/40">
          Open the drafts editor to read each platform's post, edit inline, refine with Claude, then
          come back here and <strong class="text-ok">approve</strong> to mark the set as reviewed —
          or <strong class="text-danger">reject</strong> if it shouldn't ship.
        </p>
      {:else if t.phaseId === "slop-check" && t.status === "needs_review"}
        <p class="text-xs text-muted/80 pt-1 border-t border-border/40">
          Slop gate failed retries. Open the drafts editor to inspect each platform's output and decide
          whether to refine, regenerate, or reject from here.
        </p>
      {/if}
    </section>
  {/if}

  {#if brandDraftContext}
    <section class="bg-card border border-border rounded p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Personal-brand draft set</h3>
          {#if brandDraftContext.title}
            <p class="font-medium mt-1">{brandDraftContext.title}</p>
          {/if}
          {#if brandDraftContext.pillar}
            <p class="text-xs text-muted mt-1">source pillar: <span class="font-mono">{brandDraftContext.pillar}</span></p>
          {/if}
        </div>
        {#if brandDraftContext.draftSlug}
          <a
            href={`/personal-brand/drafts/${brandDraftContext.draftSlug}`}
            class="text-xs px-3 py-1.5 rounded bg-accent text-background font-medium hover:opacity-90 whitespace-nowrap"
          >
            Open drafts editor →
          </a>
        {/if}
      </div>
      {#if brandDraftContext.platforms && brandDraftContext.platforms.length > 0}
        <div class="text-xs text-muted">
          platforms: {brandDraftContext.platforms.join(", ")}
          {#if brandDraftContext.failedPlatforms && brandDraftContext.failedPlatforms.length > 0}
            <span class="text-danger ml-2">(failed: {brandDraftContext.failedPlatforms.join(", ")})</span>
          {/if}
        </div>
      {/if}
      {#if t.phaseId === "review" && t.status === "needs_review"}
        <p class="text-xs text-muted/80 pt-1 border-t border-border/40">
          Open the drafts editor to read each platform's post, edit inline, refine with Claude,
          then come back and <strong class="text-ok">approve</strong> if it ships — or
          <strong class="text-danger">reject</strong> to discard.
        </p>
      {/if}
    </section>
  {/if}

  {#if brandContext}
    <section class="bg-card border border-border rounded p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-medium text-muted uppercase tracking-wider">Personal-brand discovery picks</h3>
          <p class="text-xs text-muted mt-1">
            Discovery surfaced <strong class="text-foreground">{brandContext.picked}</strong>
            tier-1 vault note{brandContext.picked === 1 ? "" : "s"} matching the brand filter
            (tier 1 · content_ready · audience ≠ product).
          </p>
        </div>
      </div>
      {#if t.status === "needs_review"}
        <p class="text-xs text-muted/80 pb-1 border-b border-border/40">
          Review the picks below. <strong class="text-ok">Approve</strong> to mark this batch as
          reviewed — Phase B (generate per-platform) will pick this up once shipped. For now,
          approving just completes the task.
        </p>
      {/if}
      <ul class="space-y-2 max-h-96 overflow-y-auto pr-1">
        {#each brandContext.candidates as c}
          <li class="bg-sidebar/40 border border-border/60 rounded p-3 space-y-1">
            <div class="flex items-baseline justify-between gap-3">
              <a href={vaultNoteHref(c)} class="font-medium hover:text-accent truncate">{c.title}</a>
              <a href={`/vault/${c.pillar}`} class="text-xs font-mono text-muted hover:text-accent whitespace-nowrap">{c.pillar}</a>
            </div>
            {#if c.summary}
              <p class="text-xs text-muted line-clamp-2">{c.summary}</p>
            {/if}
            <div class="flex flex-wrap gap-2 text-xs text-muted/70 pt-1">
              {#if c.tier}<span>tier {c.tier}</span>{/if}
              {#if c.tags && c.tags.length > 0}
                {#each c.tags.slice(0, 5) as tag}<span>#{tag}</span>{/each}
                {#if c.tags.length > 5}<span>+{c.tags.length - 5} more</span>{/if}
              {/if}
              {#if c.reason}<span class="text-muted/50 ml-auto">{c.reason}</span>{/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <details class="group">
    <summary class="text-sm font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-foreground list-none flex items-center gap-2">
      <span class="text-xs transition-transform group-open:rotate-90">▶</span>
      Input
      <span class="text-xs text-muted/60 normal-case font-normal">(raw JSON)</span>
    </summary>
    <pre class="mt-2 bg-card border border-border rounded p-3 text-xs overflow-x-auto">{JSON.stringify(t.input, null, 2)}</pre>
  </details>

  {#if t.output}
    <details class="group">
      <summary class="text-sm font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-foreground list-none flex items-center gap-2">
        <span class="text-xs transition-transform group-open:rotate-90">▶</span>
        Output
        <span class="text-xs text-muted/60 normal-case font-normal">(raw JSON)</span>
      </summary>
      <pre class="mt-2 bg-card border border-border rounded p-3 text-xs overflow-x-auto">{JSON.stringify(t.output, null, 2)}</pre>
    </details>
  {/if}

  {#if data.phaseOutputs.length > 0}
    <details class="group">
      <summary class="text-sm font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-foreground list-none flex items-center gap-2">
        <span class="text-xs transition-transform group-open:rotate-90">▶</span>
        Phase outputs (disk)
        <span class="text-xs text-muted/60 normal-case font-normal">({data.phaseOutputs.length})</span>
      </summary>
      <div class="mt-2 space-y-2">
        {#each data.phaseOutputs as po}
          <div class="bg-card border border-border rounded p-3 space-y-2">
            <div class="font-mono text-sm">{po.phaseId}</div>
            {#if po.output}
              <pre class="text-xs overflow-x-auto bg-sidebar p-2 rounded">{po.output}</pre>
            {/if}
          </div>
        {/each}
      </div>
    </details>
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
