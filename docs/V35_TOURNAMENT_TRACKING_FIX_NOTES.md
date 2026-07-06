# V35 Tournament Tracking Fix

## Problem found in the uploaded V34 export

The uploaded V34 tournament export showed `modelLocks: {}` for all active V34 records. Because no per-model locks were stored, the scoreboard treated every model as:

- action: SKIP
- result: skipped
- source: no model lock

That means the tournament dashboard was not measuring 10 real model decisions. It was defaulting missing locks to skips.

## Fixes in V35

1. Added live fallback model-lock capture.
   - If the primary tournament logic does not create a lock but the live read clearly meets a model's practical thresholds, the model records a fallback lock.
   - This keeps the tournament from silently showing all skips when the base read has a valid OVER/UNDER state.

2. Added settlement recovery from stored entry-minute snapshots.
   - If a ladder settles with `modelLocks` empty, V35 reconstructs model locks from the saved entry-minute snapshots before scoring the models.
   - This prevents missing locks from becoming automatic skips.

3. Kept money rules unchanged.
   - Money score, payout, EV, odds age, and odds availability remain display-only.
   - They do not block valid model locks.

4. New isolated storage namespace.
   - V35 uses `edge15.clone.tournament35.*` keys so it does not mix with V34 data.

## What to watch

V35 is a tracking fix, not a final prediction model. Its job is to correctly show and store what each internal model would do.

After 10-25 completed windows, export JSON and compare:

- model wins
- model losses
- model skips
- lock minute
- model trade rate
- which model locks too early
- which model avoids bad windows

