# Edge15 V27 — Genesis-020 Calibration Notes

This build uses the uploaded `Genesis-020` performance export as a calibration model.

## What the Genesis-020 data showed

- 450 completed 15-minute windows.
- 236 taken trades.
- 214 wins and 22 losses on taken trades.
- Taken-trade accuracy: 90.7%.
- 214 skipped / NONE windows.
- OVER and UNDER were balanced: OVER 109/120, UNDER 105/116.

## Rules imported into V27

Genesis-020 is now used as a calibration/veto layer before any official money-entry lock.

Official locks must now pass:

- Genesis-020 directional score calibration:
  - OVER requires entryScore >= 80.
  - UNDER requires entryScore <= 25.
- Approved Genesis-020 grades only:
  - A+, A, B+ are allowed.
  - B, C, D, F are watch-only.
- Genesis success chance >= 80.
- Chart score >= 76 for the selected side.
- Existing stability, flip-risk, cushion, freshness, and target-authority checks.

## Why B grade is watch-only

The uploaded Genesis-020 export showed B-grade trades were materially weaker than A+/A/B+ trades. V27 therefore blocks B-grade official entries even when the chart looks convincing.

## Timing rule

Raw early checkpoints in the Genesis-020 timing lab were not 90%+ reliable:

- 12:00 left: weak
- 10:00 left: weak
- 8:00 left: weak
- 6:00 left: moderate
- 4:00 left: better
- 3:00 left: strongest

V27 keeps 8m and 10m early calls as preview/watch-only. An early official entry now requires an ultra Genesis-020 emergency pattern, extreme score, and extended hold time.

## Money score

Money score, EV, odds price, and profit are still display-only. They do not block valid trades.
