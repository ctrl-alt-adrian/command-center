import fs from "fs/promises";
import path from "path";
import { SIGNALS_DIR } from "./paths.ts";
import type { Signal, SignalSnapshot } from "./types.ts";
import { safeReaddir } from "../../../core/lib/io.ts";

export async function getLatestSignals(): Promise<SignalSnapshot | null> {
  const dirs = await safeReaddir(SIGNALS_DIR);

  // Signal dirs are named YYYY-MM-DD
  const dateDirs = dirs.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (dateDirs.length === 0) return null;

  const latest = dateDirs[dateDirs.length - 1];
  return readSignalSnapshot(latest);
}

export async function getSignalsByDate(
  date: string
): Promise<SignalSnapshot | null> {
  return readSignalSnapshot(date);
}

async function readSignalSnapshot(
  date: string
): Promise<SignalSnapshot | null> {
  const dir = path.join(SIGNALS_DIR, date);
  const allSignals: Signal[] = [];
  let fetchedAt = "";

  for (const source of [
    "github-trending",
    "hackernews",
    "devto",
  ] as const) {
    const file = path.join(dir, `${source}.json`);
    try {
      const raw = await fs.readFile(file, "utf-8");
      const data = JSON.parse(raw);
      fetchedAt = data.fetchedAt || fetchedAt;
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          allSignals.push({
            source,
            title: item.title || item.name || "",
            url: item.url || item.html_url || "",
            description: item.description || "",
            score: item.score || item.stars || item.points || 0,
            tags: item.tags || [],
          });
        }
      }
    } catch {
      // Source file missing is fine
    }
  }

  if (allSignals.length === 0) return null;

  return { date, fetchedAt, signals: allSignals };
}

export function summarizeSignals(snapshot: SignalSnapshot): string {
  const bySource: Record<string, Signal[]> = {};
  for (const s of snapshot.signals) {
    (bySource[s.source] ??= []).push(s);
  }

  const sections: string[] = [];
  for (const [source, signals] of Object.entries(bySource)) {
    const top = signals
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 10);
    const lines = top.map(
      (s) => `- ${s.title}${s.description ? `: ${s.description}` : ""}`
    );
    sections.push(`### ${source}\n${lines.join("\n")}`);
  }

  return `# External Signals (${snapshot.date})\n\n${sections.join("\n\n")}`;
}
