# Edge15 V33 Pro Trader Stack Historical Proxy Replay

V33 is an isolated analyst-bot clone that combines a pro-trader confluence stack with the existing Genesis target/settlement guardrails. The proxy replay uses old Genesis exports only; it cannot fully reproduce live tick tape, Coinbase level2, or Kalshi orderbook deltas.

## Pooled result

| Rule set | Windows | Taken | Wins | Losses | Skips | Accuracy | Trade rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Native old models | 1267 | 667 | 609 | 58 | 600 | 91.3% | 52.6% |
| V31 active proxy | 1267 | 763 | 686 | 77 | 504 | 89.9% | 60.2% |
| V32 regime proxy | 1267 | 734 | 663 | 71 | 533 | 90.3% | 57.9% |
| V33 pro trader proxy | 1267 | 708 | 641 | 67 | 559 | 90.5% | 55.9% |

## Dataset detail

| Dataset | Rule set | Windows | Taken | Wins | Losses | Skips | Accuracy | Trade rate |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Genesis-019 | Native old models | 453 | 238 | 216 | 22 | 215 | 90.8% | 52.5% |
| Genesis-019 | V31 active proxy | 453 | 272 | 243 | 29 | 181 | 89.3% | 60.0% |
| Genesis-019 | V32 regime proxy | 453 | 260 | 233 | 27 | 193 | 89.6% | 57.4% |
| Genesis-019 | V33 pro trader proxy | 453 | 249 | 224 | 25 | 204 | 90.0% | 55.0% |
| Genesis-020 | Native old models | 450 | 236 | 214 | 22 | 214 | 90.7% | 52.4% |
| Genesis-020 | V31 active proxy | 450 | 270 | 241 | 29 | 180 | 89.3% | 60.0% |
| Genesis-020 | V32 regime proxy | 450 | 258 | 231 | 27 | 192 | 89.5% | 57.3% |
| Genesis-020 | V33 pro trader proxy | 450 | 248 | 223 | 25 | 202 | 89.9% | 55.1% |
| Genesis-027 | Native old models | 364 | 193 | 179 | 14 | 171 | 92.7% | 53.0% |
| Genesis-027 | V31 active proxy | 364 | 221 | 202 | 19 | 143 | 91.4% | 60.7% |
| Genesis-027 | V32 regime proxy | 364 | 216 | 199 | 17 | 148 | 92.1% | 59.3% |
| Genesis-027 | V33 pro trader proxy | 364 | 211 | 194 | 17 | 153 | 91.9% | 58.0% |

## V33 rule idea tested

- Uses A+, A, and B+ as primary trade grades.
- Allows B-grade only with Low settlement risk, clean target side, confidence/cushion proof, and a more extreme entry score.
- Blocks C/D/F and High settlement risk.
- Requires the model to already be on the correct side of target.

## Result interpretation

V33 does not beat the old native models on raw accuracy, but it gives a different test shape: a pro-trader confluence clone that remains around the 90% target while trading more than the conservative sniper builds. It should be run side-by-side, not replace the core.
