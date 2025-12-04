import { generateObject } from "ai";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../client";
import { VIDEO_IDEAS_SYSTEM_PROMPT, buildVideoIdeasPrompt } from "../prompts";
import type { TrendingTopic, YouTubeVideo, VideoIdea, Language } from "../../types";

// Schema for structured output
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
    .describe("The trending topic or keyword that inspired this idea"),
  estimatedViews: z
    .enum(["low", "medium", "high"])
    .describe("Estimated view potential based on trend strength"),
  reasoning: z
    .string()
    .describe("Brief explanation of why this topic will perform well"),
});

const VideoIdeasResponseSchema = z.object({
  ideas: z.array(VideoIdeaSchema),
});

export type GeneratedVideoIdea = z.infer<typeof VideoIdeaSchema>;

/**
 * Generate video ideas based on current trends and top-performing videos
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

  // Filter trends by language
  const filteredTrends = trends.filter((t) => t.language === language);
  const filteredVideos = videos.filter((v) => v.language === language);

  if (filteredTrends.length === 0) {
    console.warn(`[AI] No trends found for language: ${language}`);
    return [];
  }

  console.log(`[AI] Generating ${count} video ideas for ${language}...`);
  console.log(`[AI] Using ${filteredTrends.length} trends and ${filteredVideos.length} videos as context`);

  const { object } = await generateObject({
    model: anthropic(DEFAULT_MODEL),
    system: VIDEO_IDEAS_SYSTEM_PROMPT,
    prompt: buildVideoIdeasPrompt(filteredTrends, filteredVideos, count, language),
    schema: VideoIdeasResponseSchema,
  });

  // Transform to VideoIdea type with generated IDs
  const ideas: VideoIdea[] = object.ideas.map((idea) => ({
    id: generateId(),
    title: idea.title,
    hook: idea.hook,
    targetAudience: idea.targetAudience,
    trendSource: idea.trendSource,
    estimatedViews: idea.estimatedViews,
    reasoning: idea.reasoning,
    language,
    createdAt: new Date().toISOString(),
  }));

  console.log(`[AI] Generated ${ideas.length} video ideas`);

  return ideas;
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
