import { mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { ExportData, YouTubeVideo, TrendingTopic } from "./types";
import { getYouTubeVideos, getTrendingTopics } from "./db/sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = resolve(__dirname, "../exports");

// Ensure exports directory exists
if (!existsSync(EXPORTS_DIR)) {
  mkdirSync(EXPORTS_DIR, { recursive: true });
}

// ============================================================================
// Export Functions
// ============================================================================

export const exportToJson = async (): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `scraper-export-${timestamp}.json`;
  const filepath = resolve(EXPORTS_DIR, filename);

  const data: ExportData = {
    exportedAt: new Date().toISOString(),
    youtube: getYouTubeVideos(),
    trends: getTrendingTopics(),
  };

  await Bun.write(filepath, JSON.stringify(data, null, 2));

  console.log(`[Export] Data exported to: ${filepath}`);
  console.log(`[Export] YouTube videos: ${data.youtube.length}`);
  console.log(`[Export] Trending topics: ${data.trends.length}`);

  return filepath;
};

export const exportYouTubeToJson = async (): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `youtube-export-${timestamp}.json`;
  const filepath = resolve(EXPORTS_DIR, filename);

  const videos = getYouTubeVideos();

  await Bun.write(
    filepath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: videos.length,
        videos,
      },
      null,
      2
    )
  );

  console.log(`[Export] YouTube data exported to: ${filepath}`);
  return filepath;
};

export const exportTrendsToJson = async (): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `trends-export-${timestamp}.json`;
  const filepath = resolve(EXPORTS_DIR, filename);

  const trends = getTrendingTopics();

  await Bun.write(
    filepath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: trends.length,
        trends,
      },
      null,
      2
    )
  );

  console.log(`[Export] Trends data exported to: ${filepath}`);
  return filepath;
};

// ============================================================================
// Summary Report
// ============================================================================

export const generateSummary = (): void => {
  const videos = getYouTubeVideos();
  const trends = getTrendingTopics();

  console.log("\n" + "=".repeat(60));
  console.log("SCRAPER SUMMARY");
  console.log("=".repeat(60));

  // YouTube Summary
  console.log("\n📺 YOUTUBE VIDEOS");
  console.log("-".repeat(40));
  console.log(`Total videos: ${videos.length}`);

  const videosByLang = groupBy(videos, "language");
  for (const [lang, langVideos] of Object.entries(videosByLang)) {
    console.log(`  ${lang.toUpperCase()}: ${langVideos.length} videos`);
  }

  // Top videos by views
  const topVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);
  if (topVideos.length > 0) {
    console.log("\nTop 5 by views:");
    topVideos.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.title.slice(0, 50)}... (${formatNumber(v.viewCount)} views)`);
    });
  }

  // Trends Summary
  console.log("\n📈 GOOGLE TRENDS");
  console.log("-".repeat(40));
  console.log(`Total trends: ${trends.length}`);

  const trendsByLang = groupBy(trends, "language");
  for (const [lang, langTrends] of Object.entries(trendsByLang)) {
    console.log(`  ${lang.toUpperCase()}: ${langTrends.length} trends`);
  }

  // Breakout trends
  const breakouts = trends.filter((t) => t.isBreakout);
  if (breakouts.length > 0) {
    console.log(`\n🚀 Breakout trends (${breakouts.length}):`);
    breakouts.slice(0, 10).forEach((t) => {
      console.log(`  - "${t.relatedQuery}" (from: ${t.keyword})`);
    });
  }

  // Rising trends
  const rising = trends
    .filter((t) => t.queryType === "rising" && !t.isBreakout)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (rising.length > 0) {
    console.log("\n📊 Top rising trends:");
    rising.forEach((t) => {
      console.log(`  - "${t.relatedQuery}" (+${t.value}%) [${t.language}]`);
    });
  }

  console.log("\n" + "=".repeat(60) + "\n");
};

// ============================================================================
// Utility Functions
// ============================================================================

const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce(
    (acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
};

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
};

