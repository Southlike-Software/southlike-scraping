import { google } from "googleapis";
import type { YouTubeVideo, Language } from "../types";
import { getConfig } from "../config";
import {
  isCacheValid,
  updateCacheMeta,
  saveYouTubeVideos,
  getYouTubeVideos,
} from "../db/sqlite";

const youtube = google.youtube("v3");

// ============================================================================
// Types
// ============================================================================

interface FetchOptions {
  noCache?: boolean;
}

interface YouTubeSearchResult {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
}

interface YouTubeVideoStats {
  id?: string;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

// ============================================================================
// API Key
// ============================================================================

const getApiKey = (): string => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY environment variable is required. Get one at https://console.cloud.google.com/"
    );
  }
  return apiKey;
};

// ============================================================================
// Search Functions
// ============================================================================

const searchVideos = async (
  query: string,
  regionCode: string,
  maxResults: number
): Promise<YouTubeSearchResult[]> => {
  const apiKey = getApiKey();

  const response = await youtube.search.list({
    key: apiKey,
    part: ["snippet"],
    q: query,
    type: ["video"],
    regionCode,
    maxResults,
    order: "viewCount", // Get most viewed videos
    publishedAfter: getDateMonthsAgo(6).toISOString(), // Videos from last 6 months
    relevanceLanguage: regionCode === "BR" ? "pt" : "en",
  });

  return (response.data.items || []) as YouTubeSearchResult[];
};

const getVideoStatistics = async (
  videoIds: string[]
): Promise<Map<string, YouTubeVideoStats["statistics"]>> => {
  const apiKey = getApiKey();

  // YouTube API allows max 50 IDs per request
  const chunks = chunkArray(videoIds, 50);
  const statsMap = new Map<string, YouTubeVideoStats["statistics"]>();

  for (const chunk of chunks) {
    const response = await youtube.videos.list({
      key: apiKey,
      part: ["statistics"],
      id: chunk,
    });

    for (const item of (response.data.items || []) as YouTubeVideoStats[]) {
      if (item.id && item.statistics) {
        statsMap.set(item.id, item.statistics);
      }
    }
  }

  return statsMap;
};

// ============================================================================
// Main Fetch Function
// ============================================================================

export const fetchYouTubeVideos = async (
  language: Language,
  options: FetchOptions = {}
): Promise<YouTubeVideo[]> => {
  const { noCache = false } = options;

  // Check cache first
  if (!noCache && isCacheValid("youtube", language)) {
    console.log(`[YouTube] Using cached data for ${language}`);
    return getYouTubeVideos(language);
  }

  console.log(`[YouTube] Fetching fresh data for ${language}...`);

  const config = getConfig();
  const regionCode = config.youtube.regionCodes[language];
  const categories =
    language === "pt" ? config.youtube.categoriesPt : config.youtube.categories;

  const allVideos: YouTubeVideo[] = [];
  const seenVideoIds = new Set<string>();
  const fetchedAt = new Date().toISOString();

  // Search for each category
  for (const category of categories) {
    console.log(`[YouTube] Searching: "${category}" in ${regionCode}`);

    try {
      const searchResults = await searchVideos(
        category,
        regionCode,
        config.youtube.maxResults
      );

      // Collect video IDs for statistics lookup
      const videoIds = searchResults
        .map((r) => r.id?.videoId)
        .filter((id): id is string => !!id && !seenVideoIds.has(id));

      if (videoIds.length === 0) continue;

      // Get statistics for all videos
      const statsMap = await getVideoStatistics(videoIds);

      // Transform results
      for (const result of searchResults) {
        const videoId = result.id?.videoId;
        if (!videoId || seenVideoIds.has(videoId)) continue;

        seenVideoIds.add(videoId);
        const stats = statsMap.get(videoId);

        const video: YouTubeVideo = {
          id: videoId,
          title: result.snippet?.title || "",
          description: result.snippet?.description || "",
          channelId: result.snippet?.channelId || "",
          channelTitle: result.snippet?.channelTitle || "",
          publishedAt: result.snippet?.publishedAt || "",
          viewCount: parseInt(stats?.viewCount || "0", 10),
          likeCount: parseInt(stats?.likeCount || "0", 10),
          commentCount: parseInt(stats?.commentCount || "0", 10),
          thumbnailUrl:
            result.snippet?.thumbnails?.high?.url ||
            result.snippet?.thumbnails?.medium?.url ||
            result.snippet?.thumbnails?.default?.url ||
            "",
          language,
          searchQuery: category,
          fetchedAt,
        };

        allVideos.push(video);
      }

      // Small delay to avoid rate limiting
      await sleep(100);
    } catch (error) {
      console.error(`[YouTube] Error searching "${category}":`, error);
    }
  }

  // Save to database and update cache
  if (allVideos.length > 0) {
    saveYouTubeVideos(allVideos);
    updateCacheMeta("youtube", language);
    console.log(`[YouTube] Saved ${allVideos.length} videos for ${language}`);
  }

  return allVideos;
};

// ============================================================================
// Fetch All Languages
// ============================================================================

export const fetchAllYouTubeVideos = async (
  options: FetchOptions = {}
): Promise<YouTubeVideo[]> => {
  const languages: Language[] = ["en", "pt"];
  const allVideos: YouTubeVideo[] = [];

  for (const lang of languages) {
    const videos = await fetchYouTubeVideos(lang, options);
    allVideos.push(...videos);
  }

  return allVideos;
};

// ============================================================================
// Utility Functions
// ============================================================================

const getDateMonthsAgo = (months: number): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

