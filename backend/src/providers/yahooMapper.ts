// The only module that knows Yahoo's chart-endpoint response shape. Two pure
// functions, no network calls: mapYahooResponse turns a parsed 2xx JSON body
// into NormalizedBars, and statusToError turns a non-2xx status code into the
// typed error the rest of the app understands. Kept separate (Q4) so each is
// independently unit-testable without a mocking library.

import { z } from "zod";
import type { Bar } from "../domain/aggregateByDay.js";
import type { NormalizedBars } from "./MarketDataProvider.js";
import { InvalidSymbolError, UpstreamError } from "../errors/AppError.js";

// For a valid symbol with no bars in the window (delisted, halted, illiquid),
// Yahoo omits `timestamp` and returns `quote: [{}]`. Defaulting these to []
// turns that into an empty result (200 []) rather than a shape error (502).
const yahooQuoteSchema = z.object({
  low: z.array(z.number().nullable()).default([]),
  high: z.array(z.number().nullable()).default([]),
  volume: z.array(z.number().nullable()).default([]),
});

const yahooChartResultSchema = z.object({
  meta: z.object({
    exchangeTimezoneName: z.string(),
    regularMarketTime: z.number(),
  }),
  timestamp: z.array(z.number()).default([]),
  indicators: z.object({
    quote: z.array(yahooQuoteSchema).min(1),
  }),
});

const yahooChartResponseSchema = z.object({
  chart: z.object({
    result: z.array(yahooChartResultSchema).min(1).nullable(),
  }),
});

export function mapYahooResponse(json: unknown, symbol: string): NormalizedBars {
  const parsed = yahooChartResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new UpstreamError(`Unexpected response shape from Yahoo for "${symbol}"`, {
      cause: parsed.error,
    });
  }

  const result = parsed.data.chart.result;
  if (!result) {
    // A 2xx response should never carry a null `result` (that's how Yahoo
    // signals an invalid symbol, via a 404 status handled by statusToError
    // before this function is ever called) — guard against it anyway rather
    // than crashing on `result[0]`.
    throw new UpstreamError(`Yahoo returned no chart result for "${symbol}"`);
  }

  // Both arrays are schema-enforced to have at least one element (.min(1)),
  // so index 0 always exists.
  const { meta, timestamp, indicators } = result[0]!;
  const quote = indicators.quote[0]!;

  const arrayLengths = new Set([timestamp.length, quote.low.length, quote.high.length, quote.volume.length]);
  if (arrayLengths.size !== 1) {
    throw new UpstreamError(`Mismatched array lengths in Yahoo response for "${symbol}"`);
  }

  const bars: Bar[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    // Lengths were just verified equal above, so every index here is in
    // range for all four arrays.
    const barTimestamp = timestamp[i]!;
    const low = quote.low[i]!;
    const high = quote.high[i]!;
    const volume = quote.volume[i]!;

    // Exclude the still-forming, not-yet-closed bar (Q8/Q10): Yahoo's final
    // entry for "today" shares its timestamp with meta.regularMarketTime and
    // reports zero volume because the period hasn't closed yet. This is
    // Yahoo-specific vocabulary, so it's excluded here rather than leaking
    // regularMarketTime into the provider-agnostic aggregateByDay.
    if (barTimestamp === meta.regularMarketTime && volume === 0) {
      continue;
    }

    bars.push({ timestamp: barTimestamp, low, high, volume });
  }

  return { bars, exchangeTimezoneName: meta.exchangeTimezoneName };
}

export function statusToError(
  symbol: string,
  status: number,
  body?: unknown,
): InvalidSymbolError | UpstreamError {
  if (status === 404) {
    return new InvalidSymbolError(symbol);
  }
  return new UpstreamError(`Yahoo responded with status ${status} for "${symbol}"`, { cause: body });
}
