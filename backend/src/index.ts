// Process entry point: load config, build the app, start listening.
// Any startup failure (bad config, port in use) logs and exits non-zero.

import { loadConfig } from "./config/env.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp(config);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.fatal(error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
