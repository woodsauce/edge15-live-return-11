export const KALSHI_SERIES_TICKER = 'KXBTC15M';

export function centsFromMarketValue(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(String(value).replace(/[$,%]/g, ''));
    if (!Number.isFinite(n)) continue;
    if (n <= 1) return round2(n * 100);
    if (n <= 100) return round2(n);
  }
  return null;
}

export function parseTargetFromOfficialMarket(market = {}, event = {}) {
  const numericFields = [
    market.floor_strike,
    market.cap_strike,
    market.strike,
    market.target,
    market.expiration_value,
    event.floor_strike,
    event.cap_strike,
    event.strike,
    event.target
  ];
  for (const value of numericFields) {
    const n = normalizeTargetNumber(value);
    if (Number.isFinite(n)) return n;
  }

  const objectFields = [market.custom_strike, market.price_ranges, event.custom_strike];
  for (const obj of objectFields) {
    const n = findTargetInObject(obj);
    if (Number.isFinite(n)) return n;
  }

  const textFields = [
    market.title,
    market.subtitle,
    market.sub_title,
    market.yes_sub_title,
    market.no_sub_title,
    market.rules_primary,
    market.rules_secondary,
    market.functional_strike,
    event.title,
    event.sub_title,
    event.subtitle,
    event.strike_period
  ];
  for (const text of textFields) {
    const n = parseTargetFromText(text);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseTargetFromText(text) {
  const source = String(text || '');
  if (!source.trim()) return null;
  const patterns = [
    /BTC\s+15\s*min\s*[·\-–—]?\s*\$?([0-9][0-9,]*(?:\.\d+)?)\s*target/i,
    /\$\s*([0-9][0-9,]*(?:\.\d+)?)\s*target/i,
    /(?:above|over|higher\s+than|greater\s+than|exceed(?:s)?|at\s+or\s+above)\s*\$?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
    /\$\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:or\s+above|or\s+higher|or\s+more)/i,
    /target\s*(?:price)?\s*[:=]?\s*\$?\s*([0-9][0-9,]*(?:\.\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const n = normalizeTargetNumber(match[1]);
    if (Number.isFinite(n)) return n;
  }

  const dollarNumbers = [...source.matchAll(/\$\s*([0-9][0-9,]*(?:\.\d+)?)/g)]
    .map((match) => normalizeTargetNumber(match[1]))
    .filter((n) => Number.isFinite(n));
  const btcLike = dollarNumbers.find((n) => n > 1000 && n < 1000000);
  return Number.isFinite(btcLike) ? btcLike : null;
}

export function parseCloseTimeFromTicker(ticker) {
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const match = String(ticker || '').match(/KXBTC15M-(\d{2})([A-Z]{3})(\d{2})(\d{2})(\d{2})/i);
  if (!match) return null;
  const [, yy, mon, dd, hh, mm] = match;
  const month = months[mon.toUpperCase()];
  if (month == null) return null;
  return Date.UTC(2000 + Number(yy), month, Number(dd), Number(hh), Number(mm), 0, 0);
}

export function normalizeKalshiMarket(rawMarket = {}, rawEvent = {}, now = Date.now()) {
  const market = rawMarket || {};
  const event = rawEvent || {};
  const eventTicker = String(market.event_ticker || event.event_ticker || event.ticker || '').toUpperCase();
  const marketTicker = String(market.ticker || market.market_ticker || '').toUpperCase();
  const ticker = eventTicker || marketTicker;
  if (!ticker.includes(KALSHI_SERIES_TICKER) && !marketTicker.includes(KALSHI_SERIES_TICKER)) return null;

  const targetPrice = parseTargetFromOfficialMarket(market, event);
  if (!Number.isFinite(targetPrice)) return null;

  const closeCandidate = market.close_time || market.expected_expiration_time || market.expiration_time || market.latest_expiration_time || event.strike_date || event.close_time;
  const closeFromField = closeCandidate ? Date.parse(closeCandidate) : null;
  const closeFromTicker = parseCloseTimeFromTicker(eventTicker || marketTicker);
  const closeMs = Number.isFinite(closeFromField) ? closeFromField : closeFromTicker;
  if (!Number.isFinite(closeMs)) return null;

  const yesPrice = centsFromMarketValue(
    market.yes_bid_dollars,
    market.yes_bid,
    market.yes_ask_dollars,
    market.yes_ask,
    market.last_price_dollars,
    market.last_price
  );
  const noPrice = centsFromMarketValue(
    market.no_bid_dollars,
    market.no_bid,
    market.no_ask_dollars,
    market.no_ask,
    Number.isFinite(yesPrice) ? 100 - yesPrice : null
  );
  const title = market.title || event.title || `BTC 15 min · $${targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} target`;

  return {
    ok: true,
    official: true,
    targetVerified: true,
    source: 'kalshi_official',
    sourceLabel: 'Kalshi/Coinbase KXBTC15M official market data',
    ticker: eventTicker || marketTicker,
    eventTicker: eventTicker || null,
    marketTicker: marketTicker || null,
    title: ensureBtcTargetTitle(title, targetPrice),
    targetPrice,
    yesPrice,
    noPrice,
    volume: normalizeVolume(market.volume_fp ?? market.volume ?? market.volume_24h_fp),
    closeTime: new Date(closeMs).toISOString(),
    closeTimeSource: Number.isFinite(closeFromField) ? 'kalshi_market_close_time' : 'kx_ticker_close_time',
    fetchedAt: new Date(now).toISOString(),
    rawStatus: market.status || event.status || null
  };
}

export function chooseActiveOfficialMarket(candidates = [], now = Date.now()) {
  const normalized = candidates
    .map((item) => normalizeKalshiMarket(item.market || item, item.event || {}, now))
    .filter(Boolean)
    .map((item) => ({ ...item, closeMs: Date.parse(item.closeTime) }))
    .filter((item) => Number.isFinite(item.closeMs));

  const active = normalized
    .filter((item) => item.closeMs > now - 45_000 && item.closeMs <= now + 16.5 * 60_000)
    .sort((a, b) => a.closeMs - b.closeMs);
  if (active.length) return stripInternal(active[0]);

  const future = normalized
    .filter((item) => item.closeMs > now)
    .sort((a, b) => a.closeMs - b.closeMs);
  return future.length ? stripInternal(future[0]) : null;
}

export function resolveOfficialBtc15mMarket(payload = {}, now = Date.now()) {
  const candidates = [];
  if (Array.isArray(payload.markets)) candidates.push(...payload.markets.map((market) => ({ market })));
  if (Array.isArray(payload.events)) {
    for (const event of payload.events) {
      if (Array.isArray(event.markets)) {
        for (const market of event.markets) candidates.push({ market, event });
      } else {
        candidates.push({ market: event, event });
      }
    }
  }
  if (payload.event) {
    const event = payload.event;
    if (Array.isArray(event.markets)) {
      for (const market of event.markets) candidates.push({ market, event });
    } else {
      candidates.push({ market: event, event });
    }
  }
  return chooseActiveOfficialMarket(candidates, now);
}

function normalizeTargetNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return findTargetInObject(value);
  const n = Number(String(value).replace(/[$,]/g, '').trim());
  if (!Number.isFinite(n)) return null;
  return n > 1000 && n < 1000000 ? Math.round(n * 100) / 100 : null;
}

function findTargetInObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const directKeys = ['target', 'target_price', 'price', 'strike', 'value', 'floor', 'floor_strike', 'functional_strike'];
  for (const key of directKeys) {
    if (key in obj) {
      const n = normalizeTargetNumber(obj[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  for (const value of Object.values(obj)) {
    const n = typeof value === 'object' ? findTargetInObject(value) : normalizeTargetNumber(value) ?? parseTargetFromText(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeVolume(value) {
  const n = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function ensureBtcTargetTitle(title, targetPrice) {
  const base = String(title || '').trim();
  if (/BTC\s+15\s*min/i.test(base) && /target/i.test(base)) return base;
  return `BTC 15 min · $${targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} target`;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function stripInternal(item) {
  const { closeMs, ...publicItem } = item;
  return publicItem;
}
