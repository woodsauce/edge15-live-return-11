/**
 * Edge15 Money Display Helper
 *
 * Use this only for UI display. Do not use moneyScore, payout, odds price, or EV
 * to block a valid trade. The user's rule is: any positive profit is acceptable
 * if the accuracy guardrails pass.
 */

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildMoneyDisplay({ liveReturn = {}, moneyValue = {}, realizedReturn = {} } = {}) {
  const stake = num(liveReturn.stake ?? realizedReturn.stake, null);
  const oddsPercent = num(moneyValue.oddsPercent ?? liveReturn.oddsPercent, null);
  const multiplier = num(liveReturn.multiplier ?? moneyValue.multiplier, null);
  const winReturn = num(liveReturn.winReturn, null);
  const winProfit = num(liveReturn.winProfit ?? moneyValue.winProfit, null);
  const expectedProfit = num(moneyValue.expectedProfit, null);
  const evPercent = num(moneyValue.evPercent, null);

  return {
    available: Boolean(liveReturn.available || moneyValue.available || realizedReturn.available),
    visualOnly: true,
    stake,
    oddsPercent,
    multiplier,
    winReturn,
    winProfit,
    expectedProfit,
    evPercent,
    headline: Number.isFinite(winProfit)
      ? `Profit if correct: +$${winProfit.toFixed(2)}`
      : 'Profit display unavailable',
    note: 'Display only. Never blocks a valid accuracy setup.'
  };
}
