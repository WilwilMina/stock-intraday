// Validates and normalizes process.env into a typed AppConfig at startup.
// Fails fast (throws ConfigError) on invalid values so bad config never
// reaches the rest of the app; index.ts prints the message and exits 1.
// Every variable has a default, so no .env file is required to run.

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  YAHOO_BASE_URL: z.string().url().default("https://query1.finance.yahoo.com"),
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
  requestTimeoutMs: number;
  corsOrigins: string[];
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // One readable line (e.g. "Invalid config: PORT: Expected number, received
    // nan") instead of zod's multi-line JSON issue dump.
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid config: ${details}`);
  }

  const parsed = result.data;
  return {
    port: parsed.PORT,
    yahooBaseUrl: parsed.YAHOO_BASE_URL,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    corsOrigins: parsed.CORS_ORIGIN,
  };
}
