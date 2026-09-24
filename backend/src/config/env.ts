// Validates and normalizes process.env into a typed AppConfig at startup.
// Fails fast (throws) on missing/invalid values so bad config never reaches
// the rest of the app; index.ts is responsible for logging and exiting.

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  YAHOO_BASE_URL: z.string().url().default("https://query1.finance.yahoo.com"),
  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(30),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://example.com"
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

export type AppConfig = {
  port: number;
  yahooBaseUrl: string;
  cacheTtlSeconds: number;
  requestTimeoutMs: number;
  corsOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    port: parsed.PORT,
    yahooBaseUrl: parsed.YAHOO_BASE_URL,
    cacheTtlSeconds: parsed.CACHE_TTL_SECONDS,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    corsOrigins: parsed.CORS_ORIGIN,
  };
}
