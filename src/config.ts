import type { Config } from "./types";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "../config.json");

// Load config synchronously
export const loadConfig = (): Config => {
  const text = readFileSync(configPath, "utf-8");
  return JSON.parse(text) as Config;
};

// Lazy loaded config singleton
let cachedConfig: Config | null = null;

export const getConfig = (): Config => {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
};
