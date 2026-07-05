# Edge15 Elite V3 Upgrade Plan

## Immediate fix

V24 became too permissive and too confident. The V3 package restores strict selectivity while keeping money/payout display-only.

## What changed in V3

1. Money score is visual only.
2. Low profit never blocks a trade.
3. Expensive odds never block a trade.
4. The app should make the valid decision as soon as accuracy guardrails pass.
5. 10m Genesis elite lock is disabled as a money-entry signal until it proves itself again.
6. Late proof lock remains no-entry.
7. 6m Genesis money lock and 8m Genesis early lock are stricter.
8. Fixed 96.5% win probability is disabled.
9. Usable cushion is watch-only unless emergency lock is active.
10. OVER calls require stronger proof because the recent regression losses were mostly OVER fading UNDER.
11. Anti-regression testing is included so weak versions cannot replace strong versions again.

## Trade-ready rule

TRADE only if:

- Lock type is not disabled.
- Lock type is not no-entry.
- Trade grade is not C/D/F.
- Stability is at least 80.
- Flip risk is at most 38 for OVER or 40 for UNDER.
- Chart score is at least 72 for OVER or 68 for UNDER.
- Success chance is at least 72 for OVER or 70 for UNDER.
- Entry quality is at least 82.
- Cushion is strong, unless emergency lock is active.
- Market data is fresh and ticker matches.

Money score, payout, odds price, and expected profit are shown but do not decide the trade.

## 90%+ path

A 90%+ range is only realistic if the app is willing to skip more trades. The app should favor:

- fewer money calls,
- more watch-only calls,
- cleaner no-trade zones,
- calibrated probability,
- strict source freshness,
- official lock separated from moving preview,
- regression testing before shipping.
