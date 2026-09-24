// Fastify route for GET /api/stocks/:symbol/daily. Validates and uppercases
// the symbol param, then delegates to StockService. No business logic here -
// errors are thrown as typed AppErrors and handled centrally in app.ts.

import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import type { StockService } from "../services/StockService.js";
import { ValidationError } from "../errors/AppError.js";

const symbolParamSchema = z.object({
  symbol: z
    .string()
    .regex(/^[A-Za-z0-9.\-^=]{1,15}$/, "must be 1-15 characters of letters, digits, . - ^ =")
    .transform((value) => value.toUpperCase()),
});

export function registerStocksRoute(app: FastifyInstance, stockService: StockService): void {
  app.get("/api/stocks/:symbol/daily", async (request) => {
    let symbol: string;
    try {
      symbol = symbolParamSchema.parse(request.params).symbol;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(`Invalid symbol: ${error.issues[0]?.message ?? "malformed"}`);
      }
      throw error;
    }

    return stockService.getDailyAggregates(symbol);
  });
}
