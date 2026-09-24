// Pure, provider-agnostic aggregation: normalized 15-minute bars -> one row
// per calendar day. No I/O, no knowledge of Yahoo or any other provider —
// that keeps it trivially unit-testable and swappable across data sources.

export interface Bar {
  /** Epoch seconds (Yahoo's `timestamp` array uses seconds, not milliseconds). */
  timestamp: number;
  low: number | null;
  high: number | null;
  volume: number | null;
}

export interface DailyAggregate {
  /** Calendar date in the exchange's timezone, formatted YYYY-MM-DD. */
  day: string;
  lowAverage: number;
  highAverage: number;
  volume: number;
}

// Intl.DateTimeFormat construction is the expensive part of this function;
// one formatter per IANA timezone is reused across every bar/call.
const dayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayFormatterCache.get(timeZone);
  if (!formatter) {
    // en-CA renders as YYYY-MM-DD directly, matching the brief's `day` format.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function toExchangeLocalDay(timestampSeconds: number, exchangeTimezoneName: string): string {
  return getDayFormatter(exchangeTimezoneName).format(new Date(timestampSeconds * 1000));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo4Decimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// `=== null` alone lets NaN and +/-Infinity slip through (neither is null,
// but neither is meaningful data either): a corrupted field would otherwise
// silently poison a whole day's average/sum instead of being skipped like a
// null field is. Number.isFinite rejects null, NaN, and Infinity alike.
function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function aggregateByDay(bars: Bar[], exchangeTimezoneName: string): DailyAggregate[] {
  const byDay = new Map<string, { lows: number[]; highs: number[]; volume: number }>();

  for (const bar of bars) {
    // A bar missing (or with a non-finite) low, high, or volume can't
    // contribute a meaningful average or total, so the whole bar is dropped
    // rather than partially counted.
    if (!isFiniteNumber(bar.low) || !isFiniteNumber(bar.high) || !isFiniteNumber(bar.volume)) {
      continue;
    }

    const day = toExchangeLocalDay(bar.timestamp, exchangeTimezoneName);
    const bucket = byDay.get(day) ?? { lows: [], highs: [], volume: 0 };
    bucket.lows.push(bar.low);
    bucket.highs.push(bar.high);
    bucket.volume += bar.volume;
    byDay.set(day, bucket);
  }

  const aggregates = Array.from(byDay.entries()).map(([day, bucket]) => ({
    day,
    lowAverage: roundTo4Decimals(mean(bucket.lows)),
    highAverage: roundTo4Decimals(mean(bucket.highs)),
    volume: bucket.volume,
  }));

  // Bar timestamps aren't guaranteed sorted or deduplicated by the upstream
  // provider, so sort explicitly rather than relying on Map insertion order.
  aggregates.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  return aggregates;
}
