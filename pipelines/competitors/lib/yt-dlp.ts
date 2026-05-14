import { execFile } from "child_process";
import { promisify } from "util";
import type { VideoRecord } from "./types.ts";

const exec = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_BUFFER = 50 * 1024 * 1024;

interface YtDlpEntry {
  id?: string;
  title?: string;
  channel_id?: string;
  channel?: string;
  uploader_id?: string;
  uploader?: string;
  view_count?: number;
  duration?: number;
  upload_date?: string;     // YYYYMMDD
  timestamp?: number;
  webpage_url?: string;
  url?: string;
  thumbnails?: Array<{ url: string; preference?: number }>;
  thumbnail?: string;
  _type?: string;
}

function uploadDateToIso(d?: string, timestamp?: number): string {
  if (timestamp) return new Date(timestamp * 1000).toISOString();
  if (d && /^\d{8}$/.test(d)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`;
  }
  return "";
}

function classifyShort(duration: number, title: string, maxDurationSeconds: number): boolean {
  if (duration > 0 && duration <= maxDurationSeconds) return true;
  if (/#shorts/i.test(title)) return true;
  return false;
}

function toVideoRecord(e: YtDlpEntry, shortsMax: number): VideoRecord | null {
  if (!e.id || !e.title) return null;
  const url = e.webpage_url ?? e.url ?? `https://www.youtube.com/watch?v=${e.id}`;
  const thumbs = e.thumbnails ?? [];
  thumbs.sort((a, b) => (b.preference ?? 0) - (a.preference ?? 0));
  return {
    videoId: e.id,
    title: e.title,
    channelId: e.channel_id ?? e.uploader_id ?? "",
    channelTitle: e.channel ?? e.uploader ?? "",
    publishedAt: uploadDateToIso(e.upload_date, e.timestamp),
    viewCount: e.view_count ?? 0,
    durationSeconds: e.duration ?? 0,
    thumbnails: {
      default: thumbs.find((t) => /default\.jpg/i.test(t.url))?.url ?? e.thumbnail,
      medium: thumbs.find((t) => /mqdefault\.jpg/i.test(t.url))?.url,
      high: thumbs.find((t) => /hqdefault\.jpg/i.test(t.url))?.url ?? thumbs[0]?.url,
    },
    url,
    isShort: classifyShort(e.duration ?? 0, e.title ?? "", shortsMax),
  };
}

async function runYtDlp(args: string[]): Promise<YtDlpEntry[]> {
  const { stdout } = await exec(
    "yt-dlp",
    [
      ...args,
      "--quiet",
      "--no-warnings",
      "--ignore-errors",
      "--dump-json",
      "--flat-playlist",
    ],
    { timeout: DEFAULT_TIMEOUT_MS, maxBuffer: DEFAULT_MAX_BUFFER, encoding: "utf-8" },
  );
  return stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l) as YtDlpEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is YtDlpEntry => e !== null);
}

/** Pull the channel's most recent N uploads. */
export async function channelUploads(handle: string, limit: number, shortsMax: number): Promise<VideoRecord[]> {
  const url = handle.startsWith("@") ? `https://www.youtube.com/${handle}/videos` : `https://www.youtube.com/c/${handle}/videos`;
  const entries = await runYtDlp([url, "--playlist-end", String(limit)]).catch(() => [] as YtDlpEntry[]);
  return entries.map((e) => toVideoRecord(e, shortsMax)).filter((v): v is VideoRecord => v !== null);
}

/** Run a YouTube search and return at most `limit` results. */
export async function searchResults(query: string, limit: number, shortsMax: number): Promise<VideoRecord[]> {
  const target = `ytsearch${limit}:${query}`;
  // Flat-playlist on a search returns very little metadata. Drop --flat-playlist for searches
  // by hand-running yt-dlp without it.
  const { stdout } = await exec(
    "yt-dlp",
    [target, "--quiet", "--no-warnings", "--ignore-errors", "--dump-json", "--no-download"],
    { timeout: DEFAULT_TIMEOUT_MS, maxBuffer: DEFAULT_MAX_BUFFER, encoding: "utf-8" },
  ).catch(() => ({ stdout: "" }));

  const entries: YtDlpEntry[] = stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l) as YtDlpEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is YtDlpEntry => e !== null);

  return entries
    .map((e) => toVideoRecord(e, shortsMax))
    .filter((v): v is VideoRecord => v !== null)
    .map((v) => ({ ...v, matchedQuery: query }));
}
