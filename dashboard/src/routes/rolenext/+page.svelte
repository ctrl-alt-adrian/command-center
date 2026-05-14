<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  let { data } = $props();

  $effect(() => {
    const id = setInterval(() => invalidateAll(), 5000);
    return () => clearInterval(id);
  });
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-semibold">RoleNext</h2>
    <p class="text-muted text-sm mt-1">
      Command-center automation that operates on the rolenext repo. Separate from <code>software-factory</code>,
      which is reserved for command-center maintaining itself.
    </p>
  </div>

  <section class="space-y-2">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">Pipelines</h3>
    <ul class="space-y-2">
      {#each data.pipelines as p}
        <li>
          <a
            href={`/rolenext/${p.slug}`}
            class="block bg-card border border-border rounded p-4 hover:bg-card/60 hover:border-accent/50 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1 flex-1">
                <div class="text-base font-semibold">{p.name}</div>
                <p class="text-sm text-muted">{p.description}</p>
                <div class="flex items-center gap-3 text-xs text-muted pt-1 flex-wrap">
                  <span><code>{p.id}</code></span>
                  <span>·</span>
                  <span>cron <code>{p.cronSchedule}</code></span>
                  <span>·</span>
                  <span>repo <code>{p.repo}</code></span>
                  <span>·</span>
                  <span>browser repro: <code>{p.enableBrowserRepro ? "on" : "off"}</code></span>
                </div>
              </div>
              <div class="text-right text-xs">
                <div>active: <span class="text-foreground font-semibold">{p.counts.active}</span></div>
                <div class="text-muted">completed: {p.counts.completed}</div>
                {#if p.counts.failed > 0}
                  <div class="text-danger">failed: {p.counts.failed}</div>
                {/if}
              </div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section class="text-xs text-muted">
    Future rolenext pipelines (deploy monitors, changelog generation, etc.) will live alongside.
    See <code>pipelines/rolenext/</code> for the pattern.
  </section>
</div>
