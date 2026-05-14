export interface VideoRecord {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  publishedAt: string;       // ISO timestamp
  viewCount: number;
  durationSeconds: number;
  thumbnails: { default?: string; medium?: string; high?: string };
  url: string;
  isShort: boolean;
  // Computed downstream
  viewsPerDay?: number;
  outlierRatio?: number;
  matchedQuery?: string;
}

export interface CompetitorsConfig {
  outlier: { ratio: number; min_history_days: number; rolling_window_days: number };
  velocity: { views_per_day: number; total_views: number };
  scrape: { uploads_per_channel: number; results_per_query: number };
  shorts: { max_duration_seconds: number };
}

export interface ChannelEntry {
  handle: string;
  label?: string;
  id?: string;
}

export interface ChannelStateRecord {
  videoId: string;
  publishedAt: string;
  viewCount: number;
  sampledAt: string;
}

export interface ChannelState {
  channelId: string;
  channelTitle?: string;
  handle?: string;
  history: ChannelStateRecord[];
}

export interface CompetitorsSnapshot {
  date: string;             // YYYY-MM-DD
  fetchedAt: string;        // ISO timestamp
  thresholds: {
    outlierRatio: number;
    velocityViewsPerDay: number;
    velocityTotalViews: number;
  };
  top: VideoRecord[];
  outliers: VideoRecord[];
  niche: VideoRecord[];
  channels: VideoRecord[];
  shorts: VideoRecord[];
  archive: string | null;   // path to yesterday's file (if exists)
  warnings: string[];
}
