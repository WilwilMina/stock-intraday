# PROMPT_LOG

A log of the AI prompts used in this exercise: the prompt, why I sent it, and what I kept, changed, or rejected.

> Note: I completed this log after submitting the repository. The version I submitted contained only the template. The code was not changed with this update.

## How I used AI

I worked with two Claude surfaces:

- **Claude Code** (main session, plan mode first) wrote nearly all of the code and tests, under my direction, in small slices with a commit after each. Its subagents, skills and a prompt-logging hook are listed below.
- **A separate Claude chat** acted as an advisor. It explained what the assessment was grading, helped me plan the workflow and time budget, drafted several of the prompts I pasted into Claude Code, and reviewed Claude Code's plans and reports before I approved them. Where a prompt or a decision came from that chat, the entry says so.

What I did myself, without AI writing the code, is under **Manual changes**. The prompts I typed in Claude Code are also recorded verbatim in [`docs/PROMPT_LOG.raw.md`](docs/PROMPT_LOG.raw.md), written by a hook, with timestamps in UTC. Plan approvals made in Claude Code's approval dialog are not all captured by the hook, so those entries quote the message I approved with. Times below are US Eastern on Sep 23, 2026.

## Agent setup

| Tool | Definition | Purpose |
|---|---|---|
| Claude Code main session | n/a | Planning, then implementation in small slices with a commit after each |
| `reviewer` subagent | `.claude/agents/reviewer.md` | Read-only review of the finished repo against the brief. It reports, and I triage. |
| `qa` subagent | `.claude/agents/qa.md` | Adversarial edge-case tests. It may only add tests, never edit source. |
| grill-me skill | plugin | Interviewed me on backend design decisions before any planning |
| frontend-design skill | plugin | One bounded visual polish pass on the frontend |
| Prompt-logging hook | `.claude/hooks/log-prompt.mjs`, wired in `.claude/settings.json` | Appends every prompt I send in Claude Code to `docs/PROMPT_LOG.raw.md` |
| Playwright (throwaway) | not in the repo | Screenshots of each UI state at desktop and phone width, to verify the frontend visually |
| Claude chat (advisor) | n/a | Planning, prompt drafting, and review of Claude Code's output |

Subagent runs happen in a separate context and don't appear in the main transcript, and the hook does not record the prompts a subagent receives. For those, the entry records the prompt I gave Claude Code, a summary of what came back, and what I did with each finding.

## Entries

### Entry 0: Approach and repo scaffold (Claude chat, about 19:07-19:15)

- **Prompt:** Asked how to approach the assessment and whether to use Claude Code, then asked for the repo scaffolded with the full brief as context: `ASSESSMENT.md` (later moved to `docs/`), a `CLAUDE.md`, this log, and a reviewer agent definition.
- **Why:** I wanted the AI to have the full brief from the start, and I wanted to understand what the assessors were grading before writing any code.
- **Kept:** The layered architecture (route, service, provider interface, pure aggregation function), the aggregation rules, the small-slice workflow, and the plan to log every prompt.
- **Changed:** After the design interview (Entry 3) the scaffold was corrected: fixtures moved into `backend/`, the cache was marked as deferred, and the Node version was fixed.
- **Rejected:** A research subagent, which the chat suggested skipping because the raw fixture and the notes already covered it and time was short. I also skipped Docker and a chart for the same reason.

### Entry 0b: Prompt-logging hook and QA agent (Claude chat, about 19:35-19:40)

- **Prompt:** Asked for a way to log every prompt automatically, and for a QA agent alongside the reviewer.
- **Why:** The assessment grades the prompt log, and I didn't want to lose entries or reconstruct them at the end. I also wanted testing to be separate from review.
- **Kept:** Both. The hook script and `settings.json` went in as drafted, and I wired them in and restarted Claude Code myself.
- **Changed:** Later, a docs-consistency subagent found the last line of `qa.md` cut off mid-sentence. It was completed and extended with the valid-symbol-with-no-bars case.
- **Rejected:** Nothing.

### Entry 1: Raw Yahoo data (manual, no AI)

- **What I did:** Ran the curl from the brief with `range=1mo`, saved it to `backend/fixtures/tsla-15m-1mo.json`, and read it before prompting.
- **Why:** To know the real data shape first, so I could spot AI mistakes later.
- **What the capture shows:** 573 timestamps for 15-minute bars, no nulls in the price arrays in this capture, `exchangeTimezoneName` of `America/New_York`, and a final bar whose timestamp equals `meta.regularMarketTime` with `volume: 0`. An invalid symbol returns HTTP 404 with `{"chart":{"result":null,"error":{"code":"Not Found",...}}}`.

### Entry 2: Orientation (Claude Code, 19:41)

- **Prompt:** `ok before anything i want you to go through all the files and let me know everything`
- **Why:** I wanted Claude Code's view of the scaffold before it started, and to catch anything inconsistent.
- **Kept:** Its summary, used as the baseline for the design interview.
- **Changed / rejected:** Nothing yet.

### Entry 3: Design interview with the grill-me skill (Claude Code, 19:47)

- **Prompt:**
  ```
  /grill-me the backend design for this take-home.

  Context: read CLAUDE.md, ASSESSMENT.md and fixtures/tsla-15m-1mo.json first.
  Skip anything already decided in CLAUDE.md or answerable from the fixture.
  Prioritize the most consequential decisions: aggregation semantics, timezone
  handling, error mapping, provider abstraction, caching, and the stack choices.
  Keep it to about 8 questions.

  When we're done, propose the project structure and implementation plan for the
  backend only (GET /api/stocks/:symbol/daily), call out risks in the Yahoo
  response (nulls, timezones, invalid symbols), and say where you disagree with
  CLAUDE.md. No code yet.
  ```
- **Why:** The brief leaves most design decisions open. I wanted to make them deliberately, one at a time, before any code existed.
- **Kept:** Fastify, native `Intl.DateTimeFormat` for timezone grouping, native `fetch` with `AbortSignal.timeout`, no retries for the MVP, and a comma-separated `CORS_ORIGIN`. My full answers to Q1-Q10 are in the raw log, and the resolved decisions are in the Decisions section of `CLAUDE.md`.
- **Changed:**
  - **Q4:** Claude Code proposed splitting the Yahoo provider into a pure mapper and a thin fetch wrapper. I added that the wrapper takes an injected `fetch`, so the status-to-error mapping (404, 429, 5xx, timeout) can be unit-tested without a mocking library.
  - **Q9:** I asked for delete-and-reinsert on a cache hit so a plain bounded `Map` gives true LRU, instead of first-in-first-out.
- **Rejected:** **Q8.** Claude Code recommended including the final zero-volume bar as-is. I disagreed and excluded it narrowly, only when its timestamp equals `meta.regularMarketTime` and its volume is 0, because a not-yet-complete bar would carry the same weight as real bars in that day's averages. I drafted this answer with the advisor chat. Q10 (the exclusion lives in the Yahoo mapper so `aggregateByDay` stays provider-agnostic) I accepted. The evidence for the rule came later: with that bar excluded, every one of the 22 days has exactly 26 bars (Entries 9 and 18).

### Entry 4: Approving the backend plan with five changes (Claude Code, about 19:55)

- **Prompt (approval message, quoted from my reply):**
  ```
  Approve with these changes:
  1. Reorder the slices: wire StockService, the route, the error handler and the
     integration test (slice 6) before the cache (slice 5). ...
  2. MarketDataProvider must return { bars, exchangeTimezoneName }, not a bare Bar[] ...
  3. buildApp should accept injected dependencies ({ provider }) ...
  4. Move the fixtures into backend/fixtures/ with git mv ...
  5. Before slice 1, add a Decisions section to CLAUDE.md ...
  Everything else as proposed, including Fastify's built-in pino logger.
  ```
  The full text is in the raw log.
- **Why:** I reviewed the plan against my decisions and against the time left. I wanted a working endpoint before anything optional, so the cache went last.
- **Kept:** The layering and folder structure, the fixture list (real capture plus invalid symbol, null bars, timezone boundary, forming bar), the risk list, and using Fastify's built-in pino instead of a separate dependency.
- **Changed:** The five items above. Item 1 had a consequence: when time ran short, the cache was the piece dropped. It is documented as a deferred decision (Q6, Q9) and a known limitation.
- **Rejected:** Nothing from the plan. It was accepted with those changes.

### Entry 5: Did slice 1 actually work? (Claude Code, 20:04)

- **Prompt:** `before we move on, I want to understand what has happened and would like to know if you have tested if this code works!`
- **Why:** I didn't want to build on a scaffold I hadn't seen run.
- **Kept:** The result: typecheck, lint and tests passed, and a real build plus a curl returned `{"status":"ok"}` from `/health`. There were no business-logic tests yet, only plumbing.
- **Changed:** Claude Code disclosed a decision it had made on its own: it switched ESLint from type-aware rules to plain `recommended`, because config files sit outside `tsconfig`. I kept that for now and asked for type-aware linting scoped to `src/**/*.ts` later (`Keep the current ESLint config for now...`). Not done before the deadline.
- **Rejected:** Nothing.

### Entry 6: Slice 2, the domain layer (Claude Code, 20:16-20:22)

- **Prompt (from the raw log):** `Keep the current ESLint config for now. ... Remove passWithNoTests once we have tests. Now slice 2:` followed by `Summary of slice 2 with how each file works.`
- **Why:** `aggregateByDay` is the heart of the app. I planned a test-first slice where Claude Code writes the tests and I write the function myself.
- **Kept:** Claude Code had already written `AppError.ts`, `aggregateByDay.ts` and its test file before I switched it into plan mode, so I kept its implementation. It uses one cached `Intl.DateTimeFormat` per timezone, groups bars in a `Map`, and sorts explicitly. I closed out the slice with checks and a commit.
- **Changed:** I had it remove `passWithNoTests` once real tests existed.
- **Rejected:** My own implementation of the function did not happen, so `aggregateByDay` is AI-written. I didn't write a test for `AppError.ts` because it is three declarative classes.

### Entry 7: QA agent on `aggregateByDay` (Claude Code, 20:25)

- **Prompt:**
  ```
  Use the qa agent to test backend/src/domain/aggregateByDay.ts. Focus on edge
  cases the current tests miss: DST transition days, an invalid timezone name,
  duplicate timestamps, NaN or Infinity values, rounding at .00005 boundaries, and
  very large volumes. It should only add tests. Report bugs and don't fix source.
  ```
- **Why:** To have a fresh context try to break the core function while it was small.
- **Kept:** The agent added 12 tests without touching source. It found two bugs.
  - **NaN and Infinity slipped past the null check.** I fixed it by treating non-finite numbers as missing (`Number.isFinite`), commit `405949e`. This is defensive, since Yahoo's JSON can't contain NaN, but it guarantees the API can never emit a silent `null`.
  - **DST transitions and very large volumes** behaved correctly.
- **Changed:** Nothing beyond the fix.
- **Rejected:** **Rounding at an exact `.00005` tie.** A mean of `0.0005` and `0.0006` is `0.00055`, which floating point stores just below the tie, so it rounds down. I didn't fix it, because there's no cheap fix without decimal arithmetic and an average over about 26 real bars will essentially never land on a tie. That QA test now documents the behavior, and the README lists it under known limitations. The agent also showed that an invalid timezone name throws and that duplicate timestamps are counted twice. Both are left as documented limitations.

### Entry 8: Slice 3, Yahoo mapping (Claude Code, 20:29)

- **Prompt:**
  ```
  Proceed with slice 3, the Yahoo mapping: the MarketDataProvider interface
  (returning { bars, exchangeTimezoneName }), mapYahooResponse, and statusToError,
  with unit tests against the real fixture and the new synthetic ones (invalid
  symbol, null bars, timezone boundary, forming bar). The forming-bar exclusion
  lives in the mapper. Stop when the tests pass and show me the vitest output.
  ```
- **Why:** To isolate everything that knows Yahoo's response shape in one testable place.
- **Kept:** All of it: 9 mapper tests passing, and four synthetic fixtures. Claude Code noted that the real TSLA fixture's own last bar matches the forming-bar pattern, so the real capture exercises the exclusion too.
- **Changed / rejected:** Nothing at the time. The reviewer later found a gap, a valid symbol with no bars (Entry 16).

### Entry 9: Verifying the numbers, not just the tests (Claude Code, 20:40)

- **Prompt (two parts, excerpts):** `Write a throwaway script (don't commit it) that loads fixtures/tsla-15m-1mo.json, runs mapYahooResponse and aggregateByDay on it, and prints the daily result as a table.` then `... write a second, independent check in Python (no shared code with the TypeScript) that recomputes one day straight from the raw JSON, and compare the two results.`
- **Why:** Passing tests only show the code matches its own tests. I wanted to check the numbers against an independent calculation. I asked in the advisor chat how I could tell whether it was accurate, and turned the answer into this prompt.
- **Kept:** 22 trading days, each with exactly 26 bars, `lowAverage` at or below `highAverage`, both inside each day's range, days ascending. The independent Python check for 2026-09-23 matched exactly: 26 bars, 379.3334, 381.1192, 29,933,045.
- **Changed:** I turned the verified values into a committed golden test on the real fixture (`backend/src/pipeline.golden.test.ts`, commit `2ce0aed`).
- **Rejected:** Nothing.

### Entry 10: Descriptive commit messages (Claude Code, 20:51)

- **Prompt:** `Make sure all commit messages are descriptive and explain what each slice has finished`
- **Why:** Commit history is evidence that I own the work, so I wanted it to read as a record of each slice.
- **Kept:** The tightened messages. Claude Code also corrected an inaccurate test count in one message before pushing.
- **Changed / rejected:** Nothing.

### Entry 11: Machine-readable errors (Claude Code, 20:54)

- **Prompt:**
  ```
  Two changes.
  First, make error responses machine-readable:
  { "error": { "code": "INVALID_SYMBOL" | "VALIDATION_ERROR" | "UPSTREAM_ERROR" |
  "NOT_FOUND", "message": "..." } }, with no upstream details in messages.
  Second, add a setNotFoundHandler that uses the same shape. Update the route tests, keep
  the suite green, and commit.
  ```
- **Why:** The frontend has to tell "invalid symbol" from "request failed", and matching on message text is fragile. Unknown routes should also use the same error shape.
- **Kept:** All of it (commit `a53bc20`).
- **Changed:** Nothing.
- **Rejected:** Nothing. I then checked the running API by hand (see Manual changes).

### Entry 12: Frontend plan and six changes (Claude Code, 20:58 to about 21:05)

- **Prompt (excerpt, full text in the raw log):** `Build the frontend in frontend/ (React + Vite + TypeScript). Start with a plan of at most 10 lines, then build it in three commits: (1) scaffold and a typed API client, (2) the UI, (3) a few component tests. ... Rapid submits must not let a stale response overwrite a newer one (use AbortController) ... Show me the plan first and wait for my approval.`
- **Why:** The brief asks for a UI with basic error handling. I singled out the stale-response race as the part most likely to be wrong.
- **Kept:** A standalone package, the request state machine, `AbortController` cancellation, a Vite dev proxy so CORS isn't needed in dev, the symbol regex duplicated once with a README note, and jsdom with Testing Library for tests.
- **Changed:** I approved the plan with six changes: separate messages for "nothing submitted yet" and "no data for this symbol"; volume formatted with `toLocaleString("en-US")` so output and tests are deterministic; the `day` string is rendered as-is and never passed through `new Date()`, which would shift dates by timezone; the table is shown newest-first in the UI only, with the API left ascending; a table caption and `scope="col"` headers; and input is trimmed. The advisor chat suggested these, and Claude Code's revised plan included all six.
- **Rejected:** Nothing.

### Entry 13: Component tests and a Playwright visual check (Claude Code, 21:17)

- **Prompt (two parts):** `Proceed with commit 3 (component tests). I'll do the browser check myself and report anything I find.` and a prompt asking for a throwaway Playwright script, kept out of the repo, that forces each UI state by intercepting `/api` and saves screenshots at 1280x800 and 390x844, then reads them and fixes problems.
- **Why:** I wanted a do-task, screenshot, verify loop for the UI and not just unit tests.
- **Kept:** 14 component tests. Writing the rapid-resubmit test exposed two real problems, and both were fixed instead of worked around:
  - The submit button was disabled while loading, which also blocks Enter-key submission, so the race the `AbortController` guards against could not be triggered through the UI. Now the button stays enabled.
  - Testing Library's automatic cleanup wasn't running, so I added an explicit `afterEach(cleanup)`.
  - The Playwright pass found that on a 390px screen table headers and dates wrapped mid-word. It was fixed with a horizontally scrollable table container and `white-space: nowrap` (commit `413a080`).
- **Changed / rejected:** Claude Code noticed a faint blue tint on some text in headless screenshots. It found no such colour in the CSS and treated it as a screenshot rendering artifact, and I didn't chase it.

### Entry 14: One visual polish pass with the frontend-design skill (Claude Code, 21:33)

- **Prompt (excerpt, full text in the raw log):** `Use the frontend-design skill for one visual polish pass on the frontend. The goal is clean, professional and understated, not flashy. Constraints: no new dependencies, no external fonts, plain CSS only, and don't change behavior or the component structure.` followed by specific fixes: align the label and input, make errors visually distinct with `role="alert"`, keep the table readable at 390px, and add focus states, contrast and a max width.
- **Why:** I wanted a clean look without spending time or dependencies on design.
- **Kept:** All four fixes (commit `36c1a5c`). Errors now use `role="alert"` with assertive announcements, while idle, loading and empty states stay `role="status"` and polite. The label is aligned, there are visible focus rings, and the page has a 760px max width. Two app tests were updated for the role change.
- **Changed / rejected:** Nothing. I didn't ask for a second pass.

### Entry 15: Final pass (Claude Code, 21:45)

- **Prompt (excerpt, full text in the raw log):** five ordered steps with one commit each: (1) bump ESLint in both packages, (2) run the reviewer agent and fix Blockers and Majors that take under 5 minutes, (3) readable config errors, `.env.example`, `engines`, graceful shutdown, (4) make the docs match the code, (5) write a short README and verify it by following it literally in a fresh clone. I also told it not to restructure directories or add Docker.
- **Why:** I had about 15 minutes left, so I asked for a bounded set of fixes and a check that a stranger can run the project.
- **Kept:**
  - ESLint 10 in both packages with no conflicts or new findings.
  - Config errors now print one line and exit 1.
  - `.env.example` files, graceful SIGINT/SIGTERM shutdown, and `engines` set to `^22.13 || ^24 || >=26`, because Vitest 5 dropped Node 20, so the scaffold's original `>=20` was wrong.
  - The fresh-clone check of the README found three problems that were fixed: a route test that could time out on a busy machine, a README claim about `npm run dev` exit behavior, and the dev proxy being fixed at port 3000.
- **Changed / rejected:** I left the other major-version bumps alone because they change behavior, and left the transitive `jsdom` deprecation warning. I rejected Docker (nobody could test it tonight), moving tests out of `src/`, and building the cache.

### Entry 16: Subagents in parallel (Claude Code, 21:49)

- **Prompt:** `they are back up again make sure that you are utilizing these agents so your context window does not get filled up with useless junk.`
- **Why:** To keep the main session's context small by delegating the review and the docs check.
- **Kept:** The reviewer agent's report: no blockers in the code, and two Majors that I had fixed.
  - A valid symbol with no bars in the window returned 502 instead of `200 []`, so the frontend's "No data found" state could never appear.
  - `CLAUDE.md` still described a cache that doesn't exist, and `CACHE_TTL_SECONDS` was validated but never used. The docs were reconciled and the variable removed.
- **Changed:** The docs subagent corrected `CLAUDE.md` and both agent files (Node range, error shape, the cache marked as not built, frontend notes, and the truncated `qa.md` line).
- **Rejected:** The remaining Minors were left as they are and listed under Known limitations in the README: a trailing slash in `YAHOO_BASE_URL`, a non-JSON upstream 404 reported as 502, an unknown exchange timezone returning 500, the symbols `.` and `..`, Fastify's own 414 shape for very long symbols, no request ID in error logs, and duplicate timestamps counted twice. The reviewer suggested fixing the trailing slash, the non-JSON 404 and the `.`/`..` case first, and I ran out of time.

### Entry 17: Repository cleanup (Claude Code, 22:02)

- **Prompt (excerpt):** `Small repo cleanup, no code changes. Move ASSESSMENT.md and PROMPT_LOG.raw.md into docs/ with git mv. Update every reference to them ... Add a short "Repository layout" tree to the README. Run the tests, lint and typecheck in both packages afterward. If anything breaks and can't be fixed in 3 minutes, revert.`
- **Why:** The root felt cluttered, but I wanted no risk to working code, so I moved only two documents.
- **Kept:** The move, updated references (including the hook's log path), and the layout tree in the README (commit `7efcd58`).
- **Changed / rejected:** Moving tests into a separate folder, which I rejected because tests next to the code they cover is a normal convention and the move risked breaking imports.

### Entry 18: Verification after submission (Claude chat, 22:10-22:20)

Done after the submission deadline, and it changed no code.

- **Prompt:** I asked the advisor chat to test whether the program is accurate. It cloned the public repo fresh and ran the checks in a scratch directory.
- **Findings:**
  - Following the README in a fresh clone: install, typecheck, lint, tests and build all pass in both packages (backend 44 tests, frontend 14), with 0 vulnerabilities.
  - An independent Python recompute of all 22 days matched the app's pipeline with 0 mismatches. Every day has exactly 26 bars, from 09:30 to 15:45 New York time.
  - Against Yahoo's TSLA history page for 10 days, the day highs and lows match to the cent on 8 days and within 5 cents on 2.
  - **Volume:** the sum of the 15-minute bars is about 7-11% below Yahoo's official daily volume on nine days, and 20% below on Sep 18. For Sep 23, the fixture's own metadata gives 32,914,670 against the app's 29,933,045. The code sums exactly what Yahoo's bars contain (the independent recompute agrees), so this is a limit of the bars and not a bug. My guess is that closing-auction and late-reported trades aren't in the bars, but I couldn't confirm the cause.
  - The excluded final bar sits at 16:00 with zero volume and the official closing price. After the close, it's a closing-price placeholder, not a "still-forming" bar. Excluding it is still correct.
  - `npm run build` in the backend also compiles the test files into `dist/`.
- **Follow-ups (not yet done):** state the volume caveat and the forming-bar wording in the README, and exclude `*.test.ts` from the backend build.

## Manual changes (outside of AI)

Changes I made by hand, with the reasoning for each.

| File / area | What I changed | Why |
|---|---|---|
| GitHub repo and git | Created the repo, fixed clone and push problems (a nested folder and a missing remote), and pushed the scaffold | Needed a working remote. No AI-written code involved. |
| `backend/fixtures/tsla-15m-1mo.json` | Captured the raw Yahoo response with `curl.exe` and read it before prompting | To know the real data shape (nulls, timezone, final bar) up front |
| `.claude/settings.json` and hook | Wired the prompt-logging hook in by hand and restarted Claude Code | To log every prompt automatically |
| `CLAUDE.md` To Do list | Added the To Do / Improvements list at the bottom by hand | To track the polish items I wanted done |
| Config validation check | Started the backend with `PORT=abc` and confirmed it fails fast | To verify the "validated at startup" claim myself. The raw error dump it printed led to the readable-error change in Entry 15. |
| API checks | Ran curl against the running API with `tsla`, `BRK-B`, `^GSPC` (200), a too-long symbol (400 `VALIDATION_ERROR`) and an unknown route (404 `NOT_FOUND`) | To confirm the error codes and symbol handling myself |
| Browser check | Ran both servers and checked the UI in a real browser with TSLA, AAPL and an invalid symbol | To verify newest-first order, formatting and the error state |

## What I'd do next

- Build the cache decorator (the design is settled in Q6 and Q9), plus retries and rate limiting.
- Add a Playwright end-to-end test to the repo.
- Add Dockerfiles, tested this time.
- Add type-aware ESLint rules scoped to `src/`.
- Document the volume caveat, and reword the forming-bar explanation.
- Fix the reviewer's remaining Minor findings, starting with the trailing slash in `YAHOO_BASE_URL`, the non-JSON upstream 404, and the `.`/`..` symbols.