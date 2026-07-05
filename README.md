# Edge15 Genesis Balanced 28

BTC 15-minute Coinbase/Kalshi prediction assistant with replay-gated Genesis Balanced defaults.

## Version 28 changes

V28 is built from the V27 package, but changes the default from ultra-strict Sniper behavior to **Genesis Balanced** based on replay results from Genesis-019, Genesis-020, Genesis-027, and the recent V25 tracker failure.

### Main decision changes

- Default behavior: **Genesis Balanced**.
- V27-style strict behavior is preserved conceptually as Sniper/Safety benchmark, but no longer acts as the only default path.
- 8m and 10m early locks stay **scout/preview-only**.
- 6m balanced money lock can fire when replay guardrails pass.
- 4m balanced confirmation lock can fire if 6m was too early but the setup becomes clean.
- B-grade can now pass only when:
  - settlement risk is Low
  - cushion is strong
  - chart confirmation is stronger
  - Genesis success clears the B-grade minimum
- C/D/F grades are blocked.
- Money score, profit, payout, EV, and odds price are display-only. They do not block a valid accuracy setup.
- Oversold/overbought snapback guard remains active.

## Replay results

See:

- `docs/V28_REPLAY_GATE_RESULTS.md`
- `docs/V28_REPLAY_GATE_RESULTS.csv`

Replay summary:

| Rule set | Combined taken | Wins | Losses | Skips | Accuracy |
|---|---:|---:|---:|---:|---:|
| V27 Sniper proxy | 539 | 496 | 43 | 728 | 92.0% |
| V28 Genesis Balanced default | 634 | 576 | 58 | 633 | 90.9% |
| V28 Action candidate | 655 | 593 | 62 | 612 | 90.5% |

V28 Balanced was selected because it gives back trade frequency while staying around the 90% replay target. The Action candidate was not selected because it dropped under 90% on Genesis-019 and Genesis-020.

## Run locally

```bash
npm install
npm test
npm start
```

## Deploy

Push this folder to GitHub and deploy on Vercel. No build step is required beyond the included Vercel config.
