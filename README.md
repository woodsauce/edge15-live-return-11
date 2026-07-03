# Edge15 Money Tools 14

BTC 15-minute prediction-market decision assistant.

## Version file

`edge15-money-tools-14.zip`

## What is new in version 10

- Performance Tracker now counts official tracker-locked calls only.
- No official lock = skipped.
- Each completed ladder shows lock source minute and lock type.
- Main auto record includes lock minute, profile, source, confidence, flip risk, and final result.
- Live market chart now shows about 5 minutes instead of a few seconds.
- Keeps Entry Minute Tracker, 6m Priority Mode, Timing Engine, Learning Engine, last 10 ladders, and checkpoint accuracy.

## Tracker rule

A prediction is counted in Performance Tracker only after the app creates an official tracker lock.
The main lock is biased toward the 6-minute window, with early/late locks allowed only when the signal is strong enough.

## Deploy settings on Vercel

- Framework Preset: Other
- Build Command: blank
- Output Directory: .
- Install Command: npm install
- Root Directory: ./

## Run tests

```bash
npm test
```

## Notes

This app does not place real trades. It is a decision and tracking assistant.



## Version 14 Money Tools

Built from Edge15 Under Balance 13. Kept the existing decision engine intact and added money-management tools requested after v13 testing:

- Expected Value filter for active calls.
- No-Bet Expensive Odds rule that blocks official locks when known odds are too expensive or EV is negative.
- 10m Elite Lock, allowed only for unusually clean 10-minute setups.
- Cash Out Alert, strict/high-only, for locked calls that show strong flip evidence.
- Profit by lock type.
- Would-Have-Won Tracker for skipped ladders.

Skipped by request: side-specific betting-rule changes, Best Bet / No Bet label, bankroll protection, and strict odds freshness enforcement.
