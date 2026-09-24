// Typed errors the central Fastify error handler maps to specific HTTP
// statuses (InvalidSymbolError -> 404, UpstreamError -> 502,
// ValidationError -> 400). Thrown from routes/services/providers; never
// constructed by the error handler itself.

export class InvalidSymbolError extends Error {
  constructor(symbol: string) {
    super(`No data found for symbol "${symbol}"`);
    this.name = "InvalidSymbolError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UpstreamError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
