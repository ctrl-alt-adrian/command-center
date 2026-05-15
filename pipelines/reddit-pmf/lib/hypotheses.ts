import fs from "fs/promises";
import path from "path";
import { SIGNALS_DIR } from "../../../core/lib/paths.ts";
import { readJson } from "../../../core/lib/io.ts";
import type { Hypothesis, HypothesisStatus } from "./types.ts";

const REDDIT_PMF_DIR = path.join(SIGNALS_DIR, "reddit-pmf");
const HYPOTHESES_FILE = path.join(REDDIT_PMF_DIR, "hypotheses.json");

export async function loadHypotheses(): Promise<Hypothesis[]> {
  return readJson<Hypothesis[]>(HYPOTHESES_FILE, []);
}

export async function appendHypotheses(items: Hypothesis[]): Promise<void> {
  const existing = await loadHypotheses();
  const merged = [...existing];
  for (const h of items) {
    const idx = merged.findIndex((e) => e.id === h.id && e.weekOf === h.weekOf);
    if (idx >= 0) merged[idx] = h;
    else merged.push(h);
  }
  await fs.mkdir(REDDIT_PMF_DIR, { recursive: true });
  await fs.writeFile(HYPOTHESES_FILE, JSON.stringify(merged, null, 2), "utf-8");
}

export async function updateStatus(id: string, weekOf: string, status: HypothesisStatus, notes?: string): Promise<void> {
  const all = await loadHypotheses();
  const idx = all.findIndex((h) => h.id === id && h.weekOf === weekOf);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status, notes };
  await fs.writeFile(HYPOTHESES_FILE, JSON.stringify(all, null, 2), "utf-8");
}
