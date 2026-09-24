// Unit tests for startup config validation: defaults apply with an empty
// environment, and invalid values fail with one readable line.

import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("applies defaults when no env vars are set", () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      yahooBaseUrl: "https://query1.finance.yahoo.com",
      requestTimeoutMs: 5000,
      corsOrigins: ["http://localhost:5173"],
    });
  });

  it("splits a comma-separated CORS_ORIGIN into a trimmed list", () => {
    const config = loadConfig({ CORS_ORIGIN: "http://a.test, http://b.test ," });

    expect(config.corsOrigins).toEqual(["http://a.test", "http://b.test"]);
  });

  it("throws a single-line ConfigError naming each invalid variable", () => {
    const load = () => loadConfig({ PORT: "abc", YAHOO_BASE_URL: "not-a-url" });

    expect(load).toThrow(ConfigError);
    expect(load).toThrow(/^Invalid config: PORT: .+; YAHOO_BASE_URL: .+$/);
  });
});
