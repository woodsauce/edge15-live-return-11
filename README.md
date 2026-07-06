# Edge15 Core V30 Private Daily App

Simplified standalone private-use build for the Core V30 model: Genesis Live Balanced with the 6-minute read and late catch logic.

## What this build is

- Daily-use Core V30 app, not a 10-model tournament.
- One official current call: OVER, UNDER, WAIT, or SKIP.
- Cleaner mobile-first visuals.
- QR code header that points to the deployed Vercel URL using `window.location.href`.
- Isolated V37 local tracker storage so this build does not mix with older Core V30 or tournament data.
- Money, odds, payout, and EV remain display-only and do not block valid locks.

## Core model logic preserved

The decision engine is still the Core V30 style:

- 6m Genesis Balanced Read Lock.
- 4m Genesis Balanced Confirmation Lock.
- 4m–2m Second-Chance Balanced Lock.
- 4m–2m Live Balanced Catch Lock.
- 8m and 10m paths stay preview/scout-only.
- Snapback/exhaustion guard remains active.
- C/D/F trades remain blocked.
- B-grade can pass only with cleaner proof, strong cushion, and risk support.

## Storage keys

This build uses isolated localStorage keys:

```text
edge15.corev30.private37.records.v1
edge15.corev30.private37.settings.v1
edge15.corev30.private37.ladders.v1
edge15.corev30.private37.currentLadder.v1
edge15.corev30.private37.oddsCache.v1
```

## Deploy

Upload this folder to GitHub and deploy it on Vercel. No build step is required. After deploy, the QR code at the top will point to that live Vercel page.

## Test result

The package test suite should be run with:

```bash
npm test
```
