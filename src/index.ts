import { parseArgs } from "util";
import type { CLIOptions, Step } from "./types";
import { fetchAllYouTubeVideos } from "./fetchers/youtube";
import { fetchAllGoogleTrends } from "./fetchers/google-trends";
import { exportToJson, generateSummary } from "./export";
import { closeDb } from "./db/sqlite";

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
  -h, --help           Show this help message

EXAMPLES:
  bun run scrape                      # Run all fetchers with caching
  bun run scrape --step=youtube       # Only fetch YouTube data
  bun run scrape --step=trends        # Only fetch Google Trends data
  bun run scrape --no-cache           # Force fresh fetch, ignore cache
  bun run scrape --export             # Fetch and export to JSON

ENVIRONMENT:
  YOUTUBE_API_KEY      Required for YouTube Data API access

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

// Run
main();
