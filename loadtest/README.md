# GramChain Load Tests (k6)

Validate that the backend can handle realistic traffic before exposing to real users.

## Prerequisites

- Install k6: <https://k6.io/docs/get-started/installation/>
  - Windows: `choco install k6` or `winget install k6 --source winget`
  - macOS: `brew install k6`

## Scenarios

| File | What it tests | Target |
|---|---|---|
| `health.js` | `/health` endpoint cold path | p95 < 200ms @ 100 RPS |
| `auth.js` | OTP send → verify hot path | p95 < 800ms @ 30 RPS |
| `credit-score.js` | Credit score (cached + refresh) | p95 < 400ms cached, < 2s refresh |

## Running

```powershell
# Set the target host (defaults to local dev)
$env:BASE_URL = "https://your-staging.up.railway.app"

# Health smoke test
k6 run loadtest/health.js

# Full auth flow
k6 run loadtest/auth.js

# Credit score
k6 run loadtest/credit-score.js
```

## Interpreting results

- **`http_req_duration p(95)`** — 95th percentile latency
- **`http_req_failed`** — error rate (must be < 1% for pass)
- **`checks`** — assertion success rate (must be 100%)

If any scenario fails the thresholds, the run exits with code 99.
