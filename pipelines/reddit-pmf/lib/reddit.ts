import type { RedditPost } from "./types.ts";

/**
 * Fetch top posts from a subreddit using Reddit's public JSON endpoint.
 *
 * Reddit accepts unauthenticated requests as long as the User-Agent is
 * descriptive and the per-IP rate stays modest. Upgrade to OAuth (set
 * REDDIT_CLIENT_ID/SECRET) when rate-limited.
 */

const PUBLIC_TIMEOUT_MS = 30_000;

interface RedditApiPostData {
  id?: string;
  subreddit?: string;
  title?: string;
  selftext?: string;
  score?: number;
  num_comments?: number;
  permalink?: string;
  url?: string;
  created_utc?: number;
  author?: string;
  link_flair_text?: string;
  stickied?: boolean;
}

interface RedditApiChild { data?: RedditApiPostData }
interface RedditApiListing { data?: { children?: RedditApiChild[] } }

function userAgent(): string {
  return process.env.REDDIT_USER_AGENT ?? "command-center-reddit-pmf/0.1";
}

export async function fetchTopPosts(
  subreddit: string,
  limit: number,
  timeframe: "week" | "month" | "day" = "week",
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=${timeframe}&limit=${Math.min(limit, 100)}&raw_json=1`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PUBLIC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": userAgent() },
      signal: ac.signal,
    });
    if (!res.ok) {
      throw new Error(`reddit ${subreddit}: HTTP ${res.status}`);
    }
    const body = (await res.json()) as RedditApiListing;
    const children = body.data?.children ?? [];
    return children
      .map((c) => c.data)
      .filter((p): p is RedditApiPostData => !!p && !p.stickied)
      .map((p) => ({
        id: p.id ?? "",
        subreddit: p.subreddit ?? subreddit,
        title: p.title ?? "",
        selftext: p.selftext ?? "",
        score: p.score ?? 0,
        num_comments: p.num_comments ?? 0,
        permalink: p.permalink ? `https://www.reddit.com${p.permalink}` : "",
        url: p.url ?? "",
        created_utc: p.created_utc ?? 0,
        author: p.author ?? "",
        flair: p.link_flair_text ?? undefined,
      }))
      .filter((p) => p.id && p.title);
  } finally {
    clearTimeout(timer);
  }
}
