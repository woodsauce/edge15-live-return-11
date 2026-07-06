# V36 Tournament Clean Tracking Notes

V36 is a tracking/accounting correction for the 10-model tournament app.

## Why it exists

V34 under-counted model locks because `modelLocks` could remain empty.
V35 recovered locks from stored minute snapshots, but live locks and recovered locks could be blurred together, and the exported tournament summary could disagree with active-version records.

## V36 fixes

- Stores true live model locks in `modelLocks`.
- Stores post-window backfilled locks in `recoveredModelLocks`.
- Marks every model result with `lockType`, `isLiveLock`, and `recoveredFromEntryMinute`.
- Builds `tournamentStats` from active-version auto ladder records only.
- Exports a `tournamentIntegrity` object that shows expected rows, actual rows, live locks, recovered locks, and true skips.
- Adds a QR code section at the top of the app. The QR uses the deployed page URL.

## Strategy status

The 10 model identities are unchanged from V34/V35. This build is not a strategy retune; it is a clean scoring/export fix.
