# Edge15 V28 Replay Gate Results

V28 changes the default to **Genesis Balanced**, while keeping V27-style strictness as the safer benchmark.

## Replay input

Uploaded historical exports used:

- Genesis-019 export: file name said Genesis-018 but the export identifies itself as Genesis-019.
- Genesis-020 export.
- Genesis-027 export.
- Recent V25 tracker export for the failed early-lock review.

## Replay summary

| Rule set | Release | Taken | Wins | Losses | Skips | Accuracy |
|---|---:|---:|---:|---:|---:|---:|
| Native model behavior | Genesis-019 | 238 | 216 | 22 | 215 | 90.8% |
| Native model behavior | Genesis-020 | 236 | 214 | 22 | 214 | 90.7% |
| Native model behavior | Genesis-027 | 193 | 179 | 14 | 171 | 92.7% |
| Native model behavior | ALL | 667 | 609 | 58 | 600 | 91.3% |
| V27 Sniper proxy | Genesis-019 | 194 | 178 | 16 | 259 | 91.8% |
| V27 Sniper proxy | Genesis-020 | 193 | 177 | 16 | 257 | 91.7% |
| V27 Sniper proxy | Genesis-027 | 152 | 141 | 11 | 212 | 92.8% |
| V27 Sniper proxy | ALL | 539 | 496 | 43 | 728 | 92.0% |
| V28 Genesis Balanced default | Genesis-019 | 222 | 200 | 22 | 231 | 90.1% |
| V28 Genesis Balanced default | Genesis-020 | 221 | 199 | 22 | 229 | 90.0% |
| V28 Genesis Balanced default | Genesis-027 | 191 | 177 | 14 | 173 | 92.7% |
| V28 Genesis Balanced default | ALL | 634 | 576 | 58 | 633 | 90.9% |
| V28 Action candidate (not default) | Genesis-019 | 230 | 206 | 24 | 223 | 89.6% |
| V28 Action candidate (not default) | Genesis-020 | 229 | 205 | 24 | 221 | 89.5% |
| V28 Action candidate (not default) | Genesis-027 | 196 | 182 | 14 | 168 | 92.9% |
| V28 Action candidate (not default) | ALL | 655 | 593 | 62 | 612 | 90.5% |

## Decision from replay

Default is **V28 Genesis Balanced**:

- Combined replay: **530 wins / 53 losses / 633 skips**.
- Combined taken-trade accuracy: **90.9%**.
- Genesis-027 replay accuracy: **92.7%**.
- Genesis-019 and Genesis-020 stay around the 90% line.

V27 Sniper remains safer but skipped too much in live use:

- Combined replay: **496 wins / 43 losses / 728 skips**.
- Combined taken-trade accuracy: **92.0%**.
- The extra safety cost was 95 more skips than V28 Balanced.

The Action candidate is **not** the default because it falls below 90% on Genesis-019 and Genesis-020.

## V28 rule changes

- Early 8m/10m locks remain scout-only.
- 6m balanced money lock can fire when replay guardrails pass.
- 4m balanced confirmation lock can fire if 6m was too early but the setup becomes clean.
- B-grade is allowed only with Low settlement risk, strong cushion, stronger chart confirmation, and minimum Genesis success.
- C/D/F are blocked.
- Money score, EV, odds price, and payout remain display-only.
- Oversold/overbought snapback guard remains active.

## Why this version should be tested

V27 protected accuracy but was too inactive. V28 intentionally gives back controlled trade frequency without reopening the failed 8m early-lock path.
