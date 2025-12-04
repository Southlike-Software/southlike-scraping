import googleTrends from "google-trends-api";
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

interface RelatedQuery {
  query: string;
  value?: number;
  formattedValue?: string;
  link?: string;
}

interface RelatedQueriesResult {
  default?: {
    rankedList?: Array<{
      rankedKeyword?: RelatedQuery[];
    }>;
  };
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
      const results = await fetchRelatedQueries(keyword, geo, hl);

      // Process rising queries
      const risingQueries = extractQueries(results, "rising");
      for (const query of risingQueries) {
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
      const topQueries = extractQueries(results, "top");
      for (const query of topQueries) {
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

      // Delay to avoid rate limiting (Google Trends is more sensitive)
      await sleep(1000);
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
  hl: string
): Promise<RelatedQueriesResult> => {
  const startTime = getDateMonthsAgo(12);
  const endTime = new Date();

  const result = await googleTrends.relatedQueries({
    keyword,
    geo,
    hl,
    startTime,
    endTime,
  });

  return JSON.parse(result) as RelatedQueriesResult;
};

const extractQueries = (
  results: RelatedQueriesResult,
  type: "rising" | "top"
): RelatedQuery[] => {
  const rankedList = results.default?.rankedList || [];

  // Rising is typically at index 1, Top at index 0
  const listIndex = type === "rising" ? 1 : 0;
  const queries = rankedList[listIndex]?.rankedKeyword || [];

  return queries.slice(0, 20); // Limit to top 20
};

// ============================================================================
// Data Transformation
// ============================================================================

const createTrendingTopic = (
  keyword: string,
  query: RelatedQuery,
  queryType: "rising" | "top",
  language: Language,
  geo: string,
  fetchedAt: string
): TrendingTopic => {
  const isBreakout =
    query.formattedValue?.toLowerCase().includes("breakout") || false;

  // Parse value - could be a number or "Breakout"
  let value = 0;
  if (typeof query.value === "number") {
    value = query.value;
  } else if (query.formattedValue && !isBreakout) {
    // Try to parse percentage like "+5,000%"
    const match = query.formattedValue.match(/[\d,]+/);
    if (match) {
      value = parseInt(match[0].replace(/,/g, ""), 10);
    }
  } else if (isBreakout) {
    value = 10000; // High value for breakout queries
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

const getDateMonthsAgo = (months: number): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

