# Edge15 Genesis Pro Trader Stack 33 — Analyst Bot Clone

This is an isolated clone of the Edge15 core app. It is designed to test a professional trader / bot-style confluence model without replacing or corrupting the core app.

## Main objective

Win/predict as many BTC 15-minute periods as possible, predict them as soon as possible, and keep the official-call win rate at or above 90%.

## Permanent lock rule

When the app reaches a valid official lock point, it must lock and show the pick visually. Money score, payout, expected value, profit size, odds age, and odds availability are display-only and should not block a valid prediction lock.

## Clone isolation

This clone uses its own localStorage namespace:

- `edge15.clone.protrader33.records.v1`
- `edge15.clone.protrader33.settings.v1`
- `edge15.clone.protrader33.ladders.v1`
- `edge15.clone.protrader33.currentLadder.v1`
- `edge15.clone.protrader33.oddsCache.v1`

It will not mix tracker results with the core app, V31 Innovation Lab, or V32 Regime Lab.

## What is different

V33 tests a pro-trader confluence stack, not just looser thresholds:

- VWAP side support.
- EMA trend structure.
- MACD-style momentum filter.
- RSI regime filter.
- Bollinger/ATR volatility context.
- Momentum stack across 15s, 30s, 60s, and 3m.
- Tick-tape pressure proxy from Coinbase ticks.
- Prediction-market odds pressure proxy from Kalshi/Coinbase odds samples.
- Chop filter based on target crosses.
- Exhaustion/snapback guard.
- Genesis target/settlement guardrails.

## Entry behavior

- 8m and 10m remain preview-only.
- Main official lock window is roughly 7.5m to 2.5m remaining.
- A+, A, and B+ are allowed when the stack agrees.
- B is allowed only with Low settlement risk and enough indicator/cushion proof.
- C, D, F, and High-risk setups remain blocked.
- Late lock opportunities are still allowed if the stack cleans up.

## Historical proxy replay

Replay files are included:

- `docs/V33_PRO_TRADER_STACK_HISTORICAL_PROXY_REPORT.md`
- `docs/V33_PRO_TRADER_STACK_HISTORICAL_PROXY_REPLAY.csv`
- `docs/V33_PRO_TRADER_STACK_POOLED.csv`

The replay uses old Genesis exports. It cannot fully reproduce live Coinbase tick tape or Kalshi orderbook deltas, but it can test the decision shape against old resolved outcomes.

## Deployment

Deploy as a separate Vercel project, for example:

`edge15-pro-trader-stack-33`

Do not overwrite the core project.
