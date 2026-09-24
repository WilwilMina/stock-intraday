// Unit tests for the Yahoo-specific mapping functions, against the real
// captured fixture plus synthetic fixtures for cases the real capture
// doesn't happen to contain.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapYahooResponse, statusToError } from "./yahooMapper.js";
import { InvalidSymbolError, UpstreamError } from "../errors/AppError.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`../../fixtures/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("mapYahooResponse", () => {
  it("maps the real TSLA fixture and excludes its trailing forming bar", () => {
    const json = loadFixture("tsla-15m-1mo.json");

    const { bars, exchangeTimezoneName } = mapYahooResponse(json, "TSLA");

    expect(exchangeTimezoneName).toBe("America/New_York");
    // The raw fixture has 573 timestamps; its last bar shares meta.regularMarketTime
    // with a volume of 0 (the still-forming bar), so exactly one is excluded.
    expect(bars).toHaveLength(572);
    expect(bars[0]).toEqual({
      timestamp: 1787578200,
      low: 352.5,
      high: 363.239990234375,
      volume: 4934897,
    });
    expect(bars.some((bar) => bar.timestamp === 1790193600)).toBe(false);
  });

  it("passes null low/high/volume through unchanged rather than filtering them", () => {
    const json = loadFixture("yahoo-null-bars.json");

    const { bars } = mapYahooResponse(json, "TEST");

    expect(bars).toEqual([
      { timestamp: 1718375400, low: 350.0, high: 352.0, volume: 100000 },
      { timestamp: 1718376300, low: null, high: 353.0, volume: 110000 },
      { timestamp: 1718377200, low: 349.0, high: null, volume: 120000 },
      { timestamp: 1718378100, low: 348.0, high: 351.0, volume: null },
    ]);
  });

  it("passes the raw timestamp and timezone through unmodified near a day boundary", () => {
    const json = loadFixture("yahoo-tz-boundary.json");

    const { bars, exchangeTimezoneName } = mapYahooResponse(json, "TEST");

    // This fixture's one bar sits at 2024-06-15T02:00:00Z, which is
    // 2024-06-14 in America/New_York — but that conversion is aggregateByDay's
    // job (covered in Slice 2), not the mapper's. Here we only prove the
    // mapper doesn't touch the timestamp or mangle the timezone name itself.
    expect(exchangeTimezoneName).toBe("America/New_York");
    expect(bars).toEqual([{ timestamp: 1718416800, low: 354.5, high: 356.0, volume: 95000 }]);
  });

  it("excludes only the bar matching regularMarketTime with zero volume", () => {
    const json = loadFixture("yahoo-forming-bar.json");

    const { bars } = mapYahooResponse(json, "TEST");

    expect(bars).toEqual([{ timestamp: 1718375400, low: 350.0, high: 352.0, volume: 100000 }]);
  });

  it("maps a valid symbol with no bars in the window to an empty bar list, not an error", () => {
    // Yahoo omits `timestamp` and returns `quote: [{}]` in this case.
    const json = loadFixture("yahoo-no-bars.json");

    const { bars, exchangeTimezoneName } = mapYahooResponse(json, "TEST");

    expect(bars).toEqual([]);
    expect(exchangeTimezoneName).toBe("America/New_York");
  });

  it("throws UpstreamError when chart.result is null", () => {
    const json = loadFixture("yahoo-invalid-symbol.json");

    expect(() => mapYahooResponse(json, "ZZZZZZINVALID")).toThrow(UpstreamError);
  });

  it("throws UpstreamError on a malformed shape (missing indicators)", () => {
    const malformed = {
      chart: {
        result: [
          {
            meta: { exchangeTimezoneName: "America/New_York", regularMarketTime: 1718375400 },
            timestamp: [1718375400],
            // `indicators` is missing entirely.
          },
        ],
      },
    };

    expect(() => mapYahooResponse(malformed, "TEST")).toThrow(UpstreamError);
  });

  it("throws UpstreamError when the quote arrays don't match the timestamp length", () => {
    const mismatched = {
      chart: {
        result: [
          {
            meta: { exchangeTimezoneName: "America/New_York", regularMarketTime: 1718375400 },
            timestamp: [1718375400, 1718376300],
            indicators: { quote: [{ low: [350.0], high: [352.0], volume: [100000] }] },
          },
        ],
      },
    };

    expect(() => mapYahooResponse(mismatched, "TEST")).toThrow(UpstreamError);
  });
});

describe("statusToError", () => {
  it("maps 404 to InvalidSymbolError regardless of body content", () => {
    const body = loadFixture("yahoo-invalid-symbol.json");

    const error = statusToError("ZZZZZZINVALID", 404, body);

    expect(error).toBeInstanceOf(InvalidSymbolError);
  });

  it("maps other non-2xx statuses to UpstreamError", () => {
    expect(statusToError("TSLA", 429)).toBeInstanceOf(UpstreamError);
    expect(statusToError("TSLA", 500)).toBeInstanceOf(UpstreamError);
  });
});
