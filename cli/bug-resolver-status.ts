#!/usr/bin/env -S npx tsx
/**
 * bug-resolver-status — print the rolenext-bug-resolver's daily counter,
 * queue depth, kill-switch state, and most-recent fingerprints.
 *
 * Run with: `npx tsx cli/bug-resolver-status.ts`
 */
import { listTasksByPipeline } from "../core/lib/tasks.ts";
import {
  killSwitchActive,
  readDailyCount,
  loadFingerprints,
  STATE_DIR,
} from "../pipelines/rolenext/bug-resolver/lib/state.ts";
import { ROLENEXT_BUG_RESOLVER_CONFIG } from "../pipelines/rolenext/bug-resolver/pipeline.config.ts";

const PIPELINE_ID = "rolenext-bug-resolver";

async function main(): Promise<void> {
  const cfg = ROLENEXT_BUG_RESOLVER_CONFIG;
  const tasks = await listTasksByPipeline(PIPELINE_ID);

  const byStatus = new Map<string, number>();
  for (const t of tasks) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
  const active =
    (byStatus.get("pending") ?? 0) +
    (byStatus.get("running") ?? 0) +
    (byStatus.get("needs_review") ?? 0) +
    (byStatus.get("paused_backpressure") ?? 0);

  const daily = await readDailyCount();
  const ks = await killSwitchActive(cfg.killSwitchFile);
  const fps = await loadFingerprints();
  const fpEntries = Object.entries(fps)
    .map(([fp, rec]) => ({ fp, ...rec }))
    .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
    .slice(0, 5);

  console.log("rolenext-bug-resolver — status\n");
  console.log("config:");
  console.log(`  repo:                  ${cfg.repo}`);
  console.log(`  enableBrowserRepro:    ${cfg.enableBrowserRepro}`);
  console.log(`  reproTarget:           ${cfg.reproTarget}`);
  console.log(`  maxTicketsPerDay:      ${cfg.caps.maxTicketsPerDay}`);
  console.log(`  maxQueueDepth:         ${cfg.caps.maxQueueDepth}`);
  console.log(`  ticketStaleAfterDays:  ${cfg.caps.ticketStaleAfterDays}`);
  console.log(`  concurrency:           ${cfg.caps.concurrency}`);
  console.log("");
  console.log("runtime:");
  console.log(`  kill-switch:           ${ks ? "ACTIVE (no polling)" : "off"}`);
  console.log(`  state dir:             ${STATE_DIR}`);
  console.log(`  daily counter (UTC):   ${daily} / ${cfg.caps.maxTicketsPerDay}`);
  console.log(`  queue (active):        ${active} / ${cfg.caps.maxQueueDepth}`);
  console.log("");
  console.log("tasks by status:");
  for (const [status, count] of [...byStatus.entries()].sort()) {
    console.log(`  ${status.padEnd(20)} ${count}`);
  }
  if (byStatus.size === 0) console.log("  (none)");
  console.log("");
  console.log("recent fingerprints (top 5):");
  if (fpEntries.length === 0) {
    console.log("  (none)");
  } else {
    for (const e of fpEntries) {
      console.log(`  #${e.issueNumber}  ${e.status.padEnd(10)}  seen ${e.seenAt}`);
    }
  }
}

main().catch((err) => {
  console.error("bug-resolver-status failed:", err.message);
  process.exit(1);
});
