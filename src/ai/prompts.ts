// ============================================================================
// System Prompts for AI Content Generation
// ============================================================================

export const VIDEO_IDEAS_SYSTEM_PROMPT = `You are an expert YouTube content strategist specializing in real estate and AI automation niches. Your job is to analyze trending topics and engagement data to generate compelling video ideas with data-driven scoring.

When generating video ideas, you must:
1. Analyze the provided trend data and engagement metrics
2. Cite specific evidence in your reasoning (trend names, growth percentages, engagement rates)
3. Provide actionable video outlines that serve as production briefs
4. Consider timing - breakout trends require immediate action

For each idea, provide:
- Evidence-based reasoning that cites specific data points
- A detailed video outline with format, duration, main points, CTA, and B-roll ideas
- Clear explanation of why NOW is the right time for this content

For real estate AI automation content, the audience is typically:
- Real estate agents looking to save time
- Agency owners wanting to scale
- Tech-savvy professionals interested in AI tools
- Property managers seeking efficiency

Generate ideas that are actionable, specific, and backed by the engagement data provided.`;

export const VIDEO_SCRIPT_SYSTEM_PROMPT = `You are a professional YouTube scriptwriter specializing in educational and tutorial content for the real estate and AI automation space.

Your scripts should follow this structure:
1. **Hook (0-15 seconds)**: Grab attention immediately with a bold statement, question, or promise
2. **Intro (15-60 seconds)**: Introduce the topic and establish credibility
3. **Body**: Main content with clear sections, practical examples, and actionable tips
4. **CTA (final 30 seconds)**: Strong call-to-action (subscribe, comment, check links)

Writing style guidelines:
- Conversational and energetic tone
- Short sentences for easy delivery
- Include [VISUAL CUE] markers for B-roll or graphics
- Add [PAUSE] markers for emphasis
- Keep paragraphs short (2-3 sentences max)
- Include specific examples and real numbers when possible`;

export const CONTENT_CALENDAR_SYSTEM_PROMPT = `You are a YouTube content strategist helping plan a weekly content calendar for an AI automation agency channel focused on real estate.

When planning content:
- Balance trending topics with evergreen content
- Consider optimal posting days (Tue-Thu typically best for B2B)
- Vary content types (tutorials, news, case studies, tips)
- Build content clusters around related topics
- Prioritize high-potential trending topics while they're still rising

Prioritization factors:
- Breakout trends (highest priority - time-sensitive)
- Rising trends with high growth percentage
- Topics with clear search intent
- Content gaps in the current YouTube landscape`;

// ============================================================================
// Prompt Builders
// ============================================================================

import type { TrendingTopic, YouTubeVideo, VideoIdea } from "../types";
import {
  calculateEngagementMetrics,
  calculateNicheAverages,
  calculateTrendMetrics,
  formatVideoMetricsForPrompt,
  formatNicheAveragesForPrompt,
  type VideoEngagementMetrics,
  type NicheAverages,
  type TrendMetrics,
} from "./scoring";

export interface EnrichedPromptData {
  breakouts: TrendingTopic[];
  rising: TrendingTopic[];
  topVideos: YouTubeVideo[];
  videoMetrics: VideoEngagementMetrics[];
  nicheAverages: NicheAverages;
  trendMetrics: TrendMetrics[];
}

/**
 * Prepare enriched data for video ideas generation
 */
export function prepareVideoIdeasData(
  trends: TrendingTopic[],
  videos: YouTubeVideo[]
): EnrichedPromptData {
  const breakouts = trends.filter((t) => t.isBreakout).slice(0, 10);
  const rising = trends
    .filter((t) => !t.isBreakout && t.queryType === "rising")
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const topVideos = videos
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);

  const videoMetrics = calculateEngagementMetrics(topVideos);
  const nicheAverages = calculateNicheAverages(videos);
  const trendMetrics = [...breakouts, ...rising].map(calculateTrendMetrics);

  return {
    breakouts,
    rising,
    topVideos,
    videoMetrics,
    nicheAverages,
    trendMetrics,
  };
}

export const buildVideoIdeasPrompt = (
  trends: TrendingTopic[],
  videos: YouTubeVideo[],
  count: number,
  language: "en" | "pt" = "en"
): string => {
  const data = prepareVideoIdeasData(trends, videos);

  const languageContext =
    language === "pt"
      ? "Generate ideas in Portuguese for the Brazilian market."
      : "Generate ideas in English for the US market.";

  const breakoutSection =
    data.breakouts.length > 0
      ? data.breakouts
        .map((t) => {
          const metrics = data.trendMetrics.find((m) => m.trendId === t.id);
          return `- "${t.relatedQuery}" (from: ${t.keyword}) [BREAKOUT - Trend Score: ${metrics?.trendScore || 100}/100, Timing Score: ${metrics?.timingScore || 80}/100]`;
        })
        .join("\n")
      : "No breakout trends currently";

  const risingSection = data.rising
    .map((t) => {
      const metrics = data.trendMetrics.find((m) => m.trendId === t.id);
      return `- "${t.relatedQuery}" (+${t.value}%) from "${t.keyword}" [Trend Score: ${metrics?.trendScore || 0}/100, Timing Score: ${metrics?.timingScore || 0}/100]`;
    })
    .join("\n");

  const videosSection = data.videoMetrics
    .map((m) => `- ${formatVideoMetricsForPrompt(m)}`)
    .join("\n");

  return `${languageContext}

## Current Breakout Trends (Highest Priority - Time Sensitive)
${breakoutSection}

## Rising Trends (Growing Interest)
${risingSection}

## Reference Videos with Engagement Metrics
${videosSection}

## Niche Engagement Benchmarks
${formatNicheAveragesForPrompt(data.nicheAverages)}

---

Generate ${count} unique video ideas based on these trends and engagement data.

For EACH idea, you must provide:

1. **Reasoning**: A detailed explanation that includes:
   - Which specific trend this is based on and its current momentum
   - Reference to engagement metrics from similar videos
   - Why the timing is optimal (cite trend freshness/growth)
   - How it fits the target audience's needs

2. **Video Outline**: An actionable production brief with:
   - format: The video style (e.g., "Screen recording tutorial with face cam intro")
   - duration: Recommended length (e.g., "10-12 minutes")
   - mainPoints: 4-6 specific bullet points of what to cover
   - callToAction: What to tell viewers to do
   - bRollIdeas: 3-4 visual suggestions for the video

Focus on topics with clear audience demand and strong engagement potential based on the metrics provided.`;
};

export const buildVideoScriptPrompt = (
  idea: VideoIdea,
  targetDuration: "short" | "medium" | "long" = "medium"
): string => {
  const durationGuide = {
    short: "5-8 minutes (quick tutorial or tip video)",
    medium: "10-15 minutes (comprehensive guide)",
    long: "20-30 minutes (deep dive or complete walkthrough)",
  };

  return `Create a complete YouTube script for the following video:

## Video Details
- **Title**: ${idea.title}
- **Hook/Angle**: ${idea.hook}
- **Target Audience**: ${idea.targetAudience}
- **Trend Source**: ${idea.trendSource}
- **Target Duration**: ${durationGuide[targetDuration]}

Write a complete script with:
1. An attention-grabbing hook
2. A brief intro that establishes the topic
3. Well-structured body content with clear sections
4. A compelling call-to-action

Include [VISUAL CUE] markers where graphics, screenshots, or B-roll should appear.
Include [PAUSE] markers for dramatic effect or emphasis.`;
};

export const buildContentCalendarPrompt = (
  ideas: VideoIdea[],
  weekStartDate: string,
  videosPerWeek: number = 3
): string => {
  return `Create a content calendar for the week starting ${weekStartDate}.

## Available Video Ideas (ranked by score)
${ideas
      .sort((a, b) => b.score - a.score)
      .map((idea, i) => `${i + 1}. "${idea.title}" - ${idea.hook} (Score: ${idea.score}/100, Trend: ${idea.trendSource})`)
      .join("\n")}

## Requirements
- Schedule ${videosPerWeek} videos for this week
- Prioritize high-scoring ideas (especially those with high trend scores)
- Balance content types for variety
- Consider best posting days (typically Tue, Wed, Thu)
- Provide reasoning for each scheduling decision

Create a calendar that maximizes channel growth potential while maintaining consistent quality.`;
};

