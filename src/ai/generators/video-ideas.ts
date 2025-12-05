import { generateObject } from "ai";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../client";
import {
  VIDEO_IDEAS_SYSTEM_PROMPT,
  buildVideoIdeasPrompt,
  prepareVideoIdeasData,
} from "../prompts";
import {
  calculateScoreBreakdown,
  calculateCompositeScore,
  type NicheAverages,
} from "../scoring";
import type {
  TrendingTopic,
  YouTubeVideo,
  VideoIdea,
  Language,
  VideoIdeaOutline,
  ScoreBreakdown,
} from "../../types";

// ============================================================================
// Zod Schemas for Structured Output
// ============================================================================

const VideoIdeaOutlineSchema = z.object({
  format: z
    .string()
    .describe(
      "The video format/style (e.g., 'Screen recording tutorial with face cam intro')"
    ),
  duration: z
    .string()
    .describe("Recommended video duration (e.g., '10-12 minutes')"),
  mainPoints: z
    .array(z.string())
    .describe("4-6 specific bullet points of what to cover in the video"),
  callToAction: z
    .string()
    .describe("What to tell viewers to do at the end of the video"),
  bRollIdeas: z
    .array(z.string())
    .describe("3-4 visual suggestions for B-roll footage"),
});

const VideoIdeaSchema = z.object({
  title: z.string().describe("Compelling, click-worthy video title"),
  hook: z
    .string()
    .describe("Opening hook or angle that makes this video unique"),
  targetAudience: z
    .string()
    .describe("Specific audience segment this video targets"),
  trendSource: z
    .string()
    .describe("The specific trending topic or keyword that inspired this idea"),
  reasoning: z
    .string()
    .describe(
      "Detailed explanation citing specific trend data, engagement metrics, timing advantage, and audience fit"
    ),
  outline: VideoIdeaOutlineSchema.describe(
    "Actionable video production brief"
  ),
});

const VideoIdeasResponseSchema = z.object({
  ideas: z.array(VideoIdeaSchema),
});

export type GeneratedVideoIdea = z.infer<typeof VideoIdeaSchema>;

// ============================================================================
// Video Ideas Generation
// ============================================================================

/**
 * Generate video ideas based on current trends and top-performing videos
 * Now includes quantitative scoring and detailed outlines
 */
export async function generateVideoIdeas(
  trends: TrendingTopic[],
  videos: YouTubeVideo[],
  options: {
    count?: number;
    language?: Language;
  } = {}
): Promise<VideoIdea[]> {
  const { count = 5, language = "en" } = options;

  // Filter trends and videos by language
  const filteredTrends = trends.filter((t) => t.language === language);
  const filteredVideos = videos.filter((v) => v.language === language);

  if (filteredTrends.length === 0) {
    console.warn(`[AI] No trends found for language: ${language}`);
    return [];
  }

  console.log(`[AI] Generating ${count} video ideas for ${language}...`);
  console.log(
    `[AI] Using ${filteredTrends.length} trends and ${filteredVideos.length} videos as context`
  );

  // Prepare enriched data for scoring (includes nicheAverages)
  const enrichedData = prepareVideoIdeasData(filteredTrends, filteredVideos);
  const { nicheAverages } = enrichedData;

  console.log(
    `[AI] Niche averages: ${nicheAverages.avgEngagementRate.toFixed(2)}% engagement rate`
  );

  // Generate ideas using Claude
  const { object } = await generateObject({
    model: anthropic(DEFAULT_MODEL),
    system: VIDEO_IDEAS_SYSTEM_PROMPT,
    prompt: buildVideoIdeasPrompt(
      filteredTrends,
      filteredVideos,
      count,
      language
    ),
    schema: VideoIdeasResponseSchema,
  });

  // Transform to VideoIdea type with calculated scores
  const ideas: VideoIdea[] = object.ideas.map((idea) => {
    // Find the matching trend for this idea to calculate scores
    const matchingTrend = findMatchingTrend(idea.trendSource, filteredTrends);
    const scoreBreakdown = calculateIdeaScoreBreakdown(
      matchingTrend,
      nicheAverages
    );
    const score = calculateCompositeScore(scoreBreakdown);

    return {
      id: generateId(),
      title: idea.title,
      hook: idea.hook,
      targetAudience: idea.targetAudience,
      trendSource: idea.trendSource,
      score,
      scoreBreakdown,
      reasoning: idea.reasoning,
      outline: idea.outline,
      language,
      createdAt: new Date().toISOString(),
    };
  });

  // Sort by score descending
  ideas.sort((a, b) => b.score - a.score);

  console.log(`[AI] Generated ${ideas.length} video ideas`);
  console.log(
    `[AI] Score range: ${ideas[ideas.length - 1]?.score || 0} - ${ideas[0]?.score || 0}`
  );

  return ideas;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the trend that best matches the idea's trend source
 */
function findMatchingTrend(
  trendSource: string,
  trends: TrendingTopic[]
): TrendingTopic | null {
  const lowerSource = trendSource.toLowerCase();

  // Try exact match first
  let match = trends.find(
    (t) =>
      t.relatedQuery.toLowerCase() === lowerSource ||
      t.keyword.toLowerCase() === lowerSource
  );

  if (match) return match;

  // Try partial match
  match = trends.find(
    (t) =>
      t.relatedQuery.toLowerCase().includes(lowerSource) ||
      lowerSource.includes(t.relatedQuery.toLowerCase()) ||
      t.keyword.toLowerCase().includes(lowerSource) ||
      lowerSource.includes(t.keyword.toLowerCase())
  );

  if (match) return match;

  // Return highest scoring trend as fallback
  const breakout = trends.find((t) => t.isBreakout);
  if (breakout) return breakout;

  return trends[0] || null;
}

/**
 * Calculate score breakdown for an idea based on its matched trend
 */
function calculateIdeaScoreBreakdown(
  trend: TrendingTopic | null,
  nicheAverages: NicheAverages
): ScoreBreakdown {
  if (!trend) {
    // Default scores when no trend match found
    return {
      trendScore: 50,
      engagementScore: 50,
      timingScore: 50,
    };
  }

  return calculateScoreBreakdown(trend, nicheAverages);
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
