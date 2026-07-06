# Edge15 V34 Model Tournament Historical Proxy Replay

This is a proxy replay using old Genesis exports. It does not contain full live tick tape/orderbook history, so it cannot perfectly replay the browser logic. It uses the fields available in those exports: entry score, confidence, trade grade, settlement risk, distance at commit, and resolved outcome.

## Pooled summary

| Model | Taken | Wins | Losses | Skips | Accuracy | Trade rate |
|---|---:|---:|---:|---:|---:|---:|
| Trend Follow | 436 | 404 | 32 | 831 | 92.7% | 34.4% |
| V33 Pro Trader | 680 | 618 | 62 | 587 | 90.9% | 53.7% |
| Odds Pressure | 675 | 612 | 63 | 592 | 90.7% | 53.3% |
| Core V30 | 567 | 514 | 53 | 700 | 90.7% | 44.8% |
| V32 Regime | 727 | 658 | 69 | 540 | 90.5% | 57.4% |
| Late Catch | 762 | 685 | 77 | 505 | 89.9% | 60.1% |
| V31 Active | 760 | 683 | 77 | 507 | 89.9% | 60.0% |
| Meta Judge | 746 | 671 | 75 | 521 | 89.9% | 58.9% |
| 6m Commit | 744 | 669 | 75 | 523 | 89.9% | 58.7% |
| Snapback Guard | 290 | 249 | 41 | 977 | 85.9% | 22.9% |

## Dataset-level summary

| Dataset | Model | Taken | W-L | Skips | Accuracy | Trade rate |
|---|---|---:|---:|---:|---:|---:|
| Genesis-019 | Core V30 | 200 | 180-20 | 253 | 90.0% | 44.2% |
| Genesis-019 | V31 Active | 271 | 242-29 | 182 | 89.3% | 59.8% |
| Genesis-019 | V32 Regime | 258 | 232-26 | 195 | 89.9% | 57.0% |
| Genesis-019 | V33 Pro Trader | 242 | 219-23 | 211 | 90.5% | 53.4% |
| Genesis-019 | 6m Commit | 264 | 236-28 | 189 | 89.4% | 58.3% |
| Genesis-019 | Late Catch | 272 | 243-29 | 181 | 89.3% | 60.0% |
| Genesis-019 | Trend Follow | 154 | 142-12 | 299 | 92.2% | 34.0% |
| Genesis-019 | Snapback Guard | 102 | 86-16 | 351 | 84.3% | 22.5% |
| Genesis-019 | Odds Pressure | 241 | 217-24 | 212 | 90.0% | 53.2% |
| Genesis-019 | Meta Judge | 265 | 237-28 | 188 | 89.4% | 58.5% |
| Genesis-020 | Core V30 | 199 | 179-20 | 251 | 89.9% | 44.2% |
| Genesis-020 | V31 Active | 269 | 240-29 | 181 | 89.2% | 59.8% |
| Genesis-020 | V32 Regime | 257 | 231-26 | 193 | 89.9% | 57.1% |
| Genesis-020 | V33 Pro Trader | 241 | 218-23 | 209 | 90.5% | 53.6% |
| Genesis-020 | 6m Commit | 262 | 234-28 | 188 | 89.3% | 58.2% |
| Genesis-020 | Late Catch | 270 | 241-29 | 180 | 89.3% | 60.0% |
| Genesis-020 | Trend Follow | 153 | 141-12 | 297 | 92.2% | 34.0% |
| Genesis-020 | Snapback Guard | 100 | 84-16 | 350 | 84.0% | 22.2% |
| Genesis-020 | Odds Pressure | 240 | 216-24 | 210 | 90.0% | 53.3% |
| Genesis-020 | Meta Judge | 263 | 235-28 | 187 | 89.4% | 58.4% |
| Genesis-027 | Core V30 | 168 | 155-13 | 196 | 92.3% | 46.2% |
| Genesis-027 | V31 Active | 220 | 201-19 | 144 | 91.4% | 60.4% |
| Genesis-027 | V32 Regime | 212 | 195-17 | 152 | 92.0% | 58.2% |
| Genesis-027 | V33 Pro Trader | 197 | 181-16 | 167 | 91.9% | 54.1% |
| Genesis-027 | 6m Commit | 218 | 199-19 | 146 | 91.3% | 59.9% |
| Genesis-027 | Late Catch | 220 | 201-19 | 144 | 91.4% | 60.4% |
| Genesis-027 | Trend Follow | 129 | 121-8 | 235 | 93.8% | 35.4% |
| Genesis-027 | Snapback Guard | 88 | 79-9 | 276 | 89.8% | 24.2% |
| Genesis-027 | Odds Pressure | 194 | 179-15 | 170 | 92.3% | 53.3% |
| Genesis-027 | Meta Judge | 218 | 199-19 | 146 | 91.3% | 59.9% |

## How to use this

Run the live V34 app through at least 25 completed windows. Export JSON. The leaderboard inside the app will show which model has the best actual live win rate and trade rate. The best model can then be split into its own standalone app.
