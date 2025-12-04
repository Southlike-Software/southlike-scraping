import { parseArgs } from "util";
import type { Language } from "./types";
import {
  getYouTubeVideos,
  getTrendingTopics,
  getVideoIdeas,
  getVideoIdeaById,
  saveVideoIdeas,
  saveVideoScript,
  saveCalendarEntries,
  closeDb,
} from "./db/sqlite";
import {
  generateVideoIdeas,
  generateVideoScript,
  generateContentCalendar,
} from "./ai";

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface AICliArgs {
  command: string;
  language: Language;
  count: number;
  ideaId?: string;
  duration: "short" | "medium" | "long";
}

const parseCliArgs = (): AICliArgs => {
  const command = Bun.argv[2] || "help";

  const { values } = parseArgs({
    args: Bun.argv.slice(3),
    options: {
      lang: {
        type: "string",
        short: "l",
        default: "en",
      },
      count: {
        type: "string",
        short: "c",
        default: "5",
      },
      idea: {
        type: "string",
        short: "i",
      },
      duration: {
        type: "string",
        short: "d",
        default: "medium",
      },
    },
    strict: false,
    allowPositionals: true,
  });

  return {
    command,
    language: (values.lang as Language) || "en",
    count: parseInt(values.count as string) || 5,
    ideaId: values.idea as string | undefined,
    duration: (values.duration as "short" | "medium" | "long") || "medium",
  };
};

// ============================================================================
// Help
// ============================================================================

const printHelp = (): void => {
  console.log(`
🤖 AI Content Generator CLI

USAGE:
  bun run ai <command> [options]

COMMANDS:
  ideas      Generate video ideas from scraped trends
  script     Generate a full script for a video idea
  calendar   Generate a weekly content calendar
  list       List saved video ideas
  help       Show this help message

OPTIONS:
  -l, --lang <lang>      Language: en or pt (default: en)
  -c, --count <n>        Number of items to generate (default: 5)
  -i, --idea <id>        Video idea ID (for script command)
  -d, --duration <dur>   Script duration: short, medium, long (default: medium)

EXAMPLES:
  bun run ai ideas                    # Generate 5 English video ideas
  bun run ai ideas -l=pt -c=10        # Generate 10 Portuguese ideas
  bun run ai script -i=abc123         # Generate script for idea
  bun run ai calendar -c=3            # Generate calendar with 3 videos/week
  bun run ai list                     # List all saved ideas

ENVIRONMENT:
  ANTHROPIC_API_KEY    Required for AI features
`);
};

// ============================================================================
// Commands
// ============================================================================

const commandIdeas = async (args: AICliArgs): Promise<void> => {
  console.log(`🤖 Generating ${args.count} video ideas for ${args.language}...\n`);

  const trends = getTrendingTopics(args.language);
  const videos = getYouTubeVideos(args.language);

  if (trends.length === 0) {
    console.error(`❌ No trends data for ${args.language}. Run the scraper first.`);
    process.exit(1);
  }

  console.log(`   Using ${trends.length} trends and ${videos.length} videos as context`);

  const ideas = await generateVideoIdeas(trends, videos, {
    count: args.count,
    language: args.language,
  });

  saveVideoIdeas(ideas);

  console.log("\n" + "=".repeat(60));
  console.log("GENERATED VIDEO IDEAS");
  console.log("=".repeat(60) + "\n");

  ideas.forEach((idea, i) => {
    console.log(`${i + 1}. ${idea.title}`);
    console.log(`   ID: ${idea.id}`);
    console.log(`   Hook: ${idea.hook}`);
    console.log(`   Audience: ${idea.targetAudience}`);
    console.log(`   Trend: ${idea.trendSource}`);
    console.log(`   Potential: ${idea.estimatedViews}`);
    console.log("");
  });

  console.log(`✅ ${ideas.length} ideas saved. Use 'bun run ai script -i=<id>' to generate a script.`);
};

const commandScript = async (args: AICliArgs): Promise<void> => {
  if (!args.ideaId) {
    // If no ID, show list of ideas to choose from
    const ideas = getVideoIdeas();
    if (ideas.length === 0) {
      console.error("❌ No video ideas found. Generate some first with 'bun run ai ideas'");
      process.exit(1);
    }

    console.log("Available ideas:\n");
    ideas.slice(0, 10).forEach((idea, i) => {
      console.log(`  ${i + 1}. [${idea.id.slice(0, 8)}] ${idea.title}`);
    });
    console.log("\nUse: bun run ai script -i=<id>");
    return;
  }

  const idea = getVideoIdeaById(args.ideaId);
  if (!idea) {
    console.error(`❌ Idea not found: ${args.ideaId}`);
    process.exit(1);
  }

  console.log(`🤖 Generating ${args.duration} script for: "${idea.title}"\n`);

  const script = await generateVideoScript(idea, { duration: args.duration });
  saveVideoScript(script);

  console.log("\n" + "=".repeat(60));
  console.log("GENERATED SCRIPT");
  console.log("=".repeat(60) + "\n");

  console.log("🎬 HOOK");
  console.log("-".repeat(40));
  console.log(script.hook);
  console.log("");

  console.log("📢 INTRO");
  console.log("-".repeat(40));
  console.log(script.intro);
  console.log("");

  script.sections.forEach((section) => {
    console.log(`📝 ${section.title.toUpperCase()} (${section.duration})`);
    console.log("-".repeat(40));
    console.log(section.content);
    console.log("");
  });

  console.log("🎯 CALL TO ACTION");
  console.log("-".repeat(40));
  console.log(script.cta);
  console.log("");

  console.log("🏷️ SUGGESTED TAGS");
  console.log("-".repeat(40));
  console.log(script.tags.join(", "));
  console.log("");

  console.log(`✅ Script saved (${script.estimatedDuration}). ID: ${script.id}`);
};

const commandCalendar = async (args: AICliArgs): Promise<void> => {
  const ideas = getVideoIdeas();

  if (ideas.length === 0) {
    console.error("❌ No video ideas found. Generate some first with 'bun run ai ideas'");
    process.exit(1);
  }

  console.log(`🤖 Generating content calendar (${args.count} videos/week)...\n`);
  console.log(`   Using ${ideas.length} video ideas`);

  const calendar = await generateContentCalendar(ideas, {
    videosPerWeek: args.count,
  });

  saveCalendarEntries(calendar.entries);

  console.log("\n" + "=".repeat(60));
  console.log("CONTENT CALENDAR");
  console.log("=".repeat(60) + "\n");

  if (calendar.weeklyTheme) {
    console.log(`📌 Weekly Theme: ${calendar.weeklyTheme}\n`);
  }

  calendar.entries.forEach((entry) => {
    console.log(`📅 ${entry.dayOfWeek}, ${entry.scheduledDate} at ${entry.timeSlot}`);
    console.log(`   ${entry.ideaTitle}`);
    console.log(`   Type: ${entry.contentType} | Priority: ${entry.priority}/10`);
    console.log(`   ${entry.reasoning}`);
    console.log("");
  });

  if (calendar.notes) {
    console.log(`📝 Notes: ${calendar.notes}\n`);
  }

  console.log(`✅ Calendar saved with ${calendar.entries.length} entries.`);
};

const commandList = async (args: AICliArgs): Promise<void> => {
  const ideas = getVideoIdeas(args.language === "en" || args.language === "pt" ? args.language : undefined);

  if (ideas.length === 0) {
    console.log("No video ideas found. Generate some with 'bun run ai ideas'");
    return;
  }

  console.log(`\n💡 Video Ideas (${ideas.length} total)\n`);
  console.log("-".repeat(60));

  ideas.forEach((idea, i) => {
    console.log(`${i + 1}. ${idea.title}`);
    console.log(`   ID: ${idea.id}`);
    console.log(`   Potential: ${idea.estimatedViews} | Lang: ${idea.language}`);
    console.log("");
  });
};

// ============================================================================
// Main
// ============================================================================

const main = async (): Promise<void> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set. Cannot run AI features.");
    process.exit(1);
  }

  const args = parseCliArgs();

  try {
    switch (args.command) {
      case "ideas":
        await commandIdeas(args);
        break;
      case "script":
        await commandScript(args);
        break;
      case "calendar":
        await commandCalendar(args);
        break;
      case "list":
        await commandList(args);
        break;
      case "help":
      default:
        printHelp();
        break;
    }
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    process.exit(1);
  } finally {
    closeDb();
  }
};

main();
