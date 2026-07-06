# Edge15 Genesis Innovation Lab 31 — Active Clone

This is an isolated clone of the Edge15 core app. It is designed to test a more active path without changing or corrupting the core V30 tracker data.

## Main objective

Win/predict as many BTC 15-minute periods as possible, predict them as soon as possible, and keep the official-call win rate at or above 90%.

## Clone isolation

This clone uses its own localStorage namespace:

- `edge15.clone.innovation31.records.v1`
- `edge15.clone.innovation31.settings.v1`
- `edge15.clone.innovation31.ladders.v1`
- `edge15.clone.innovation31.currentLadder.v1`
- `edge15.clone.innovation31.oddsCache.v1`

It will not mix tracker results with the core app.

## What is different from V30 Core

- V31 is intentionally more active than V30.
- 6m read window expanded to roughly 7m–4m remaining.
- 6m read guard allows noisier stability/flip-risk when cushion, Genesis agreement, and chart support line up.
- B-grade is allowed unless settlement risk is High.
- 4m–2m late catch is easier than V30, but C/D/F still stay blocked.
- 8m and 10m remain preview-only and do not become official money locks.
- Money score, payout, EV, odds age, and profit remain display-only.
- Snapback/exhaustion guard remains active.

## What this clone is testing

This clone tests whether V30/V29 were losing too many winners because the live-only gates were overblocking good 6m reads.

Expected behavior:

- More trades than V28/V29/V30.
- More risk than V30 core.
- Better activity around 6 minutes remaining.
- Still no loose 8m/10m official money entries.

## Test rule

Run this clone side-by-side with V30 Core for at least 25 completed windows unless it takes 2 losses first.

Export both JSON files and compare:

- Official wins
- Official losses
- Skips
- Would-have-won skipped windows
- Scout wins/losses
- Lock source performance

## Deployment

Deploy as a separate Vercel project, for example:

`edge15-innovation-lab-31`

Do not overwrite the core project.
