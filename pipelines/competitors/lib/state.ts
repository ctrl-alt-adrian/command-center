import fs from "fs/promises";
import path from "path";
import { SIGNALS_DIR } from "../../../core/lib/paths.ts";
import type { ChannelState, ChannelStateRecord } from "./types.ts";

export const STATE_DIR = path.join(SIGNALS_DIR, "competitors", "state");

function statePath(channelId: string): string {
  return path.join(STATE_DIR, `${channelId}.json`);
}

export async function readChannelState(channelId: string): Promise<ChannelState | null> {
  try {
    const raw = await fs.readFile(statePath(channelId), "utf-8");
    return JSON.parse(raw) as ChannelState;
  } catch {
    return null;
  }
}

export async function writeChannelState(state: ChannelState): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(statePath(state.channelId), JSON.stringify(state, null, 2), "utf-8");
}

export interface UpsertOptions {
  rollingWindowDays: number;
  channelTitle?: string;
  handle?: string;
}

/**
 * Append today's video records, trim entries older than the rolling window,
 * persist, and return the updated state. Records are keyed by videoId — a
 * second sample of the same video overwrites the prior sample (newer view
 * counts are more accurate).
 */
export async function upsertChannelHistory(
  channelId: string,
  newRecords: ChannelStateRecord[],
  opts: UpsertOptions,
): Promise<ChannelState> {
  const existing = (await readChannelState(channelId)) ?? {
    channelId,
    channelTitle: opts.channelTitle,
    handle: opts.handle,
    history: [],
  };
  if (opts.channelTitle && !existing.channelTitle) existing.channelTitle = opts.channelTitle;
  if (opts.handle && !existing.handle) existing.handle = opts.handle;

  const byId = new Map<string, ChannelStateRecord>();
  for (const r of existing.history) byId.set(r.videoId, r);
  for (const r of newRecords) byId.set(r.videoId, r);

  const cutoff = Date.now() - opts.rollingWindowDays * 86_400_000;
  const merged = [...byId.values()].filter((r) => {
    const t = Date.parse(r.publishedAt);
    return Number.isFinite(t) && t >= cutoff;
  });
  merged.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  const next: ChannelState = { ...existing, history: merged };
  await writeChannelState(next);
  return next;
}

export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Distinct calendar days represented in the history. */
export function distinctDayCount(state: ChannelState): number {
  const days = new Set<string>();
  for (const r of state.history) {
    const t = Date.parse(r.publishedAt);
    if (Number.isFinite(t)) days.add(new Date(t).toISOString().slice(0, 10));
  }
  return days.size;
}
