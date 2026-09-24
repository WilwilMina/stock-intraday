# Stock Intraday

Enter a stock symbol and see, for each trading day of the last month, the average low, average high and total volume of its 15-minute Yahoo Finance bars.

- `backend/`: Node + TypeScript + Fastify API, `GET /api/stocks/:symbol/daily`
- `frontend/`: React + Vite + TypeScript UI

## Repository layout

```
.
├── backend/              Node/TypeScript API (see Source layout below)
├── frontend/             React/Vite UI (see Source layout below)
├── docs/
│   ├── ASSESSMENT.md       the take-home brief and our resolved ambiguities
│   └── PROMPT_LOG.raw.md   every prompt, auto-logged by a Claude Code hook
├── .claude/              agents, hooks, and project-specific rules
├── CLAUDE.md             architecture and design decisions
├── PROMPT_LOG.md         the curated AI prompt log (what/why/kept/changed)
└── README.md             this file
```

## Prerequisites

- Node `22.13+` or `24+` (the exact range is in each `package.json` `engines` field; Node 20 is not supported)
- npm (ships with Node)
- Internet access for the backend to reach Yahoo Finance. The tests never call Yahoo.

## Run it

Use two terminals, starting from the repo root.

Terminal 1, backend (http://localhost:3000):

```bash
cd backend
npm ci
npm run dev
```

Terminal 2, frontend (http://localhost:5173):

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. In dev, Vite proxies `/api` to the backend on port 3000, so no CORS setup is needed. The proxy target is fixed at port 3000: if you run the backend on another `PORT`, change the target in `frontend/vite.config.ts` to match.

To check the API directly:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/stocks/TSLA/daily
```

The response looks like this, one entry per day, oldest first:

```json
[{ "day": "2026-09-23", "lowAverage": 379.3334, "highAverage": 381.1192, "volume": 29933045 }]
```

Errors come back as `{ "error": { "code": "...", "message": "..." } }`:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | The symbol doesn't match `^[A-Za-z0-9.\-^=]{1,15}$` |
| 404 | `INVALID_SYMBOL` | Yahoo has no such symbol |
| 404 | `NOT_FOUND` | Unknown route |
| 502 | `UPSTREAM_ERROR` | Yahoo failed, timed out or returned something unexpected (no details are exposed) |
| 500 | `INTERNAL_ERROR` | Anything else |

For a production build, run `npm run build` in each package. Then run `npm start` in `backend/` (it serves from `dist/`) and serve `frontend/dist/` with any static host.

## Environment variables

All variables are optional. The defaults are listed in `backend/.env.example` and `frontend/.env.example`. No `.env` file is loaded automatically, so set overrides in your shell, for example `PORT=3001 npm run dev`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Backend port |
| `YAHOO_BASE_URL` | `https://query1.finance.yahoo.com` | Yahoo chart API base URL (no trailing slash) |
| `REQUEST_TIMEOUT_MS` | `5000` | Timeout for each Yahoo request |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins. Only needed when the frontend isn't using the dev proxy |
| `VITE_API_BASE_URL` (frontend) | empty | Backend origin for a production build. Leave empty in dev |

If a value is invalid, the backend prints one line (`Invalid config: PORT: Expected number, received nan`) and exits with code 1. Under `npm run dev`, the file watcher prints the same line but keeps running until you stop it.

## Checks

Run these in each of `backend/` and `frontend/`:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

- Backend: Vitest unit tests for the aggregation, the Yahoo mapper (against a real captured TSLA response plus synthetic edge-case fixtures in `backend/fixtures/`), the HTTP provider (with an injected fake `fetch`), config, and one route integration test.
- Frontend: Vitest and Testing Library tests for the form, the table and the app's state handling, including the rapid-resubmit race.

## Source layout

```
backend/src/
  index.ts                 entry point: config, listen, graceful shutdown
  app.ts                   Fastify app, CORS, central error handler
  config/env.ts            env var validation
  routes/stocks.ts         GET /api/stocks/:symbol/daily (validation only)
  services/StockService.ts provider + aggregation
  providers/               MarketDataProvider interface, Yahoo HTTP client, Yahoo response mapper
  domain/aggregateByDay.ts pure grouping and averaging
backend/fixtures/          captured and synthetic Yahoo responses
frontend/src/
  api/stockClient.ts       typed API client
  components/              SymbolForm, ResultsTable, StatusMessage
  App.tsx                  state handling and request cancellation
```

`CLAUDE.md` records the design decisions. `PROMPT_LOG.md` is the AI prompt log.

## Assumptions

The brief leaves these open. Here is how they were decided:

- "Last month" means `range=1mo&interval=15m`. The brief's example has no range, and Yahoo then defaults to one day.
- `lowAverage` is the mean of the 15-minute bar lows for the day, and `highAverage` is the mean of the highs. Both are rounded to 4 decimals. `volume` is the sum of the bar volumes.
- A "day" is the calendar date in the exchange's timezone (`meta.exchangeTimezoneName`), not UTC.
- Bars with a missing or non-finite low, high or volume are skipped. A day with no valid bars is left out. Days are sorted oldest first.
- Yahoo's still-forming current bar is excluded. That's the one whose timestamp equals `meta.regularMarketTime` and whose volume is `0`.
- An unknown symbol returns 404. A real symbol with no bars in the window returns `200 []`.

## Known limitations

- Yahoo's chart endpoint is unofficial. It can rate-limit, change shape or start requiring cookies at any time.
- No caching, no retries and no rate limiting. These were deliberately left out of the MVP, and any upstream failure returns 502 straight away.
- Edge cases found in review and left as they are:
  - A trailing slash in `YAHOO_BASE_URL` produces a double slash in the request URL.
  - An upstream 404 with a non-JSON body is reported as 502 instead of `INVALID_SYMBOL`.
  - An unknown exchange timezone from Yahoo returns 500 instead of 502.
  - The symbols `.` and `..` pass validation but resolve to a different path and return `NOT_FOUND`.
  - A symbol longer than 100 characters gets Fastify's own 414 error shape.
  - Error logs carry no request ID.
  - Bars with duplicate timestamps are counted twice.
- Rounding uses IEEE-754 doubles, so a mean that lands exactly on a `.00005` tie can round down. Volume sums above `Number.MAX_SAFE_INTEGER` would lose precision, which no real stock volume reaches.
- The frontend duplicates the backend's symbol regex, because the two packages share no code.
- The frontend has a table but no chart.
