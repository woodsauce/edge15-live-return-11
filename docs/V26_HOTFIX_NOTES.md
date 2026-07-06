# Edge15 Genesis Elite 26 Hotfix

This hotfix addresses the V25 tracker export failure.

## What failed in V25

The active V25 export contained only two V25 official money locks: one win and one loss. The loss came from the `8m genesis early lock` path on an UNDER call. The setup looked strong on normal confirmation metrics, but it was actually an exhaustion/snapback trap: RSI was pinned near 1 with heavy downside momentum, then price reversed and finished OVER.

## What V26 changes

- `8m genesis early lock` is now preview/watch-only.
- `10m genesis elite lock` remains preview/watch-only.
- Late proof locks remain no-entry/watch-only.
- Official money locks now require stricter chart score, success chance, flip risk, and entry quality.
- New exhaustion/snapback guard blocks trades when RSI is pinned extremely overbought/oversold with heavy one-sided momentum.
- Scout is tightened with the same snapback logic.
- Money score, profit, EV, and odds price remain display-only and do not block accuracy-valid trades.

## Practical effect

V26 should take fewer official locks. That is intentional. The goal is to rebuild toward 90%+ accuracy by removing failure paths, not by forcing more predictions.
