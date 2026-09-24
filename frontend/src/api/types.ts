// Shape of one row returned by GET /api/stocks/:symbol/daily, matching the
// backend's DailyAggregate (backend/src/domain/aggregateByDay.ts) exactly.

export interface DailyAggregate {
  day: string;
  lowAverage: number;
  highAverage: number;
  volume: number;
}
