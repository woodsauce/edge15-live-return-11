# Edge15 Genesis Hybrid 19

Version 19 is a target-authority hotfix. It removes LOCAL-BTC15M from official decision-making and requires a verified KXBTC15M official target before tracker locks, money guidance, cash-out alerts, or win/loss scoring can occur.

## What changed from v18

- Added a server-side official market fetcher using Kalshi/Coinbase KXBTC15M market data.
- Blocks local/generated targets from official tracker locks.
- Blocks money guidance and Trading Style Overlay recommendations until a verified target is loaded.
- Blocks cash-out alerts until the target is verified.
- Blocks win/loss scoring for unverified local windows.
- Keeps local BTC window data only as preview metadata, never as an official target.
- Adds parser tests for official target extraction.

## Data rule

No verified official KXBTC15M target = no official lock, no money guidance, no cash-out alert, and no official win/loss score.
