import { parseArgs } from "util";
import type { CLIOptions, Step, Language } from "./types";
import { fetchAllYouTubeVideos } from "./fetchers/youtube";
import { fetchAllGoogleTrends } from "./fetchers/google-trends";
import { exportToJson, generateSummary } from "./export";
import { closeDb, getYouTubeVideos, getTrendingTopics, saveVideoIdeas } from "./db/sqlite";
import { generateVideoIdeas } from "./ai";

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const parseCliArgs = (): CLIOptions => {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            step: {
                type: "string",
                short: "s",
                default: "all",
            },
            "no-cache": {
                type: "boolean",
                default: false,
            },
            export: {
                type: "boolean",
                short: "e",
                default: false,
            },
            analyze: {
                type: "boolean",
                short: "a",
                default: false,
            },
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
            help: {
                type: "boolean",
                short: "h",
                default: false,
            },
        },
        strict: true,
        allowPositionals: false,
    });

    return {
        step: (values.step as Step) || "all",
        noCache: values["no-cache"] || false,
        export: values.export || false,
        analyze: values.analyze || false,
        lang: (values.lang as Language) || "en",
        count: parseInt(values.count as string) || 5,
    };
};

// ============================================================================
// Help
// ============================================================================

const printHelp = (): void => {
    console.log(`
YouTube & Google Trends Scraper for Real Estate Content Ideas

USAGE:
  bun run scrape [options]

OPTIONS:
  -s, --step <step>    Step to run: youtube, trends, or all (default: all)
      --no-cache       Disable cache, always fetch fresh data
  -e, --export         Export results to JSON after fetching
  -a, --analyze        Generate AI video ideas after fetching
  -l, --lang <lang>    Language for AI analysis: en or pt (default: en)
  -c, --count <n>      Number of AI ideas to generate (default: 5)
  -h, --help           Show this help message

EXAMPLES:
  bun run scrape                      # Run all fetchers with caching
  bun run scrape --step=youtube       # Only fetch YouTube data
  bun run scrape --step=trends        # Only fetch Google Trends data
  bun run scrape --no-cache           # Force fresh fetch, ignore cache
  bun run scrape --export             # Fetch and export to JSON
  bun run scrape --analyze            # Fetch data and generate AI video ideas
  bun run scrape -a -l=pt -c=10       # Generate 10 Portuguese video ideas

AI COMMANDS:
  bun run ai:ideas                    # Generate video ideas from cached data
  bun run ai:calendar                 # Generate weekly content calendar

ENVIRONMENT:
  YOUTUBE_API_KEY      Required for YouTube Data API access
  ANTHROPIC_API_KEY    Required for AI analysis features

CACHE:
  Data is cached for 6 hours by default (configurable in config.json).
  Use --no-cache to bypass the cache during development.
`);
};

// ============================================================================
// Main Execution
// ============================================================================

const main = async (): Promise<void> => {
    const args = parseCliArgs();

    // Check for help flag
    if (Bun.argv.includes("-h") || Bun.argv.includes("--help")) {
        printHelp();
        process.exit(0);
    }

    console.log("🚀 Starting YouTube & Google Trends Scraper");
    console.log(`   Step: ${args.step}`);
    console.log(`   Cache: ${args.noCache ? "disabled" : "enabled"}`);
    console.log(`   Export: ${args.export ? "yes" : "no"}`);
    console.log(`   Analyze: ${args.analyze ? `yes (${args.count} ideas in ${args.lang})` : "no"}`);
    console.log("");

    const fetchOptions = { noCache: args.noCache };

    try {
        // Run the appropriate step(s)
        switch (args.step) {
            case "youtube":
                console.log("📺 Fetching YouTube data...\n");
                await fetchAllYouTubeVideos(fetchOptions);
                break;

            case "trends":
                console.log("📈 Fetching Google Trends data...\n");
                await fetchAllGoogleTrends(fetchOptions);
                break;

            case "all":
            default:
                console.log("📺 Fetching YouTube data...\n");
                await fetchAllYouTubeVideos(fetchOptions);

                console.log("\n📈 Fetching Google Trends data...\n");
                await fetchAllGoogleTrends(fetchOptions);
                break;
        }

        // Generate summary
        generateSummary();

        // AI Analysis if requested
        if (args.analyze) {
            console.log("\n🤖 Running AI Analysis...\n");
            await runAIAnalysis(args.lang, args.count);
        }

        // Export if requested
        if (args.export) {
            console.log("📁 Exporting data to JSON...\n");
            await exportToJson();
        }

        console.log("✅ Scraping complete!");
    } catch (error) {
        console.error("❌ Error during scraping:", error);
        process.exit(1);
    } finally {
        closeDb();
    }
};

// ============================================================================
// AI Analysis
// ============================================================================

const runAIAnalysis = async (language: Language, count: number): Promise<void> => {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("❌ ANTHROPIC_API_KEY not set. Cannot run AI analysis.");
        return;
    }

    const trends = getTrendingTopics(language);
    const videos = getYouTubeVideos(language);

    if (trends.length === 0) {
        console.warn(`⚠️ No trends found for language: ${language}`);
        return;
    }

    console.log(`   Found ${trends.length} trends and ${videos.length} videos for ${language}`);
    console.log(`   Generating ${count} video ideas...\n`);

    const ideas = await generateVideoIdeas(trends, videos, { count, language });

    // Save to database
    saveVideoIdeas(ideas);

    // Display results
    console.log("\n" + "=".repeat(60));
    console.log("AI-GENERATED VIDEO IDEAS");
    console.log("=".repeat(60) + "\n");

    ideas.forEach((idea, index) => {
        console.log(`${index + 1}. ${idea.title}`);
        console.log(`   Hook: ${idea.hook}`);
        console.log(`   Audience: ${idea.targetAudience}`);
        console.log(`   Trend: ${idea.trendSource}`);
        console.log(`   Potential: ${idea.estimatedViews}`);
        console.log("");
    });

    console.log(`💡 ${ideas.length} ideas saved to database.`);
    console.log("   View them in the dashboard: bun run dev\n");
};

// Run
main();
