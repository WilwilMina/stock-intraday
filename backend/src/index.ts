// Process entry point: load config, build the app, start listening.
// Any startup failure (bad config, port in use) logs one line and exits 1.
// SIGINT/SIGTERM close the server gracefully (in-flight requests finish)
// before the process exits.

import { ConfigError, loadConfig } from "./config/env.js";
import { buildApp } from "./app.js";
import { YahooMarketDataProvider } from "./providers/YahooMarketDataProvider.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = new YahooMarketDataProvider({
    baseUrl: config.yahooBaseUrl,
    requestTimeoutMs: config.requestTimeoutMs,
  });
  const app = await buildApp(config, { provider });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    // A second Ctrl+C while closing shouldn't start a second close.
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, "Shutting down");
    app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error({ err: error }, "Error during shutdown");
        process.exit(1);
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.fatal(error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    console.error("Fatal startup error:", error);
  }
  process.exit(1);
});
