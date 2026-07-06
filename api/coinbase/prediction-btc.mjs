import { parseCoinbasePredictionPage } from '../../lib/coinbase-predictions.mjs';
import { resolveOfficialBtc15mMarket } from '../../lib/official-market-data.mjs';

const KALSHI_BASE = 'https://external-api.kalshi.com/trade-api/v2';
const KALSHI_URLS = [
  `${KALSHI_BASE}/markets?series_ticker=KXBTC15M&status=open&limit=100`,
  `${KALSHI_BASE}/markets?series_ticker=KXBTC15M&limit=100`
];
const COINBASE_SOURCE_URLS = [
  'https://www.coinbase.com/predictions/crypto/BTC/15%20min',
  'https://www.coinbase.com/predictions/crypto/15%20min',
  'https://www.coinbase.com/predictions/crypto/BTC'
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const now = Date.now();
  const attempts = [];

  for (const url of KALSHI_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'Edge15DecisionEngine/1.9 official-target-fetcher (+https://vercel.com)'
        }
      });
      const text = await response.text();
      attempts.push({ source: 'kalshi', url, status: response.status, bytes: text.length });
      if (!response.ok) continue;
      const json = JSON.parse(text);
      const official = resolveOfficialBtc15mMarket(json, now);
      if (official?.targetVerified && official?.ticker) {
        const coinbaseCheck = await tryCoinbaseCrossCheck(official, attempts, now);
        return res.status(200).json({
          ...official,
          fetchedAt: new Date(now).toISOString(),
          dataStatus: 'VERIFIED',
          targetAuthority: 'official_kxbtc15m',
          crossCheck: coinbaseCheck,
          attempts
        });
      }
    } catch (error) {
      attempts.push({ source: 'kalshi', url, error: error.message });
    }
  }

  for (const url of COINBASE_SOURCE_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0 Edge15DecisionEngine/1.9 official-target-fetcher (+https://vercel.com)'
        }
      });
      const html = await response.text();
      attempts.push({ source: 'coinbase_page', url, status: response.status, bytes: html.length });
      if (!response.ok) continue;
      const parsed = parseCoinbasePredictionPage(html, now);
      const closeMs = Date.parse(parsed?.closeTime || '');
      const verifiedTicker = parsed?.ticker && String(parsed.ticker).startsWith('KXBTC15M-');
      const currentWindow = Number.isFinite(closeMs) && closeMs > now - 45_000 && closeMs <= now + 16.5 * 60_000;
      if (parsed?.targetPrice && verifiedTicker && parsed.closeTimeSource === 'ticker' && currentWindow) {
        return res.status(200).json({
          ...parsed,
          official: true,
          targetVerified: true,
          source: 'coinbase_page_kx_verified',
          sourceLabel: 'Coinbase KXBTC15M page with verified event ticker',
          dataStatus: 'VERIFIED',
          targetAuthority: 'official_kxbtc15m_page',
          fetchedAt: new Date(now).toISOString(),
          attempts
        });
      }
    } catch (error) {
      attempts.push({ source: 'coinbase_page', url, error: error.message });
    }
  }

  return res.status(503).json({
    ok: false,
    dataStatus: 'PREVIEW_ONLY',
    error: 'No verified KXBTC15M official target was available. Edge15 v24 refuses to create a local target for official decisions.',
    attempts
  });
}

async function tryCoinbaseCrossCheck(official, attempts, now) {
  for (const url of COINBASE_SOURCE_URLS.slice(0, 2)) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'user-agent': 'Mozilla/5.0 Edge15DecisionEngine/1.9 target-cross-check (+https://vercel.com)'
        }
      });
      const html = await response.text();
      attempts.push({ source: 'coinbase_cross_check', url, status: response.status, bytes: html.length });
      if (!response.ok) continue;
      const parsed = parseCoinbasePredictionPage(html, now);
      if (!parsed?.targetPrice) continue;
      const targetDelta = Math.abs(Number(parsed.targetPrice) - Number(official.targetPrice));
      const tickerMatch = parsed.ticker && official.ticker && String(parsed.ticker).toUpperCase() === String(official.ticker).toUpperCase();
      const closeMatch = parsed.closeTime && official.closeTime && Math.abs(Date.parse(parsed.closeTime) - Date.parse(official.closeTime)) <= 60_000;
      return {
        checked: true,
        source: 'coinbase_page',
        ticker: parsed.ticker || null,
        targetPrice: parsed.targetPrice,
        targetDelta: Math.round(targetDelta * 100) / 100,
        tickerMatch: Boolean(tickerMatch),
        closeMatch: Boolean(closeMatch),
        status: targetDelta <= 0.01 || tickerMatch ? 'match_or_same_event' : 'mismatch_warning'
      };
    } catch (error) {
      attempts.push({ source: 'coinbase_cross_check', url, error: error.message });
    }
  }
  return { checked: false, status: 'coinbase_page_unavailable' };
}
