import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTargetFromText, parseTargetFromOfficialMarket, resolveOfficialBtc15mMarket, parseCloseTimeFromTicker } from '../lib/official-market-data.mjs';

test('parses BTC 15m target wording', () => {
  assert.equal(parseTargetFromText('BTC 15 min · $62,620.20 target'), 62620.20);
  assert.equal(parseTargetFromText('Will BTC be above $62,620.20?'), 62620.20);
  assert.equal(parseTargetFromText('$62,620.20 or above'), 62620.20);
});

test('parses target from official market fields', () => {
  const market = { floor_strike: '62620.20', title: 'Bitcoin above target' };
  assert.equal(parseTargetFromOfficialMarket(market), 62620.20);
});

test('resolves active KXBTC15M official market', () => {
  const now = Date.UTC(2026, 6, 4, 4, 52, 0);
  const payload = {
    markets: [
      {
        ticker: 'KXBTC15M-26JUL040500-T62620',
        event_ticker: 'KXBTC15M-26JUL040500',
        title: 'BTC 15 min · $62,620.20 target',
        close_time: '2026-07-04T05:00:00Z',
        yes_bid_dollars: '0.5600',
        no_bid_dollars: '0.4400',
        volume_fp: '1200'
      }
    ]
  };
  const market = resolveOfficialBtc15mMarket(payload, now);
  assert.equal(market.targetPrice, 62620.20);
  assert.equal(market.ticker, 'KXBTC15M-26JUL040500');
  assert.equal(market.yesPrice, 56);
  assert.equal(market.noPrice, 44);
  assert.equal(market.targetVerified, true);
});

test('parses KX close time', () => {
  assert.equal(new Date(parseCloseTimeFromTicker('KXBTC15M-26JUL040500')).toISOString(), '2026-07-04T05:00:00.000Z');
});
