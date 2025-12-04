import { createAnthropic } from "@ai-sdk/anthropic";

// Initialize Anthropic client with API key from environment
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default model for all AI operations
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// Validate API key on import
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[AI] Warning: ANTHROPIC_API_KEY not set. AI features will not work."
  );
}
