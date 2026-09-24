// Unit tests for the pure aggregation function. Bars are hand-written here
// rather than loaded from fixtures/, since this module must stay
// provider-agnostic and shouldn't know Yahoo's fixture shapes exist.

import { describe, expect, it } from "vitest";
import { aggregateByDay, type Bar } from "./aggregateByDay.js";

const NY = "America/New_York";

function bar(overrides: Partial<Bar> & { timestamp: number }): Bar {
  return { low: 100, high: 110, volume: 1000, ...overrides };
}

describe("aggregateByDay", () => {
  it("returns an empty array for no bars", () => {
    expect(aggregateByDay([], NY)).toEqual([]);
  });

  it("skips a bar with a null low, high, or volume independently", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: null }), // 2024-06-15 10:30 NY
      bar({ timestamp: 1718465400, high: null }), // 2024-06-15 11:30 NY
      bar({ timestamp: 1718469000, volume: null }), // 2024-06-15 12:30 NY
      bar({ timestamp: 1718472600 }), // 2024-06-15 13:30 NY, the only valid bar
    ];

    const result = aggregateByDay(bars, NY);

    expect(result).toEqual([{ day: "2024-06-15", lowAverage: 100, highAverage: 110, volume: 1000 }]);
  });

  it("omits a day whose bars are all null", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: null, high: null, volume: null }),
      bar({ timestamp: 1718465400, low: null, high: null, volume: null }),
    ];

    expect(aggregateByDay(bars, NY)).toEqual([]);
  });

  it("groups by the exchange-local calendar day, not the UTC day", () => {
    // 2024-06-15T02:00:00Z is 2024-06-14 22:00 in America/New_York (EDT, UTC-4):
    // the UTC date is a day ahead of the exchange-local date.
    const timestamp = Date.UTC(2024, 5, 15, 2, 0, 0) / 1000;

    const result = aggregateByDay([bar({ timestamp })], NY);

    expect(result).toHaveLength(1);
    expect(result[0]?.day).toBe("2024-06-14");
  });

  it("averages lows/highs, sums volume, and rounds prices to 4 decimals", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: 100.00001, high: 110.00006, volume: 500 }),
      bar({ timestamp: 1718465400, low: 100.00002, high: 110.00007, volume: 700 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(result).toEqual([{ day: "2024-06-15", lowAverage: 100, highAverage: 110.0001, volume: 1200 }]);
  });

  it("sorts output ascending by day regardless of input order", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718548200 }), // 2024-06-16
      bar({ timestamp: 1718461800 }), // 2024-06-15
      bar({ timestamp: 1718634600 }), // 2024-06-17
    ];

    const result = aggregateByDay(bars, NY);

    expect(result.map((row) => row.day)).toEqual(["2024-06-15", "2024-06-16", "2024-06-17"]);
  });
});
