# Edge15 Genesis Hybrid 24

BTC 15-minute Coinbase/Kalshi prediction assistant.

## Version 24 changes

- Keeps the verified KXBTC15M target authority: no official lock, money guidance, cash-out alert, or scoring from LOCAL/generated targets.
- Adds a clear **Locked Side** banner near the top: `LOCKED SIDE: OVER/UNDER`, `Tracker Lock: Valid`, or live-lean-only when not locked.
- Makes the Trading Style Overlay explicitly **note-only**. Safe/Cents, Balanced, Value Hunter, Aggressive Value, and Scout notes cannot block, change, or hide a valid Tracker Lock.
- Low payout / contract expensive is warning-only. A valid prediction lock still locks and still counts in prediction stats.
- Adds active-version-only Performance Tracker stats for v24 so older v21/v22/v23 records do not pollute the main count.
- Adds All-Time and By-Version stats so older records can still be reviewed separately.
- Adds deduped tracker stats: one counted record per KXBTC15M market per version.
- Splits prediction stats from money-entry stats: late proof/no-entry locks can count as prediction proof but are excluded from money ROI.
- Adds stronger OVER reversal protection: weak/shrinking OVER cushion, too many target crosses, VWAP against OVER, or weak chart support can block OVER locks.
- Reduces excessive UNDER blocking by using a cleaner base UNDER gate while keeping the stricter 5% UNDER Opportunity Upgrade for cushion easing.
- Makes cash-out warnings louder and clearer with yellow Watch, red Alert, notification/beep attempts, and cushion-collapse reasons.
- Keeps the separate First 3-Minute Scout module and Scout stats isolated from main Tracker Lock stats.
- Keeps true cushion-collapse cash-out logic:
  - Normal locks: Watch at 45% collapse, Alert at 65% collapse.
  - Genesis Emergency Money Lock: Watch at 35% collapse, Alert at 55% collapse.
- Keeps Genesis Emergency Money Lock name and 10% tightening.

## Optional cloud sync setup

For shared phone/PC history, configure one of these Vercel environment variable pairs:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

If those are missing, v24 still works locally and shows `Tracker: local`.

## Install / deploy

Upload the extracted contents to the repo root and deploy on Vercel as a static app with serverless API routes.

## Safety rule

No verified KXBTC15M target means preview only. The app must not create official locks or score wins/losses from local targets.
