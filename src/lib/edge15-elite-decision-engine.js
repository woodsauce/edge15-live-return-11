/**
 * Edge15 Elite Decision Engine - V3
 *
 * Purpose
 * - Restore Genesis-027-style selectivity after the V24 regression.
 * - Keep money score, odds price, payout, and profit VISUAL ONLY.
 * - Never block a trade because the payout is small, odds are expensive, or profit is low.
 * - Block only for accuracy/safety problems: weak chart proof, unstable setup, high flip risk,
 *   weak cushion, stale/mismatched market data, disabled lock types, or no-entry lock types.
 *
 * Import:
 *   import { evaluateEliteDecision } from './lib/edge15-elite-decision-engine.js';
 */

export const EDGE15_ELITE_VERSION = 'Genesis-027-Restore-Elite-003';

export const ELITE_GUARDRAILS = Object.freeze({
  mode: 'accuracy_first_fast_entry',

  // Accuracy rules. These are intentionally strict because the V24 failure was false confidence.
  minChartScore: { OVER: 72, UNDER: 68 },
  minSuccessChance: { OVER: 72, UNDER: 70 },
  minStability: 80,
  maxFlipRisk: { OVER: 38, UNDER: 40 },
  minEntryQuality: 82,

  // Money/profit is display-only. Do not add moneyScore, EV, payout, or odds-price blockers.
  moneyScorePolicy: 'visual_only_never_blocks_trade',
  profitPolicy: 'any_positive_profit_is_acceptable_if_accuracy_guardrails_pass',

  // Source freshness still matters because stale/mismatched market data can cause the wrong call.
  maxOddsAgeSec: 20,

  // Lock behavior from tracker regression review.
  disabledMoneyLocks: ['10m genesis elite lock'],
  noEntryLocks: ['late proof lock · no-entry'],
  emergencyLockName: 'genesis emergency money lock',

  // Cushion policy. Usable cushion was too weak in the losing V24 records.
  allowedCushionTiers: ['strong'],
  usableCushionPolicy: 'watch_only_unless_emergency',

  // Recent performance deploy guard. This should warn/tighten; it should not hide the UI.
  minRecentTradeWinRate: 90,
  minRecentTradeSample: 20,

  // Temporary anti-OVER-bias guard from the V24 loss pattern.
  overBiasGuard: true,
});

const BAD_GRADES = new Set(['C', 'D', 'F', 'NONE', '']);
const WARN_GRADES = new Set(['B']);

function norm(value) {
  return String(value ?? '').trim().toLowerCase();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function upper(value, fallback = '') {
  return String(value ?? fallback).trim().toUpperCase();
}

function getOfficial(record) {
  return record?.officialCall || record?.lock || record || {};
}

function getLockSource(record) {
  const official = getOfficial(record);
  return norm(official.source || record?.callSource || record?.checkpoint || '');
}

function getSide(record) {
  const official = getOfficial(record);
  return upper(official.choice || official.action || record?.choice || record?.recommendation || 'SKIP', 'SKIP');
}

function getChartSignals(official) {
  return official.chartSignals || official.genesisGate?.chartSignal || {};
}

function getChartScore(official, side) {
  const signals = getChartSignals(official);
  if (side === 'OVER') return num(signals.overScore ?? signals.score, 0);
  if (side === 'UNDER') return num(signals.underScore ?? signals.score, 0);
  return num(signals.score, 0);
}

function getOddsPercent(official) {
  const mv = official.moneyValue || {};
  const lr = official.liveReturn || {};
  return num(mv.oddsPercent ?? lr.oddsPercent, 0);
}

function isEmergencyLock(lockSource) {
  return lockSource.includes(ELITE_GUARDRAILS.emergencyLockName);
}

export function getRecentWinRate(recentOfficialRecords = [], sampleSize = ELITE_GUARDRAILS.minRecentTradeSample) {
  const settled = recentOfficialRecords
    .filter((r) => r?.result === 'win' || r?.result === 'loss')
    .slice(-sampleSize);

  if (settled.length < sampleSize) {
    return { available: false, sample: settled.length, wins: settled.filter((r) => r.result === 'win').length, losses: settled.filter((r) => r.result === 'loss').length, winRate: null };
  }

  const wins = settled.filter((r) => r.result === 'win').length;
  const losses = settled.length - wins;
  return { available: true, sample: settled.length, wins, losses, winRate: (wins / settled.length) * 100 };
}

/**
 * Replaces the bad fixed 96.5% probability with a conservative calibrated estimate.
 * This number is for display and confidence ranking. It does not decide payout/EV.
 */
export function calibratedWinProbability(record, recentOfficialRecords = []) {
  const official = getOfficial(record);
  const side = getSide(record);
  const lock = getLockSource(record);
  const cushionTier = norm(official.cushion?.tier);
  const chartScore = getChartScore(official, side);
  const stability = num(official.stability, 0);
  const flipRisk = num(official.flipRisk, 100);
  const successChance = num(official.genesisGate?.successChance, 0);
  const entryQuality = num(official.entryQuality, 0);

  let base = 68;

  if (lock.includes('emergency money')) base = 92;
  else if (lock.includes('8m genesis early')) base = 86;
  else if (lock.includes('6m genesis money')) base = 80;
  else if (lock.includes('10m genesis elite')) base = 66;
  else if (lock.includes('late proof')) base = 70;

  if (cushionTier === 'strong') base += 5;
  if (cushionTier === 'usable') base -= 6;
  if (cushionTier === 'huge') base -= lock.includes('10m') ? 8 : 2;

  if (ELITE_GUARDRAILS.overBiasGuard && side === 'OVER') base -= 3;
  if (chartScore >= 76) base += 3;
  if (chartScore < 70) base -= 8;
  if (stability >= 92) base += 2;
  if (stability < 80) base -= 12;
  if (flipRisk > 40) base -= 12;
  if (successChance >= 75) base += 2;
  if (successChance < 70) base -= 6;
  if (entryQuality >= 88) base += 2;
  if (entryQuality < 82) base -= 6;

  const recent = getRecentWinRate(recentOfficialRecords);
  if (recent.available && recent.winRate < ELITE_GUARDRAILS.minRecentTradeWinRate) base -= 4;

  return Math.max(45, Math.min(94, Math.round(base * 10) / 10));
}

function getFreshnessState(official) {
  const oddsAge = num(official.moneyValue?.oddsAgeSec ?? official.liveReturn?.oddsAgeSec, 999);
  const freshFlag = official.liveReturn?.fresh !== false;
  const tickerMatch = official.liveReturn?.tickerMatch !== false;
  return {
    oddsAge,
    freshOdds: freshFlag && oddsAge <= ELITE_GUARDRAILS.maxOddsAgeSec,
    tickerMatch,
  };
}

export function evaluateEliteDecision(record, recentOfficialRecords = []) {
  const official = getOfficial(record);
  const side = getSide(record);
  const lock = getLockSource(record);
  const reasons = [];
  const warnings = [];

  if (!official || side === 'SKIP' || side === 'NONE') {
    return {
      action: 'SKIP',
      choice: side,
      grade: 'NO_TRADE',
      probability: null,
      reasons: ['No official money-ready lock.'],
      warnings,
      moneyDisplay: getMoneyDisplay(record),
    };
  }

  const checkpoint = num(official.checkpoint ?? record?.checkpointMinute, null);
  const grade = upper(official.genesisGate?.tradeGrade || '', '');
  const stability = num(official.stability, 0);
  const flipRisk = num(official.flipRisk, 100);
  const entryQuality = num(official.entryQuality, 0);
  const successChance = num(official.genesisGate?.successChance, 0);
  const chartScore = getChartScore(official, side);
  const cushionTier = norm(official.cushion?.tier);
  const { oddsAge, freshOdds, tickerMatch } = getFreshnessState(official);
  const oddsPercent = getOddsPercent(official);
  const emergency = isEmergencyLock(lock);
  const calibratedProbability = calibratedWinProbability(record, recentOfficialRecords);
  const recent = getRecentWinRate(recentOfficialRecords);
  const moneyDisplay = getMoneyDisplay(record);

  // Lock-type blockers.
  if (ELITE_GUARDRAILS.disabledMoneyLocks.some((x) => lock.includes(x))) {
    reasons.push('10m Genesis elite lock is preview-only until live results prove it can beat 90% over a meaningful sample.');
  }

  if (ELITE_GUARDRAILS.noEntryLocks.some((x) => lock.includes(x))) {
    reasons.push('Late proof lock is labeled no-entry; it can confirm direction but cannot create a money entry.');
  }

  // Accuracy blockers.
  if (BAD_GRADES.has(grade)) reasons.push(`Trade grade ${grade || 'unknown'} is not allowed.`);
  if (WARN_GRADES.has(grade) && side === 'OVER') warnings.push('B-grade OVER requires extra proof because recent losses were OVER calls fading UNDER.');
  if (stability < ELITE_GUARDRAILS.minStability) reasons.push(`Stability ${stability} is below ${ELITE_GUARDRAILS.minStability}.`);
  if (flipRisk > ELITE_GUARDRAILS.maxFlipRisk[side]) reasons.push(`Flip risk ${flipRisk} is above ${ELITE_GUARDRAILS.maxFlipRisk[side]} for ${side}.`);
  if (entryQuality < ELITE_GUARDRAILS.minEntryQuality) reasons.push(`Entry quality ${entryQuality} is below ${ELITE_GUARDRAILS.minEntryQuality}.`);
  if (successChance < ELITE_GUARDRAILS.minSuccessChance[side]) reasons.push(`Success chance ${successChance} is below ${ELITE_GUARDRAILS.minSuccessChance[side]} for ${side}.`);
  if (chartScore < ELITE_GUARDRAILS.minChartScore[side]) reasons.push(`Chart score ${chartScore} is below ${ELITE_GUARDRAILS.minChartScore[side]} for ${side}.`);

  // Data-quality blockers. This is not about profit; it is about avoiding a call on stale/wrong market data.
  if (!freshOdds) reasons.push(`Market odds are stale or missing (${oddsAge}s).`);
  if (!tickerMatch) reasons.push('Kalshi ticker does not match the active market.');

  // Cushion blocker.
  if (!emergency && !ELITE_GUARDRAILS.allowedCushionTiers.includes(cushionTier)) {
    reasons.push(`Cushion tier '${cushionTier || 'unknown'}' is watch-only; only strong cushion is money-ready unless emergency lock is active.`);
  }

  // Performance warning, not a hard block for an individual trade.
  if (recent.available && recent.winRate < ELITE_GUARDRAILS.minRecentTradeWinRate) {
    warnings.push(`Recent ${recent.sample}-trade win rate is ${recent.winRate.toFixed(1)}%; elite mode should tighten and reduce trade count.`);
  }

  // MONEY/PAYOUT WARNINGS ONLY. These do not block.
  if (oddsPercent >= 95 && moneyDisplay.available) {
    warnings.push(`Payout is small because odds are ${oddsPercent}%. This is visual only and does not block a valid accuracy setup.`);
  }

  const blocked = reasons.length > 0;

  return {
    action: blocked ? 'SKIP' : side,
    choice: side,
    grade: blocked ? 'WATCH_ONLY' : emergency ? 'ELITE_EMERGENCY' : 'ELITE_READY',
    probability: calibratedProbability,
    lockSource: lock,
    checkpoint,
    chartScore,
    successChance,
    stability,
    flipRisk,
    entryQuality,
    cushionTier,
    oddsAgeSec: oddsAge,
    oddsPercent,
    moneyDisplay,
    reasons: blocked ? reasons : ['Elite accuracy guardrails passed. Money score/profit was display-only.'],
    warnings,
  };
}

/**
 * Money display helper. This is safe to use in UI panels.
 * Never use this return value as a blocker for evaluateEliteDecision().
 */
export function getMoneyDisplay(record) {
  const official = getOfficial(record);
  const lr = official.liveReturn || record?.liveReturn || {};
  const mv = official.moneyValue || record?.moneyValue || {};
  const rr = record?.realizedReturn || {};

  const stake = num(lr.stake ?? rr.stake, null);
  const oddsPercent = num(mv.oddsPercent ?? lr.oddsPercent, null);
  const multiplier = num(lr.multiplier ?? mv.multiplier, null);
  const winReturn = num(lr.winReturn, null);
  const winProfit = num(lr.winProfit ?? mv.winProfit, null);
  const expectedProfit = num(mv.expectedProfit, null);
  const evPercent = num(mv.evPercent, null);

  return {
    available: Boolean(lr.available || mv.available || rr.available),
    visualOnly: true,
    stake,
    oddsPercent,
    multiplier,
    winReturn,
    winProfit,
    expectedProfit,
    evPercent,
    label: Number.isFinite(winProfit) ? `Visual payout: +$${winProfit.toFixed(2)} if correct` : 'Visual payout unavailable',
    note: 'Money score, payout, odds price, and profit do not block a valid accuracy setup.',
  };
}

export function shouldDeployBuild({ latestWinRate, previousWinRate, sampleSize, minSample = 20 }) {
  const reasons = [];
  if (sampleSize < minSample) reasons.push(`Sample size ${sampleSize} is below ${minSample}.`);
  if (latestWinRate < 90) reasons.push(`Latest win rate ${latestWinRate}% is below 90%.`);
  if (previousWinRate && latestWinRate < previousWinRate - 3) reasons.push(`Regression detected: ${latestWinRate}% vs prior ${previousWinRate}%.`);
  return { allowDeploy: reasons.length === 0, reasons };
}

/**
 * Convenience adapter: use this if your existing app already creates an officialCall object.
 */
export function attachEliteDecision(record, recentOfficialRecords = []) {
  const eliteDecision = evaluateEliteDecision(record, recentOfficialRecords);
  return {
    ...record,
    eliteDecision,
    eliteVersion: EDGE15_ELITE_VERSION,
    recommendation: eliteDecision.action,
    choice: eliteDecision.action === 'SKIP' ? 'SKIP' : eliteDecision.choice,
  };
}
