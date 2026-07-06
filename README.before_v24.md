# Edge15 Genesis Hybrid 23

BTC 15-minute Coinbase/Kalshi prediction assistant.

## Version 23 changes

- Keeps the verified KXBTC15M target authority from v19/v20/v21: no official lock, money guidance, cash-out alert, or scoring from LOCAL/generated targets.

- Contract price / low payout is warning-only and does not block a valid Tracker Lock.
- Adds separate First 3-Minute Scout module for high-risk early signals during the first 3 minutes of each 15-minute market.
- Scout Lock is tracked separately from the main Tracker Lock and does not affect main performance stats.
- Adds Scout performance stats: scout wins, losses, skips, side split, and estimated scout return when fresh odds are available.
- Keeps the v20 Chart Signal Layer: EMA pressure, VWAP pressure, short-window momentum, RSI slope, volatility state, target-cross count, and cushion velocity.
- Keeps v21 local/cloud tracker support. Without KV/Upstash configuration, it still works locally.
- Keeps Genesis Emergency Money Lock tightened by 10% while keeping the name.
- Adds true cushion-collapse cash-out logic:
  - Normal locks: Watch at 45% collapse, Alert at 65% collapse.
  - Genesis Emergency Money Lock: Watch at 35% collapse, Alert at 55% collapse.
- Tightens UNDER Opportunity Upgrade from 7% easier to 5% easier.
- Adds stronger UNDER reversal protection: chart score 72+, stable/improving UNDER cushion, lower target chop, UNDER VWAP support, and no fast push back toward target.
- Improves Balanced money guidance with a stronger tiny-payout warning below about +$0.08 on a $0.50 stake.
- Keeps the Skipped / Would-Have-Won panel for missed signal review.
- Adds a compact post-round lock audit showing lock cushion, lowest cushion, collapse %, and whether the cash-out rule would have warned.

## Optional cloud sync setup

For shared phone/PC history, configure one of these Vercel environment variable pairs:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

If those are missing, v23 still works locally and shows `Tracker: local`.

## Install / deploy

Upload the extracted contents to the repo root and deploy on Vercel as a static app with serverless API routes.

## Safety rule

No verified KXBTC15M target means preview only. The app must not create official locks or score wins/losses from local targets.
