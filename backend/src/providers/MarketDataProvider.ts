// The seam StockService depends on instead of a concrete data source.
// Yahoo is the only implementation today, but nothing above this interface
// knows that — a future provider just has to satisfy the same shape.

import type { Bar } from "../domain/aggregateByDay.js";

export interface NormalizedBars {
  bars: Bar[];
  exchangeTimezoneName: string;
}

export interface MarketDataProvider {
  getBars(symbol: string): Promise<NormalizedBars>;
}
