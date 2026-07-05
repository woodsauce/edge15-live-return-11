# Edge15 Elite V3 Package

This is a self-contained recovery/upgrade package for Edge15 after the V24 regression.

It includes:

- Elite decision engine V3
- Money display helper where money score/profit is visual-only
- Regression test helpers
- Integration example
- Old-version browser data exporter
- Known Genesis-027 storage keys
- Upgrade/recovery documentation

## Important

This is a complete drop-in package, not a full rebuilt app repo. If your GitHub repo files were deleted, re-add these files to the repo and wire the decision engine into the current decision flow.

Recommended repo placement:

```text
src/lib/edge15-elite-decision-engine.js
src/lib/edge15-money-display.js
src/lib/edge15-regression-test.js
src/config/edge15-elite-config.json
tools/edge15-devtools-storage-exporter.js
tools/edge15-known-storage-keys.json
docs/EDGE15_ELITE_UPGRADE_PLAN.md
docs/OLD_VERSION_DATA_RECOVERY.md
```

## Integration

After your existing app creates a candidate official call, run:

```js
import { evaluateEliteDecision } from './src/lib/edge15-elite-decision-engine.js';

const eliteDecision = evaluateEliteDecision(candidateRecord, recentOfficialRecords);

if (eliteDecision.action === 'SKIP') {
  // Show WATCH ONLY / SKIP and display eliteDecision.reasons
} else {
  // Show official OVER/UNDER trade-ready call
}
```

## Money score rule

Money score, payout, odds price, EV, and profit are display-only.

They must not block a trade. A trade is blocked only for accuracy/safety reasons.

## Old high-win-rate version data

Use:

```text
tools/edge15-devtools-storage-exporter.js
```

Open the old app, paste the script into DevTools Console, and upload the downloaded JSON.
