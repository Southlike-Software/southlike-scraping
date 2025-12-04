# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Package Manager

This project uses **Bun** as the JavaScript runtime and package manager. Always use Bun commands instead of Node.js, npm, pnpm, or vite.

**Common Commands:**
- `bun install` - Install dependencies
- `bun run scrape` - Run the main scraping script
- `bun run scrape:verbose` - Run with debug logging (LOG_LEVEL=debug)
- `bun run dev` - Run web server with hot reload
- `bun run start` - Run web server in production mode

## Code Style & Patterns

**TypeScript Conventions:**
- Use **functional TypeScript** with pure functions and immutability
- Use **Zod** for schema validation and type inference
- Use **types** over interfaces
- **Avoid classes** - use functions and plain objects instead
- Enable strict TypeScript settings (see tsconfig.json)

**Bun-Specific APIs:**
When working with this codebase, prefer Bun's native APIs:
- `Bun.serve()` for HTTP servers (supports WebSockets, routes, HMR)
- `bun:sqlite` for SQLite databases
- `Bun.redis` for Redis
- `Bun.sql` for Postgres
- Built-in `WebSocket` API
- `Bun.$` for shell commands
- `.env` files are automatically loaded (no dotenv needed)

## Dependencies & Architecture

**Core Dependencies:**
- `pino` - Structured logging with pretty printing support
- `ai` - Vercel AI SDK for LLM integration
- `@ai-sdk/anthropic` - Anthropic (Claude) provider
- `@ai-sdk/openai` - OpenAI provider
- `zod` v4 - Runtime schema validation

**Environment Variables:**
Environment variables are stored in `.env` and automatically loaded by Bun. Never commit this file.

## Web Server (When Implemented)

The project includes scripts for a web server (referenced in package.json but not yet implemented):
- Uses `Bun.serve()` with HTML imports
- Supports React with `.tsx` files imported directly from HTML
- CSS bundling built-in
- HMR (hot module reload) enabled in development

**Server Pattern:**
```typescript
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/endpoint": {
      GET: (req) => Response.json({ data: "value" })
    }
  },
  development: {
    hmr: true,
    console: true
  }
})
```

## TypeScript Configuration

- Target: ESNext with Preserve modules
- Module resolution: bundler mode
- JSX: react-jsx
- Strict mode enabled with additional safety flags:
  - `noUncheckedIndexedAccess: true`
  - `noImplicitOverride: true`
  - `noFallthroughCasesInSwitch: true`
