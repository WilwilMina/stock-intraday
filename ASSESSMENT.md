# Take-Home Assessment - AI-Collaborative Development

> Full text of the assessment brief (transcribed from `Take-Home Assessment.pdf`), kept in the repo as the source of truth for scope. Section 2 at the bottom is NOT part of the brief; it is our own notes.

## 1. The brief (verbatim)

Build a full-stack application that consumes a public stock API and displays intraday market data.

You are encouraged to use AI assistants (Claude, Copilot, ChatGPT, etc.) - this reflects how we work. We will evaluate both the quality of the code you submit and how effectively you collaborate with AI. You own the final code - if AI generates something, you are expected to review, improve, and make it production-ready.

### Requirements

#### Backend

Using this public stock API (example uses TSLA):

```bash
curl "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=15m" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

- Create a self-hosted C# .NET 8+ or Node.js/TypeScript API
- Expose an endpoint that:
  - Takes a stock symbol as a parameter
  - Queries intraday data from the last month
  - Groups results by day
  - Returns JSON in this format and precision:

```json
[
    {
        "day": "2009-01-30",
        "lowAverage": 40.2958,
        "highAverage": 49.7534,
        "volume": 49073348
    }
]
```

#### Frontend

- Build a UI (React, Angular, or Vue) that consumes your backend API
- Allow the user to enter a stock symbol and view the results
- Display the data in a meaningful way (table, chart, or both)
- Basic error handling for invalid symbols or failed requests

### Deliverables

1. **Working repository** - commit(s) to a GitHub repository and provide the link (PREFERABLE), OR zip the contents and share
2. **README.md** - Setup and run instructions so a reviewer can build and run both backend and frontend locally
3. **PROMPT_LOG.md** - A log of the AI prompts you used during this exercise. For each entry include:
   - The prompt you sent
   - A brief note on why you chose that prompt (what were you trying to learn or achieve?)
   - What you kept, changed, or rejected from the AI output and why
4. **Description and reasoning behind any manual changes made outside of AI**

### Expectations

- All requirements are met and the solution is fully functional
- Highest quality, suitable for a production deployment
  - Best practices, maintainable, SOLID, modern, etc.
- Assume this is an MVP with requirements expected to grow
- The prompt log should show thoughtful AI collaboration, not just copy-paste

---

## 2. Our notes (not part of the brief)

Ambiguities in the brief and how we resolve them. Each of these must be stated in the README.

| Ambiguity | Decision |
|---|---|
| The example curl has no `range` param (Yahoo then defaults to 1 day) | Request `range=1mo&interval=15m` to satisfy "last month" |
| `lowAverage` / `highAverage` are undefined | Mean of the 15-minute bar `low` values / `high` values for that day |
| `volume` is undefined | Sum of the 15-minute bar volumes for that day |
| What counts as a "day" | The calendar date in the exchange's timezone (`meta.exchangeTimezoneName`), not UTC |
| "Precision" | Prices rounded to 4 decimal places; volume is an integer |
| Bars with null OHLCV values (Yahoo emits these) | Skip them; a day with no valid bars is omitted |
| Sample response shows a 2009 date | Just an illustrative example; do not hardcode anything from it |
| Invalid symbol | Yahoo returns a 404 error payload; surface as a clean 404 from our API |
| Sort order | Ascending by day (oldest first) |
| Yahoo endpoint is unofficial and can rate-limit | Isolate behind a provider interface, add a short-TTL cache, document the risk |

Grading signals to keep in mind: working end-to-end, production-minded structure (SOLID, tests, error handling, config), a README a stranger can follow, and a prompt log that shows real judgment (things rejected or changed, not just accepted).
