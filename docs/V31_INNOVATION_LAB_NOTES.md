# V31 Innovation Lab Notes

## Why this clone exists

The core objective is not just maximum accuracy. It is the best tradeoff between:

1. As many correct 15-minute period predictions as possible.
2. As early as possible, ideally around 6 minutes remaining.
3. At least 90% official-call win rate.

V28 and V29 protected accuracy but live testing showed too many skips. V30 fixed some activity blockers, but this clone pushes further while staying isolated from the core app.

## Innovation path being tested

### 1. Regime-first decisioning

The app should decide whether the window is trend, chop, reversal, or squeeze before deciding OVER/UNDER. The current clone approximates this with chart score, target crosses, cushion velocity, RSI exhaustion, and Genesis agreement.

### 2. 6-minute primary read

The 6m read should be the main trade point. This clone expands that window and accepts noisier stability when cushion and trend proof are strong.

### 3. Late second-chance catch

If the 6m read is skipped, the app gets one more chance from 4m to 2m only if the signal cleans up.

### 4. Data isolation

Each clone gets separate storage keys so tracker data does not mix.

## What is not yet fully implemented

The next major leap is true live microstructure:

- Coinbase WebSocket trade/tape stream
- Kalshi WebSocket orderbook/trade stream
- Orderbook imbalance and odds velocity
- Deterministic event-driven replay using orderbook/trade streams
- Online calibration learner that updates thresholds by regime

This clone prepares for that by separating lab results from core results.
