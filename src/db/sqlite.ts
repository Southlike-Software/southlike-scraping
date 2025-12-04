import { Database } from "bun:sqlite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  YouTubeVideo,
  TrendingTopic,
  CacheMeta,
  CacheSource,
  Language,
} from "../types";
import { getConfig } from "../config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../../data/scraper.db");

// Ensure data directory exists
const dataDir = resolve(__dirname, "../../data");
import { mkdirSync, existsSync } from "fs";
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Database singleton
let db: Database | null = null;

export const getDb = (): Database => {
  if (!db) {
    db = new Database(DB_PATH);
    initializeSchema(db);
  }
  return db;
};

// ============================================================================
// Schema Initialization
// ============================================================================

const initializeSchema = (database: Database): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS youtube_videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      channel_id TEXT NOT NULL,
      channel_title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      thumbnail_url TEXT,
      language TEXT NOT NULL,
      search_query TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS google_trends (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      related_query TEXT NOT NULL,
      query_type TEXT NOT NULL,
      value INTEGER DEFAULT 0,
      is_breakout INTEGER DEFAULT 0,
      language TEXT NOT NULL,
      geo TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_meta (
      source TEXT NOT NULL,
      language TEXT NOT NULL,
      last_fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (source, language)
    );

    CREATE INDEX IF NOT EXISTS idx_youtube_language ON youtube_videos(language);
    CREATE INDEX IF NOT EXISTS idx_youtube_fetched ON youtube_videos(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_trends_language ON google_trends(language);
    CREATE INDEX IF NOT EXISTS idx_trends_fetched ON google_trends(fetched_at);
  `);
};

// ============================================================================
// Cache Management
// ============================================================================

export const isCacheValid = (
  source: CacheSource,
  language: Language
): boolean => {
  const database = getDb();
  const config = getConfig();
  const ttlMs = config.cache.ttlHours * 60 * 60 * 1000;

  const result = database
    .query<{ expires_at: string }, [string, string]>(
      "SELECT expires_at FROM cache_meta WHERE source = ? AND language = ?"
    )
    .get(source, language);

  if (!result) return false;

  const expiresAt = new Date(result.expires_at);
  return expiresAt > new Date();
};

export const updateCacheMeta = (
  source: CacheSource,
  language: Language
): void => {
  const database = getDb();
  const config = getConfig();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.cache.ttlHours * 60 * 60 * 1000);

  database.run(
    `INSERT OR REPLACE INTO cache_meta (source, language, last_fetched_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    [source, language, now.toISOString(), expiresAt.toISOString()]
  );
};

export const getCacheMeta = (
  source: CacheSource,
  language: Language
): CacheMeta | null => {
  const database = getDb();
  const result = database
    .query<
      { source: string; language: string; last_fetched_at: string; expires_at: string },
      [string, string]
    >(
      "SELECT source, language, last_fetched_at, expires_at FROM cache_meta WHERE source = ? AND language = ?"
    )
    .get(source, language);

  if (!result) return null;

  return {
    source: result.source as CacheSource,
    language: result.language as Language,
    lastFetchedAt: result.last_fetched_at,
    expiresAt: result.expires_at,
  };
};

// ============================================================================
// YouTube Video Operations
// ============================================================================

export const saveYouTubeVideos = (videos: YouTubeVideo[]): void => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO youtube_videos 
    (id, title, description, channel_id, channel_title, published_at, 
     view_count, like_count, comment_count, thumbnail_url, language, search_query, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((items: YouTubeVideo[]) => {
    for (const video of items) {
      stmt.run(
        video.id,
        video.title,
        video.description,
        video.channelId,
        video.channelTitle,
        video.publishedAt,
        video.viewCount,
        video.likeCount,
        video.commentCount,
        video.thumbnailUrl,
        video.language,
        video.searchQuery,
        video.fetchedAt
      );
    }
  });

  insertMany(videos);
};

export const getYouTubeVideos = (language?: Language): YouTubeVideo[] => {
  const database = getDb();

  const query = language
    ? "SELECT * FROM youtube_videos WHERE language = ? ORDER BY view_count DESC"
    : "SELECT * FROM youtube_videos ORDER BY view_count DESC";

  const results = language
    ? database
        .query<Record<string, unknown>, [string]>(query)
        .all(language)
    : database.query<Record<string, unknown>, []>(query).all();

  return results.map(mapRowToYouTubeVideo);
};

const mapRowToYouTubeVideo = (row: Record<string, unknown>): YouTubeVideo => ({
  id: row.id as string,
  title: row.title as string,
  description: row.description as string,
  channelId: row.channel_id as string,
  channelTitle: row.channel_title as string,
  publishedAt: row.published_at as string,
  viewCount: row.view_count as number,
  likeCount: row.like_count as number,
  commentCount: row.comment_count as number,
  thumbnailUrl: row.thumbnail_url as string,
  language: row.language as Language,
  searchQuery: row.search_query as string,
  fetchedAt: row.fetched_at as string,
});

// ============================================================================
// Google Trends Operations
// ============================================================================

export const saveTrendingTopics = (topics: TrendingTopic[]): void => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO google_trends 
    (id, keyword, related_query, query_type, value, is_breakout, language, geo, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((items: TrendingTopic[]) => {
    for (const topic of items) {
      stmt.run(
        topic.id,
        topic.keyword,
        topic.relatedQuery,
        topic.queryType,
        topic.value,
        topic.isBreakout ? 1 : 0,
        topic.language,
        topic.geo,
        topic.fetchedAt
      );
    }
  });

  insertMany(topics);
};

export const getTrendingTopics = (language?: Language): TrendingTopic[] => {
  const database = getDb();

  const query = language
    ? "SELECT * FROM google_trends WHERE language = ? ORDER BY is_breakout DESC, value DESC"
    : "SELECT * FROM google_trends ORDER BY is_breakout DESC, value DESC";

  const results = language
    ? database
        .query<Record<string, unknown>, [string]>(query)
        .all(language)
    : database.query<Record<string, unknown>, []>(query).all();

  return results.map(mapRowToTrendingTopic);
};

const mapRowToTrendingTopic = (row: Record<string, unknown>): TrendingTopic => ({
  id: row.id as string,
  keyword: row.keyword as string,
  relatedQuery: row.related_query as string,
  queryType: row.query_type as "rising" | "top",
  value: row.value as number,
  isBreakout: (row.is_breakout as number) === 1,
  language: row.language as Language,
  geo: row.geo as string,
  fetchedAt: row.fetched_at as string,
});

// ============================================================================
// Cleanup
// ============================================================================

export const clearOldData = (daysOld: number = 7): void => {
  const database = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffIso = cutoffDate.toISOString();

  database.run("DELETE FROM youtube_videos WHERE fetched_at < ?", [cutoffIso]);
  database.run("DELETE FROM google_trends WHERE fetched_at < ?", [cutoffIso]);
};

export const closeDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};

