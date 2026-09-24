// Adversarial / edge-case coverage for aggregateByDay, on top of the existing
// aggregateByDay.test.ts (which already covers: empty input, per-field null
// skipping, an all-null day omitted, a UTC-vs-exchange-local boundary,
// rounding + volume summing, and sort order).
//
// This file specifically hunts for bugs in six areas that the base suite
// does not exercise:
//   1. DST transition days (23h / 25h local days)
//   2. Invalid/unknown IANA timezone name
//   3. Duplicate timestamps
//   4. NaN / Infinity in low/high/volume (distinct from null)
//   5. Rounding at .00005 boundaries (floating-point round-half-up quirks)
//   6. Very large volumes (> 2^31, and beyond Number.MAX_SAFE_INTEGER)
//
// For every test below, the comment states what it is probing and whether it
// documents correct/acceptable behavior or proves a bug.
//
// Update: the NaN/Infinity gap (area 4) was fixed in aggregateByDay.ts
// (isFiniteNumber() replaces the `=== null` checks) - those tests now assert
// the fixed behavior. The .00005 rounding gap (area 5) was reviewed and
// deliberately left as-is (see that describe block for why); its test now
// documents the actual behavior instead of asserting an unfixed "bug".

import { describe, expect, it } from "vitest";
import { aggregateByDay, type Bar } from "./aggregateByDay.js";

const NY = "America/New_York";

function bar(overrides: Partial<Bar> & { timestamp: number }): Bar {
  return { low: 100, high: 110, volume: 1000, ...overrides };
}

describe("aggregateByDay - DST transitions", () => {
  // 2024-03-10 is a 23-hour day in America/New_York: clocks jump from
  // 01:59:59 EST straight to 03:00:00 EDT. Bars just before and just after
  // the jump, plus a bar near the following midnight, should still land on
  // the correct exchange-local calendar day. Intl.DateTimeFormat is backed
  // by the IANA tz database, so this is expected to work correctly -
  // documenting that day-bucketing survives the spring-forward transition,
  // not reporting a bug.
  it("buckets bars correctly across the spring-forward (23-hour) day", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1710052200 }), // 2024-03-10 01:30 EST (pre-jump)
      bar({ timestamp: 1710055800 }), // 2024-03-10 03:30 EDT (post-jump)
      bar({ timestamp: 1710127800 }), // 2024-03-10 23:30 EDT (near midnight)
      bar({ timestamp: 1710131400 }), // 2024-03-11 00:30 EDT (next day)
    ];

    const result = aggregateByDay(bars, NY);

    expect(result.map((r) => r.day)).toEqual(["2024-03-10", "2024-03-11"]);
    expect(result[0]?.volume).toBe(3000); // three bars folded into 03-10
    expect(result[1]?.volume).toBe(1000);
  });

  // 2024-11-03 is a 25-hour day in America/New_York: 01:00-01:59 happens
  // twice (once as EDT, once as EST). Two bars that share the same *local*
  // wall-clock time (01:30) but different UTC instants should both bucket
  // into the same exchange-local day, alongside the day's open/close bars.
  // Again, expected to work correctly - documents behavior, not a bug.
  it("buckets bars correctly across the fall-back (25-hour) day, including the repeated local hour", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1730608200 }), // 2024-11-03 00:30 EDT
      bar({ timestamp: 1730611800 }), // 2024-11-03 01:30 EDT (1st occurrence)
      bar({ timestamp: 1730615400 }), // 2024-11-03 01:30 EST (2nd occurrence, same wall-clock time)
      bar({ timestamp: 1730694600 }), // 2024-11-03 23:30 EST
      bar({ timestamp: 1730698200 }), // 2024-11-04 00:30 EST (next day)
    ];

    const result = aggregateByDay(bars, NY);

    expect(result.map((r) => r.day)).toEqual(["2024-11-03", "2024-11-04"]);
    expect(result[0]?.volume).toBe(4000); // four bars folded into 11-03, despite the repeated local hour
    expect(result[1]?.volume).toBe(1000);
  });
});

describe("aggregateByDay - invalid timezone name", () => {
  // meta.exchangeTimezoneName should always be a valid IANA name coming from
  // Yahoo, but if it were ever garbage, Intl.DateTimeFormat throws at
  // construction time (RangeError), which propagates out of aggregateByDay
  // uncaught. This is a fail-fast/fail-loud behavior rather than silently
  // producing wrong day buckets, which is an acceptable MVP posture (the
  // caller/service layer would need to translate this into a 502, but that
  // is outside this pure function's contract). Documenting, not filing as a
  // bug.
  it("throws rather than silently mis-bucketing when the timezone name is invalid", () => {
    const bars: Bar[] = [bar({ timestamp: 1718461800 })];

    expect(() => aggregateByDay(bars, "Not/A_Zone")).toThrow(RangeError);
  });
});

describe("aggregateByDay - duplicate timestamps", () => {
  // Nothing in the aggregation rules calls for de-duplication by timestamp,
  // so two bars sharing the identical epoch second should both contribute
  // to the average and the volume sum. Confirms the implementation does NOT
  // silently drop one of them (e.g. via a Map keyed by timestamp) - this
  // passes today and documents intended behavior.
  it("counts both bars when two bars share the identical timestamp", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: 100, high: 110, volume: 500 }),
      bar({ timestamp: 1718461800, low: 200, high: 220, volume: 700 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(result).toEqual([{ day: "2024-06-15", lowAverage: 150, highAverage: 165, volume: 1200 }]);
  });
});

describe("aggregateByDay - NaN in low/high/volume (fixed: now caught alongside null)", () => {
  // Originally filed as a bug: `bar.low === null` (etc.) didn't catch NaN,
  // since NaN !== null and `typeof NaN === "number"`. Fixed in
  // aggregateByDay.ts by replacing the `=== null` checks with an
  // isFiniteNumber() guard (Number.isFinite, which rejects null, NaN, and
  // Infinity alike). These tests now assert the fixed, intended behavior.
  it("a single NaN low is skipped like a null bar would be, leaving lowAverage computed from the valid bar", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: Number.NaN, high: 110, volume: 500 }), // 2024-06-15 10:30 NY
      bar({ timestamp: 1718465400, low: 100, high: 112, volume: 700 }), // 2024-06-15 11:30 NY, otherwise valid
    ];

    const result = aggregateByDay(bars, NY);

    expect(Number.isFinite(result[0]?.lowAverage)).toBe(true);
    expect(result[0]?.lowAverage).toBe(100);
  });

  it("a day where every bar has NaN low is omitted, mirroring the all-null-day case", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: Number.NaN, high: 110, volume: 500 }),
      bar({ timestamp: 1718465400, low: Number.NaN, high: 112, volume: 700 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(result).toEqual([]);
  });

  it("NaN volume is skipped rather than poisoning the day's volume total", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: 100, high: 110, volume: Number.NaN }),
      bar({ timestamp: 1718465400, low: 100, high: 110, volume: 700 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(Number.isFinite(result[0]?.volume)).toBe(true);
    expect(result[0]?.volume).toBe(700);
  });
});

describe("aggregateByDay - Infinity in low/high/volume (fixed: now caught alongside null)", () => {
  // Same fix as the NaN cases above: isFiniteNumber() rejects
  // Infinity/-Infinity too, so these no longer poison the mean or the sum.
  it("an Infinity high is skipped rather than poisoning the day's highAverage", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: 100, high: Number.POSITIVE_INFINITY, volume: 500 }),
      bar({ timestamp: 1718465400, low: 100, high: 112, volume: 700 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(Number.isFinite(result[0]?.highAverage)).toBe(true);
    expect(result[0]?.highAverage).toBe(112);
  });

  it("an Infinity volume is skipped rather than poisoning the day's volume total", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: 100, high: 110, volume: Number.POSITIVE_INFINITY }),
      bar({ timestamp: 1718465400, low: 100, high: 110, volume: 700 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(Number.isFinite(result[0]?.volume)).toBe(true);
    expect(result[0]?.volume).toBe(700);
  });
});

describe("aggregateByDay - rounding at .00005 boundaries (documented, not fixed)", () => {
  // roundTo4Decimals does `Math.round(value * 10000) / 10000`. Because
  // binary floating point cannot exactly represent most decimal fractions,
  // a mean that mathematically sits exactly on a .00005 boundary can land
  // *just below* it after the `* 10000` multiplication (e.g. 5.499999999999999
  // instead of 5.5), so Math.round's "round half up" behavior rounds DOWN
  // instead:
  //   (0.0005 + 0.0006) / 2               === 0.0005499999999999999
  //   0.0005499999999999999 * 10000       === 5.499999999999999
  //   Math.round(5.499999999999999)       === 5   (mathematically 5.5 -> 6)
  //
  // Decision: not fixed. An exact .00005 tie only arises from a mean of real
  // stock prices (which have effectively arbitrary fractional-cent noise) in
  // a vanishingly unlikely coincidence - unlike the NaN/Infinity case above,
  // there's no realistic Yahoo response that reliably triggers this. A
  // decimal-safe rounding fix (e.g. string-based rounding) would add
  // complexity for a boundary that's already extremely unlikely to occur in
  // real 15-minute bar data, and the direction of the error is at most a
  // single unit in the 4th decimal place. This test pins the actual current
  // behavior so a future change to roundTo4Decimals shows up as a diff here,
  // rather than asserting the mathematically "ideal" value this
  // implementation doesn't (and isn't being changed to) produce.
  it("documents (does not fix): a mean landing exactly on a .00005 boundary can round down due to float imprecision", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, low: 0.0005, high: 110, volume: 500 }),
      bar({ timestamp: 1718465400, low: 0.0006, high: 110, volume: 500 }),
    ];

    const result = aggregateByDay(bars, NY);

    // Actual behavior: rounds down to 0.0005, not the mathematically "ideal"
    // 0.0006 a true round-half-up would produce.
    expect(result[0]?.lowAverage).toBe(0.0005);
  });
});

describe("aggregateByDay - very large volumes", () => {
  // Sums comfortably above the 32-bit signed int boundary (2^31 - 1 =
  // 2147483648) are NOT a bug here: JS numbers are IEEE 754 doubles, which
  // represent integers exactly up to 2^53, far beyond any realistic
  // real-world daily/monthly volume figure. This documents that the
  // "volume must be an integer" requirement holds comfortably past 2^31.
  it("sums volumes past the 2^31 boundary exactly, with no 32-bit overflow", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, volume: 1_200_000_000 }),
      bar({ timestamp: 1718465400, volume: 1_200_000_000 }),
      bar({ timestamp: 1718469000, volume: 1_200_000_000 }),
    ];

    const result = aggregateByDay(bars, NY);

    expect(result[0]?.volume).toBe(3_600_000_000);
    expect(Number.isSafeInteger(result[0]?.volume)).toBe(true);
  });

  // Beyond Number.MAX_SAFE_INTEGER (2^53 - 1 = 9,007,199,254,740,991), plain
  // `+` addition on doubles silently loses precision instead of throwing -
  // this is a fundamental characteristic of JS numbers, not something
  // specific to aggregateByDay. Verified directly:
  //   9007199254740991 + 10  ->  9007199254741000   (off by 1 from the true
  //                                                   sum of 9007199254741001)
  // Flagging this as a known, accepted limitation rather than a bug to fix:
  // real exchange volumes are on the order of 10^9-10^10 shares even summed
  // over a month, many orders of magnitude below where this bites. Fixing it
  // would require BigInt volume accumulation, which would be over-engineering
  // for this MVP given the brief's realistic input sizes. This test pins the
  // *actual* (lossy) current behavior so a future change to it is visible in
  // a diff, rather than encoding the "correct" arbitrary-precision value as
  // an expectation.
  it("documents (does not fix): volume sums beyond Number.MAX_SAFE_INTEGER silently lose precision", () => {
    const bars: Bar[] = [
      bar({ timestamp: 1718461800, volume: Number.MAX_SAFE_INTEGER }), // 9007199254740991
      bar({ timestamp: 1718465400, volume: 10 }),
    ];

    const result = aggregateByDay(bars, NY);

    // Note: the true mathematical sum, 9007199254741001, cannot even be
    // written as a distinct JS numeric literal - the source parser itself
    // rounds it to the nearest representable double at parse time, which is
    // 9007199254741000. That collapse is precisely the precision loss being
    // documented here (computed via BigInt so the comparison itself doesn't
    // fall into the same trap).
    const exactMathematicalSum = Number.MAX_SAFE_INTEGER + 10; // computed in JS, already lossy - see below
    const exactMathematicalSumBigInt = BigInt(Number.MAX_SAFE_INTEGER) + 10n; // true, lossless sum
    expect(BigInt(result[0]?.volume ?? 0)).not.toBe(exactMathematicalSumBigInt); // precision was lost vs. the true integer sum
    expect(result[0]?.volume).toBe(exactMathematicalSum); // actual (lossy) double result: 9007199254741000
    expect(Number.isSafeInteger(result[0]?.volume)).toBe(false); // no longer an exactly-representable integer
  });
});
