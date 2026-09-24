// Integration test for GET /api/stocks/:symbol/daily: builds the real app
// (real StockService, real aggregateByDay, real error handler) with a fake
// MarketDataProvider injected via buildApp, so this exercises the whole
// route/service/domain path without ever touching the network.

import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AppConfig } from "../config/env.js";
import type { MarketDataProvider, NormalizedBars } from "../providers/MarketDataProvider.js";
import { InvalidSymbolError, UpstreamError } from "../errors/AppError.js";

const testConfig: AppConfig = {
  port: 0,
  yahooBaseUrl: "https://example.invalid",
  cacheTtlSeconds: 30,
  requestTimeoutMs: 5000,
  corsOrigins: ["http://localhost:5173"],
};

class FakeMarketDataProvider implements MarketDataProvider {
  calls = 0;

  constructor(private readonly handler: (symbol: string) => Promise<NormalizedBars>) {}

  async getBars(symbol: string): Promise<NormalizedBars> {
    this.calls += 1;
    return this.handler(symbol);
  }
}

describe("GET /api/stocks/:symbol/daily", () => {
  it("200: returns the aggregated daily result for a valid symbol", async () => {
    const provider = new FakeMarketDataProvider(async () => ({
      bars: [{ timestamp: 1718461800, low: 100, high: 110, volume: 1000 }], // 2024-06-15 in America/New_York
      exchangeTimezoneName: "America/New_York",
    }));
    const app = await buildApp(testConfig, { provider });

    const response = await app.inject({ method: "GET", url: "/api/stocks/TSLA/daily" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ day: "2024-06-15", lowAverage: 100, highAverage: 110, volume: 1000 }]);
  });

  it("400: rejects a symbol that fails validation before ever calling the provider", async () => {
    const provider = new FakeMarketDataProvider(async () => {
      throw new Error("should not be called");
    });
    const app = await buildApp(testConfig, { provider });

    const response = await app.inject({ method: "GET", url: "/api/stocks/BAD$YMBOL/daily" });

    expect(response.statusCode).toBe(400);
    expect(provider.calls).toBe(0);
  });

  it("404: maps InvalidSymbolError to a 404 with a clean message", async () => {
    const provider = new FakeMarketDataProvider(async (symbol) => {
      throw new InvalidSymbolError(symbol);
    });
    const app = await buildApp(testConfig, { provider });

    const response = await app.inject({ method: "GET", url: "/api/stocks/ZZZZZZINVALID/daily" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'No data found for symbol "ZZZZZZINVALID"' });
  });

  it("502: maps UpstreamError to a 502 without leaking upstream details", async () => {
    const provider = new FakeMarketDataProvider(async () => {
      throw new UpstreamError("Yahoo responded with status 500 for \"TSLA\" - secret upstream detail", {
        cause: { some: "upstream body" },
      });
    });
    const app = await buildApp(testConfig, { provider });

    const response = await app.inject({ method: "GET", url: "/api/stocks/TSLA/daily" });

    expect(response.statusCode).toBe(502);
    const body: unknown = response.json();
    expect(body).toEqual({ error: "Failed to fetch data from the upstream provider" });
    expect(JSON.stringify(body)).not.toContain("secret upstream detail");
  });
});
