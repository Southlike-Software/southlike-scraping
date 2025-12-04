import { generateObject } from "ai";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../client";
import { CONTENT_CALENDAR_SYSTEM_PROMPT, buildContentCalendarPrompt } from "../prompts";
import type { VideoIdea, ContentCalendarEntry } from "../../types";

// Schema for calendar entry
const CalendarEntrySchema = z.object({
  ideaId: z.string().describe("ID of the video idea to schedule"),
  ideaTitle: z.string().describe("Title of the video for reference"),
  scheduledDate: z.string().describe("ISO date string for when to publish"),
  dayOfWeek: z.string().describe("Day of the week (e.g., Tuesday)"),
  timeSlot: z.string().describe("Recommended publish time (e.g., '10:00 AM EST')"),
  priority: z.number().min(1).max(10).describe("Priority score 1-10"),
  reasoning: z.string().describe("Why this video is scheduled for this slot"),
  contentType: z
    .enum(["tutorial", "news", "case_study", "tips", "comparison", "deep_dive"])
    .describe("Type of content for variety tracking"),
});

const ContentCalendarSchema = z.object({
  weekStart: z.string().describe("Start date of the week"),
  weekEnd: z.string().describe("End date of the week"),
  entries: z.array(CalendarEntrySchema),
  weeklyTheme: z.string().describe("Optional theme tying the week's content together"),
  notes: z.string().describe("Additional strategic notes for the week"),
});

export type GeneratedCalendar = z.infer<typeof ContentCalendarSchema>;

/**
 * Generate a weekly content calendar from video ideas
 */
export async function generateContentCalendar(
  ideas: VideoIdea[],
  options: {
    weekStartDate?: string; // ISO date string, defaults to next Monday
    videosPerWeek?: number;
  } = {}
): Promise<{
  entries: ContentCalendarEntry[];
  weeklyTheme: string;
  notes: string;
}> {
  const { videosPerWeek = 3 } = options;

  // Default to next Monday if no date provided
  const weekStartDate = options.weekStartDate || getNextMonday();

  if (ideas.length === 0) {
    console.warn("[AI] No video ideas provided for calendar generation");
    return { entries: [], weeklyTheme: "", notes: "No ideas available" };
  }

  console.log(`[AI] Generating content calendar for week of ${weekStartDate}`);
  console.log(`[AI] Scheduling ${videosPerWeek} videos from ${ideas.length} ideas`);

  const { object } = await generateObject({
    model: anthropic(DEFAULT_MODEL),
    system: CONTENT_CALENDAR_SYSTEM_PROMPT,
    prompt: buildContentCalendarPrompt(ideas, weekStartDate, videosPerWeek),
    schema: ContentCalendarSchema,
  });

  // Transform to ContentCalendarEntry type
  const entries: ContentCalendarEntry[] = object.entries.map((entry) => ({
    id: generateId(),
    ideaId: entry.ideaId,
    ideaTitle: entry.ideaTitle,
    scheduledDate: entry.scheduledDate,
    dayOfWeek: entry.dayOfWeek,
    timeSlot: entry.timeSlot || "10:00 AM",
    priority: entry.priority,
    reasoning: entry.reasoning,
    contentType: entry.contentType,
    status: "planned" as const,
    createdAt: new Date().toISOString(),
  }));

  console.log(`[AI] Created calendar with ${entries.length} entries`);
  console.log(`[AI] Weekly theme: ${object.weeklyTheme}`);

  return {
    entries,
    weeklyTheme: object.weeklyTheme,
    notes: object.notes,
  };
}

/**
 * Get the next Monday's date in ISO format
 */
function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  const dateStr = nextMonday.toISOString().split("T")[0];
  return dateStr ?? nextMonday.toISOString().slice(0, 10);
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
