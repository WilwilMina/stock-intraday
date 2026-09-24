// Builds a configured but unstarted Fastify instance: logger, CORS, routes,
// and the central error handler. Kept separate from index.ts so tests can
// build an app instance (with an injected fake provider) without binding a
// real port or making a real Yahoo request.

import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
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

// Every error response (typed errors, 404s, and the unexpected-error
// fallback) uses this one machine-readable shape, so API consumers can
// switch on `error.code` instead of parsing message text.
type ErrorCode = "VALIDATION_ERROR" | "INVALID_SYMBOL" | "UPSTREAM_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR";

function sendError(reply: FastifyReply, status: number, code: ErrorCode, message: string): void {
  reply.status(status).send({ error: { code, message } });
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
      sendError(reply, 400, "VALIDATION_ERROR", error.message);
      return;
    }
    if (error instanceof InvalidSymbolError) {
      sendError(reply, 404, "INVALID_SYMBOL", error.message);
      return;
    }
    if (error instanceof UpstreamError) {
      app.log.error({ err: error }, "Upstream provider error");
      sendError(reply, 502, "UPSTREAM_ERROR", "Failed to fetch data from the upstream provider");
      return;
    }
    app.log.error({ err: error }, "Unexpected error");
    sendError(reply, 500, "INTERNAL_ERROR", "Internal server error");
  });

  // Unmatched routes (wrong path/method) get the same error shape as
  // everything else, distinguished by its own NOT_FOUND code rather than
  // reusing INVALID_SYMBOL (that's specifically "symbol not found").
  app.setNotFoundHandler((request, reply) => {
    sendError(reply, 404, "NOT_FOUND", `Route not found: ${request.method} ${request.url}`);
  });

  return app;
}
