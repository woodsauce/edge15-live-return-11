# Edge15 Genesis Master V38

Private daily-use Edge15 build. This version uses Core V30 as the base candidate engine and adds a master confirmation/veto layer.

## What changed

- Core V30 still proposes the first official candidate.
- V33 Pro Trader, V32 Regime, Trend Follow, and Odds Pressure act as confirmation sensors.
- Snapback Guard, Chop Guard, Target Cross Guard, and the new OVER Protection Gate can veto weak locks.
- The record card is moved to the top of the app near the live market and current call.
- QR code remains at the top and points to the deployed URL.
- Official locked pick is always displayed as `LOCK OVER` or `LOCK UNDER`.
- Current call box flashes once when a new official lock is captured.
- Money, odds, profit, and EV remain display-only.
- V38 uses isolated storage keys so it does not mix with V34/V35/V36/V37 records.

## Main design rule

V38 is not another 10-panel tournament screen. It is one master call with internal sensor votes and vetoes.

## Deploy

Upload this folder/ZIP to Vercel as a new project. The QR code will automatically use `window.location.href` after deployment.

## Test commands

```bash
npm test
node --check app.js
node --check lib/decision-engine.mjs
```
