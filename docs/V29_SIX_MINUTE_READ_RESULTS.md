# Edge15 V29 Six-Minute Read Replay Notes

V29 keeps Genesis Balanced as the default but adds a controlled 6-minute read lock and a 4m-2m second-chance lock.

## What changed from V28

- 8m and 10m early locks remain preview-only.
- 6 minutes remaining is now the main decision point.
- A new `6m genesis balanced read lock` can fire when the setup has huge cushion/trend proof even if the stability meter is noisy.
- A new `4m-2m second-chance balanced lock` can fire only after the signal cleans up late.
- Money score, profit, EV, payout, and odds price remain display-only.
- Snapback/exhaustion guard remains active.

## Historical proxy replay

This is a simplified replay using the Genesis performance exports. It uses fields available in those exports: direction, entryScore, confidence, tradeGrade, settlementRisk, distanceAtCommit, and final outcome. It cannot fully reproduce live chart/cushion/odds fields, so it is a proxy, not a full browser replay.

| Dataset | Native model | V29 proxy taken | V29 proxy W-L | V29 proxy accuracy |
|---|---:|---:|---:|---:|
| Genesis-019 export | 216-22 / 238 | 224 | 202-22 | 90.2% |
| Genesis-020 export | 214-22 / 236 | 223 | 201-22 | 90.1% |
| Genesis-027 export | 179-14 / 193 | 193 | 177-16 | 91.7% |

## Recent V28 active sample review

Actual V28 active result: **1 win, 0 losses, 6 skips**.

V29 was built to address the missed usable windows without reopening the bad 8m/10m path:

- The 01:15 skipped OVER winner matches the new 6m read concept: huge cushion, B grade, Low risk, Genesis agreement, VWAP support, and 6m timing.
- The 00:15 skipped loss stays blocked because it came from a 10m-style setup with too many target crosses and insufficient V29 cushion quality.
- The 01:00 winner remains valid.
- The 00:00 and 00:45 skipped winners had strong same-window legacy 6m/7m proof and should have a better chance of being caught if the signal is still valid at 6m.

Expected behavior: more active than V28, still less loose than V23/V24.
