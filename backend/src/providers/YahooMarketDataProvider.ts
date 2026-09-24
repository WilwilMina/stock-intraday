// The only place that makes a real network call to Yahoo. Delegates all
// shape/status interpretation to yahooMapper; this file's job is strictly
// the HTTP round-trip (URL construction, headers, timeout, error wrapping).

import type { MarketDataProvider, NormalizedBars } from "./MarketDataProvider.js";
import { mapYahooResponse, statusToError } from "./yahooMapper.js";
import { UpstreamError } from "../errors/AppError.js";

// Matches the brief's example curl exactly; Yahoo's unofficial endpoint has
// been observed to reject requests with no User-Agent at all.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export interface YahooMarketDataProviderOptions {
  baseUrl: string;
  requestTimeoutMs: number;
  /** Injectable for tests (Q4); defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

export class YahooMarketDataProvider implements MarketDataProvider {
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: YahooMarketDataProviderOptions) {
    this.baseUrl = options.baseUrl;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async getBars(symbol: string): Promise<NormalizedBars> {
    const url = `${this.baseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=15m`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      // Covers both network failures and AbortSignal.timeout firing (Q3/Q5:
      // no retry, surface immediately).
      throw new UpstreamError(`Failed to reach Yahoo for "${symbol}"`, { cause: error });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new UpstreamError(`Yahoo returned a non-JSON response for "${symbol}"`, { cause: error });
    }

    if (!response.ok) {
      throw statusToError(symbol, response.status, body);
    }

    return mapYahooResponse(body, symbol);
  }
}
