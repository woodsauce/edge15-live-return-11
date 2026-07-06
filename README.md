# Edge15 Genesis Model Tournament 35 — Multi-Model Lab

This is an isolated clone tournament build. It runs 10 internal models side by side inside one deployed app, with separate per-model locks and per-model scoring.

## Models included

1. Core V30
2. V31 Active
3. V32 Regime
4. V33 Pro Trader
5. 6m Commit
6. Late Catch
7. Trend Follow
8. Snapback Guard
9. Odds Pressure
10. Meta Judge

## Permanent rule

If any model reaches a valid official lock point, it locks and displays the pick. Money score, payout, profit, EV, odds age, and odds availability are display-only and do not block a valid prediction lock.

## Isolated storage

This clone uses separate storage keys and will not contaminate V30/V31/V32/V33 data:

- `edge15.clone.tournament35.records.v1`
- `edge15.clone.tournament35.modelRecords.v1`
- `edge15.clone.tournament35.settings.v1`
- `edge15.clone.tournament35.ladders.v1`
- `edge15.clone.tournament35.currentLadder.v1`
- `edge15.clone.tournament35.oddsCache.v1`

## Testing goal

Run at least 25 completed 15-minute windows unless a model takes 2 losses quickly. Export JSON afterward. The best model can then be separated into its own standalone app.

## V35 tracking fix

V35 fixes the V34 tournament issue where all 10 models could show as skipped because no per-model `modelLocks` were stored. It adds live fallback lock capture and settlement recovery from stored entry-minute snapshots.

Money score, payout, EV, odds age, and odds availability remain display-only.
