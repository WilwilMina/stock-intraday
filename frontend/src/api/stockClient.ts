// Typed client for the backend's stock endpoint. The only module that knows
// the API's URL shape and its { error: { code, message } } error format
// (backend/src/app.ts's sendError). Left empty, VITE_API_BASE_URL relies on
// the Vite dev proxy for /api (see vite.config.ts) and never touches CORS.

import type { DailyAggregate } from "./types";

export type ApiErrorKind = "invalid_symbol" | "failed";

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export async function fetchDailyAggregates(symbol: string, signal: AbortSignal): Promise<DailyAggregate[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/stocks/${encodeURIComponent(symbol)}/daily`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Let the caller's own abort handling deal with this - a superseded
      // request is not a "failed request".
      throw error;
    }
    throw new ApiError("failed", "Could not reach the server.");
  }

  if (!response.ok) {
    let body: ErrorBody | undefined;
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      body = undefined;
    }

    if (body?.error?.code === "INVALID_SYMBOL") {
      throw new ApiError("invalid_symbol", body.error.message ?? `No data found for symbol "${symbol}"`);
    }
    throw new ApiError("failed", "Something went wrong fetching data. Please try again.");
  }

  return (await response.json()) as DailyAggregate[];
}
