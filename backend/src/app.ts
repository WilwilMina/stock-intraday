// Builds a configured but unstarted Fastify instance: logger, CORS, routes,
// and the central error handler. Kept separate from index.ts so tests can
// build an app instance (with an injected fake provider) without binding a
// real port or making a real Yahoo request.

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { AppConfig } from "./config/env.js";
import type { MarketDataProvider } from "./providers/MarketDataProvider.js";
import { InvalidSymbolError, UpstreamError, ValidationError } from "./errors/AppError.js";
import { StockService } from "./services/StockService.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerStocksRoute } from "./routes/stocks.js";

export interface BuildAppDeps {
  provider: MarketDataProvider;
}

export async function buildApp(config: AppConfig, deps: BuildAppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigins });

  registerHealthRoute(app);
  registerStocksRoute(app, new StockService(deps.provider));

  // Central error handler: typed errors map to fixed statuses. UpstreamError
  // is logged with full detail server-side but never exposes upstream
  // internals (Yahoo's shape, status codes, response body) in the response.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ValidationError) {
      reply.status(400).send({ error: error.message });
      return;
    }
    if (error instanceof InvalidSymbolError) {
      reply.status(404).send({ error: error.message });
      return;
    }
    if (error instanceof UpstreamError) {
      app.log.error({ err: error }, "Upstream provider error");
      reply.status(502).send({ error: "Failed to fetch data from the upstream provider" });
      return;
    }
    app.log.error({ err: error }, "Unexpected error");
    reply.status(500).send({ error: "Internal server error" });
  });

  return app;
}
