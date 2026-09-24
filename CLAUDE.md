# CLAUDE.md

Project context for Claude Code. Read `ASSESSMENT.md` first: it is the full take-home brief (requirements, deliverables, expectations) plus our resolved ambiguities. Everything below follows from it.

## Goal

Full-stack app: a Node/TypeScript API that pulls the last month of 15-minute bars for a stock symbol from Yahoo Finance, groups them by day, and returns `[{ day, lowAverage, highAverage, volume }]`. A React frontend lets the user enter a symbol and view the result. This is an MVP whose requirements are expected to grow, so it is built production-minded without being over-built.

## Stack

- Backend: Node 20+, TypeScript (strict), Fastify, zod for validation, Vitest for tests
- Frontend: React + Vite + TypeScript, Vitest + Testing Library for a few component tests
- Lint/format: ESLint + Prettier
- Layout: `backend/` and `frontend/` as separate packages; root README explains running both

## Backend architecture (SOLID, small layers)

```
route (HTTP only)  ->  StockService  ->  MarketDataProvider (interface)
                                      ->  aggregateByDay (pure function)
                                   YahooMarketDataProvider implements MarketDataProvider
```

- `routes/`: parse and validate input (symbol regex `^[A-Za-z0-9.\-^=]{1,15}$`, uppercased), call the service, map errors to HTTP. No business logic.
- `services/StockService`: orchestrates provider + aggregation; depends only on the `MarketDataProvider` interface (dependency inversion).
- `providers/MarketDataProvider`: interface returning normalized bars (`{ timestamp, low, high, volume }`) plus the exchange timezone. Yahoo is one implementation, so it can be swapped later.
- `providers/YahooMarketDataProvider`: the only file that knows Yahoo's response shape, the User-Agent header, and its error payloads. Has a request timeout.
- `domain/aggregateByDay`: pure and side-effect free, so it is trivially unit-tested.
- Central error handler with typed errors: `InvalidSymbolError` -> 404, `UpstreamError` -> 502, `ValidationError` -> 400. Never leak upstream internals.
- Config via env vars (`PORT`, `YAHOO_BASE_URL`, `CACHE_TTL_SECONDS`, `REQUEST_TIMEOUT_MS`, `CORS_ORIGIN`) validated at startup.
- Short-TTL in-memory cache wrapped around the provider (decorator), since the endpoint is unofficial and rate-limits.
- Structured logging (pino) with no secrets.

Endpoint: `GET /api/stocks/:symbol/daily` returns the JSON array in the brief's exact format. Also `GET /health`.

## Decisions (design interview, resolved before backend implementation)

Outcomes of a `/grill-me` session over the open points above `CLAUDE.md` didn't already settle. Supersedes anything above that reads as ambiguous.

| # | Question | Decision |
|---|---|---|
| Q1 | Fastify vs Express | Fastify. Validate route params with plain zod `.parse()`; no type-provider plugin. |
| Q2 | Timezone handling | Native `Intl.DateTimeFormat`, no library. Use the `en-CA` locale so `.format()` returns `YYYY-MM-DD` directly; cache one formatter per timezone. |
| Q3 | Outbound HTTP client | Native `fetch` + `AbortSignal.timeout(REQUEST_TIMEOUT_MS)`. Send the brief's `User-Agent` header. |
| Q4 | Provider testability | `mapYahooResponse` is a pure function tested against fixtures. The HTTP-fetching wrapper takes an **injected `fetch`** (default: global `fetch`), so the status-to-error mapping (404 -> `InvalidSymbolError`; 429/5xx/timeout -> `UpstreamError`) is unit-tested by injecting a fake `fetch`, with no HTTP-mocking library. |
| Q5 | Retry policy | No retry for the MVP. A transient failure surfaces immediately as `UpstreamError` -> 502. Documented as a known limitation in the README. |
| Q6 | Cache shape | The `CachingMarketDataProvider` decorator caches the provider's normalized output (bars + timezone), never the aggregated result and never an error response. |
| Q7 | `CORS_ORIGIN` format | Comma-separated string, split into an array at config-validation time. |
| Q8 | The in-progress "today" bar | Yahoo's response includes a final bar whose `timestamp` equals `meta.regularMarketTime` with `volume: 0` — the still-forming, not-yet-closed period. This is **excluded**, narrowly: only when `timestamp === meta.regularMarketTime && volume === 0`. A genuine zero-volume bar elsewhere in the array is left alone; only `null` low/high/volume gets skipped by `aggregateByDay`'s general rule. |
| Q9 | Cache eviction | A hand-rolled bounded `Map` (~100 entries), not the `lru-cache` package. On a cache hit, delete-then-re-set the key so it moves to the end, giving true LRU ordering for free. Expired entries are dropped lazily on read (no background sweep). |
| Q10 | Where Q8's exclusion lives | Inside `mapYahooResponse` (the Yahoo provider), not `aggregateByDay`. `regularMarketTime` is Yahoo-specific vocabulary; `aggregateByDay` must stay provider-agnostic per the architecture above, so it never learns this concept exists. Tested as a `yahooMapper` fixture case, not an `aggregateByDay` case. |

Two implementation notes that came out of the same session, not disagreements with the plan above:
- Fastify's built-in logger already is pino — configure `fastify({ logger: {...} })` rather than adding a standalone `pino` dependency.
- Fixtures live in `backend/fixtures/` (moved from a repo-root `fixtures/`), consistent with `backend/` and `frontend/` being separate packages.

## Aggregation rules (do not change without discussing)

- Group by calendar date in `meta.exchangeTimezoneName`, not UTC
- `lowAverage` = mean of bar lows; `highAverage` = mean of bar highs; both rounded to 4 decimals
- `volume` = sum of bar volumes (integer)
- Skip any bar where low, high, or volume is null
- Omit days with no valid bars; sort ascending by day
- Request `range=1mo&interval=15m`

## Frontend

- Symbol input with client-side validation, submit, loading state, empty state, error state (invalid symbol vs. failed request are distinct messages)
- Results table, plus a simple chart (low/high average lines) if time allows. The table is required, the chart is optional.
- API base URL from `VITE_API_BASE_URL`; dev proxy to the backend is fine
- Typed API client in one module; components stay presentational

## Testing

- Unit: `aggregateByDay` using a fixture with nulls, a timezone-boundary bar, and a day with all-null bars
- Unit: Yahoo provider mapping (including the invalid-symbol payload) against fixtures in `backend/fixtures/`
- Integration: one route test with a mocked provider (200, 400, 404, 502)
- Never call the live Yahoo API in tests

## Working agreements for Claude

- Plan first for anything non-trivial; do not write code until the plan is confirmed
- Small vertical slices; one commit per slice, imperative commit messages
- Before adding a dependency, say why. Prefer fewer dependencies.
- Do not gold-plate: no auth, database, or Docker orchestration unless asked
- When you make a choice the brief leaves open, say so out loud so it can be recorded in the README and `PROMPT_LOG.md`
- Type-check, lint, and run tests before declaring a slice done

## Deliverables checklist

- [ ] Backend endpoint, tested
- [ ] Frontend, working against the backend
- [ ] `README.md` (setup and run for both halves, design decisions, assumptions, known limitations)
- [ ] `PROMPT_LOG.md` (every AI prompt: what, why, kept/changed/rejected)
- [ ] Manual changes documented (section at the bottom of `PROMPT_LOG.md`)
- [ ] Pushed to GitHub
