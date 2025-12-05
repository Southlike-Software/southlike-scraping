// ============================================================================
// Video Scoring Utilities
// Industry-standard YouTube engagement metrics and trend scoring
// ============================================================================

import type { YouTubeVideo, TrendingTopic, ScoreBreakdown } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface VideoEngagementMetrics {
  videoId: string;
  title: string;
  viewCount: number;
  engagementRate: number;
  likeToViewRatio: number;
  commentToViewRatio: number;
  viralityScore: number;
  daysSincePublished: number;
}

export interface TrendMetrics {
  trendId: string;
  query: string;
  trendScore: number;
  timingScore: number;
  isBreakout: boolean;
  growthPercentage: number;
  hoursSinceFetched: number;
}

export interface NicheAverages {
  avgEngagementRate: number;
  avgLikeRatio: number;
  avgCommentRatio: number;
  avgViralityScore: number;
}

// ============================================================================
// Constants - Industry Benchmarks
// ============================================================================

// Healthy YouTube engagement benchmarks
const BENCHMARKS = {
  likeRatio: { min: 0.02, max: 0.04 }, // 2-4% is healthy
  commentRatio: { min: 0.0005, max: 0.005 }, // 0.05-0.5% is healthy
  engagementRate: { min: 2, max: 6 }, // 2-6% is healthy
};

// Scoring weights for composite score
const WEIGHTS = {
  trend: 0.4,
  engagement: 0.4,
  timing: 0.2,
};

// ============================================================================
// Engagement Metric Calculations
// ============================================================================

/**
 * Calculate engagement rate: (likes + comments) / views × 100
 */
export function calculateEngagementRate(video: YouTubeVideo): number {
  if (video.viewCount === 0) return 0;
  return ((video.likeCount + video.commentCount) / video.viewCount) * 100;
}

/**
 * Calculate like-to-view ratio: likes / views
 * Healthy range: 2-4%
 */
export function calculateLikeRatio(video: YouTubeVideo): number {
  if (video.viewCount === 0) return 0;
  return video.likeCount / video.viewCount;
}

/**
 * Calculate comment-to-view ratio: comments / views
 * Healthy range: 0.05-0.5%
 */
export function calculateCommentRatio(video: YouTubeVideo): number {
  if (video.viewCount === 0) return 0;
  return video.commentCount / video.viewCount;
}

/**
 * Calculate virality score: views / days since published
 * Higher = faster growth
 */
export function calculateViralityScore(video: YouTubeVideo): number {
  const publishedDate = new Date(video.publishedAt);
  const now = new Date();
  const daysSincePublished = Math.max(
    1,
    Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  return video.viewCount / daysSincePublished;
}

/**
 * Calculate days since video was published
 */
export function getDaysSincePublished(video: YouTubeVideo): number {
  const publishedDate = new Date(video.publishedAt);
  const now = new Date();
  return Math.max(
    1,
    Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
  );
}

/**
 * Calculate all engagement metrics for a video
 */
export function calculateVideoMetrics(video: YouTubeVideo): VideoEngagementMetrics {
  return {
    videoId: video.id,
    title: video.title,
    viewCount: video.viewCount,
    engagementRate: calculateEngagementRate(video),
    likeToViewRatio: calculateLikeRatio(video),
    commentToViewRatio: calculateCommentRatio(video),
    viralityScore: calculateViralityScore(video),
    daysSincePublished: getDaysSincePublished(video),
  };
}

/**
 * Calculate engagement metrics for multiple videos
 */
export function calculateEngagementMetrics(
  videos: YouTubeVideo[]
): VideoEngagementMetrics[] {
  return videos.map(calculateVideoMetrics);
}

/**
 * Calculate niche averages from a set of videos
 */
export function calculateNicheAverages(videos: YouTubeVideo[]): NicheAverages {
  if (videos.length === 0) {
    return {
      avgEngagementRate: 0,
      avgLikeRatio: 0,
      avgCommentRatio: 0,
      avgViralityScore: 0,
    };
  }

  const metrics = calculateEngagementMetrics(videos);
  const sum = metrics.reduce(
    (acc, m) => ({
      engagementRate: acc.engagementRate + m.engagementRate,
      likeRatio: acc.likeRatio + m.likeToViewRatio,
      commentRatio: acc.commentRatio + m.commentToViewRatio,
      viralityScore: acc.viralityScore + m.viralityScore,
    }),
    { engagementRate: 0, likeRatio: 0, commentRatio: 0, viralityScore: 0 }
  );

  return {
    avgEngagementRate: sum.engagementRate / metrics.length,
    avgLikeRatio: sum.likeRatio / metrics.length,
    avgCommentRatio: sum.commentRatio / metrics.length,
    avgViralityScore: sum.viralityScore / metrics.length,
  };
}

// ============================================================================
// Trend Scoring
// ============================================================================

/**
 * Calculate hours since a trend was fetched
 */
export function getHoursSinceFetched(trend: TrendingTopic): number {
  const fetchedDate = new Date(trend.fetchedAt);
  const now = new Date();
  return Math.max(
    0,
    Math.floor((now.getTime() - fetchedDate.getTime()) / (1000 * 60 * 60))
  );
}

/**
 * Calculate trend score (0-100) based on trend strength
 * - Breakout trends = 100 (highest priority)
 * - Rising trends = normalized 0-100 based on growth percentage
 */
export function calculateTrendScore(trend: TrendingTopic): number {
  if (trend.isBreakout) {
    return 100;
  }

  // Normalize rising trends: cap at 1000% growth for score calculation
  // 0% = 0 score, 1000%+ = 100 score
  const normalizedValue = Math.min(trend.value, 1000);
  return Math.round((normalizedValue / 1000) * 100);
}

/**
 * Calculate timing score (0-100) based on trend freshness
 * - Trends from last 24 hours get full bonus
 * - 24-48 hours get partial bonus
 * - Older trends get reduced score
 */
export function calculateTimingScore(trend: TrendingTopic): number {
  const hoursSinceFetched = getHoursSinceFetched(trend);

  if (hoursSinceFetched <= 24) {
    // Fresh trend: 80-100 score
    return Math.round(100 - (hoursSinceFetched / 24) * 20);
  } else if (hoursSinceFetched <= 48) {
    // Recent trend: 50-80 score
    return Math.round(80 - ((hoursSinceFetched - 24) / 24) * 30);
  } else if (hoursSinceFetched <= 72) {
    // Older trend: 30-50 score
    return Math.round(50 - ((hoursSinceFetched - 48) / 24) * 20);
  } else {
    // Stale trend: 0-30 score (decays over next 48 hours)
    const decay = Math.min((hoursSinceFetched - 72) / 48, 1);
    return Math.round(30 * (1 - decay));
  }
}

/**
 * Calculate all trend metrics
 */
export function calculateTrendMetrics(trend: TrendingTopic): TrendMetrics {
  return {
    trendId: trend.id,
    query: trend.relatedQuery,
    trendScore: calculateTrendScore(trend),
    timingScore: calculateTimingScore(trend),
    isBreakout: trend.isBreakout,
    growthPercentage: trend.value,
    hoursSinceFetched: getHoursSinceFetched(trend),
  };
}

// ============================================================================
// Engagement Score Calculation
// ============================================================================

/**
 * Calculate engagement potential score (0-100) based on niche averages
 * Compares niche metrics against industry benchmarks
 */
export function calculateEngagementScore(nicheAverages: NicheAverages): number {
  let score = 50; // Start at neutral

  // Like ratio scoring (max +20 points)
  if (nicheAverages.avgLikeRatio >= BENCHMARKS.likeRatio.max) {
    score += 20;
  } else if (nicheAverages.avgLikeRatio >= BENCHMARKS.likeRatio.min) {
    const ratio =
      (nicheAverages.avgLikeRatio - BENCHMARKS.likeRatio.min) /
      (BENCHMARKS.likeRatio.max - BENCHMARKS.likeRatio.min);
    score += Math.round(ratio * 20);
  }

  // Comment ratio scoring (max +15 points)
  if (nicheAverages.avgCommentRatio >= BENCHMARKS.commentRatio.max) {
    score += 15;
  } else if (nicheAverages.avgCommentRatio >= BENCHMARKS.commentRatio.min) {
    const ratio =
      (nicheAverages.avgCommentRatio - BENCHMARKS.commentRatio.min) /
      (BENCHMARKS.commentRatio.max - BENCHMARKS.commentRatio.min);
    score += Math.round(ratio * 15);
  }

  // Engagement rate scoring (max +15 points)
  if (nicheAverages.avgEngagementRate >= BENCHMARKS.engagementRate.max) {
    score += 15;
  } else if (nicheAverages.avgEngagementRate >= BENCHMARKS.engagementRate.min) {
    const ratio =
      (nicheAverages.avgEngagementRate - BENCHMARKS.engagementRate.min) /
      (BENCHMARKS.engagementRate.max - BENCHMARKS.engagementRate.min);
    score += Math.round(ratio * 15);
  }

  return Math.min(100, Math.max(0, score));
}

// ============================================================================
// Composite Score Calculation
// ============================================================================

/**
 * Calculate final composite score (0-100) combining:
 * - Trend strength (40% weight)
 * - Engagement potential (40% weight)
 * - Timing/freshness (20% weight)
 */
export function calculateCompositeScore(breakdown: ScoreBreakdown): number {
  const weighted =
    breakdown.trendScore * WEIGHTS.trend +
    breakdown.engagementScore * WEIGHTS.engagement +
    breakdown.timingScore * WEIGHTS.timing;

  return Math.round(Math.min(100, Math.max(0, weighted)));
}

/**
 * Calculate complete score breakdown for a trend + engagement data
 */
export function calculateScoreBreakdown(
  trend: TrendingTopic,
  nicheAverages: NicheAverages
): ScoreBreakdown {
  return {
    trendScore: calculateTrendScore(trend),
    engagementScore: calculateEngagementScore(nicheAverages),
    timingScore: calculateTimingScore(trend),
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format video metrics for display in prompts
 */
export function formatVideoMetricsForPrompt(
  metrics: VideoEngagementMetrics
): string {
  const likePercent = (metrics.likeToViewRatio * 100).toFixed(1);
  const commentPercent = (metrics.commentToViewRatio * 100).toFixed(2);
  const viewsPerDay = formatNumber(Math.round(metrics.viralityScore));

  return `"${truncate(metrics.title, 60)}" (${formatNumber(metrics.viewCount)} views, ${likePercent}% like ratio, ${commentPercent}% comment ratio, ${viewsPerDay} views/day)`;
}

/**
 * Format niche averages summary for prompts
 */
export function formatNicheAveragesForPrompt(averages: NicheAverages): string {
  return `Average engagement: ${averages.avgEngagementRate.toFixed(1)}% engagement rate, ${(averages.avgLikeRatio * 100).toFixed(1)}% like ratio, ${(averages.avgCommentRatio * 100).toFixed(2)}% comment ratio`;
}

/**
 * Format a number with K/M suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Truncate a string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}
