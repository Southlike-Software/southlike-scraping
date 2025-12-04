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
- [ ] Implement YouTube Data API fetcher (`src/fetchers/youtube.ts`)
  - [ ] Fetch trending videos for English (US region)
  - [ ] Fetch trending videos for Portuguese (BR region)
- [ ] Implement Google Trends fetcher (`src/fetchers/google-trends.ts`)
  - [ ] Fetch rising trends for English keywords
  - [ ] Fetch rising trends for Portuguese keywords

### Phase 4: Export & CLI
- [ ] Implement JSON export functionality (`src/export.ts`)
- [ ] Wire up CLI argument parsing (`src/index.ts`)
  - [ ] `--step=youtube` - Fetch only YouTube data
  - [ ] `--step=trends` - Fetch only Google Trends data
  - [ ] `--step=all` - Run all fetchers (default)
  - [ ] `--no-cache` - Disable cache reads
  - [ ] `--export` - Export results to JSON

### Phase 5: Testing & Refinement
- [ ] Test YouTube fetcher with API key
- [ ] Test Google Trends fetcher
- [ ] Test caching behavior
- [ ] Test JSON export

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

