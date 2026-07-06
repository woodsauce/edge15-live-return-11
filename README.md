# Edge15 Genesis Model Tournament 36 — Clean Tracking Multi-Model Lab

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

- `edge15.clone.tournament36.records.v1`
- `edge15.clone.tournament36.modelRecords.v1`
- `edge15.clone.tournament36.settings.v1`
- `edge15.clone.tournament36.ladders.v1`
- `edge15.clone.tournament36.currentLadder.v1`
- `edge15.clone.tournament36.oddsCache.v1`

## Testing goal

Run at least 25 completed 15-minute windows unless a model takes 2 losses quickly. Export JSON afterward. The best model can then be separated into its own standalone app.

## V36 clean tracking fix

V36 fixes the V35 accounting issue where recovered/backfilled model decisions could blur together with true live locks and the exported tournament summary could disagree with active records. It separates true live model locks from recovered entry-minute locks and builds `tournamentStats` from one source only: active-version auto ladder records and their `tournamentResults`.

Money score, payout, EV, odds age, and odds availability remain display-only.


## V36 clean tracking rules

- `modelLocks` = true live model locks captured while the market is open.
- `recoveredModelLocks` = backfilled locks reconstructed from stored entry-minute snapshots.
- `tournamentResults` marks each model row with `lockType`, `isLiveLock`, and `recoveredFromEntryMinute`.
- Exported `tournamentStats` is built from active-version records only, not a separate stale localStorage list.
- The top header includes a QR code generated from the deployed page URL so the app can be opened quickly on a phone.
