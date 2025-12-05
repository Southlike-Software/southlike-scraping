import { Database } from "bun:sqlite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  YouTubeVideo,
  TrendingTopic,
  CacheMeta,
  CacheSource,
  Language,
  VideoIdea,
  VideoIdeaOutline,
  ScoreBreakdown,
  VideoScript,
  ContentCalendarEntry,
  CalendarStatus,
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

    -- AI-generated video ideas
    CREATE TABLE IF NOT EXISTS video_ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      hook TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      trend_source TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      score_breakdown TEXT,
      reasoning TEXT,
      outline TEXT,
      language TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Generated video scripts
    CREATE TABLE IF NOT EXISTS video_scripts (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL REFERENCES video_ideas(id),
      hook TEXT NOT NULL,
      intro TEXT NOT NULL,
      sections TEXT NOT NULL,
      cta TEXT NOT NULL,
      full_script TEXT NOT NULL,
      estimated_duration TEXT,
      thumbnail_ideas TEXT,
      tags TEXT,
      created_at TEXT NOT NULL
    );

    -- Content calendar entries
    CREATE TABLE IF NOT EXISTS content_calendar (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL REFERENCES video_ideas(id),
      idea_title TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      time_slot TEXT,
      priority INTEGER DEFAULT 5,
      reasoning TEXT,
      content_type TEXT NOT NULL,
      status TEXT DEFAULT 'planned',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_youtube_language ON youtube_videos(language);
    CREATE INDEX IF NOT EXISTS idx_youtube_fetched ON youtube_videos(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_trends_language ON google_trends(language);
    CREATE INDEX IF NOT EXISTS idx_trends_fetched ON google_trends(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_ideas_language ON video_ideas(language);
    CREATE INDEX IF NOT EXISTS idx_ideas_created ON video_ideas(created_at);
    CREATE INDEX IF NOT EXISTS idx_scripts_idea ON video_scripts(idea_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_date ON content_calendar(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_status ON content_calendar(status);
  `);

  // Run migrations for existing tables
  migrateVideoIdeasTable(database);
};

/**
 * Migrate AI tables to new schema
 * Drops and recreates tables with old schema
 */
const migrateVideoIdeasTable = (database: Database): void => {
  // Check if video_ideas has old schema (has estimated_views column)
  const tableInfo = database
    .query<{ name: string }, []>("PRAGMA table_info(video_ideas)")
    .all();
  const existingColumns = new Set(tableInfo.map((col) => col.name));

  if (existingColumns.has("estimated_views")) {
    console.log("[DB] Dropping old AI tables and recreating with new schema...");

    // Drop all AI-related tables (they reference video_ideas)
    database.exec("DROP TABLE IF EXISTS content_calendar;");
    database.exec("DROP TABLE IF EXISTS video_scripts;");
    database.exec("DROP TABLE IF EXISTS video_ideas;");

    // Recreate with new schema
    database.exec(`
      CREATE TABLE video_ideas (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        hook TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        trend_source TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        score_breakdown TEXT,
        reasoning TEXT,
        outline TEXT,
        language TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE video_scripts (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL REFERENCES video_ideas(id),
        hook TEXT NOT NULL,
        intro TEXT NOT NULL,
        sections TEXT NOT NULL,
        cta TEXT NOT NULL,
        full_script TEXT NOT NULL,
        estimated_duration TEXT,
        thumbnail_ideas TEXT,
        tags TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE content_calendar (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL REFERENCES video_ideas(id),
        idea_title TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        time_slot TEXT,
        priority INTEGER DEFAULT 5,
        reasoning TEXT,
        content_type TEXT NOT NULL,
        status TEXT DEFAULT 'planned',
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_ideas_language ON video_ideas(language);
      CREATE INDEX idx_ideas_created ON video_ideas(created_at);
      CREATE INDEX idx_scripts_idea ON video_scripts(idea_id);
      CREATE INDEX idx_calendar_date ON content_calendar(scheduled_date);
      CREATE INDEX idx_calendar_status ON content_calendar(status);
    `);

    console.log("[DB] AI tables recreated with new schema.");
  }
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
// Video Ideas Operations
// ============================================================================

export const saveVideoIdeas = (ideas: VideoIdea[]): void => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO video_ideas 
    (id, title, hook, target_audience, trend_source, score, score_breakdown, reasoning, outline, language, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((items: VideoIdea[]) => {
    for (const idea of items) {
      stmt.run(
        idea.id,
        idea.title,
        idea.hook,
        idea.targetAudience,
        idea.trendSource,
        idea.score,
        JSON.stringify(idea.scoreBreakdown),
        idea.reasoning,
        JSON.stringify(idea.outline),
        idea.language,
        idea.createdAt
      );
    }
  });

  insertMany(ideas);
};

export const getVideoIdeas = (language?: Language): VideoIdea[] => {
  const database = getDb();

  const query = language
    ? "SELECT * FROM video_ideas WHERE language = ? ORDER BY created_at DESC"
    : "SELECT * FROM video_ideas ORDER BY created_at DESC";

  const results = language
    ? database.query<Record<string, unknown>, [string]>(query).all(language)
    : database.query<Record<string, unknown>, []>(query).all();

  return results.map(mapRowToVideoIdea);
};

export const getVideoIdeaById = (id: string): VideoIdea | null => {
  const database = getDb();
  const result = database
    .query<Record<string, unknown>, [string]>(
      "SELECT * FROM video_ideas WHERE id = ?"
    )
    .get(id);

  return result ? mapRowToVideoIdea(result) : null;
};

const mapRowToVideoIdea = (row: Record<string, unknown>): VideoIdea => {
  const defaultScoreBreakdown: ScoreBreakdown = {
    trendScore: 0,
    engagementScore: 0,
    timingScore: 0,
  };

  const defaultOutline: VideoIdeaOutline = {
    format: "",
    duration: "",
    mainPoints: [],
    callToAction: "",
    bRollIdeas: [],
  };

  return {
    id: row.id as string,
    title: row.title as string,
    hook: row.hook as string,
    targetAudience: row.target_audience as string,
    trendSource: row.trend_source as string,
    score: (row.score as number) || 0,
    scoreBreakdown: row.score_breakdown
      ? JSON.parse(row.score_breakdown as string)
      : defaultScoreBreakdown,
    reasoning: row.reasoning as string,
    outline: row.outline
      ? JSON.parse(row.outline as string)
      : defaultOutline,
    language: row.language as Language,
    createdAt: row.created_at as string,
  };
};

// ============================================================================
// Video Scripts Operations
// ============================================================================

export const saveVideoScript = (script: VideoScript): void => {
  const database = getDb();
  database.run(
    `INSERT OR REPLACE INTO video_scripts 
     (id, idea_id, hook, intro, sections, cta, full_script, estimated_duration, thumbnail_ideas, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      script.id,
      script.ideaId,
      script.hook,
      script.intro,
      JSON.stringify(script.sections),
      script.cta,
      script.fullScript,
      script.estimatedDuration,
      JSON.stringify(script.thumbnailIdeas),
      JSON.stringify(script.tags),
      script.createdAt,
    ]
  );
};

export const getVideoScripts = (ideaId?: string): VideoScript[] => {
  const database = getDb();

  const query = ideaId
    ? "SELECT * FROM video_scripts WHERE idea_id = ? ORDER BY created_at DESC"
    : "SELECT * FROM video_scripts ORDER BY created_at DESC";

  const results = ideaId
    ? database.query<Record<string, unknown>, [string]>(query).all(ideaId)
    : database.query<Record<string, unknown>, []>(query).all();

  return results.map(mapRowToVideoScript);
};

export const getVideoScriptById = (id: string): VideoScript | null => {
  const database = getDb();
  const result = database
    .query<Record<string, unknown>, [string]>(
      "SELECT * FROM video_scripts WHERE id = ?"
    )
    .get(id);

  return result ? mapRowToVideoScript(result) : null;
};

const mapRowToVideoScript = (row: Record<string, unknown>): VideoScript => ({
  id: row.id as string,
  ideaId: row.idea_id as string,
  hook: row.hook as string,
  intro: row.intro as string,
  sections: JSON.parse(row.sections as string),
  cta: row.cta as string,
  fullScript: row.full_script as string,
  estimatedDuration: row.estimated_duration as string,
  thumbnailIdeas: JSON.parse(row.thumbnail_ideas as string),
  tags: JSON.parse(row.tags as string),
  createdAt: row.created_at as string,
});

// ============================================================================
// Content Calendar Operations
// ============================================================================

export const saveCalendarEntries = (entries: ContentCalendarEntry[]): void => {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO content_calendar 
    (id, idea_id, idea_title, scheduled_date, day_of_week, time_slot, priority, reasoning, content_type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((items: ContentCalendarEntry[]) => {
    for (const entry of items) {
      stmt.run(
        entry.id,
        entry.ideaId,
        entry.ideaTitle,
        entry.scheduledDate,
        entry.dayOfWeek,
        entry.timeSlot,
        entry.priority,
        entry.reasoning,
        entry.contentType,
        entry.status,
        entry.createdAt
      );
    }
  });

  insertMany(entries);
};

export const getCalendarEntries = (options?: {
  status?: CalendarStatus;
  fromDate?: string;
  toDate?: string;
}): ContentCalendarEntry[] => {
  const database = getDb();

  let query = "SELECT * FROM content_calendar WHERE 1=1";
  const params: string[] = [];

  if (options?.status) {
    query += " AND status = ?";
    params.push(options.status);
  }

  if (options?.fromDate) {
    query += " AND scheduled_date >= ?";
    params.push(options.fromDate);
  }

  if (options?.toDate) {
    query += " AND scheduled_date <= ?";
    params.push(options.toDate);
  }

  query += " ORDER BY scheduled_date ASC, priority DESC";

  const results = database
    .query<Record<string, unknown>, string[]>(query)
    .all(...params);

  return results.map(mapRowToCalendarEntry);
};

export const updateCalendarEntryStatus = (
  id: string,
  status: CalendarStatus
): void => {
  const database = getDb();
  database.run("UPDATE content_calendar SET status = ? WHERE id = ?", [
    status,
    id,
  ]);
};

const mapRowToCalendarEntry = (
  row: Record<string, unknown>
): ContentCalendarEntry => ({
  id: row.id as string,
  ideaId: row.idea_id as string,
  ideaTitle: row.idea_title as string,
  scheduledDate: row.scheduled_date as string,
  dayOfWeek: row.day_of_week as string,
  timeSlot: row.time_slot as string,
  priority: row.priority as number,
  reasoning: row.reasoning as string,
  contentType: row.content_type as ContentCalendarEntry["contentType"],
  status: row.status as CalendarStatus,
  createdAt: row.created_at as string,
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

