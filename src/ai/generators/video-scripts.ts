import { generateObject } from "ai";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../client";
import { VIDEO_SCRIPT_SYSTEM_PROMPT, buildVideoScriptPrompt } from "../prompts";
import type { VideoIdea, VideoScript } from "../../types";

// Schema for structured script output
const VideoScriptSchema = z.object({
  hook: z
    .string()
    .describe("Opening 15-second hook to grab attention immediately"),
  intro: z
    .string()
    .describe("60-second introduction establishing the topic and credibility"),
  sections: z.array(
    z.object({
      title: z.string().describe("Section heading"),
      content: z.string().describe("Section content with visual cues"),
      duration: z.string().describe("Estimated duration for this section"),
    })
  ).describe("Main body content divided into logical sections"),
  cta: z
    .string()
    .describe("Closing call-to-action (subscribe, comment, etc.)"),
  estimatedDuration: z
    .string()
    .describe("Total estimated video duration"),
  thumbnailIdeas: z.array(z.string()).describe("3 thumbnail concept ideas"),
  tags: z.array(z.string()).describe("Suggested YouTube tags for SEO"),
});

export type GeneratedVideoScript = z.infer<typeof VideoScriptSchema>;

/**
 * Generate a complete video script for a given idea
 */
export async function generateVideoScript(
  idea: VideoIdea,
  options: {
    duration?: "short" | "medium" | "long";
  } = {}
): Promise<VideoScript> {
  const { duration = "medium" } = options;

  console.log(`[AI] Generating ${duration} script for: "${idea.title}"`);

  const { object } = await generateObject({
    model: anthropic(DEFAULT_MODEL),
    system: VIDEO_SCRIPT_SYSTEM_PROMPT,
    prompt: buildVideoScriptPrompt(idea, duration),
    schema: VideoScriptSchema,
  });

  // Combine sections into full script
  const fullScript = [
    "=== HOOK ===",
    object.hook,
    "",
    "=== INTRO ===",
    object.intro,
    "",
    ...object.sections.flatMap((section) => [
      `=== ${section.title.toUpperCase()} (${section.duration}) ===`,
      section.content,
      "",
    ]),
    "=== CALL TO ACTION ===",
    object.cta,
  ].join("\n");

  const script: VideoScript = {
    id: generateId(),
    ideaId: idea.id,
    hook: object.hook,
    intro: object.intro,
    sections: object.sections,
    cta: object.cta,
    fullScript,
    estimatedDuration: object.estimatedDuration,
    thumbnailIdeas: object.thumbnailIdeas,
    tags: object.tags,
    createdAt: new Date().toISOString(),
  };

  console.log(`[AI] Generated script (${object.estimatedDuration})`);

  return script;
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
