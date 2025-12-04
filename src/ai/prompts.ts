// ============================================================================
// System Prompts for AI Content Generation
// ============================================================================

export const VIDEO_IDEAS_SYSTEM_PROMPT = `You are an expert YouTube content strategist specializing in real estate and AI automation niches. Your job is to analyze trending topics and generate compelling video ideas that will perform well on YouTube.

When generating video ideas, consider:
- Search intent and viewer motivation
- Click-through rate optimization (compelling titles and hooks)
- Content that provides genuine value
- Trends that are rising but not oversaturated
- The target audience's pain points and aspirations

For real estate AI automation content, the audience is typically:
- Real estate agents looking to save time
- Agency owners wanting to scale
- Tech-savvy professionals interested in AI tools
- Property managers seeking efficiency

Generate ideas that are actionable, specific, and have clear audience appeal.`;

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

export const buildVideoIdeasPrompt = (
  trends: TrendingTopic[],
  videos: YouTubeVideo[],
  count: number,
  language: "en" | "pt" = "en"
): string => {
  const breakouts = trends.filter((t) => t.isBreakout).slice(0, 10);
  const rising = trends
    .filter((t) => !t.isBreakout && t.queryType === "rising")
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const topVideos = videos
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);

  const languageContext =
    language === "pt"
      ? "Generate ideas in Portuguese for the Brazilian market."
      : "Generate ideas in English for the US market.";

  return `${languageContext}

## Current Breakout Trends (Highest Priority - Time Sensitive)
${breakouts.length > 0 ? breakouts.map((t) => `- "${t.relatedQuery}" (from keyword: ${t.keyword})`).join("\n") : "No breakout trends currently"}

## Rising Trends (Growing Interest)
${rising.map((t) => `- "${t.relatedQuery}" (+${t.value}%) from "${t.keyword}"`).join("\n")}

## Top Performing Videos in This Niche (For Reference)
${topVideos.map((v) => `- "${v.title}" (${formatViews(v.viewCount)} views)`).join("\n")}

Generate ${count} unique video ideas based on these trends. Focus on topics with clear audience demand and actionable content potential.`;
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

## Available Video Ideas (ranked by potential)
${ideas.map((idea, i) => `${i + 1}. "${idea.title}" - ${idea.hook} (Trend: ${idea.trendSource}, Est. Views: ${idea.estimatedViews})`).join("\n")}

## Requirements
- Schedule ${videosPerWeek} videos for this week
- Prioritize breakout/time-sensitive topics
- Balance content types for variety
- Consider best posting days (typically Tue, Wed, Thu)
- Provide reasoning for each scheduling decision

Create a calendar that maximizes channel growth potential while maintaining consistent quality.`;
};

// Helper function
const formatViews = (views: number): string => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
};
