<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });
</script>

<div class="space-y-4">
  <h2 class="text-2xl font-semibold">Overview</h2>
  <p class="text-muted text-sm">Phase 1 scaffold. Pipelines registered:</p>
  <ul class="space-y-2">
    {#each data.pipelines as p}
      <li>
        <a
          href={`/pipelines/${p.id}`}
          class="bg-card border border-border rounded p-3 flex justify-between items-center hover:border-accent transition-colors"
        >
          <div>
            <div class="font-mono">{p.id}</div>
            <div class="text-xs text-muted">
              {p.phases.length} phase(s) · cap {p.backpressureCap} ·
              {p.phases.map((ph) => ph.gateType).join(" → ")}
            </div>
          </div>
          <div class="text-xs text-muted">
            {p.counts.needs_review} / {p.backpressureCap} needs_review
          </div>
        </a>
      </li>
    {/each}
  </ul>
</div>
