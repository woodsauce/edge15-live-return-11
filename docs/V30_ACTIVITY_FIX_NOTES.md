# Edge15 V30 Activity Fix Notes

Problem found in live use:

- V28: 1 win / 0 losses / 10 skips.
- V29: appeared to be following the same path, 0 wins / 0 losses / 4 skips.
- Historical replay expected about a 50% trade rate, so live behavior was too tight.

Root cause:

The replay proxy could not fully model live-only blockers. In live use, odds availability/age, elite chart score, elite stability, and elite flip-risk gates were blocking too many otherwise usable 6-minute reads.

V30 changes:

1. Odds/money are display-only.
   - No odds available does not block a prediction lock.
   - Stale odds do not block a prediction lock.
   - Money score, profit, payout, and EV remain visual only.

2. 6m read is now truly Balanced.
   - It can pass with noisy stability if Genesis direction, target side, cushion, and chart support are aligned.
   - It no longer requires huge-only cushion; strong cushion can pass.

3. Late catch added.
   - If 6m skips and the signal cleans up later, a 4m-2m live balanced catch lock can fire.

4. Safety still kept.
   - 8m and 10m stay preview-only.
   - C/D/F stay blocked.
   - Snapback/exhaustion guard remains active.
   - Too many target crosses remain blocked.

Test suite: 18 passed / 0 failed.
