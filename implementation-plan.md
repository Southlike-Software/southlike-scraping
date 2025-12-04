# YouTube & Google Trends Scraper - Implementation Plan

## Overview

Build a modular CLI script using Bun to fetch YouTube trending videos and Google Trends rising data for real estate AI automation content ideas, with SQLite caching and JSON export.

---

## Progress Tracker

### Phase 1: Project Setup

- [x] Install dependencies (`googleapis`, `google-trends-api`)
- [x] Create `config.json` with keywords and settings
- [x] Create TypeScript types (`src/types.ts`)

### Phase 2: Database Layer

- [x] Create SQLite database schema (`src/db/sqlite.ts`)
- [x] Implement cache helper functions (check TTL, store timestamp)

### Phase 3: Data Fetchers

- [x] Implement YouTube Data API fetcher (`src/fetchers/youtube.ts`)
  - [x] Fetch trending videos for English (US region)
  - [x] Fetch trending videos for Portuguese (BR region)
- [x] Implement Google Trends fetcher (`src/fetchers/google-trends.ts`)
  - [x] Fetch rising trends for English keywords
  - [x] Fetch rising trends for Portuguese keywords

### Phase 4: Export & CLI

- [x] Implement JSON export functionality (`src/export.ts`)
- [x] Wire up CLI argument parsing (`src/index.ts`)
  - [x] `--step=youtube` - Fetch only YouTube data
  - [x] `--step=trends` - Fetch only Google Trends data
  - [x] `--step=all` - Run all fetchers (default)
  - [x] `--no-cache` - Disable cache reads
  - [x] `--export` - Export results to JSON

### Phase 5: Testing & Refinement

- [x] Test YouTube fetcher with API key
- [x] Test Google Trends fetcher
- [x] Test caching behavior
- [x] Test JSON export

---

## File Structure (Target)

```
src/
├── index.ts              # CLI entry point
├── config.ts             # Load config from JSON
├── types.ts              # TypeScript interfaces
├── db/
│   └── sqlite.ts         # Bun SQLite setup & cache
├── fetchers/
│   ├── youtube.ts        # YouTube Data API
│   └── google-trends.ts  # Google Trends
└── export.ts             # JSON export
```

---

## Environment Variables Required

```
YOUTUBE_API_KEY=your_api_key_here
```

---

## Notes

- Using Bun's native `bun:sqlite` for database
- Functional programming approach (no classes)
- Cache TTL: 6 hours by default
