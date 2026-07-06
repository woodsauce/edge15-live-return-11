# Edge15 Genesis Balanced 29

BTC 15-minute Coinbase/Kalshi prediction assistant with Genesis Balanced defaults, a 6-minute read lock, late second-chance lock, visual-only money score, and scout-only early locks.

## Version 29 changes

V29 is built from V28 after the live tracker showed 1 win, 0 losses, and 6 skips. V28 was safe but still too quiet. V29 keeps the replay guardrails but makes 6 minutes remaining the primary read point.

### Core changes

- 6m read is now the main decision point.
- Added `6m genesis balanced read lock` for huge-cushion/trend setups.
- Added `4m-2m second-chance balanced lock` when a skipped setup cleans up late.
- 8m and 10m early locks remain scout/preview-only.
- C/D/F grades remain blocked.
- B grade is allowed only with Low settlement risk and cleaner proof.
- Money score, odds price, EV, payout, and profit remain display-only.
- Snapback/exhaustion guard remains active.

## Replay / test files

- `docs/V29_SIX_MINUTE_READ_RESULTS.md`
- `docs/V29_SIX_MINUTE_READ_RESULTS.csv`
- Previous V28 replay files remain in `docs/` for comparison.

## Test result

The included test suite passed before packaging:

```text
18 passed / 0 failed
```

## Deploy

Upload the full folder contents to GitHub and deploy with Vercel. This is a static app plus Vercel API routes; no build step is required.
