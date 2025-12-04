# YouTube & Google Trends Scraper

A CLI tool that scrapes YouTube and Google Trends data to discover trending topics and video ideas for real estate AI automation content. Built with Bun for speed and simplicity.

## Features

- **YouTube Data API** - Fetches trending videos by search keywords for US and Brazil
- **Google Trends** - Discovers rising and breakout search trends
- **Bilingual Support** - English (US) and Portuguese (BR) markets
- **SQLite Caching** - Avoids rate limits with configurable TTL
- **JSON Export** - Export scraped data for analysis
- **Step-by-Step Execution** - Run fetchers independently for easier debugging

## Requirements

- [Bun](https://bun.sh/) v1.0+
- YouTube Data API key ([Get one here](https://console.cloud.google.com/apis/library/youtube.googleapis.com))

## Installation

```bash
# Clone the repository
git clone https://github.com/Southlike-Software/southlike-scraping.git
cd southlike-scraping

# Install dependencies
bun install
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
YOUTUBE_API_KEY=your_youtube_api_key_here
```

### Keywords Configuration

Edit `config.json` to customize search keywords:

```json
{
  "youtube": {
    "categories": ["real estate", "real estate marketing", ...],
    "categoriesPt": ["imobiliária", "marketing imobiliário", ...],
    "maxResults": 50,
    "regionCodes": { "en": "US", "pt": "BR" }
  },
  "trends": {
    "keywords": ["real estate AI", "AI automation agency", ...],
    "keywordsPt": ["imobiliária IA", "automação imobiliária", ...],
    "geo": { "en": "US", "pt": "BR" }
  },
  "cache": {
    "ttlHours": 6
  }
}
```

## Usage

### Basic Commands

```bash
# Run all fetchers (YouTube + Google Trends)
bun run scrape

# Fetch only YouTube data
bun run scrape --step=youtube

# Fetch only Google Trends data
bun run scrape --step=trends

# Force fresh fetch (ignore cache)
bun run scrape --no-cache

# Export results to JSON
bun run scrape --export

# Combine options
bun run scrape --step=all --no-cache --export

# Show help
bun run scrape --help
```

### CLI Options

| Option          | Short | Description                                                 |
| --------------- | ----- | ----------------------------------------------------------- |
| `--step=<step>` | `-s`  | Step to run: `youtube`, `trends`, or `all` (default: `all`) |
| `--no-cache`    |       | Disable cache, always fetch fresh data                      |
| `--export`      | `-e`  | Export results to JSON after fetching                       |
| `--help`        | `-h`  | Show help message                                           |

## Output

### Console Summary

After scraping, you'll see a summary like:

```
============================================================
SCRAPER SUMMARY
============================================================

📺 YOUTUBE VIDEOS
----------------------------------------
Total videos: 478
  EN: 248 videos
  PT: 230 videos

Top 5 by views:
  1. Real estate construction work... (77.2M views)
  2. Real Estate Construction work... (72.8M views)
  ...

📈 GOOGLE TRENDS
----------------------------------------
Total trends: 92
  EN: 92 trends

🚀 Breakout trends (3):
  - "best real estate lead generation system" (from: real estate lead generation)
  - "n8n" (from: AI automation agency)
  ...

📊 Top rising trends:
  - "property management software comparison" (+1900%) [en]
  - "property management software features" (+1250%) [en]
  ...
```

### JSON Export

When using `--export`, data is saved to `exports/scraper-export-<timestamp>.json`:

```json
{
  "exportedAt": "2025-12-04T22:15:36.837Z",
  "youtube": [
    {
      "id": "abc123",
      "title": "Video Title",
      "viewCount": 1000000,
      "likeCount": 50000,
      "language": "en",
      "searchQuery": "real estate",
      ...
    }
  ],
  "trends": [
    {
      "keyword": "real estate AI",
      "relatedQuery": "best real estate lead generation",
      "queryType": "rising",
      "value": 1900,
      "isBreakout": false,
      "language": "en",
      ...
    }
  ]
}
```

## Project Structure

```
src/
├── index.ts              # CLI entry point
├── config.ts             # Configuration loader
├── types.ts              # TypeScript interfaces
├── export.ts             # JSON export & summary
├── db/
│   └── sqlite.ts         # SQLite database & caching
├── fetchers/
│   ├── youtube.ts        # YouTube Data API fetcher
│   └── google-trends.ts  # Google Trends fetcher
└── types/
    └── google-trends-api.d.ts  # Type declarations

config.json               # Keywords & settings
data/                     # SQLite database (gitignored)
exports/                  # JSON exports (gitignored)
```

## Caching

Data is cached in a local SQLite database (`data/scraper.db`) to:

- Avoid hitting API rate limits
- Speed up development iterations
- Reduce API quota usage

**Cache TTL**: 6 hours by default (configurable in `config.json`)

Use `--no-cache` to bypass the cache and fetch fresh data.

## Development

```bash
# Run with verbose logging
LOG_LEVEL=debug bun run scrape

# Run specific step without cache
bun run scrape --step=trends --no-cache

# Type check
bunx tsc --noEmit
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Database**: SQLite via `bun:sqlite`
- **YouTube API**: `googleapis`
- **Google Trends**: `google-trends-api`
- **Language**: TypeScript

## License

MIT
