<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-screen flex">
  <aside class="w-56 shrink-0 bg-sidebar border-r border-border p-4 flex flex-col gap-1 text-sm">
    <h1 class="text-foreground font-semibold mb-4 text-lg">Command Center</h1>
    <a href="/" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Overview</a>
    <a href="/tasks" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Tasks</a>
    <div class="text-xs text-muted px-3 mt-3 mb-1 uppercase tracking-wider">Domains</div>
    <a href="/marketing" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Marketing</a>
    <a href="/personal-brand" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Personal Brand</a>
    <a href="/vault" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Vault</a>
    <a href="/competitors" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Competitors</a>
    <a href="/reddit-pmf" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Reddit PMF</a>
    <a href="/software-factory" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">Software Factory</a>
    <a href="/rolenext" class="px-3 py-2 rounded hover:bg-card text-muted hover:text-foreground">RoleNext</a>
    <div class="mt-auto text-xs text-muted px-3">all 6 phases · port 3001</div>
  </aside>
  <main class="flex-1 min-w-0 p-6">
    {@render children()}
  </main>
</div>
