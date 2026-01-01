import { getJson } from "serpapi";
import type { TrendingTopic, Language } from "../types";
import { getConfig } from "../config";
import {
  isCacheValid,
  updateCacheMeta,
  saveTrendingTopics,
  getTrendingTopics,
} from "../db/sqlite";
import { createHash } from "crypto";

// ============================================================================
// Types
// ============================================================================

interface FetchOptions {
  noCache?: boolean;
}

interface SerpAPIRelatedQuery {
  query: string;
  value: string;
  extracted_value: number;
  link?: string;
  serpapi_link?: string;
}

interface SerpAPIRelatedQueriesResponse {
  related_queries?: {
    rising?: SerpAPIRelatedQuery[];
    top?: SerpAPIRelatedQuery[];
  };
  error?: string;
}

// ============================================================================
// Main Fetch Function
// ============================================================================

export const fetchGoogleTrends = async (
  language: Language,
  options: FetchOptions = {}
): Promise<TrendingTopic[]> => {
  const { noCache = false } = options;

  // Check cache first
  if (!noCache && isCacheValid("trends", language)) {
    console.log(`[Trends] Using cached data for ${language}`);
    return getTrendingTopics(language);
  }

  // Check for API key
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.error("[Trends] SERPAPI_KEY environment variable is not set");
    throw new Error("SERPAPI_KEY is required for Google Trends fetching");
  }

  console.log(`[Trends] Fetching fresh data for ${language}...`);

  const config = getConfig();
  const geo = config.trends.geo[language];
  const keywords =
    language === "pt" ? config.trends.keywordsPt : config.trends.keywords;
  const hl = language === "pt" ? "pt-BR" : "en-US";

  const allTopics: TrendingTopic[] = [];
  const fetchedAt = new Date().toISOString();

  // Fetch related queries for each keyword
  for (const keyword of keywords) {
    console.log(`[Trends] Fetching related queries for: "${keyword}"`);

    try {
      const results = await fetchRelatedQueries(keyword, geo, hl, apiKey);

      const { rising = [], top = [] } = results.related_queries || {};

      if (rising.length === 0 && top.length === 0) {
        console.log(
          `[Trends] No related queries found for "${keyword}" (${language}) - low search volume`
        );
        continue;
      }

      // Process rising queries
      for (const query of rising.slice(0, 20)) {
        const topic = createTrendingTopic(
          keyword,
          query,
          "rising",
          language,
          geo,
          fetchedAt
        );
        allTopics.push(topic);
      }

      // Process top queries
      for (const query of top.slice(0, 20)) {
        const topic = createTrendingTopic(
          keyword,
          query,
          "top",
          language,
          geo,
          fetchedAt
        );
        allTopics.push(topic);
      }

      if (rising.length > 0 || top.length > 0) {
        console.log(
          `[Trends] Found ${rising.length} rising + ${top.length} top queries for "${keyword}"`
        );
      }

      // Small delay between requests to be respectful to the API
      await sleep(500);
    } catch (error) {
      console.error(`[Trends] Error fetching "${keyword}":`, error);
      // Continue with next keyword
    }
  }

  // Save to database and update cache
  if (allTopics.length > 0) {
    saveTrendingTopics(allTopics);
    updateCacheMeta("trends", language);
    console.log(`[Trends] Saved ${allTopics.length} trends for ${language}`);
  }

  return allTopics;
};

// ============================================================================
// Fetch All Languages
// ============================================================================

export const fetchAllGoogleTrends = async (
  options: FetchOptions = {}
): Promise<TrendingTopic[]> => {
  const languages: Language[] = ["en", "pt"];
  const allTopics: TrendingTopic[] = [];

  for (const lang of languages) {
    const topics = await fetchGoogleTrends(lang, options);
    allTopics.push(...topics);
  }

  return allTopics;
};

// ============================================================================
// API Helpers
// ============================================================================

const fetchRelatedQueries = async (
  keyword: string,
  geo: string,
  hl: string,
  apiKey: string
): Promise<SerpAPIRelatedQueriesResponse> => {
  const result = await getJson({
    engine: "google_trends",
    q: keyword,
    data_type: "RELATED_QUERIES",
    geo,
    hl,
    api_key: apiKey,
  });

  // "No results" is not an error - just means low search volume for that keyword
  if (result.error) {
    const errorMsg = String(result.error).toLowerCase();
    if (errorMsg.includes("hasn't returned any results")) {
      // Return empty response for keywords with no data
      return { related_queries: { rising: [], top: [] } };
    }
    throw new Error(`SerpAPI error: ${result.error}`);
  }

  return result as SerpAPIRelatedQueriesResponse;
};

// ============================================================================
// Data Transformation
// ============================================================================

const createTrendingTopic = (
  keyword: string,
  query: SerpAPIRelatedQuery,
  queryType: "rising" | "top",
  language: Language,
  geo: string,
  fetchedAt: string
): TrendingTopic => {
  // Check if it's a breakout query (value contains "Breakout")
  const isBreakout = query.value.toLowerCase().includes("breakout");

  // Use extracted_value which is already a number
  let value = query.extracted_value || 0;

  // If breakout, assign a high value
  if (isBreakout) {
    value = 10000;
  }

  // Generate unique ID
  const id = generateId(keyword, query.query, queryType, language);

  return {
    id,
    keyword,
    relatedQuery: query.query,
    queryType,
    value,
    isBreakout,
    language,
    geo,
    fetchedAt,
  };
};

const generateId = (
  keyword: string,
  query: string,
  queryType: string,
  language: string
): string => {
  const hash = createHash("md5")
    .update(`${keyword}:${query}:${queryType}:${language}`)
    .digest("hex");
  return hash.substring(0, 16);
};

// ============================================================================
// Utility Functions
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
