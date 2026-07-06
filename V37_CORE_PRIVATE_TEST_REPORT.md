# V37 Core V30 Private Daily App — Test Report

## Build

- Package: `edge15-genesis-core-v30-private-daily-use-37.zip`
- Purpose: simplified daily-use Core V30 app, not a tournament build.
- Core model: V30 Genesis Live Balanced with 6m Read + Late Catch.
- Tracking version/storage: V37 isolated local storage.

## Verification

```text
node --check app.js passed
npm test: 18 passed / 0 failed
```

## Notes

- Same Core V30 decision shape is preserved.
- Visuals are simplified for phone use.
- QR header generates from the deployed Vercel URL using `window.location.href`.
- Money/odds/profit/EV stay display-only and do not block valid locks.
