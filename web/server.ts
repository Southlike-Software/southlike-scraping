import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getYouTubeVideos,
  getTrendingTopics,
  getVideoIdeas,
  getVideoIdeaById,
  saveVideoIdeas,
  getVideoScripts,
  getVideoScriptById,
  saveVideoScript,
  getCalendarEntries,
  saveCalendarEntries,
  updateCalendarEntryStatus,
} from "../src/db/sqlite";
import {
  generateVideoIdeas,
  generateVideoScript,
  generateContentCalendar,
} from "../src/ai";
import type { Language, CalendarStatus } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ============================================================================
// CORS Headers
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ============================================================================
// Response Helpers
// ============================================================================

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const error = (message: string, status = 400) =>
  json({ error: message }, status);

// ============================================================================
// Route Handlers
// ============================================================================

type RouteHandler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

const routes: Record<string, RouteHandler> = {
  // Data endpoints - GET scraped data
  "GET /api/data": async (_req: Request, _params: Record<string, string>) => {
    const youtube = getYouTubeVideos();
    const trends = getTrendingTopics();
    return json({ youtube, trends });
  },

  "GET /api/data/youtube": async (req: Request, _params: Record<string, string>) => {
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") as Language | null;
    const videos = getYouTubeVideos(lang || undefined);
    return json({ count: videos.length, videos });
  },

  "GET /api/data/trends": async (req: Request, _params: Record<string, string>) => {
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") as Language | null;
    const breakoutOnly = url.searchParams.get("breakout") === "true";

    let trends = getTrendingTopics(lang || undefined);

    if (breakoutOnly) {
      trends = trends.filter((t) => t.isBreakout);
    }

    return json({ count: trends.length, trends });
  },

  // AI endpoints - Generate content
  "POST /api/ai/ideas": async (req: Request, _params: Record<string, string>) => {
    try {
      const body = await req.json();
      const { count = 5, language = "en" } = body as {
        count?: number;
        language?: Language;
      };

      const trends = getTrendingTopics(language);
      const videos = getYouTubeVideos(language);

      if (trends.length === 0) {
        return error("No trends data available. Run the scraper first.", 404);
      }

      const ideas = await generateVideoIdeas(trends, videos, { count, language });

      // Save to database
      saveVideoIdeas(ideas);

      return json({ count: ideas.length, ideas });
    } catch (err) {
      console.error("[API] Error generating ideas:", err);
      return error(`Failed to generate ideas: ${(err as Error).message}`, 500);
    }
  },

  "POST /api/ai/script/:ideaId": async (req: Request, params: Record<string, string>) => {
    try {
      const ideaId = params.ideaId ?? "";
      if (!ideaId) {
        return error("Missing ideaId parameter", 400);
      }
      const body = await req.json();
      const { duration = "medium" } = body as {
        duration?: "short" | "medium" | "long";
      };

      const idea = getVideoIdeaById(ideaId);
      if (!idea) {
        return error(`Video idea not found: ${ideaId}`, 404);
      }

      const script = await generateVideoScript(idea, { duration });

      // Save to database
      saveVideoScript(script);

      return json(script);
    } catch (err) {
      console.error("[API] Error generating script:", err);
      return error(`Failed to generate script: ${(err as Error).message}`, 500);
    }
  },

  "POST /api/ai/calendar": async (req: Request, _params: Record<string, string>) => {
    try {
      const body = await req.json();
      const { weekStartDate, videosPerWeek = 3 } = body as {
        weekStartDate?: string;
        videosPerWeek?: number;
      };

      const ideas = getVideoIdeas();
      if (ideas.length === 0) {
        return error("No video ideas available. Generate ideas first.", 404);
      }

      const calendar = await generateContentCalendar(ideas, {
        weekStartDate,
        videosPerWeek,
      });

      // Save entries to database
      saveCalendarEntries(calendar.entries);

      return json(calendar);
    } catch (err) {
      console.error("[API] Error generating calendar:", err);
      return error(`Failed to generate calendar: ${(err as Error).message}`, 500);
    }
  },

  // Ideas CRUD endpoints
  "GET /api/ideas": async (req: Request, _params: Record<string, string>) => {
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") as Language | null;
    const ideas = getVideoIdeas(lang || undefined);
    return json({ count: ideas.length, ideas });
  },

  "GET /api/ideas/:id": async (_req: Request, params: Record<string, string>) => {
    const id = params.id ?? "";
    const idea = getVideoIdeaById(id);
    if (!idea) {
      return error(`Idea not found: ${id}`, 404);
    }
    return json(idea);
  },

  // Scripts endpoints
  "GET /api/scripts": async (req: Request, _params: Record<string, string>) => {
    const url = new URL(req.url);
    const ideaId = url.searchParams.get("ideaId") || undefined;
    const scripts = getVideoScripts(ideaId);
    return json({ count: scripts.length, scripts });
  },

  "GET /api/scripts/:id": async (_req: Request, params: Record<string, string>) => {
    const id = params.id ?? "";
    const script = getVideoScriptById(id);
    if (!script) {
      return error(`Script not found: ${id}`, 404);
    }
    return json(script);
  },

  // Calendar endpoints
  "GET /api/calendar": async (req: Request, _params: Record<string, string>) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as CalendarStatus | null;
    const fromDate = url.searchParams.get("from") || undefined;
    const toDate = url.searchParams.get("to") || undefined;

    const entries = getCalendarEntries({
      status: status || undefined,
      fromDate,
      toDate,
    });

    return json({ count: entries.length, entries });
  },

  "PUT /api/calendar/:id/status": async (req: Request, params: Record<string, string>) => {
    try {
      const id = params.id ?? "";
      const body = await req.json();
      const { status } = body as { status: CalendarStatus };

      if (!["planned", "in_progress", "published", "cancelled"].includes(status)) {
        return error(`Invalid status: ${status}`);
      }

      updateCalendarEntryStatus(id, status);
      return json({ success: true, id, status });
    } catch (err) {
      return error(`Failed to update status: ${(err as Error).message}`, 500);
    }
  },
};

// ============================================================================
// Router
// ============================================================================

const matchRoute = (
  method: string,
  pathname: string
): { handler: RouteHandler; params: Record<string, string> } | null => {
  for (const [pattern, handler] of Object.entries(routes)) {
    const parts = pattern.split(" ");
    const routeMethod = parts[0];
    const routePath = parts[1];

    if (!routePath || routeMethod !== method) continue;

    // Convert route pattern to regex
    const paramNames: string[] = [];
    const regexPattern = routePath.replace(/:(\w+)/g, (_, paramName: string) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

    const regex = new RegExp(`^${regexPattern}$`);
    const match = pathname.match(regex);

    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1] ?? "";
      });
      return { handler, params };
    }
  }
  return null;
};

// ============================================================================
// Static File Serving
// ============================================================================

const serveStaticFile = async (pathname: string): Promise<Response | null> => {
  // Map root to index.html
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = resolve(__dirname, "." + filePath);

  try {
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      const ext = fullPath.split(".").pop() || "";
      const contentTypes: Record<string, string> = {
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        svg: "image/svg+xml",
        ico: "image/x-icon",
      };
      return new Response(file, {
        headers: {
          "Content-Type": contentTypes[ext] || "application/octet-stream",
          ...corsHeaders,
        },
      });
    }
  } catch {
    // File not found, continue to 404
  }
  return null;
};

// ============================================================================
// Server
// ============================================================================

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { method, pathname } = { method: req.method, pathname: url.pathname };

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Try API routes first
    if (pathname.startsWith("/api/")) {
      const route = matchRoute(method, pathname);
      if (route) {
        return route.handler(req, route.params);
      }
      return error("Not found", 404);
    }

    // Serve static files for non-API routes
    const staticResponse = await serveStaticFile(pathname);
    if (staticResponse) {
      return staticResponse;
    }

    // SPA fallback - serve index.html for all other routes
    const indexResponse = await serveStaticFile("/");
    if (indexResponse) {
      return indexResponse;
    }

    return error("Not found", 404);
  },
});

console.log(`
🚀 Dashboard server running at http://localhost:${server.port}

📡 API Endpoints:
   GET  /api/data              - All scraped data
   GET  /api/data/youtube      - YouTube videos (?lang=en|pt)
   GET  /api/data/trends       - Google Trends (?lang=en|pt&breakout=true)
   
   POST /api/ai/ideas          - Generate video ideas
   POST /api/ai/script/:id     - Generate script for idea
   POST /api/ai/calendar       - Generate content calendar
   
   GET  /api/ideas             - List saved ideas
   GET  /api/ideas/:id         - Get idea by ID
   GET  /api/scripts           - List scripts (?ideaId=xxx)
   GET  /api/scripts/:id       - Get script by ID
   GET  /api/calendar          - Calendar entries (?status=planned&from=2025-01-01)
   PUT  /api/calendar/:id/status - Update entry status
`);
