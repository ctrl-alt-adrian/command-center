import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { SIGNALS_DIR } from "../../../core/lib/paths.ts";
import { readJsonOrNull } from "../../../core/lib/io.ts";
import { channelUploads, searchResults } from "./yt-dlp.ts";
import { upsertChannelHistory, median, distinctDayCount, readChannelState } from "./state.ts";
import type {
  ChannelEntry,
  ChannelStateRecord,
  CompetitorsConfig,
  CompetitorsSnapshot,
  VideoRecord,
} from "./types.ts";

const COMPETITORS_DIR = path.join(SIGNALS_DIR, "competitors");
const PIPELINE_DIR = path.resolve(import.meta.dirname, "..");
const CHANNELS_YAML = path.join(PIPELINE_DIR, "channels.yaml");
const QUERIES_YAML = path.join(PIPELINE_DIR, "queries.yaml");
const CONFIG_YAML = path.join(PIPELINE_DIR, "config.yaml");

export async function loadConfig(): Promise<CompetitorsConfig> {
  const raw = await fs.readFile(CONFIG_YAML, "utf-8");
  return yaml.load(raw) as CompetitorsConfig;
}

export async function loadChannels(): Promise<ChannelEntry[]> {
  const raw = await fs.readFile(CHANNELS_YAML, "utf-8");
  const parsed = yaml.load(raw) as { channels?: ChannelEntry[] };
  return parsed.channels ?? [];
}

export async function loadQueries(): Promise<string[]> {
  const raw = await fs.readFile(QUERIES_YAML, "utf-8");
  const parsed = yaml.load(raw) as { queries?: string[] };
  return parsed.queries ?? [];
}

function viewsPerDay(v: VideoRecord, now = Date.now()): number {
  const t = Date.parse(v.publishedAt);
  if (!Number.isFinite(t)) return v.viewCount;
  const days = Math.max(1, (now - t) / 86_400_000);
  return v.viewCount / days;
}

function decorate(v: VideoRecord, now = Date.now()): VideoRecord {
  return { ...v, viewsPerDay: Math.round(viewsPerDay(v, now)) };
}

export interface ScrapeResult {
  snapshot: CompetitorsSnapshot;
  filePath: string;
}

export async function runScrape(): Promise<ScrapeResult> {
  const cfg = await loadConfig();
  const channels = await loadChannels();
  const queries = await loadQueries();
  const warnings: string[] = [];
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);

  // ---- Phase 1: pull recent uploads from each tracked channel ----
  const channelVideos: VideoRecord[] = [];
  const channelOutliers: VideoRecord[] = [];
  for (const ch of channels) {
    let videos: VideoRecord[] = [];
    try {
      videos = await channelUploads(ch.handle, cfg.scrape.uploads_per_channel, cfg.shorts.max_duration_seconds);
    } catch (e) {
      warnings.push(`channel ${ch.handle} fetch failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (videos.length === 0) {
      warnings.push(`channel ${ch.handle} returned 0 videos`);
      continue;
    }

    // Channel id is the first non-empty channelId in the batch
    const channelId = videos.find((v) => v.channelId)?.channelId ?? ch.handle;
    const channelTitle = videos[0].channelTitle;

    // Update rolling state
    const records: ChannelStateRecord[] = videos.map((v) => ({
      videoId: v.videoId,
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      sampledAt: new Date(now).toISOString(),
    }));
    const state = await upsertChannelHistory(channelId, records, {
      rollingWindowDays: cfg.outlier.rolling_window_days,
      channelTitle,
      handle: ch.handle,
    });

    // Tag each video with handle for UI grouping
    const decorated = videos.map((v) => decorate({ ...v, channelHandle: ch.handle, channelId }, now));
    channelVideos.push(...decorated);

    // Outlier check requires sufficient history
    if (distinctDayCount(state) < cfg.outlier.min_history_days) continue;
    const med = median(state.history.map((r) => r.viewCount));
    if (med <= 0) continue;

    for (const v of decorated) {
      const ratio = v.viewCount / med;
      if (ratio >= cfg.outlier.ratio) {
        channelOutliers.push({ ...v, outlierRatio: Number(ratio.toFixed(2)) });
      }
    }
  }

  // ---- Phase 2: niche-query search results with velocity filter ----
  const niche: VideoRecord[] = [];
  for (const q of queries) {
    let results: VideoRecord[] = [];
    try {
      results = await searchResults(q, cfg.scrape.results_per_query, cfg.shorts.max_duration_seconds);
    } catch (e) {
      warnings.push(`query "${q}" failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    for (const v of results) {
      const decorated = decorate(v, now);
      if (
        (decorated.viewsPerDay ?? 0) >= cfg.velocity.views_per_day ||
        decorated.viewCount >= cfg.velocity.total_views
      ) {
        niche.push(decorated);
      }
    }
  }

  // ---- Build six-tab snapshot ----
  // Top = channel outliers + niche merged, ranked by viewsPerDay (or outlierRatio for outliers)
  const top = [
    ...channelOutliers.map((v) => ({ ...v, _topScore: (v.outlierRatio ?? 0) * 1000 + (v.viewsPerDay ?? 0) })),
    ...niche.map((v) => ({ ...v, _topScore: v.viewsPerDay ?? 0 })),
  ]
    .sort((a, b) => (b as VideoRecord & { _topScore: number })._topScore - (a as VideoRecord & { _topScore: number })._topScore)
    .slice(0, 50)
    .map(({ _topScore: _ignored, ...v }) => v);

  const shorts = [...channelVideos, ...niche].filter((v) => v.isShort);

  // Find yesterday's file path for the Archive pointer
  await fs.mkdir(COMPETITORS_DIR, { recursive: true });
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const archiveCandidate = path.join(COMPETITORS_DIR, `${yesterday}.json`);
  const archiveExists = await fs.access(archiveCandidate).then(() => true).catch(() => false);

  const snapshot: CompetitorsSnapshot = {
    date: today,
    fetchedAt: new Date(now).toISOString(),
    thresholds: {
      outlierRatio: cfg.outlier.ratio,
      velocityViewsPerDay: cfg.velocity.views_per_day,
      velocityTotalViews: cfg.velocity.total_views,
    },
    top,
    outliers: channelOutliers.sort((a, b) => (b.outlierRatio ?? 0) - (a.outlierRatio ?? 0)),
    niche: niche.sort((a, b) => (b.viewsPerDay ?? 0) - (a.viewsPerDay ?? 0)),
    channels: channelVideos,
    shorts,
    archive: archiveExists ? `${yesterday}.json` : null,
    warnings,
  };

  const filePath = path.join(COMPETITORS_DIR, `${today}.json`);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  await fs.writeFile(path.join(COMPETITORS_DIR, "latest.json"), JSON.stringify(snapshot, null, 2), "utf-8");

  return { snapshot, filePath };
}

/** Load today's (or most recent) snapshot for the dashboard. */
export async function loadLatest(): Promise<CompetitorsSnapshot | null> {
  const fromLatest = await readJsonOrNull<CompetitorsSnapshot>(path.join(COMPETITORS_DIR, "latest.json"));
  if (fromLatest) return fromLatest;
  // No latest.json — find newest dated file
  const entries = await fs.readdir(COMPETITORS_DIR).catch(() => [] as string[]);
  const dated = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  if (dated.length === 0) return null;
  return readJsonOrNull<CompetitorsSnapshot>(path.join(COMPETITORS_DIR, dated[0]));
}

export async function listArchive(): Promise<Array<{ date: string; path: string }>> {
  const entries = await fs.readdir(COMPETITORS_DIR).catch(() => [] as string[]);
  const dated = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  return dated.map((f) => ({ date: f.slice(0, 10), path: f }));
}

export async function loadByDate(date: string): Promise<CompetitorsSnapshot | null> {
  return readJsonOrNull<CompetitorsSnapshot>(path.join(COMPETITORS_DIR, `${date}.json`));
}

// Re-export for callers (state module is wired here so the pipeline can introspect)
export { readChannelState };
