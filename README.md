# Edge15 Genesis Hybrid 20

BTC 15-minute Coinbase/Kalshi prediction assistant.

## Version 20 changes

- Keeps the verified KXBTC15M target authority: no official lock, money guidance, cash-out alert, or scoring from LOCAL/generated targets.
- Adds the Chart Signal Layer for earlier chart reads: 1-minute candle context, EMA 9/21/50 trend, VWAP pressure, 15s/30s/60s/3m momentum, RSI slope, volatility state, target-cross count, and cushion velocity.
- Weights the Chart Signal Layer into the Genesis gate as a 25% confirmation/protection layer. Genesis remains the main decision engine.
- Adds Chart Signal display inside Current Call.
- Adds earlier Cash Out Watch logic using cushion velocity, chart conflict, momentum against the official lock, and near-target deterioration.
- Keeps Trading Style Overlay working only from verified official target data.

## Install / deploy

Upload the extracted contents to the repo root and deploy on Vercel as a static app with serverless API routes.

## Safety rule

No verified KXBTC15M target means preview only. The app must not create official locks or score wins/losses from local targets.
