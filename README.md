# Priority Foregrounds Kanban

A standalone product-priority workbench for making tradeoffs explicit.

The operator allocates an exact 100-point budget across five editable decision
principles. Queue rank is deterministic. An optional AI evaluator can propose
one complete score column and concise reasons for a principle; incomplete or
malformed output is rejected without changing any scores.

## Run locally

Python 3.11 or newer is sufficient for the workbench and server:

```bash
python3 -m priority_foregrounds.server
```

Then open <http://127.0.0.1:8780>.

The server binds to `127.0.0.1` by default. It is a local development server,
not an internet-facing authentication boundary.

## What the workbench does

- Shares exactly 100 points across five principles with a `0.1` floor.
- Redistributes points proportionally while a slider moves.
- Keeps rows stationary during a drag, then reorders principles on release.
- Lets an operator click any principle name to edit its scoring prompt.
- Re-scores the complete queue with one bounded structured-output request.
- Rejects partial, duplicate, unknown, boolean, or out-of-range scores.
- Retains accepted scores, reasons, prompt state, model, token use, cache state,
  hashes, and budget provenance in browser local storage.
- Renders model reasons as text, never injected HTML.
- Includes a responsive queue comparison view and unit-economics calculator.

Seed data is intentionally generic. Edit `web/app.js` to replace the example
queue with your own initiatives, or use it as the starting point for persistent
queue storage in the next iteration.

## Enable AI re-scoring

Re-scoring is **off by default**. The rest of the workbench works without an API
key or third-party package.

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[ai]'
cp .env.example .env
```

Put a Gemini key in your local `.env`, set `PRIORITY_RESCORE_ENABLED=1`, then
load the environment and start the server:

```bash
set -a
. ./.env
set +a
python -m priority_foregrounds.server
```

The default model is `gemini-3.1-flash-lite`. Override it with
`PRIORITY_MODEL`.

### Spend controls

Uncached model calls are constrained in memory by all three limits:

| Variable | Default | Bound |
| --- | ---: | ---: |
| `PRIORITY_MAX_RUNS_PER_MINUTE` | 6 | 1-30 |
| `PRIORITY_MAX_RUNS_PER_DAY` | 24 | 1-500 |
| `PRIORITY_MAX_TOKENS_PER_DAY` | 100000 | 5000-5000000 |

Identical requests share an in-flight call and are cached by request plus
model. The cache and daily counters reset when the process restarts. The API
reports dollar cost as `null` (unknown), not zero, because provider pricing is
not hardcoded into this repository.

## Evaluation contract

`POST /api/rescore` accepts
`priority_foregrounds.rescore_request/v1` and returns
`priority_foregrounds.rescore_result/v1`.

The server:

1. bounds request bytes, queue size, IDs, fields, and text lengths;
2. treats queue contents as untrusted data inside the model prompt;
3. requires every expected initiative ID exactly once;
4. requires integer scores from 1 through 5 and a non-empty reason;
5. attaches prompt, queue, request, and result hashes plus model provenance;
6. changes no browser scores unless the browser independently validates the
   same complete-set contract.

The API accepts only same-origin localhost browser requests. Do not bind the
development server publicly without adding real authentication, TLS, durable
budgets, and an external rate limiter.

## Tests

The focused suite uses only the standard library:

```bash
python3 -m unittest discover -s tests -v
```

It covers strict request validation, fail-closed score normalization, hashes,
default-off behavior, model-specific caching, concurrent request coalescing,
daily budgets, prompt-injection boundaries, HTTP security, and the UI contract.

## Repository map

```text
priority_foregrounds/rescore.py  Structured evaluator and budget controls
priority_foregrounds/server.py   Localhost HTTP and static-file server
web/index.html                   Workbench structure
web/styles.css                   Responsive visual system
web/app.js                       Priority model and browser interactions
tests/                           Focused standard-library tests
```

## Design invariants

- AI proposes; the operator decides.
- A missing score invalidates the whole proposed column.
- Recorded provenance travels with accepted model output.
- Unknown cost remains unknown.
- The 100-point budget is exact and every principle remains addressable.
- Reordering happens only after release so controls do not move under a pointer.

