# Edge15 Genesis Elite 27

BTC 15-minute Coinbase/Kalshi prediction assistant with Genesis-027-style elite regression safeguards.

## What this package is

This is a complete launchable repo/package based on the uploaded `edge15-genesis-hybrid-24` app, with the elite regression updates merged directly into the live app flow.

Upload these extracted files to GitHub and deploy on Vercel.

## Version 27 changes

- Restores stricter Genesis-027-style selectivity after the V24 regression.
- Sets active tracker lock version to `25`.
- Keeps money score, payout, odds cost, EV, and profit **display-only**.
- Never blocks a valid accuracy setup just because profit is small or odds are expensive.
- Disables `10m genesis elite lock` as a money-entry lock. It is now preview-only.
- Keeps `late proof lock · no-entry` as watch-only/no-entry.
- Tightens `6m genesis money lock` and `8m genesis early lock`.
- Requires stronger OVER proof because recent V24 losses were mostly OVER calls fading UNDER.
- Requires strong cushion for normal money locks. Usable cushion is watch-only unless emergency conditions are met.
- Replaces the fixed 96.5% display probability with a conservative calibrated estimate.
- Tightens the first 3-minute scout for better accuracy:
  - higher confidence,
  - higher stability,
  - lower flip risk,
  - strong cushion,
  - chart support by side,
  - Genesis agreement,
  - fresh matching odds.
- Includes old-version browser storage recovery tools in `tools/`.
- Includes elite upgrade/recovery notes in `docs/`.
- Includes regression analysis helper in `lib/edge15-regression-test.mjs`.

## Important money rule

Money score is visual only.

The app should only block a call for prediction-quality/data-quality reasons:

- weak chart confirmation,
- low stability,
- high flip risk,
- weak cushion,
- stale/mismatched odds data,
- disabled lock type,
- no-entry lock type,
- weak Genesis success/risk profile.

Small profit is still profit and does not block a trade.

## Deploy

1. Extract this ZIP.
2. Upload all files to the GitHub repo root.
3. Deploy on Vercel.
4. Vercel should use the included `vercel.json` and `package.json`.

## Test locally

```bash
npm install
npm test
```

## Optional cloud sync

For shared phone/PC history, configure one of these Vercel environment variable pairs:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

If those are missing, the app still works locally and shows `Tracker: local`.

## Old high-win-rate version data recovery

Open the old app in the same browser/profile where it showed the high win rate, then paste this file into DevTools Console:

```text
tools/edge15-devtools-storage-exporter.js
```

It should download a JSON file if the old app saved data in browser storage. Upload that JSON for analysis.


## Header/version display fix

Visible app header updated to Version 27 / Genesis Elite. The prior package already had TRACKER_LOCK_VERSION = 25 in app.js, but index.html still displayed the old Version 24 text.


## V27 Hotfix

This build disables the 8m Genesis early lock as an official money-entry path and leaves it as preview/watch-only. The V25 tracker export showed the only V25 loss came from the 8m early-lock path, so V27 routes official trades through stricter emergency and 6m money-lock conditions only.

V27 also adds an exhaustion/snapback guard. Extreme RSI plus heavy one-sided momentum is treated as reversal risk, not as confirmation. This directly addresses the V25 UNDER loss where RSI was near 1 and the market snapped back over the target.

Money score, profit, odds price, and EV remain display-only and do not block otherwise valid accuracy setups.
