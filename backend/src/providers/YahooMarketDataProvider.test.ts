// Unit tests for the HTTP round-trip, with an injected fake fetch (Q4) so
// nothing here ever touches the network. Mapping/status-to-error logic
// itself is covered in yahooMapper.test.ts; these tests only check that
// YahooMarketDataProvider wires the request and delegates correctly.

import { describe, expect, it, vi } from "vitest";
import { YahooMarketDataProvider } from "./YahooMarketDataProvider.js";
import { InvalidSymbolError, UpstreamError } from "../errors/AppError.js";

const BASE_URL = "https://query1.finance.yahoo.com";

const VALID_BODY = {
  chart: {
    result: [
      {
        meta: { exchangeTimezoneName: "America/New_York", regularMarketTime: 1718375400 },
        timestamp: [1718375400],
        indicators: { quote: [{ low: [350.0], high: [352.0], volume: [100000] }] },
      },
    ],
  },
};

function makeProvider(fetchFn: typeof fetch) {
  return new YahooMarketDataProvider({ baseUrl: BASE_URL, requestTimeoutMs: 5000, fetchFn });
}

describe("YahooMarketDataProvider", () => {
  it("requests the expected URL with range=1mo&interval=15m and a User-Agent header, and maps a 200", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(VALID_BODY), { status: 200 }));

    const result = await makeProvider(fetchFn).getBars("TSLA");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/v8/finance/chart/TSLA?range=1mo&interval=15m`);
    expect((init?.headers as Record<string, string>)["User-Agent"]).toContain("Mozilla/5.0");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    expect(result).toEqual({
      bars: [{ timestamp: 1718375400, low: 350.0, high: 352.0, volume: 100000 }],
      exchangeTimezoneName: "America/New_York",
    });
  });

  it("encodes special characters in the symbol (e.g. ^GSPC)", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(VALID_BODY), { status: 200 }));

    await makeProvider(fetchFn).getBars("^GSPC");

    const [url] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/v8/finance/chart/%5EGSPC?range=1mo&interval=15m`);
  });

  it("maps a 404 to InvalidSymbolError", async () => {
    const errorBody = { chart: { result: null, error: { code: "Not Found", description: "..." } } };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(errorBody), { status: 404 }));

    await expect(makeProvider(fetchFn).getBars("ZZZZZZINVALID")).rejects.toBeInstanceOf(InvalidSymbolError);
  });

  it("maps a 429 to UpstreamError", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 429 }));

    await expect(makeProvider(fetchFn).getBars("TSLA")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("maps a 500 to UpstreamError", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 500 }));

    await expect(makeProvider(fetchFn).getBars("TSLA")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("wraps a network failure or timeout as UpstreamError", async () => {
    const timeoutError = new DOMException("The operation was aborted", "TimeoutError");
    const fetchFn = vi.fn(async () => {
      throw timeoutError;
    });

    const error: unknown = await makeProvider(fetchFn)
      .getBars("TSLA")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).cause).toBe(timeoutError);
  });

  it("wraps a non-JSON response body as UpstreamError", async () => {
    const fetchFn = vi.fn(async () => new Response("not json", { status: 200 }));

    await expect(makeProvider(fetchFn).getBars("TSLA")).rejects.toBeInstanceOf(UpstreamError);
  });
});
