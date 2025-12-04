// ============================================================================
// Configuration Types
// ============================================================================

export type Language = "en" | "pt";

export interface YouTubeConfig {
  categories: string[];
  categoriesPt: string[];
  maxResults: number;
  regionCodes: Record<Language, string>;
}

export interface TrendsConfig {
  keywords: string[];
  keywordsPt: string[];
  geo: Record<Language, string>;
}

export interface CacheConfig {
  ttlHours: number;
}

export interface Config {
  youtube: YouTubeConfig;
  trends: TrendsConfig;
  cache: CacheConfig;
}

// ============================================================================
// YouTube Data Types
// ============================================================================

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnailUrl: string;
  language: Language;
  searchQuery: string;
  fetchedAt: string;
}

// ============================================================================
// Google Trends Data Types
// ============================================================================

export interface TrendingTopic {
  id: string;
  keyword: string;
  relatedQuery: string;
  queryType: "rising" | "top";
  value: number; // percentage or "Breakout"
  isBreakout: boolean;
  language: Language;
  geo: string;
  fetchedAt: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export type CacheSource = "youtube" | "trends";

export interface CacheMeta {
  source: CacheSource;
  language: Language;
  lastFetchedAt: string;
  expiresAt: string;
}

// ============================================================================
// CLI Types
// ============================================================================

export type Step = "youtube" | "trends" | "all";

export interface CLIOptions {
  step: Step;
  noCache: boolean;
  export: boolean;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportData {
  exportedAt: string;
  youtube: YouTubeVideo[];
  trends: TrendingTopic[];
}

