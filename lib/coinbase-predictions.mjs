const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11
};

export function parseCoinbasePredictionPage(html, now = Date.now()) {
  const source = String(html || '');
  const text = htmlToText(source);
  const targetMatch = text.match(/BTC\s+15\s*min\s*[·\-–—]?\s*\$?([0-9][0-9,]*(?:\.\d+)?)\s*target/i);
  if (!targetMatch) {
    return null;
  }

  const targetPrice = Number(targetMatch[1].replace(/,/g, ''));
  const ticker = chooseBestTicker(source, now) || chooseBestTicker(text, now);
  const closeTime = ticker ? parseKx15mCloseTime(ticker) : nextQuarterHour(now);
  const closeTimeSource = ticker ? 'ticker' : 'derived_next_15m_boundary';
  const segment = text.slice(targetMatch.index, Math.min(text.length, targetMatch.index + 450));
  const fallback = extractSidePercents(segment);
  let yesPrice = Number.isFinite(fallback.yesPrice) ? fallback.yesPrice : extractPercent(segment, 'Yes');
  let noPrice = Number.isFinite(fallback.noPrice) ? fallback.noPrice : extractPercent(segment, 'No');
  if (!Number.isFinite(yesPrice) && Number.isFinite(noPrice)) yesPrice = Math.max(1, 100 - noPrice);
  if (!Number.isFinite(noPrice) && Number.isFinite(yesPrice)) noPrice = Math.max(1, 100 - yesPrice);
  const volume = extractVolume(segment);

  return {
    ok: true,
    source: 'coinbase_predictions',
    title: `BTC 15 min · $${targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} target`,
    ticker,
    targetPrice,
    yesPrice,
    noPrice,
    volume,
    closeTime: new Date(closeTime).toISOString(),
    closeTimeSource,
    fetchedAt: new Date(now).toISOString()
  };
}

export function parseKx15mCloseTime(ticker) {
  const match = String(ticker || '').match(/KXBTC15M-(\d{2})([A-Z]{3})(\d{2})(\d{2})(\d{2})/i);
  if (!match) return null;
  const [, yy, mon, dd, hh, mm] = match;
  const month = MONTHS[mon.toUpperCase()];
  if (month === undefined) return null;
  return Date.UTC(2000 + Number(yy), month, Number(dd), Number(hh), Number(mm), 0, 0);
}

export function nextQuarterHour(now = Date.now()) {
  const quarter = 15 * 60 * 1000;
  let next = Math.ceil(now / quarter) * quarter;
  if (next - now < 5000) next += quarter;
  return next;
}

function chooseBestTicker(source, now) {
  const tickers = [...String(source || '').matchAll(/KXBTC15M-[0-9]{2}[A-Z]{3}[0-9]{6}/gi)]
    .map((match) => match[0].toUpperCase());
  const unique = [...new Set(tickers)];
  if (!unique.length) return null;

  const scored = unique.map((ticker) => {
    const close = parseKx15mCloseTime(ticker);
    const delta = close ? close - now : Number.POSITIVE_INFINITY;
    return { ticker, close, delta };
  }).filter((item) => Number.isFinite(item.delta));

  const active = scored
    .filter((item) => item.delta > -90_000 && item.delta < 17 * 60_000)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  if (active.length) return active[0].ticker;

  const future = scored
    .filter((item) => item.delta > 0)
    .sort((a, b) => a.delta - b.delta);
  return future[0]?.ticker || scored.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0]?.ticker || null;
}

function extractPercent(text, label) {
  const source = String(text || '');
  const labelMatch = source.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  if (!labelMatch || labelMatch.index == null) return null;
  const labelIndex = labelMatch.index;
  const percentMatches = [...source.matchAll(/(\d{1,3})(?:\.\d+)?%/g)]
    .map((match) => ({ value: Number(match[1]), index: match.index ?? 0 }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0 && item.value < 100);
  const nearest = percentMatches
    .map((item) => ({ ...item, distance: Math.abs(item.index - labelIndex) }))
    .filter((item) => item.distance <= 24)
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest ? nearest.value : null;
}


function extractSidePercents(text) {
  const source = String(text || '');
  const percentages = [...source.matchAll(/(\d{1,3})(?:\.\d+)?%/g)].map((match) => Number(match[1])).filter((n) => Number.isFinite(n) && n > 0 && n < 100);
  const yesIndex = source.search(/yes/i);
  const noIndex = source.search(/no/i);
  if (!percentages.length) return { yesPrice: null, noPrice: null };
  if (percentages.length >= 2) {
    if (yesIndex >= 0 && noIndex >= 0 && noIndex < yesIndex) return { yesPrice: percentages[1], noPrice: percentages[0] };
    return { yesPrice: percentages[0], noPrice: percentages[1] };
  }
  const only = percentages[0];
  if (yesIndex >= 0 && noIndex < 0) return { yesPrice: only, noPrice: Math.max(1, 100 - only) };
  if (noIndex >= 0 && yesIndex < 0) return { yesPrice: Math.max(1, 100 - only), noPrice: only };
  return { yesPrice: null, noPrice: null };
}


function extractVolume(text) {
  const match = String(text || '').match(/\$([0-9,.]+)\s*(K|M)?\s*vol/i);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ''));
  const multiplier = match[2]?.toUpperCase() === 'M' ? 1_000_000 : match[2]?.toUpperCase() === 'K' ? 1_000 : 1;
  return Number.isFinite(base) ? Math.round(base * multiplier) : null;
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/gi, '·')
    .replace(/\s+/g, ' ')
    .trim();
}
