<script lang="ts">
  import { formatDate } from "$lib/format";
  let { data } = $props();
</script>

<div class="space-y-4">
  <div>
    <a href="/vault" class="text-xs text-muted hover:text-foreground">← vault</a>
    <h2 class="text-2xl font-semibold mt-1 font-mono">{data.pillar}</h2>
    <p class="text-xs text-muted mt-1">{data.notes.length} note(s)</p>
  </div>

  {#if data.notes.length === 0}
    <p class="text-muted text-sm">no notes yet in this pillar — run the nuggets extract or add manually</p>
  {:else}
    <table class="w-full text-sm table-fixed">
      <colgroup>
        <col class="w-28" />
        <col />
        <col class="w-16" />
        <col class="w-56" />
        <col class="w-20" />
      </colgroup>
      <thead class="text-xs text-muted text-left">
        <tr class="border-b border-border">
          <th class="py-2 pr-4">created</th>
          <th class="py-2 pr-4">title</th>
          <th class="py-2 pr-4">tier</th>
          <th class="py-2 pr-4">tags</th>
          <th class="py-2 pr-2">ready?</th>
        </tr>
      </thead>
      <tbody>
        {#each data.notes as n}
          <tr class="border-b border-border/40 align-top hover:bg-card/40 cursor-pointer transition-colors" onclick={() => (location.href = `/vault/${data.pillar}/${encodeURIComponent(n.filename)}`)}>
            <td class="py-2 pr-4 font-mono text-xs text-muted whitespace-nowrap">{formatDate(n.created)}</td>
            <td class="py-2 pr-4">
              <a href={`/vault/${data.pillar}/${encodeURIComponent(n.filename)}`} class="hover:text-accent">
                {n.title}
              </a>
              {#if n.warnings.length > 0}
                <span class="ml-2 text-xs text-warn" title={n.warnings.join("; ")}>⚠</span>
              {/if}
            </td>
            <td class="py-2 pr-4 text-xs font-mono">{n.tier}</td>
            <td class="py-2 pr-4 text-xs text-muted truncate">{(n.tags ?? []).slice(0, 4).join(", ")}</td>
            <td class="py-2 pr-2 text-xs">
              {#if n.content_ready}<span class="text-ok">✓</span>{:else}<span class="text-muted">○</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
