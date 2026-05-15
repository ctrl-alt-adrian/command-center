<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDateTime } from "$lib/format";
  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });

  let reviewerNote = $state("");
  let dispatching = $state(false);
  let revisionResult = $state<{ ok: boolean; message: string } | null>(null);

  const STATUS_COLORS: Record<string, string> = {
    completed: "text-ok",
    running: "text-accent",
    failed: "text-danger",
    pending: "text-foreground",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    cleared_stale: "text-muted",
  };

  async function revise() {
    if (!data.prNumber || dispatching) return;
    dispatching = true;
    revisionResult = null;
    try {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipelineId: data.pipelineId,
          phaseId: "fix",
          input: {
            issueNumber: data.issueNumber,
            prNumber: data.prNumber,
            mode: "revision",
            reviewerNote,
          },
        }),
      });
      if (!taskRes.ok) {
        revisionResult = { ok: false, message: `task creation failed: ${taskRes.status}` };
        return;
      }
      await fetch("/api/cron", { method: "POST" }).catch(() => undefined);
      revisionResult = { ok: true, message: "revision task dispatched" };
      reviewerNote = "";
      await invalidateAll();
    } catch (err) {
      revisionResult = { ok: false, message: (err as Error).message };
    } finally {
      dispatching = false;
    }
  }
</script>

<div class="space-y-6">
  <div>
    <a href="/rolenext/bug-resolver" class="text-xs text-muted hover:text-foreground">← bug resolver</a>
  </div>

  <!-- Header -->
  <header class="bg-card border border-border rounded p-5 space-y-3">
    <div class="flex items-center gap-3 flex-wrap text-sm">
      <span class="font-mono text-xs text-muted">task {data.task.id.slice(0, 8)}</span>
      <span class="text-xs px-2 py-0.5 rounded border border-border {STATUS_COLORS[data.task.status] ?? 'text-muted'}">{data.task.status}</span>
      <span class="text-xs px-2 py-0.5 rounded border border-border text-muted">phase: {data.task.phaseId}</span>
      {#if data.attempt > 1}
        <span class="text-xs px-2 py-0.5 rounded border border-warn/30 bg-warn/10 text-warn">REOPEN attempt {data.attempt}</span>
      {/if}
    </div>

    {#if data.issueNumber}
      <h2 class="text-xl font-semibold">
        {#if data.issueUrl}
          <a href={data.issueUrl} target="_blank" rel="noopener" class="hover:text-accent">
            #{data.issueNumber}: {data.issueTitle}
          </a>
        {:else}
          #{data.issueNumber}: {data.issueTitle}
        {/if}
      </h2>
    {/if}

    {#if data.prUrl}
      <div class="text-sm">
        <span class="text-muted">PR:</span>
        <a href={data.prUrl} target="_blank" rel="noopener" class="hover:text-accent ml-1">{data.prUrl}</a>
      </div>
    {/if}

    <div class="flex items-center gap-3 text-xs text-muted">
      <span>created {formatDateTime(data.task.createdAt)}</span>
      <span>·</span>
      <span>updated {formatDateTime(data.task.updatedAt)}</span>
    </div>

    {#if data.task.gateFailReason}
      <div class="text-sm border-l-2 border-warn pl-3 text-warn">
        Gate fail reason: <code>{data.task.gateFailReason}</code>
      </div>
    {/if}

    {#if data.task.error}
      <div class="text-sm border-l-2 border-danger pl-3 space-y-1">
        <div class="text-danger font-semibold">Phase error</div>
        <pre class="text-xs bg-sidebar border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{data.task.error}</pre>
      </div>
    {/if}

    {#if data.failingAttempts.length > 0}
      <details class="text-sm">
        <summary class="cursor-pointer text-muted hover:text-foreground">
          ⚠ {data.failingAttempts.length} failing attempt{data.failingAttempts.length === 1 ? "" : "s"}
        </summary>
        <ol class="mt-2 space-y-2">
          {#each data.failingAttempts as a, i}
            <li class="border-l-2 border-danger/40 pl-3 space-y-1">
              <div class="text-xs text-muted">
                attempt {i + 1} · <span class="font-mono">{a.phaseId}</span> · {a.outcome}
                · <span class="font-mono">{formatDateTime(a.finishedAt ?? a.startedAt)}</span>
              </div>
              <pre class="text-xs bg-sidebar border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{a.reason ?? "(no reason recorded)"}</pre>
            </li>
          {/each}
        </ol>
      </details>
    {/if}
  </header>

  <!-- Phase timeline -->
  <section class="space-y-2">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Phase progression</h3>
    <ol class="space-y-1 text-sm font-mono">
      {#each data.phaseSlices as p, i}
        <li class="flex items-start gap-3">
          <span class="text-xs text-muted w-6">{i + 1}.</span>
          <span class={p.exists ? "text-foreground" : "text-muted"}>
            {p.phaseId}
            {#if p.exists}<span class="text-xs text-muted">— {p.artifacts.length} artifact{p.artifacts.length === 1 ? "" : "s"}</span>{/if}
          </span>
        </li>
      {/each}
    </ol>
  </section>

  <!-- Handoff -->
  {#if data.handoffHtml}
    <section class="space-y-2">
      <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">handoff.md</h3>
      <div class="bg-card border border-border rounded p-5 markdown-body">{@html data.handoffHtml}</div>
    </section>
  {/if}

  <!-- Per-phase artifacts -->
  <section class="space-y-3">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Phase artifacts</h3>
    {#each data.phaseSlices.filter((p) => p.exists) as p}
      <div class="bg-card border border-border rounded p-4 space-y-2">
        <div class="flex items-center gap-3">
          <code class="text-sm">{p.phaseId}</code>
          <span class="text-xs text-muted">{p.artifacts.length} file{p.artifacts.length === 1 ? "" : "s"}</span>
        </div>
        <ul class="text-xs text-muted space-y-0.5 font-mono">
          {#each p.artifacts as a}
            <li>{a.name} <span class="text-muted/70">({a.size} bytes)</span></li>
          {/each}
        </ul>
        {#if p.outputJson}
          <details class="text-xs">
            <summary class="cursor-pointer text-muted hover:text-foreground">meta.json</summary>
            <pre class="mt-2 p-3 bg-sidebar border border-border rounded overflow-x-auto">{JSON.stringify(p.outputJson, null, 2)}</pre>
          </details>
        {/if}
        {#if p.log}
          <details class="text-xs">
            <summary class="cursor-pointer text-muted hover:text-foreground">make-ci.log (tail)</summary>
            <pre class="mt-2 p-3 bg-sidebar border border-border rounded overflow-x-auto">{p.log}</pre>
          </details>
        {/if}
      </div>
    {/each}
  </section>

  <!-- Revise now button -->
  {#if data.prNumber}
    <section class="space-y-2">
      <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Revise this PR</h3>
      <p class="text-xs text-muted">
        Dispatch a revision task that re-invokes the fix agent against PR #{data.prNumber}.
        The agent automatically reads your line-level review comments via <code>gh api</code>.
        Optionally add a high-level note below.
      </p>
      <textarea
        bind:value={reviewerNote}
        placeholder="(optional) high-level note for the fix agent — e.g. 'the fix broke search pagination'"
        rows="3"
        class="w-full bg-card border border-border rounded p-2 text-sm font-sans"
      ></textarea>
      <div class="flex items-center gap-3">
        <button
          onclick={revise}
          disabled={dispatching}
          class="px-3 py-1.5 rounded bg-accent text-background text-sm hover:bg-accent/80 disabled:opacity-50"
        >
          {dispatching ? "dispatching…" : "Revise now"}
        </button>
        {#if revisionResult}
          <span class="text-xs {revisionResult.ok ? 'text-ok' : 'text-danger'}">{revisionResult.message}</span>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .markdown-body {
    font-size: 0.875rem;
    line-height: 1.65;
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3) { font-weight: 600; margin-top: 1em; margin-bottom: 0.4em; }
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
  }
  .markdown-body :global(pre code) { padding: 0; background: transparent; border: 0; }
  .markdown-body :global(a) { color: var(--color-accent, #5ea0ff); text-decoration: underline; }
</style>
