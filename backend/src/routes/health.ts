// Liveness check for the process itself. Does not verify the Yahoo
// dependency is reachable; that's out of scope for an MVP health check.

import type { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", async () => ({ status: "ok" }));
}
