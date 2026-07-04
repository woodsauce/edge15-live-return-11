# Edge15 Genesis Hybrid 17

BTC 15-minute prediction-market decision assistant.

## Version file

`edge15-genesis-hybrid-17.zip`

## What is new in version 17

- Moves Performance Tracker near the top under Current Call / Cash Out Alert.
- Adds a top Tracker Lock Readiness meter.
- Renames the changing prediction display to Live Lean.
- Keeps Tracker Lock as the official frozen call that counts in the tracker.
- Adds a slow flash on the Current Call card when an official Tracker Lock hits.
- Adds optional browser notifications and a short alert tone for tracker locks.
- Adds a Why No Lock line so skipped / waiting states are easier to understand.
- Separates Money Entry Locks from Late Proof Locks in the Performance Tracker.
- Tightens early OVER locks slightly while leaving the strong UNDER gate mostly unchanged.
- Fixes Money Filter so stale or ticker-mismatched odds cannot show Good Value.
- Keeps the Genesis Hybrid 15 core logic, strict live-return tracking, 6m money-entry goal, and late proof tracking.

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


## Version 17 notes

- Saved version 16 before building.
- Added Coinbase Target Authority: official tracker locks require a fresh Coinbase prediction target. Local/manual fallback is warning-only and disables official tracker locks.
- Added Target Source badge near the top.
- Added Tight Market Mode wording only. It does not change prediction behavior.
- Added Why No Lock v2 so all active blockers are shown, including cushion only when cushion is actually a blocker.
- Added Trading Style Overlay: Safe / Cents, Balanced, Value Hunter, Aggressive Value, and Scout. This changes money-entry guidance only; it does not change the official tracker lock engine.
