# Edge15 Genesis Hybrid 21

BTC 15-minute Coinbase/Kalshi prediction assistant.

## Version 21 changes

- Keeps the verified KXBTC15M target authority from v19/v20: no official lock, money guidance, cash-out alert, or scoring from LOCAL/generated targets.
- Keeps the v20 Chart Signal Layer: EMA pressure, VWAP pressure, short-window momentum, RSI slope, volatility state, target-cross count, and cushion velocity.
- Adds Shared Cloud Tracker support for phone/PC sync when Vercel KV/Upstash Redis environment variables are configured.
- Adds a server-backed `/api/cloud/tracker` route to merge and dedupe official KXBTC15M records across devices.
- Keeps local tracker fallback if cloud storage is not configured.
- Tightens Genesis Emergency Money Lock by 10% while keeping the name.
- Adds emergency-lock protection: stable/improving cushion, low target chop, chart score 70+, and non-tiny payout.
- Adds UNDER Opportunity Upgrade: verified UNDER setups with chart support and stable/improving cushion can pass about 7% easier.
- Makes Cash Out Watch earlier, especially after a Genesis Emergency Money Lock.

## Optional cloud sync setup

For shared phone/PC history, configure one of these Vercel environment variable pairs:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

If those are missing, v21 still works locally and shows `Tracker: local`.

## Install / deploy

Upload the extracted contents to the repo root and deploy on Vercel as a static app with serverless API routes.

## Safety rule

No verified KXBTC15M target means preview only. The app must not create official locks or score wins/losses from local targets.
