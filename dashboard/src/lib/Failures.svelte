<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { formatDateTime } from "$lib/format";
  import type { FailureRow } from "./failures.ts";

  interface Props {
    failures: FailureRow[];
    title?: string;
    /** When true (default), collapses to a compact callout if there are no failures. */
    hideWhenEmpty?: boolean;
    /** When true, hide the pipeline column (useful on pipeline-specific pages). */
    hidePipelineColumn?: boolean;
    /**
     * When set, the Clear button scopes to a single pipeline. Omit to clear
     * across every pipeline (used on the overview / global tasks page).
     */
    pipelineId?: string;
  }

  let {
    failures,
    title = "Failures",
    hideWhenEmpty = true,
    hidePipelineColumn = false,
    pipelineId,
  }: Props = $props();

  let expanded = $state<Record<string, boolean>>({});
  function toggle(id: string) {
    expanded[id] = !expanded[id];
  }

  const STATUS_COLORS: Record<string, string> = {
    failed: "text-danger",
    cleared_stale: "text-muted",
    pending: "text-foreground",
    running: "text-accent",
    needs_review: "text-warn",
    paused_backpressure: "text-danger",
    completed: "text-muted",
  };

  const terminalFailures = $derived(
    failures.filter((f) => f.status === "failed" || f.status === "cleared_stale"),
  );

  let clearing = $state(false);
  let clearResult = $state<{ ok: boolean; message: string } | null>(null);

  async function clearFailures() {
    if (clearing) return;
    if (terminalFailures.length === 0) return;
    clearing = true;
    clearResult = null;
    try {
      const body: { status: string[]; pipelineId?: string } = {
        status: ["failed", "cleared_stale"],
      };
      if (pipelineId) body.pipelineId = pipelineId;
      const res = await fetch("/api/tasks/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        clearResult = { ok: false, message: `clear failed: ${res.status}` };
        return;
      }
      const json = (await res.json()) as { removed: number };
      clearResult = { ok: true, message: `cleared ${json.removed}` };
      await invalidateAll();
    } catch (err) {
      clearResult = { ok: false, message: (err as Error).message };
    } finally {
      clearing = false;
      setTimeout(() => (clearResult = null), 4000);
    }
  }
</script>

{#if failures.length === 0}
  {#if !hideWhenEmpty}
    <section class="bg-card border border-border rounded p-3 text-sm text-muted">
      No failures recorded. ✓
    </section>
  {/if}
{:else}
  <section class="bg-danger/5 border border-danger/40 rounded p-4 space-y-2">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h3 class="text-sm font-semibold text-danger flex items-center gap-2">
        <span>⚠</span>
        {title} ({failures.length})
      </h3>
      <div class="flex items-center gap-2">
        {#if clearResult}
          <span class="text-xs {clearResult.ok ? 'text-ok' : 'text-danger'}">{clearResult.message}</span>
        {/if}
        {#if terminalFailures.length > 0}
          <button
            onclick={clearFailures}
            disabled={clearing}
            class="px-2 py-1 rounded border border-danger/40 text-danger text-xs hover:bg-danger/10 disabled:opacity-50 whitespace-nowrap"
            title={pipelineId
              ? `Delete ${terminalFailures.length} failed task(s) for ${pipelineId}`
              : `Delete ${terminalFailures.length} failed task(s) across all pipelines`}
          >
            {clearing ? "clearing…" : `Clear ${terminalFailures.length} failed`}
          </button>
        {/if}
        <span class="text-xs text-muted">click a row to expand the error</span>
      </div>
    </div>
    <ul class="divide-y divide-border/40">
      {#each failures as f}
        <li>
          <button
            class="w-full flex items-start gap-3 py-2 text-left hover:bg-card/40 px-1 -mx-1 rounded"
            onclick={() => toggle(f.taskId)}
          >
            <span class="font-mono text-xs text-muted whitespace-nowrap w-28">{f.taskId.slice(0, 12)}</span>
            <span class="text-xs {STATUS_COLORS[f.status] ?? 'text-muted'} whitespace-nowrap w-32">{f.status}</span>
            {#if !hidePipelineColumn}
              <span class="text-xs whitespace-nowrap w-44 truncate" title={f.pipelineId}>{f.pipelineLabel}</span>
            {/if}
            <span class="text-xs text-muted font-mono whitespace-nowrap w-28">{f.phaseId}</span>
            <span class="text-xs flex-1 truncate text-foreground" title={f.errorMessage}>{f.errorMessage}</span>
            <span class="text-xs text-muted whitespace-nowrap">{formatDateTime(f.updatedAt)}</span>
          </button>
          {#if expanded[f.taskId]}
            <div class="bg-card border border-border rounded p-3 mt-1 mb-2 text-xs space-y-2">
              <div class="flex items-center gap-2 flex-wrap">
                <a href={f.detailUrl} class="text-accent hover:underline">View task detail →</a>
                {#if f.detailUrl !== `/tasks/${f.taskId}`}
                  <span class="text-muted">·</span>
                  <a href={`/tasks/${f.taskId}`} class="text-muted hover:text-foreground">Generic task view</a>
                {/if}
                <span class="text-muted">·</span>
                <span class="text-muted">{f.attemptCount} failing attempt{f.attemptCount === 1 ? "" : "s"}</span>
              </div>
              <div>
                <div class="text-muted uppercase tracking-wide mb-1 text-[10px]">Error message</div>
                <pre class="bg-sidebar border border-border rounded p-2 overflow-x-auto text-[11px] whitespace-pre-wrap break-all">{f.errorMessage}</pre>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}
