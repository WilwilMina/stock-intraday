// Orchestrates a MarketDataProvider and aggregateByDay. Depends only on the
// MarketDataProvider interface, not a concrete provider (dependency
// inversion), so it never knows Yahoo exists.

import type { MarketDataProvider } from "../providers/MarketDataProvider.js";
import { aggregateByDay, type DailyAggregate } from "../domain/aggregateByDay.js";

export class StockService {
  constructor(private readonly provider: MarketDataProvider) {}

  async getDailyAggregates(symbol: string): Promise<DailyAggregate[]> {
    const { bars, exchangeTimezoneName } = await this.provider.getBars(symbol);
    return aggregateByDay(bars, exchangeTimezoneName);
  }
}
