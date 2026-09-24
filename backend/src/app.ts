// Builds a configured but unstarted Fastify instance: logger, CORS, and
// route registration. Kept separate from index.ts so tests can build an
// app instance without binding a real port.

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { AppConfig } from "./config/env.js";
import { registerHealthRoute } from "./routes/health.js";

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigins });

  registerHealthRoute(app);

  return app;
}
