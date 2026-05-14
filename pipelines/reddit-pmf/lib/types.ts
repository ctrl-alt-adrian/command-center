export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  created_utc: number; // seconds since epoch
  author: string;
  flair?: string;
}

export interface Cluster {
  id: string;                    // slug, used for filenames + URLs
  name: string;                  // human label
  representative_quote: string;  // single quote that exemplifies the complaint
  underlying_pain: string;
  positioning: string;           // "RoleNext is the tool that ..."
  headline: string;
  subhead: string;
  cta: string;
  source_post_ids: string[];     // 3-10 post ids that informed this cluster
}

export type HypothesisStatus = "live" | "failed_deploy" | "dry_run" | "archived" | "winner";

export interface Hypothesis {
  id: string;                    // matches cluster.id
  cluster: Cluster;
  status: HypothesisStatus;
  deployedAt?: string;           // ISO
  deployUrl?: string;
  weekOf: string;                // YYYY-MM-DD of the Monday this batch ran
  notes?: string;
}

export interface SubredditConfig {
  name: string;
  label?: string;
  flair?: string;
}

export interface RedditPmfConfig {
  scrape: {
    posts_per_subreddit: number;
    timeframe: "week" | "month" | "day";
    default_user_agent: string;
  };
  extract: {
    min_clusters: number;
    max_clusters: number;
    target_clusters: number;
    slop_max_retries: number;
    model: string;
  };
  deploy: {
    force_dry_run: boolean;
  };
}
