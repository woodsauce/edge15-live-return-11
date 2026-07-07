# V38 Master Machine Test Report

Build: `edge15-genesis-master-machine-38-full-launch.zip`

## Implemented

- Top-of-app V38 Master record card near the live market/current call area.
- QR code retained and generated from the deployed URL.
- Official locked pick always displays as `LOCK OVER` or `LOCK UNDER`.
- Current-call box flashes once when a new official lock is captured.
- Core V30 remains the base candidate engine.
- Added V38 Master confirmation/veto layer:
  - V33 Pro Trader sensor
  - V32 Regime sensor
  - Trend Follow sensor
  - Odds Pressure sensor
  - Snapback Guard veto
  - Chop/Target Cross veto
  - OVER Protection Gate
- Renamed the misleading 6m money lock to a confirmed lock path.
- Isolated V38 tracker/localStorage keys.
- Export includes `masterModelVersion: 38`.

## Local checks

- `node --check app.js`: passed
- `node --check lib/decision-engine.mjs`: passed
- `npm test`: 18 passed / 0 failed
- Duplicate HTML id check: passed

## Notes

V38 is designed to be stricter on weak OVER calls, especially 6m read OVER calls that have low chart score, target chop, over-exhaustion, mixed/down trend pressure, or insufficient confirmation.
