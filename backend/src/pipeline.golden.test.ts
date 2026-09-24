// Golden test: runs the real mapYahooResponse -> aggregateByDay pipeline
// against the actual captured TSLA fixture (not a synthetic one) and locks
// in known-correct output. The 2026-09-23 values were independently
// verified against the raw JSON with a separate, throwaway Python script
// (no shared code with this implementation) before being hardcoded here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapYahooResponse } from "./providers/yahooMapper.js";
import { aggregateByDay } from "./domain/aggregateByDay.js";

describe("pipeline golden test (real TSLA fixture)", () => {
  it("produces 22 days, with 2026-09-23 matching independently verified values", () => {
    const fixturePath = fileURLToPath(new URL("../fixtures/tsla-15m-1mo.json", import.meta.url));
    const json: unknown = JSON.parse(readFileSync(fixturePath, "utf-8"));

    const { bars, exchangeTimezoneName } = mapYahooResponse(json, "TSLA");
    const daily = aggregateByDay(bars, exchangeTimezoneName);

    expect(daily).toHaveLength(22);

    const lastDay = daily.find((row) => row.day === "2026-09-23");
    expect(lastDay).toEqual({
      day: "2026-09-23",
      lowAverage: 379.3334,
      highAverage: 381.1192,
      volume: 29933045,
    });
  });
});
