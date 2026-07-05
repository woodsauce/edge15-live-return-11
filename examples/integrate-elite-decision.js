/**
 * Example integration point.
 *
 * Put evaluateEliteDecision() immediately after your existing app creates a candidate official call,
 * and before the UI shows OVER/UNDER as trade-ready.
 */

import { evaluateEliteDecision } from '../src/lib/edge15-elite-decision-engine.js';

export function applyEliteGuardrails(candidateRecord, recentOfficialRecords) {
  const elite = evaluateEliteDecision(candidateRecord, recentOfficialRecords);

  const moneyPanel = elite.moneyDisplay;

  if (elite.action === 'SKIP') {
    return {
      ...candidateRecord,
      recommendation: 'SKIP',
      choice: 'SKIP',
      eliteDecision: elite,
      uiStatus: 'WATCH ONLY',
      moneyPanel
    };
  }

  return {
    ...candidateRecord,
    recommendation: elite.choice,
    choice: elite.choice,
    eliteDecision: elite,
    uiStatus: elite.grade,
    moneyPanel
  };
}
