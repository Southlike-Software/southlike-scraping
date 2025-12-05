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
  analyze: boolean;
  lang: Language;
  count: number;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportData {
  exportedAt: string;
  youtube: YouTubeVideo[];
  trends: TrendingTopic[];
}

// ============================================================================
// AI-Generated Content Types
// ============================================================================

export interface VideoIdeaOutline {
  format: string;
  duration: string;
  mainPoints: string[];
  callToAction: string;
  bRollIdeas: string[];
}

export interface ScoreBreakdown {
  trendScore: number;
  engagementScore: number;
  timingScore: number;
}

export interface VideoIdea {
  id: string;
  title: string;
  hook: string;
  targetAudience: string;
  trendSource: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string;
  outline: VideoIdeaOutline;
  language: Language;
  createdAt: string;
}

export interface VideoScriptSection {
  title: string;
  content: string;
  duration: string;
}

export interface VideoScript {
  id: string;
  ideaId: string;
  hook: string;
  intro: string;
  sections: VideoScriptSection[];
  cta: string;
  fullScript: string;
  estimatedDuration: string;
  thumbnailIdeas: string[];
  tags: string[];
  createdAt: string;
}

export type ContentType =
  | "tutorial"
  | "news"
  | "case_study"
  | "tips"
  | "comparison"
  | "deep_dive";

export type CalendarStatus = "planned" | "in_progress" | "published" | "cancelled";

export interface ContentCalendarEntry {
  id: string;
  ideaId: string;
  ideaTitle: string;
  scheduledDate: string;
  dayOfWeek: string;
  timeSlot: string;
  priority: number;
  reasoning: string;
  contentType: ContentType;
  status: CalendarStatus;
  createdAt: string;
}

