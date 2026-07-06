/**
 * Edge15 Regression Test Helpers
 *
 * Use this before shipping a new build. It reads tracker exports and summarizes
 * wins/losses/skips by version, lock source, side, and cushion tier.
 */

function norm(value) {
  return String(value ?? '').trim().toLowerCase();
}

function key(value) {
  return String(value ?? 'unknown').trim() || 'unknown';
}

function pct(wins, losses) {
  const total = wins + losses;
  return total ? Math.round((wins / total) * 1000) / 10 : null;
}

function add(bucket, group, result) {
  const k = key(group);
  if (!bucket[k]) bucket[k] = { wins: 0, losses: 0, skipped: 0, total: 0, winRate: null };
  bucket[k].total += 1;
  if (result === 'win') bucket[k].wins += 1;
  else if (result === 'loss') bucket[k].losses += 1;
  else bucket[k].skipped += 1;
  bucket[k].winRate = pct(bucket[k].wins, bucket[k].losses);
}

export function analyzeTrackerExport(exportJson) {
  const records = Array.isArray(exportJson?.records) ? exportJson.records : [];
  const summary = {
    exportedAt: exportJson?.exportedAt || null,
    appVersion: exportJson?.appVersion || null,
    overall: { wins: 0, losses: 0, skipped: 0, total: records.length, winRate: null },
    byVersion: {},
    byLockSource: {},
    bySide: {},
    byCushionTier: {},
    flagged: []
  };

  for (const r of records) {
    const result = r.result === 'win' || r.result === 'loss' ? r.result : 'skipped';
    if (result === 'win') summary.overall.wins += 1;
    else if (result === 'loss') summary.overall.losses += 1;
    else summary.overall.skipped += 1;

    const official = r.officialCall || {};
    const version = r.trackerLockVersion || official.trackerLockVersion || exportJson.appVersion || 'unknown';
    const lock = official.source || r.callSource || r.checkpoint || 'no official tracker lock';
    const side = official.choice || official.action || r.choice || r.recommendation || 'SKIP';
    const cushion = official.cushion?.tier || 'unknown';

    add(summary.byVersion, version, result);
    add(summary.byLockSource, lock, result);
    add(summary.bySide, side, result);
    add(summary.byCushionTier, cushion, result);

    if (result === 'loss') {
      summary.flagged.push({
        id: r.id,
        title: r.title,
        version,
        lock,
        side,
        cushion,
        confidence: r.confidence ?? official.confidence,
        stability: r.stability ?? official.stability,
        flipRisk: r.flipRisk ?? official.flipRisk,
        finalSide: r.finalSide,
        finalPrice: r.finalPrice,
        targetPrice: r.targetPrice
      });
    }
  }

  summary.overall.winRate = pct(summary.overall.wins, summary.overall.losses);
  return summary;
}

export function passesEliteDeployGate(summary, baselineWinRate = 90) {
  const reasons = [];
  const winRate = summary?.overall?.winRate ?? 0;
  const taken = (summary?.overall?.wins ?? 0) + (summary?.overall?.losses ?? 0);
  if (taken < 20) reasons.push(`Only ${taken} taken trades; need at least 20 for deploy confidence.`);
  if (winRate < 90) reasons.push(`Taken-trade win rate is ${winRate}%, below 90%.`);
  if (baselineWinRate && winRate < baselineWinRate - 3) reasons.push(`Regression versus baseline: ${winRate}% vs ${baselineWinRate}%.`);
  return { allowDeploy: reasons.length === 0, reasons };
}
