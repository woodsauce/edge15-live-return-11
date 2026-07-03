# Edge15 Genesis Hybrid 15

BTC 15-minute prediction-market decision assistant.

## Version file

`edge15-genesis-hybrid-15.zip`

## What is new in version 15

- Adds a Genesis-style directional entry score gate.
- Uses a 6-minute money-entry deadline as the main normal lock.
- Allows 10-minute and 8-minute early locks only when the Genesis gate and cushion tools agree.
- Keeps late huge-cushion locks as prediction/tracker proof, but labels them as no-entry locks.
- Adds time-adjusted cushion scoring so required cushion changes by time left.
- Separates prediction confidence from bet value. Expensive odds warn, but do not block tracker lock.
- Excludes stale or ticker-mismatched Coinbase odds from Net / ROI.
- Keeps the version 13 UNDER gate and version 14 money tools.

## Tracker rule

A prediction is counted in Performance Tracker only after the app creates an official tracker lock.
No official lock = skipped.

## Money-entry rule

The main money-entry window is 6 minutes or earlier. Late proof locks can still track whether the model was right, but they should not be treated as a good entry point.

## Deploy settings on Vercel

- Framework Preset: Other
- Build Command: blank or `npm run vercel-build`
- Output Directory: .
- Install Command: npm install
- Root Directory: ./

## Run tests

```bash
npm test
```

## Notes

This app does not place real trades. It is a decision and tracking assistant.
