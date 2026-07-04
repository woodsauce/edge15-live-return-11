# Edge15 Genesis Hybrid 18

Hotfix based on Genesis Hybrid 17.

## What changed from v17

- Reverted Coinbase Target Authority from a hard blocker to a warning-only badge.
- Restored v16-style tracker lock/readiness behavior.
- Trading Style Overlay now works even when Coinbase target authority is not confirmed.
- Target Source still warns when target is local/manual/unverified.
- Why No Lock v2 still lists real blockers and includes target warnings as warnings, not blockers.
- Core v16/v17 Genesis lock logic remains otherwise unchanged.

## Why

The public Coinbase target scrape can fail or become stale, so v17 could incorrectly block readiness and money guidance. V18 keeps the useful warning while avoiding false blocking.
