import {
  CHECKPOINT_MINUTES,
  PROFILES,
  evaluateDecision,
  createRecord,
  settleRecord,
  summarizeRecords,
  shouldCaptureCheckpoint
} from './lib/decision-engine.mjs';

const APP_VERSION_FILE = 'edge15-genesis-hybrid-20.zip';
const LEARNING_SAMPLE_TARGET = 25;
const STORE_KEY = 'edge15.records.v1';
const SETTINGS_KEY = 'edge15.settings.v1';
const LADDERS_KEY = 'edge15.ladders.v1';
const CURRENT_LADDER_KEY = 'edge15.currentLadder.v1';
const ODDS_CACHE_KEY = 'edge15.oddsCache.v1';
const MAX_TICKS = 900;
const BASE_HOLD_MS = 75_000;
const ENTRY_HOLD_MS = 120_000;
const STRONG_HOLD_MS = 150_000;
const SWITCH_CONFIRM_MS = 22_000;
const COMPLETED_LADDER_LIMIT = 10;
const ENTRY_MINUTES = Array.from({ length: 15 }, (_, index) => 15 - index);
const PRIORITY_PROFILES = ['balanced', 'aggressive', 'no_chase'];
const TRACKER_LOCK_VERSION = 20;
const ASSUMED_STAKE_DOLLARS = 0.50;
const ODDS_FRESH_MS = 90_000;
const MIN_EV_PERCENT = 0;
const EXPENSIVE_ODDS_PERCENT = 86;
const TOO_EXPENSIVE_ODDS_PERCENT = 92;
const MIN_CASH_OUT_SCORE = 5;
const LATE_HUGE_CUSHION_SCORE = 175;
const LOCK_CUSHION_SCORE = 72;
const GENESIS_OVER_SCORE = 75;
const GENESIS_UNDER_SCORE = 25;
const GENESIS_MONEY_LATEST_SEC = 300;
const OVER_EARLY_MIN_CUSHION_SCORE = 90;
const OVER_EARLY_MIN_ENTRY_SCORE = 80;
const OVER_EARLY_MAX_TOTAL_RISK = 58;
const TRADING_STYLES = {
  safe_cents: { label: 'Safe / Cents', minProfit: 0.02, minReadiness: 92, note: 'Accepts small wins when the tracker lock is very strong.' },
  balanced: { label: 'Balanced', minProfit: 0.07, minReadiness: 96, note: 'Default v16-style money guidance. Core tracker stays unchanged from v16.' },
  value_hunter: { label: 'Value Hunter', minProfit: 0.18, minReadiness: 97, note: 'Prefers fewer entries with better payout.' },
  aggressive_value: { label: 'Aggressive Value', minProfit: 0.10, minReadiness: 84, note: 'Allows earlier money-entry ideas before official lock, clearly higher risk.' },
  scout: { label: 'Scout', minProfit: 0.05, minReadiness: 72, note: 'Earliest high-risk idea only. It is not a tracker lock.' }
};
const DEFAULT_TRADING_STYLE = 'balanced';

const state = {
  ticks: [],
  records: loadRecords(),
  ladders: loadLadders(),
  currentLadder: loadCurrentLadder(),
  settings: loadSettings(),
  decision: null,
  rawDecision: null,
  previousRemainingSec: null,
  capturedCheckpoints: {},
  capturedEntryMinutes: loadCurrentLadder()?.entryMinutes || {},
  checkpointHistory: [],
  market: null,
  orderbook: null,
  coinbasePrediction: null,
  localPrediction: null,
  signalHistory: [],
  predictionPriceHistory: [],
  oddsCache: loadOddsCache(),
  heldDecision: null,
  pendingSwitch: null,
  ws: null,
  lastWsMessageAt: 0,
  refreshTimer: null,
  predictionTimer: null,
  countdownTimer: null,
  manualEndAt: loadSettings().manualEndAt || null,
  lastNotifiedLockId: null
};

const $ = (id) => document.getElementById(id);
const fmtMoney = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
const fmtPct = (value) => `${Number(value || 0).toFixed(1)}%`;

init();

function init() {
  hydrateSettings();
  renderProfiles();
  renderLadder();
  renderCompletedLadders();
  renderRecords();
  renderStats();
  renderLadderStats();
  renderLearningEngine();
  renderTimingEngine();
  renderEntryMinuteTracker();
  renderLiveReturnTracker();
  renderMoneyTools();
  renderTradingStyleOverlay();
  renderChartSignalLayer();
  renderProfitByLockType();
  renderWouldHaveWonTracker();
  renderCashOutAlert();
  wireEvents();
  loadCoinbaseCandles();
  connectCoinbase();
  loadCoinbasePrediction(true);
  checkApiHealth();
  startLoops();
  evaluateAndRender();
}

function hydrateSettings() {
  $('targetPrice').value = '';
  $('minutesLeft').value = '';
  state.manualEndAt = null;
  $('refreshSeconds').value = state.settings.refreshSeconds || '3';
  const ticker = $('marketTicker');
  if (ticker) ticker.value = state.settings.marketTicker || '';
  const styleSelect = $('tradingStyleSelect');
  if (styleSelect) styleSelect.value = TRADING_STYLES[state.settings.tradingStyle] ? state.settings.tradingStyle : DEFAULT_TRADING_STYLE;
  const version = $('versionName');
  if (version) version.textContent = APP_VERSION_FILE;
  const targetInput = $('targetPrice');
  if (targetInput) targetInput.readOnly = true;
  const minutesInput = $('minutesLeft');
  if (minutesInput) minutesInput.readOnly = true;
  ['useCurrentAsTarget', 'start15m'].forEach((id) => {
    const btn = $(id);
    if (btn) { btn.disabled = true; btn.title = 'Manual target/time disabled in v20. Official KXBTC15M data required.'; }
  });
}


function renderProfiles() {
  const select = $('profileSelect');
  const entries = [
    ...PRIORITY_PROFILES.map((key) => [key, PROFILES[key]]).filter(([, profile]) => profile),
    ...Object.entries(PROFILES).filter(([key]) => !PRIORITY_PROFILES.includes(key))
  ];
  select.innerHTML = entries.map(([key, profile]) =>
    `<option value="${key}">${profile.label}</option>`
  ).join('');
  select.value = PROFILES[state.settings.profile] ? state.settings.profile : 'balanced';
}

function wireEvents() {
  ['targetPrice', 'profileSelect', 'refreshSeconds', 'marketTicker', 'tradingStyleSelect'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      saveSettingsFromUi();
      if (id === 'refreshSeconds') restartRefreshLoop();
      if (id === 'targetPrice') resetDecisionSession(false);
      evaluateAndRender();
    });
  });
  $('minutesLeft').addEventListener('input', () => {
    const minutes = Number($('minutesLeft').value);
    state.manualEndAt = Number.isFinite(minutes) && minutes > 0 ? Date.now() + minutes * 60000 : null;
    resetDecisionSession(false);
    saveSettingsFromUi();
    evaluateAndRender();
  });
  $('useCurrentAsTarget').addEventListener('click', setTargetFromCurrent);
  $('start15m').addEventListener('click', () => startManualCountdown(15));
  $('resetSession').addEventListener('click', () => resetDecisionSession(true));
  $('recordDecision').addEventListener('click', () => recordCurrentDecision());
  $('skipTrade').addEventListener('click', () => recordCurrentDecision('skip'));
  const refreshPrediction = $('refreshPrediction');
  if (refreshPrediction) refreshPrediction.addEventListener('click', () => loadCoinbasePrediction(false));
  const copyBtn = $('copyVersionName');
  if (copyBtn) copyBtn.addEventListener('click', copyVersionName);
  const alertsBtn = $('enableNotifications');
  if (alertsBtn) alertsBtn.addEventListener('click', enableBrowserAlerts);
  $('exportTracker').addEventListener('click', exportTracker);
  $('clearTracker').addEventListener('click', clearTracker);
}

function startLoops() {
  restartRefreshLoop();
  state.predictionTimer = setInterval(() => loadCoinbasePrediction(true), 15000);
  state.countdownTimer = setInterval(() => {
    updateTimeLeft();
    evaluateAndRender(false);
  }, 1000);
}

function restartRefreshLoop() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  const seconds = Math.max(1, Number($('refreshSeconds').value || 3));
  state.refreshTimer = setInterval(() => evaluateAndRender(), seconds * 1000);
}

async function loadCoinbaseCandles() {
  try {
    const response = await fetch('/api/coinbase/candles?granularity=60&minutes=90', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.candles)) throw new Error(data.error || 'Candle preload failed');

    const preloadTicks = data.candles.flatMap((candle) => ([
      { price: Number(candle.open), ts: Number(candle.ts), volume: Number(candle.volume || 0) / 3, source: 'coinbase-candle-open' },
      { price: Number(candle.high), ts: Number(candle.ts) + 20_000, volume: Number(candle.volume || 0) / 3, source: 'coinbase-candle-high' },
      { price: Number(candle.close), ts: Number(candle.ts) + 59_000, volume: Number(candle.volume || 0) / 3, source: 'coinbase-candle-close' }
    ])).filter((tick) => Number.isFinite(tick.price) && Number.isFinite(tick.ts));

    state.ticks = [...state.ticks, ...preloadTicks]
      .sort((a, b) => a.ts - b.ts)
      .filter((tick, index, arr) => index === 0 || tick.ts !== arr[index - 1].ts || tick.price !== arr[index - 1].price)
      .slice(-MAX_TICKS);

    updateLocalPredictionFromTicks();
    drawSparkline();
    evaluateAndRender(false);
    const debug = $('apiDebug');
    if (debug) debug.textContent = `Loaded ${data.candles.length} Coinbase 1-minute candles for startup context.`;
  } catch (error) {
    const debug = $('apiDebug');
    if (debug) debug.textContent = `Coinbase candle preload failed: ${error.message}. Live WebSocket ticks will still work.`;
  }
}

function connectCoinbase() {
  try {
    if (state.ws) state.ws.close();
    const ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
    state.ws = ws;
    $('coinbaseStatus').textContent = 'Coinbase: connecting';
    $('coinbaseStatus').className = 'pill warn';

    ws.addEventListener('open', () => {
      $('coinbaseStatus').textContent = 'Coinbase: live';
      $('coinbaseStatus').className = 'pill good';
      ws.send(JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD'], channel: 'ticker' }));
      ws.send(JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD'], channel: 'market_trades' }));
    });

    ws.addEventListener('message', (event) => {
      const data = safeJson(event.data);
      const tick = parseCoinbaseTick(data);
      if (tick) {
        addTick(tick);
        state.lastWsMessageAt = Date.now();
        $('coinbaseStatus').textContent = 'Coinbase: live';
        $('coinbaseStatus').className = 'pill good';
        renderMarketBasics();
        drawSparkline();
        evaluateAndRender(false);
      }
    });

    ws.addEventListener('close', () => {
      $('coinbaseStatus').textContent = 'Coinbase: reconnecting';
      $('coinbaseStatus').className = 'pill warn';
      setTimeout(connectCoinbase, 1800);
    });

    ws.addEventListener('error', () => {
      $('coinbaseStatus').textContent = 'Coinbase: error';
      $('coinbaseStatus').className = 'pill bad';
    });
  } catch (error) {
    $('coinbaseStatus').textContent = 'Coinbase: failed';
    $('coinbaseStatus').className = 'pill bad';
  }
}

function parseCoinbaseTick(data) {
  if (!data || data.type === 'subscriptions') return null;
  const candidates = [];
  if (Array.isArray(data.events)) {
    for (const event of data.events) {
      if (Array.isArray(event.tickers)) candidates.push(...event.tickers);
      if (Array.isArray(event.trades)) candidates.push(...event.trades);
      if (Array.isArray(event.candles)) candidates.push(...event.candles);
    }
  }
  candidates.push(data);
  for (const item of candidates) {
    const rawPrice = item.price || item.last_price || item.best_bid || item.best_ask || item.close;
    const price = Number(rawPrice);
    if (Number.isFinite(price) && price > 0) {
      const rawTs = item.time || item.timestamp || data.timestamp || data.time;
      const ts = rawTs ? Date.parse(rawTs) || Date.now() : Date.now();
      const bestBid = Number(item.best_bid ?? item.bid ?? data.best_bid);
      const bestAsk = Number(item.best_ask ?? item.ask ?? data.best_ask);
      const side = String(item.side || item.taker_side || '').toUpperCase();
      return {
        price,
        ts,
        volume: Number(item.volume || item.size || 0),
        source: 'coinbase',
        bestBid: Number.isFinite(bestBid) ? bestBid : null,
        bestAsk: Number.isFinite(bestAsk) ? bestAsk : null,
        spread: Number.isFinite(bestBid) && Number.isFinite(bestAsk) ? Math.max(0, bestAsk - bestBid) : null,
        side: side || null
      };
    }
  }
  return null;
}

function addTick(tick) {
  state.ticks.push(tick);
  if (state.ticks.length > MAX_TICKS) state.ticks = state.ticks.slice(-MAX_TICKS);
  updateLocalPredictionFromTicks();
}

function updateLocalPredictionFromTicks(now = Date.now()) {
  const latest = state.ticks.at(-1);
  if (!latest) return null;
  const windowMs = 15 * 60 * 1000;
  const startAt = Math.floor(now / windowMs) * windowMs;
  const closeAt = startAt + windowMs;
  const currentKey = new Date(closeAt).toISOString();
  const existing = state.localPrediction;
  if (!existing || existing.windowKey !== currentKey) {
    const startTick = state.ticks.find((tick) => tick.ts >= startAt) || latest;
    state.localPrediction = {
      ok: true,
      source: 'local_preview_only',
      title: `PREVIEW ONLY · local BTC open ${fmtMoney(Number(startTick.price))}`,
      ticker: `LOCAL-PREVIEW-BTC15M-${currentKey}`,
      targetPrice: Number(startTick.price),
      yesPrice: null,
      noPrice: null,
      closeTime: new Date(closeAt).toISOString(),
      closeTimeSource: 'local_preview_boundary',
      fetchedAt: new Date(now).toISOString(),
      windowKey: currentKey
    };
  }
  // v20: local/generated targets are preview metadata only. They are never applied
  // to targetPrice, official locks, money guidance, cash-out alerts, or scoring.
  return state.localPrediction;
}

function isVerifiedOfficialPrediction(prediction) {
  if (!prediction?.targetPrice || !prediction?.closeTime) return false;
  const source = String(prediction.source || '').toLowerCase();
  const ticker = String(prediction.ticker || prediction.eventTicker || '').toUpperCase();
  return Boolean(prediction.official || prediction.targetVerified || ['kalshi_official', 'coinbase_page_kx_verified'].includes(source)) && ticker.startsWith('KXBTC15M-');
}

function hasFreshCoinbasePrediction(now = Date.now()) {
  const prediction = state.coinbasePrediction;
  if (!isVerifiedOfficialPrediction(prediction)) return false;
  const close = Date.parse(prediction.closeTime);
  const fetched = Date.parse(prediction.fetchedAt || 0);
  return Number.isFinite(close) && close > now - 45_000 && close - now <= 16.5 * 60 * 1000 && (!Number.isFinite(fetched) || now - fetched < 120_000);
}

function applyPredictionToUi(data, options = {}) {
  if (!data || !Number.isFinite(Number(data.targetPrice))) return;
  if (!isVerifiedOfficialPrediction(data)) return;
  updatePredictionPriceHistory(data);
  const previousKey = [state.market?.ticker, $('targetPrice').value, state.market?.close_time].join('|');
  const nextKey = [data.ticker, data.targetPrice, data.closeTime].join('|');

  state.market = {
    source: data.source || 'kalshi_official',
    ticker: data.ticker || data.eventTicker || 'KXBTC15M-UNKNOWN',
    title: data.title,
    close_time: data.closeTime,
    yes_bid: data.yesPrice,
    no_bid: data.noPrice,
    yesChange: getPredictionPriceContext().yesChange,
    noChange: getPredictionPriceContext().noChange,
    indicativeOnly: false
  };

  state.orderbook = {
    yesPrice: data.yesPrice,
    noPrice: data.noPrice,
    yesChange: getPredictionPriceContext().yesChange,
    noChange: getPredictionPriceContext().noChange,
    source: data.source || 'kalshi_official',
    indicativeOnly: false,
    raw: data
  };

  $('targetPrice').value = String(data.targetPrice);
  const marketTickerEl = $('marketTicker');
  if (data.ticker && marketTickerEl) marketTickerEl.value = data.ticker;
  const remainingMinutes = Math.max(0, (Date.parse(data.closeTime) - Date.now()) / 60000);
  if (Number.isFinite(remainingMinutes)) $('minutesLeft').value = remainingMinutes.toFixed(2);

  if ((options.reset || previousKey !== nextKey) && previousKey !== nextKey) {
    finalizeCurrentLadder('new_window');
    resetDecisionSession(false);
  }
  ensureCurrentLadder();
  if (options.save) saveSettingsFromUi();
  renderMarketBasics();
}

function getRemainingSec() {
  const now = Date.now();
  const preferred = hasFreshCoinbasePrediction(now) ? state.coinbasePrediction : null;
  if (preferred?.closeTime) {
    const parsed = Date.parse(preferred.closeTime);
    if (Number.isFinite(parsed)) {
      const derived = Math.max(0, (parsed - now) / 1000);
      if (derived <= 15 * 60 + 45) return derived;
    }
  }
  if (state.market && isVerifiedOfficialPrediction(state.coinbasePrediction)) {
    const closeTime = parseMarketCloseTime(state.market);
    if (closeTime) {
      const derived = Math.max(0, (closeTime - Date.now()) / 1000);
      if (derived <= 15 * 60 + 45) return derived;
    }
  }
  return 0;
}

function parseMarketCloseTime(market) {
  const fields = ['close_time', 'closeTime', 'expiration_time', 'expected_expiration_time', 'latest_expiration_time'];
  for (const field of fields) {
    if (!market?.[field]) continue;
    const parsed = Date.parse(market[field]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function updateTimeLeft() {
  updateLocalPredictionFromTicks();
  const remaining = getRemainingSec();
  $('timeLeftDisplay').textContent = formatRemaining(remaining);
}

function evaluateAndRender(capture = true) {
  updateLocalPredictionFromTicks();
  const remainingSec = getRemainingSec();
  const targetPrice = Number($('targetPrice').value);
  const profile = $('profileSelect').value;
  const marketContext = { ...(state.market || {}), ...(state.orderbook || {}), ...getMicrostructureContext(), ...getPredictionPriceContext() };
  const rawDecision = evaluateDecision({
    ticks: state.ticks,
    targetPrice,
    timeRemainingSec: remainingSec,
    profile,
    market: marketContext,
    recentDecisions: [...state.signalHistory, ...state.checkpointHistory]
  });
  state.rawDecision = rawDecision;
  rememberSignal(rawDecision);
  const decision = stabilizeDecision(rawDecision);
  state.decision = decision;

  ensureCurrentLadder();
  updateCurrentLadderDecision(decision);
  maybeLockOfficialCall(decision, remainingSec);
  captureEntryMinuteSnapshot(decision, remainingSec);

  if (capture) {
    const cp = shouldCaptureCheckpoint(state.previousRemainingSec, remainingSec, state.capturedCheckpoints);
    if (cp) {
      const checkpointDecision = { ...decision, checkpoint: cp, capturedAt: Date.now() };
      state.capturedCheckpoints[String(cp)] = checkpointDecision;
      state.checkpointHistory.push(checkpointDecision);
      updateCurrentLadderCheckpoint(cp, checkpointDecision);
    }
    state.previousRemainingSec = remainingSec;
  }

  if (remainingSec <= 1) finalizeCurrentLadder('window_closed');

  renderDecision(decision);
  renderLadder();
  renderMarketBasics();
  renderReasons(decision);
  renderIndicators(decision.indicators || {});
  drawSparkline();
}

function rememberSignal(decision) {
  if (!decision?.choice || decision.choice === 'WAIT') return;
  const now = Date.now();
  const last = state.signalHistory.at(-1);
  if (last && now - last.ts < 1200 && last.choice === decision.choice && last.action === decision.action) return;
  state.signalHistory.push({
    choice: decision.choice,
    action: decision.action,
    confidence: Number(decision.confidence) || 0,
    ts: now
  });
  const cutoff = now - 75_000;
  state.signalHistory = state.signalHistory.filter((item) => item.ts >= cutoff).slice(-40);
}

function stabilizeDecision(decision) {
  const now = Date.now();
  const held = state.heldDecision;
  const action = decision.action;
  const isTradeCall = ['OVER', 'UNDER'].includes(action);
  const heldIsTradeCall = held && ['OVER', 'UNDER'].includes(held.action);
  const remainingSec = getRemainingSec();
  const holdMs = remainingSec <= 360 ? STRONG_HOLD_MS : remainingSec <= 600 ? ENTRY_HOLD_MS : BASE_HOLD_MS;

  if (!heldIsTradeCall && isTradeCall) {
    state.pendingSwitch = null;
    state.heldDecision = { ...decision, heldAt: now, updatedAt: now, expiresAt: now + holdMs, bestConfidence: Number(decision.confidence) || 0 };
    return state.heldDecision;
  }

  if (heldIsTradeCall && isTradeCall && action === held.action) {
    state.pendingSwitch = null;
    const bestConfidence = Math.max(Number(held.bestConfidence || held.confidence || 0), Number(decision.confidence || 0));
    state.heldDecision = {
      ...decision,
      heldAt: held.heldAt || now,
      updatedAt: now,
      expiresAt: now + holdMs,
      bestConfidence
    };
    return state.heldDecision;
  }

  if (heldIsTradeCall && isTradeCall && action !== held.action) {
    if (held.expiresAt <= now) {
      state.pendingSwitch = null;
      state.heldDecision = { ...decision, heldAt: now, updatedAt: now, expiresAt: now + holdMs, bestConfidence: Number(decision.confidence) || 0 };
      return state.heldDecision;
    }

    const pending = state.pendingSwitch?.action === action
      ? state.pendingSwitch
      : { action, startedAt: now, strongestConfidence: 0, lowestFlipRisk: 100 };
    pending.strongestConfidence = Math.max(pending.strongestConfidence, Number(decision.confidence || 0));
    pending.lowestFlipRisk = Math.min(pending.lowestFlipRisk, Number(decision.flipRisk || 100));
    state.pendingSwitch = pending;

    const pendingForMs = now - pending.startedAt;
    const confidenceLead = Number(decision.confidence || 0) - Number(held.confidence || 0);
    const flipImprovement = Number(held.flipRisk || 100) - Number(decision.flipRisk || 100);
    const immediateOverride = Number(decision.confidence || 0) >= 90 && Number(decision.flipRisk || 100) <= 24 && confidenceLead >= 14;
    const confirmedSwitch = pendingForMs >= SWITCH_CONFIRM_MS && confidenceLead >= 12 && flipImprovement >= 5;

    if (immediateOverride || confirmedSwitch) {
      state.pendingSwitch = null;
      state.heldDecision = { ...decision, heldAt: now, updatedAt: now, expiresAt: now + holdMs, bestConfidence: Number(decision.confidence) || 0 };
      return state.heldDecision;
    }

    return {
      ...held,
      held: true,
      rawAction: action,
      rawChoice: decision.choice,
      confidence: Math.max(Number(held.confidence || 0) - 1.5, Number(decision.confidence || 0) - 6, 1),
      stability: Math.max(Number(held.stability || 0), Number(decision.stability || 0)),
      flipRisk: Math.min(99, Math.max(Number(held.flipRisk || 0), Number(decision.flipRisk || 0))),
      readiness: `Prediction lock: holding ${held.action}. ${action} must stay stronger for ${Math.max(0, Math.ceil((SWITCH_CONFIRM_MS - pendingForMs) / 1000))} more seconds before switching.`,
      reasons: [
        `Held ${held.action} instead of switching on one noisy update.`,
        ...(decision.reasons || [])
      ]
    };
  }

  if (heldIsTradeCall && !isTradeCall) {
    const canHold = held.expiresAt > now &&
      (decision.choice === held.choice || decision.choice === held.action || Number(decision.confidence || 0) >= Number(held.confidence || 0) - 24) &&
      Number(decision.flipRisk || 100) <= Math.max(Number(held.flipRisk || 0) + 30, 78);

    if (canHold) {
      return {
        ...held,
        held: true,
        rawAction: decision.action,
        rawChoice: decision.choice,
        confidence: Math.max(Number(held.confidence || 0) - 1, Number(decision.confidence || 0), 1),
        stability: Math.max(Number(held.stability || 0), Number(decision.stability || 0)),
        flipRisk: Math.min(99, Math.max(Number(held.flipRisk || 0), Number(decision.flipRisk || 0))),
        readiness: `Prediction lock: holding ${held.action}. The raw engine briefly said ${decision.action}, but the call has not been invalidated yet.`,
        reasons: [
          `Held ${held.action} instead of flickering to ${decision.action}.`,
          ...(decision.reasons || [])
        ]
      };
    }
  }

  if (!isTradeCall) {
    state.pendingSwitch = null;
    state.heldDecision = null;
  }
  return decision;
}

function renderDecision(decision) {
  const action = decision.action || 'WAIT';
  $('mainAction').textContent = action;
  $('mainAction').className = `main-action ${action.toLowerCase()}`;
  $('readiness').textContent = decision.readiness || '';
  $('confidence').textContent = fmtPct(decision.confidence);
  $('stability') && ($('stability').textContent = fmtPct(decision.stability));
  $('flipRisk').textContent = fmtPct(decision.flipRisk);
  $('checkpoint').textContent = `${decision.checkpoint || '—'}m`;
  const timing = getTimingSignal(decision);
  const entryQualityEl = $('entryQuality');
  if (entryQualityEl) entryQualityEl.textContent = fmtPct(timing.entryQuality);
  const fairPriceEl = $('fairPrice');
  if (fairPriceEl) fairPriceEl.textContent = decision.marketValue?.price ? `${decision.marketValue.price}¢` : '—';
  renderTimingEngine(timing);
  renderLearningEngine();
  renderEntryMinuteTracker();
  renderMoneyTools();
  renderTradingStyleOverlay();
  renderChartSignalLayer(decision);
  renderTargetSourceBadge();
  renderTightMarketBadge();
  renderCashOutAlert();
  renderLockReadiness(decision);
  updateOfficialLockAlertUi();
  const raw = state.rawDecision;
  const rawText = raw ? `${raw.action || 'WAIT'} (${fmtPct(raw.confidence)})` : '—';
  const lockedText = ['OVER', 'UNDER'].includes(decision.action)
    ? `${decision.action}${decision.held ? ' held' : ' preview'}`
    : '—';
  const rawEl = $('rawSignal');
  const lockEl = $('lockedPrediction');
  const trackerEl = $('trackerLock');
  if (rawEl) rawEl.textContent = rawText;
  if (lockEl) lockEl.textContent = lockedText;
  if (trackerEl) trackerEl.textContent = formatOfficialLock(state.currentLadder?.officialCall);
}



function getTargetAuthorityStatus(now = Date.now()) {
  const prediction = state.coinbasePrediction;
  const fresh = hasFreshCoinbasePrediction(now);
  const targetPrice = Number($('targetPrice')?.value || prediction?.targetPrice);
  const uiMatches = Number.isFinite(targetPrice) && Number.isFinite(Number(prediction?.targetPrice)) && Math.abs(Number(prediction.targetPrice) - targetPrice) < 0.01;
  if (fresh && uiMatches) {
    const source = prediction.source === 'kalshi_official' ? 'Kalshi/Coinbase Official' : 'Coinbase Official';
    const closeNote = prediction.closeTimeSource || 'official close';
    return { official: true, source: prediction.source || 'official_kxbtc15m', label: `${source} · ${closeNote}`, className: 'pill good', reason: 'Verified KXBTC15M target is active.' };
  }
  const activeTicker = String($('marketTicker')?.value || state.market?.ticker || '').toUpperCase();
  if (activeTicker.startsWith('LOCAL') || state.localPrediction?.targetPrice === targetPrice) {
    return { official: false, source: 'local_preview_only', label: 'PREVIEW ONLY — local target blocked', className: 'pill bad', reason: 'Local/generated target is not allowed for locks, money guidance, cash-out, or scoring.' };
  }
  if (isVerifiedOfficialPrediction(prediction) && !fresh) {
    return { official: false, source: 'stale_official', label: 'Official target stale — waiting refresh', className: 'pill warn', reason: 'Official KXBTC15M data exists but is not fresh enough for decisions.' };
  }
  return { official: false, source: 'missing_official', label: 'Waiting for official KXBTC15M target', className: 'pill bad', reason: 'No verified official target available. v20 blocks official locks and scoring until data is verified.' };
}

function renderTargetSourceBadge() {
  const badge = $('targetSourceBadge');
  if (!badge) return;
  const status = getTargetAuthorityStatus();
  badge.textContent = `Target Source: ${status.label}`;
  badge.className = status.className || 'pill warn';
}

function getTargetCrossCount(seconds = 120) {
  const targetPrice = Number($('targetPrice')?.value);
  if (!Number.isFinite(targetPrice)) return 0;
  const cutoff = Date.now() - seconds * 1000;
  const recent = state.ticks.filter((tick) => tick.ts >= cutoff && Number.isFinite(Number(tick.price)));
  let crosses = 0;
  let lastSign = 0;
  for (const tick of recent) {
    const diff = Number(tick.price) - targetPrice;
    const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    if (!sign) continue;
    if (lastSign && sign !== lastSign) crosses += 1;
    lastSign = sign;
  }
  return crosses;
}

function getTightMarketStatus(decision = state.decision) {
  const latestPrice = Number(state.ticks.at(-1)?.price ?? decision?.currentPrice);
  const targetPrice = Number($('targetPrice')?.value || decision?.targetPrice);
  if (!Number.isFinite(latestPrice) || !Number.isFinite(targetPrice)) {
    return { active: false, label: 'Tight Market: waiting', reason: 'Waiting for price and target.' };
  }
  const micro = getMicrostructureContext();
  const avgMove = Number(getGenesisGateSnapshot(decision, getRemainingSec()).avgOneMinMove || 0);
  const threshold = Math.max(10, Math.min(65, avgMove * 1.15 || targetPrice * 0.00022));
  const distance = Math.abs(latestPrice - targetPrice);
  const crosses = getTargetCrossCount(150);
  const active = distance <= threshold || crosses >= 3;
  const label = active ? 'Tight Market Mode' : 'Tight Market: clear enough';
  const reason = active
    ? `BTC is near the target (${fmtMoney(distance)} away) or crossing often (${crosses} crosses). Wording only — no logic change.`
    : `Distance ${fmtMoney(distance)} · crosses ${crosses}.`;
  return { active, label, reason, distance: round2(distance), crosses, threshold: round2(threshold), periodRange: round2(micro.periodRange) };
}

function renderTightMarketBadge() {
  const badge = $('tightMarketBadge');
  if (!badge) return;
  const tight = getTightMarketStatus(state.decision);
  badge.textContent = tight.active ? 'Tight Market Mode' : 'Tight Market: clear';
  badge.className = tight.active ? 'pill warn' : 'pill good';
}

function getNoLockBlockers(decision, candidate, remainingSec) {
  const blockers = [];
  const notes = [];
  const authority = candidate?.targetAuthority || getTargetAuthorityStatus();
  if (!authority.official) blockers.push(`Official data required: ${authority.label}`);
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) {
    blockers.push('No active OVER/UNDER signal yet');
    return blockers;
  }
  const latestPrice = Number(state.ticks.at(-1)?.price ?? decision.currentPrice);
  const targetPrice = Number($('targetPrice').value || decision.targetPrice);
  const cushion = candidate?.cushionSnapshot || getTimeAdjustedCushionSnapshot(decision.action, latestPrice, targetPrice, remainingSec, decision);
  const genesis = candidate?.genesisGate || getGenesisGateSnapshot(decision, remainingSec);
  const rightSide = isCorrectSideOfTarget(decision.action, latestPrice, targetPrice);
  const tight = getTightMarketStatus(decision);
  if (!rightSide) blockers.push(`${decision.action} is on the wrong side of target`);
  if (Number(cushion.score || 0) < LOCK_CUSHION_SCORE) blockers.push(`Cushion too small: ${cushion.label}`);
  else notes.push(`Cushion OK: ${cushion.label}`);
  if (!genesis.allow || genesis.pick !== decision.action) blockers.push(`Genesis gate: ${genesis.status}`);
  else notes.push(`Genesis OK: ${genesis.status}`);
  const chart = candidate?.chartSupport || getChartSignalSupport(decision);
  if (chart.available && chart.conflict) blockers.push(`Chart layer is against ${decision.action}: ${chart.direction} ${Number(chart.score || 0).toFixed(0)}`);
  else if (chart.available) notes.push(`Chart layer OK: ${chart.direction} ${Number(chart.score || 0).toFixed(0)}`);
  if (Number(decision.flipRisk || 100) > 58) blockers.push(`Flip risk too high: ${fmtPct(decision.flipRisk)}`);
  if (getHeldDurationMs(decision) < 30000) blockers.push('Needs signal to hold longer');
  if (decision.action === 'OVER' && remainingSec >= GENESIS_MONEY_LATEST_SEC) {
    if (Number(cushion.score || 0) < OVER_EARLY_MIN_CUSHION_SCORE) blockers.push(`Early OVER cushion not clean enough: ${cushion.label}`);
    if (Number(genesis.entryScore || 0) < OVER_EARLY_MIN_ENTRY_SCORE) blockers.push(`Early OVER Genesis score too low: ${Number(genesis.entryScore || 0).toFixed(0)}`);
    if (Number(genesis.totalRisk || 100) > OVER_EARLY_MAX_TOTAL_RISK) blockers.push(`Early OVER risk too high: ${Number(genesis.totalRisk || 0).toFixed(1)}`);
  }
  if (tight.active) notes.push(`Tight Market Mode: ${tight.reason}`);
  if (!blockers.length) blockers.push(candidate?.reason || 'Waiting for official lock conditions to line up');
  return [...blockers, ...notes].slice(0, 7);
}

function getLockReadinessSnapshot(decision = state.decision) {
  const ladder = state.currentLadder;
  if (ladder?.officialCall) {
    const call = ladder.officialCall;
    return {
      percent: 100,
      label: `Locked: ${call.action} · ${call.minute}m · ${call.source}`,
      reason: 'Official tracker lock is frozen for this market.',
      locked: true
    };
  }
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) {
    return { percent: 0, label: 'Waiting', reason: 'No active OVER/UNDER signal yet.', locked: false };
  }
  const authorityCheck = getTargetAuthorityStatus();
  if (!authorityCheck.official) {
    return { percent: 0, label: 'Data not verified', reason: authorityCheck.reason, locked: false };
  }
  const remainingSec = getRemainingSec();
  const candidate = getOfficialLockCandidate(decision, remainingSec);
  const authority = candidate.targetAuthority || getTargetAuthorityStatus();
  if (candidate.allow) {
    return { percent: 99, label: 'Ready to lock', reason: candidate.reason || candidate.source || 'Official lock conditions met.', locked: false };
  }
  const timing = getTimingSignal(decision);
  const latestPrice = Number(state.ticks.at(-1)?.price ?? decision.currentPrice);
  const targetPrice = Number($('targetPrice').value || decision.targetPrice);
  const cushion = candidate.cushionSnapshot || getTimeAdjustedCushionSnapshot(decision.action, latestPrice, targetPrice, remainingSec, decision);
  const genesis = candidate.genesisGate || getGenesisGateSnapshot(decision, remainingSec);
  const rightSide = isCorrectSideOfTarget(decision.action, latestPrice, targetPrice);
  const heldScore = Math.min(100, getHeldDurationMs(decision) / 60000 * 100);
  const pieces = [
    clampClient(Number(decision.confidence || 0), 0, 100) * 0.18,
    clampClient(100 - Number(decision.flipRisk || 100), 0, 100) * 0.16,
    clampClient(Number(decision.stability || 0), 0, 100) * 0.12,
    clampClient(Number(timing.entryQuality || 0), 0, 100) * 0.14,
    clampClient(Number(cushion.score || 0), 0, 130) / 130 * 18,
    clampClient(Number(genesis.successChance || 0), 0, 100) * 0.14,
    rightSide ? 8 : 0,
    heldScore * 0.10
  ];
  const percent = Math.round(clampClient(pieces.reduce((sum, value) => sum + value, 0), 0, 98));
  const blockers = getNoLockBlockers(decision, candidate, remainingSec);
  const adjustedPercent = percent;
  return {
    percent: adjustedPercent,
    label: `${adjustedPercent}% ready`,
    reason: blockers.join(' · ') || candidate.reason || 'Waiting for cleaner confirmation.',
    locked: false
  };
}

function renderLockReadiness(decision = state.decision) {
  const snapshot = getLockReadinessSnapshot(decision);
  const percentEl = $('lockReadinessPercent');
  const barEl = $('lockReadinessBar');
  const needsEl = $('lockReadinessNeeds');
  const whyEl = $('whyNoLock');
  if (percentEl) percentEl.textContent = snapshot.label || `${snapshot.percent}%`;
  if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, Number(snapshot.percent || 0)))}%`;
  if (needsEl) needsEl.textContent = snapshot.reason || '';
  if (whyEl) {
    whyEl.textContent = snapshot.locked ? snapshot.reason : `Why no lock: ${snapshot.reason || 'waiting'}`;
    whyEl.className = snapshot.locked ? 'why-no-lock locked' : 'why-no-lock';
  }
}

function updateOfficialLockAlertUi() {
  const card = $('currentCallCard');
  if (!card) return;
  const lock = state.currentLadder?.officialCall;
  card.classList.toggle('tracker-locked-flash', Boolean(lock));
}

function enableBrowserAlerts() {
  const button = $('enableNotifications');
  if (!('Notification' in window)) {
    if (button) button.textContent = 'Alerts unsupported';
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (button) button.textContent = permission === 'granted' ? 'Alerts on' : 'Alerts blocked';
  }).catch(() => {
    if (button) button.textContent = 'Alerts unavailable';
  });
}

function alertOfficialTrackerLock(ladder) {
  const lock = ladder?.officialCall;
  if (!lock) return;
  const key = `${ladder.windowKey}|${lock.lockedAt}|${lock.action}`;
  if (state.lastNotifiedLockId === key) return;
  state.lastNotifiedLockId = key;
  playLockBeep();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const title = `Tracker Locked: ${lock.action}`;
  const body = `${lock.minute}m · ${lock.source}\nPrice ${fmtMoney(lock.price)} vs target ${fmtMoney(lock.targetPrice)}`;
  try {
    new Notification(title, { body, tag: key, silent: false });
  } catch {}
}

function playLockBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

function renderMarketBasics() {
  const latest = state.ticks.at(-1);
  $('btcPrice').textContent = latest ? fmtMoney(latest.price) : '—';
  $('targetDisplay').textContent = Number($('targetPrice').value) ? fmtMoney(Number($('targetPrice').value)) : '—';
  $('timeLeftDisplay').textContent = formatRemaining(getRemainingSec());
  const yes = state.orderbook?.yesPrice ?? state.coinbasePrediction?.yesPrice ?? state.market?.yes_bid ?? state.market?.yes_ask ?? state.market?.last_price;
  const no = state.orderbook?.noPrice ?? state.coinbasePrediction?.noPrice ?? state.market?.no_bid ?? state.market?.no_ask;
  const predContext = getPredictionPriceContext();
  const yesEl = $('yesPrice');
  const noEl = $('noPrice');
  if (yesEl) yesEl.textContent = yes ? `${displayCents(yes)}${formatSignedChange(predContext.yesChange, '¢')}` : '—';
  if (noEl) noEl.textContent = no ? `${displayCents(no)}${formatSignedChange(predContext.noChange, '¢')}` : '—';
  renderTargetSourceBadge();
  renderTightMarketBadge();
}


function renderReasons(decision) {
  $('reasons').innerHTML = (decision.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join('');
}

function renderIndicators(indicators) {
  $('indicators').innerHTML = Object.entries(indicators).map(([key, value]) =>
    `<div><span class="small-muted">${escapeHtml(key)}</span><strong>${escapeHtml(String(value))}</strong></div>`
  ).join('');
}

function renderLadder() {
  const currentCp = state.decision?.checkpoint;
  $('ladder').innerHTML = CHECKPOINT_MINUTES.map((minutes) => {
    const captured = state.capturedCheckpoints[String(minutes)];
    const active = currentCp === minutes ? ' active' : '';
    return `<div class="checkpoint-card${active}">
      <div class="checkpoint-time">${minutes}:00 left</div>
      <div class="checkpoint-pick">${captured ? captured.action : '—'}</div>
      <div class="checkpoint-details">${captured ? `${captured.confidence}% conf · ${captured.flipRisk}% flip` : 'Waiting'}</div>
    </div>`;
  }).join('');
}


function updatePredictionPriceHistory(data) {
  const yes = normalizePercentPrice(data?.yesPrice);
  const no = normalizePercentPrice(data?.noPrice);
  if (!Number.isFinite(yes) && !Number.isFinite(no)) return;
  const sample = {
    ts: Date.now(),
    ticker: data.ticker || data.eventTicker || 'KXBTC15M-UNKNOWN',
    yesPrice: Number.isFinite(yes) ? yes : Number.isFinite(no) ? Math.max(1, 100 - no) : null,
    noPrice: Number.isFinite(no) ? no : Number.isFinite(yes) ? Math.max(1, 100 - yes) : null,
    source: data.source || 'kalshi_official'
  };
  state.predictionPriceHistory.push(sample);
  const cutoff = Date.now() - 20 * 60 * 1000;
  state.predictionPriceHistory = state.predictionPriceHistory.filter((item) => item.ts >= cutoff).slice(-120);
  updateOddsCache(sample);
}

function getPredictionPriceContext() {
  const last = state.predictionPriceHistory.at(-1);
  if (!last) return { yesChange: 0, noChange: 0, predictionSamples: 0 };
  const sameTicker = state.predictionPriceHistory.filter((item) => item.ticker === last.ticker);
  const prior = sameTicker.find((item) => last.ts - item.ts >= 55_000) || sameTicker[0] || last;
  const yesChange = Number.isFinite(last.yesPrice) && Number.isFinite(prior.yesPrice) ? last.yesPrice - prior.yesPrice : 0;
  const noChange = Number.isFinite(last.noPrice) && Number.isFinite(prior.noPrice) ? last.noPrice - prior.noPrice : 0;
  return { yesChange, noChange, predictionSamples: sameTicker.length };
}

function updateOddsCache(sample) {
  if (!sample) return;
  const yes = normalizePercentPrice(sample.yesPrice);
  const no = normalizePercentPrice(sample.noPrice);
  if (!Number.isFinite(yes) && !Number.isFinite(no)) return;
  state.oddsCache = {
    yesPrice: Number.isFinite(yes) ? round2(yes) : Number.isFinite(no) ? round2(Math.max(1, 100 - no)) : null,
    noPrice: Number.isFinite(no) ? round2(no) : Number.isFinite(yes) ? round2(Math.max(1, 100 - yes)) : null,
    ticker: sample.ticker || state.market?.ticker || 'COINBASE-BTC-15M',
    source: sample.source || state.coinbasePrediction?.source || 'kalshi_official',
    ts: Number(sample.ts) || Date.now()
  };
  saveOddsCache();
}

function getOddsCacheStatus(now = Date.now()) {
  const cache = state.oddsCache;
  if (!cache?.ts) return { fresh: false, ageSec: null, label: 'No cached odds' };
  const ageSec = Math.max(0, Math.round((now - Number(cache.ts)) / 1000));
  return {
    fresh: ageSec <= ODDS_FRESH_MS / 1000,
    ageSec,
    label: ageSec <= ODDS_FRESH_MS / 1000 ? `Fresh · ${ageSec}s old` : `Stale · ${ageSec}s old`
  };
}

function getFreshCachedOddsForSide(side) {
  const status = getOddsCacheStatus();
  if (!status.fresh) return null;
  const field = side === 'OVER' ? 'yesPrice' : 'noPrice';
  return normalizePercentPrice(state.oddsCache?.[field]);
}

function getMicrostructureContext() {
  const now = Date.now();
  const recent60 = state.ticks.filter((tick) => tick.ts >= now - 60_000);
  const recent30 = state.ticks.filter((tick) => tick.ts >= now - 30_000);
  const latest = state.ticks.at(-1);
  const withSpread = [...state.ticks].reverse().find((tick) => Number.isFinite(Number(tick.spread)) && Number(tick.spread) >= 0);
  const upMoves = recent30.filter((tick, index, arr) => index > 0 && tick.price > arr[index - 1].price).length;
  const downMoves = recent30.filter((tick, index, arr) => index > 0 && tick.price < arr[index - 1].price).length;
  const buys = recent60.filter((tick) => ['BUY', 'BID'].includes(String(tick.side || '').toUpperCase())).length;
  const sells = recent60.filter((tick) => ['SELL', 'ASK'].includes(String(tick.side || '').toUpperCase())).length;
  const tradeVelocity = recent60.length / 60;
  const tickPressure = recent30.length > 1 ? (upMoves - downMoves) / Math.max(upMoves + downMoves, 1) : 0;
  const buySellPressure = buys + sells ? (buys - sells) / (buys + sells) : 0;
  const remainingSec = getRemainingSec();
  const elapsedMs = Math.max(0, (15 * 60 - remainingSec) * 1000);
  const windowStart = latest ? latest.ts - elapsedMs : now;
  const currentWindowTicks = state.ticks.filter((tick) => tick.ts >= windowStart);
  const windowPrices = currentWindowTicks.map((tick) => tick.price);
  const periodHigh = windowPrices.length ? Math.max(...windowPrices) : latest?.price ?? null;
  const periodLow = windowPrices.length ? Math.min(...windowPrices) : latest?.price ?? null;
  return {
    bestBid: withSpread?.bestBid ?? null,
    bestAsk: withSpread?.bestAsk ?? null,
    spread: withSpread?.spread ?? null,
    tradeVelocity,
    tickPressure,
    buySellPressure,
    periodHigh,
    periodLow,
    periodRange: Number.isFinite(periodHigh) && Number.isFinite(periodLow) ? periodHigh - periodLow : null
  };
}

function ensureCurrentLadder() {
  const authority = getTargetAuthorityStatus();
  if (!authority.official) return null;
  const targetPrice = Number($('targetPrice').value);
  const closeTime = getActiveCloseTime();
  if (!Number.isFinite(targetPrice) || targetPrice <= 0 || !closeTime) return null;
  const ticker = $('marketTicker').value || state.market?.ticker || state.market?.market_ticker || state.coinbasePrediction?.ticker || 'KXBTC15M-UNKNOWN';
  const windowKey = `${ticker}|${targetPrice}|${new Date(closeTime).toISOString()}`;
  if (state.currentLadder?.windowKey === windowKey) return state.currentLadder;

  if (state.currentLadder && !state.currentLadder.settledAt) finalizeCurrentLadder('window_changed');

  state.currentLadder = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    windowKey,
    ticker,
    title: state.market?.title || state.coinbasePrediction?.title || 'BTC 15 min',
    targetPrice,
    closeTime: new Date(closeTime).toISOString(),
    startedAt: Date.now(),
    profile: PROFILES[$('profileSelect').value]?.label || $('profileSelect').value || 'Balanced',
    profileKey: $('profileSelect').value || 'balanced',
    targetAuthority: getTargetAuthorityStatus(),
    tradingStyle: $('tradingStyleSelect')?.value || DEFAULT_TRADING_STYLE,
    checkpoints: {},
    entryMinutes: {},
    lastCall: null,
    officialCall: null,
    lastSeenPrice: state.ticks.at(-1)?.price ?? null
  };
  saveCurrentLadder();
  return state.currentLadder;
}

function getActiveCloseTime() {
  const now = Date.now();
  const preferred = hasFreshCoinbasePrediction(now) ? state.coinbasePrediction : null;
  if (preferred?.closeTime) {
    const parsed = Date.parse(preferred.closeTime);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (state.market && isVerifiedOfficialPrediction(state.coinbasePrediction)) {
    const parsed = parseMarketCloseTime(state.market);
    if (parsed) return parsed;
  }
  return null;
}

function updateCurrentLadderDecision(decision) {
  const ladder = ensureCurrentLadder();
  if (!ladder || !decision) return;
  ladder.lastSeenPrice = state.ticks.at(-1)?.price ?? ladder.lastSeenPrice;
  ladder.targetAuthority = getTargetAuthorityStatus();
  ladder.tradingStyle = $('tradingStyleSelect')?.value || DEFAULT_TRADING_STYLE;
  const action = ['OVER', 'UNDER'].includes(decision.action) ? decision.action : null;
  if (action) {
    ladder.lastCall = {
      action,
      choice: decision.choice,
      confidence: decision.confidence,
      stability: decision.stability,
      flipRisk: decision.flipRisk,
      checkpoint: decision.checkpoint,
      ts: Date.now(),
      held: Boolean(decision.held)
    };
  }
  saveCurrentLadder();
}


function getHeldDurationMs(decision) {
  const heldAt = Number(decision?.heldAt || state.heldDecision?.heldAt || 0);
  return heldAt ? Math.max(0, Date.now() - heldAt) : 0;
}

function getOfficialLockCandidate(decision, remainingSec) {
  const targetAuthority = getTargetAuthorityStatus();
  if (!targetAuthority.official) return { allow: false, reason: targetAuthority.reason, targetAuthority };
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) return { allow: false, reason: 'No trade call', targetAuthority };
  const timing = getTimingSignal(decision);
  const confidence = Number(decision.confidence || 0);
  const flipRisk = Number(decision.flipRisk || 100);
  const stability = Number(decision.stability || 0);
  const entryQuality = Number(timing.entryQuality || 0);
  const heldMs = getHeldDurationMs(decision);
  const minute = Math.max(1, Math.min(15, Math.ceil(remainingSec / 60)));
  const latestPrice = Number(state.ticks.at(-1)?.price);
  const targetPrice = Number($('targetPrice').value);
  const rightSide = isCorrectSideOfTarget(decision.action, latestPrice, targetPrice);
  const cushion = getTimeAdjustedCushionSnapshot(decision.action, latestPrice, targetPrice, remainingSec, decision);
  const valueSnapshot = getExpectedValueSnapshot(decision);
  const genesisGate = getGenesisGateSnapshot(decision, remainingSec);
  const chartSupport = getChartSignalSupport(decision);
  const chartClean = !chartSupport.available || !chartSupport.conflict || chartSupport.supportScore >= 50 || (remainingSec <= 180 && cushion.score >= LATE_HUGE_CUSHION_SCORE);
  const chartConfirms = !chartSupport.available || chartSupport.supports || chartSupport.supportScore >= 56 || (remainingSec <= 240 && cushion.score >= 140);

  const baseClean = confidence >= 52 && flipRisk <= 68 && stability >= 34;
  const rightSideOrEliteReclaim = rightSide || isEliteWrongSideReclaim(decision, remainingSec, timing);
  const genesisClean = genesisGate.allow && genesisGate.pick === decision.action && genesisGate.settlementRisk !== 'High' && chartClean;
  const genesisElite = genesisClean && chartConfirms && ['A+', 'A', 'B+'].includes(genesisGate.tradeGrade) && genesisGate.successChance >= 72;
  const isEarlyOver = decision.action === 'OVER' && remainingSec >= GENESIS_MONEY_LATEST_SEC;
  const overEarlyClean = !isEarlyOver || (
    cushion.score >= OVER_EARLY_MIN_CUSHION_SCORE &&
    Number(genesisGate.entryScore || 0) >= OVER_EARLY_MIN_ENTRY_SCORE &&
    Number(genesisGate.totalRisk || 100) <= OVER_EARLY_MAX_TOTAL_RISK &&
    Number(genesisGate.nearTargetRisk || 0) <= 12 &&
    flipRisk <= 50
  );
  const overSixClean = decision.action !== 'OVER' || (
    cushion.score >= 68 &&
    Number(genesisGate.entryScore || 0) >= 78 &&
    Number(genesisGate.totalRisk || 100) <= 62 &&
    flipRisk <= 60
  );
  const hugeLateCushion = remainingSec <= 180 && rightSide && cushion.score >= LATE_HUGE_CUSHION_SCORE && confidence >= 58 && flipRisk <= 72;
  const sixMinuteMoneyLock = remainingSec <= 420 && remainingSec >= GENESIS_MONEY_LATEST_SEC && baseClean && entryQuality >= 52 && rightSideOrEliteReclaim && cushion.score >= 55 && genesisClean && overSixClean;
  const tenMinuteElite = minute === 10 && confidence >= 92 && stability >= 90 && flipRisk <= 48 && entryQuality >= 76 && heldMs >= 30000 && rightSide && cushion.score >= 90 && genesisElite && overEarlyClean;
  const earlyGenesisLock = remainingSec <= 540 && remainingSec > 420 && confidence >= 62 && flipRisk <= 52 && entryQuality >= 70 && heldMs >= 30000 && rightSide && cushion.score >= 70 && genesisElite && overEarlyClean;
  const emergency = remainingSec >= GENESIS_MONEY_LATEST_SEC && confidence >= 90 && flipRisk <= 28 && entryQuality >= 84 && rightSide && cushion.score >= 105 && genesisElite && overEarlyClean;

  const approve = (source, entryEligible = remainingSec >= GENESIS_MONEY_LATEST_SEC) => ({
    allow: true,
    source,
    minute,
    entryQuality,
    heldMs,
    valueSnapshot,
    cushionSnapshot: cushion,
    genesisGate,
    chartSupport,
    targetAuthority,
    entryEligible
  });

  if (tenMinuteElite) return approve('10m genesis elite lock');
  if (earlyGenesisLock) return approve('8m genesis early lock');
  if (sixMinuteMoneyLock) return approve('6m genesis money lock');
  if (emergency) return approve('genesis emergency money lock');
  if (hugeLateCushion) return approve('late proof lock · no-entry', false);
  const sideNote = rightSide ? 'Waiting for official lock' : `${decision.action} is on wrong side of target`;
  return {
    allow: false,
    reason: `${sideNote}. Genesis ${genesisGate.status}. Cushion ${cushion.label}.`,
    minute,
    entryQuality,
    heldMs,
    valueSnapshot,
    cushionSnapshot: cushion,
    genesisGate,
    chartSupport,
    targetAuthority
  };
}

function isEliteWrongSideReclaim(decision, remainingSec, timing) {
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) return false;
  const confidence = Number(decision.confidence || 0);
  const flipRisk = Number(decision.flipRisk || 100);
  const stability = Number(decision.stability || 0);
  const entryQuality = Number(timing?.entryQuality || 0);
  const heldMs = getHeldDurationMs(decision);
  return remainingSec <= 360 && confidence >= 96 && stability >= 94 && flipRisk <= 32 && entryQuality >= 84 && heldMs >= 60000;
}

function getGenesisGateSnapshot(decision = state.decision, remainingSec = getRemainingSec()) {
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) {
    return { allow: false, status: 'waiting', pick: null, entryScore: 50, successChance: 0, tradeGrade: '—', settlementRisk: '—' };
  }
  const price = Number(state.ticks.at(-1)?.price ?? decision.currentPrice);
  const targetPrice = Number($('targetPrice').value || decision.targetPrice);
  if (!Number.isFinite(price) || !Number.isFinite(targetPrice) || !targetPrice) {
    return { allow: false, status: 'needs price/target', pick: null, entryScore: 50, successChance: 0, tradeGrade: '—', settlementRisk: '—' };
  }
  const timeMin = Math.max(Number(remainingSec || 0) / 60, 0.1);
  const gapToTarget = targetPrice - price;
  const neededPerMin = gapToTarget / timeMin;
  const recent = state.ticks.slice(-120);
  const recentTs = recent.at(-1)?.ts || Date.now();
  const last10m = recent.filter((tick) => tick.ts >= recentTs - 10 * 60_000);
  const prices = (last10m.length ? last10m : recent).map((tick) => Number(tick.price)).filter(Number.isFinite);
  const high = prices.length ? Math.max(...prices) : price;
  const low = prices.length ? Math.min(...prices) : price;
  const liveRange = Math.max(0, high - low);
  const changes = prices.slice(1).map((value, index) => Math.abs(value - prices[index]));
  const avgOneMinMove = changes.length ? changes.reduce((sum, item) => sum + item, 0) / Math.max(changes.length, 1) * Math.max(1, Math.min(4, 60 / Math.max(1, (recentTs - (last10m[0]?.ts || recentTs - 60000)) / Math.max(1, prices.length - 1) / 1000))) : Math.max(Number(decision.indicators?.atr || 0), Number(decision.indicators?.volatility || 0), 8);
  const volUnit = Math.max(avgOneMinMove, Number(decision.indicators?.atr || 0), Number(decision.indicators?.volatility || 0), targetPrice * 0.0001, 8);
  const slope3m = Number(decision.indicators?.slope3m || 0);
  const rsi = Number(decision.indicators?.rsi || 50);
  const macdHistogram = Number(decision.indicators?.macdHistogram || 0);
  const agreement = Number(decision.indicators?.agreement || 0);
  const predictionOddsPressure = Number(decision.indicators?.predictionOddsPressure || 0);
  const tickPressure = Number(decision.indicators?.tickPressure || 0);
  const chart = getChartSignalSupport(decision);

  let overScore = 50;
  if (gapToTarget > 0) overScore -= clampClient(Math.abs(neededPerMin) * 1.2, 0, 35);
  else overScore += clampClient(Math.abs(neededPerMin) * 1.2, 0, 35);
  overScore += clampClient(slope3m / volUnit * 12, -18, 18);
  overScore += clampClient((rsi - 50) / 4, -10, 10);
  overScore += clampClient(macdHistogram / volUnit * 24, -8, 8);
  overScore += clampClient((agreement - 3) * 2.2, -6, 6);
  overScore += clampClient(predictionOddsPressure * 0.45, -8, 8);
  overScore += clampClient(tickPressure * 5, -5, 5);

  if (chart.available && Number.isFinite(Number(chart.overScore))) {
    // v20: Genesis remains the boss, but the Chart Signal Layer now carries a 25% confirmation/protection weight.
    overScore = overScore * 0.75 + Number(chart.overScore) * 0.25;
  }

  const odds = getStrictOddsSnapshotForSide('OVER', { allowUnavailable: true });
  if (odds.available && odds.fresh && Number.isFinite(odds.oddsPercent)) {
    overScore = overScore * 0.72 + odds.oddsPercent * 0.28;
  }

  if (timeMin < 3 && gapToTarget > 0) overScore -= 6;
  if (timeMin < 3 && gapToTarget < 0) overScore += 6;

  overScore = clampClient(overScore, 3, 97);
  const underScore = 100 - overScore;
  const pick = underScore > overScore ? 'UNDER' : 'OVER';
  const confidence = Math.max(underScore, overScore);
  const nearTargetRisk = Math.abs(gapToTarget) < Math.max(12, volUnit * 1.4) ? 22 : 0;
  const lateWindowRisk = timeMin < 2 ? 30 : timeMin < 4 ? 20 : timeMin < 7 ? 10 : 4;
  const whipsawRisk = liveRange > 0 && volUnit > 0 ? clampClient((liveRange / volUnit) * 7, 0, 30) : 12;
  const wrongSideRisk = decision.action !== pick ? 18 : 0;
  const chartConflictRisk = chart.available && chart.conflict ? clampClient((Number(chart.oppositeScore || 50) - Number(chart.supportScore || 50)) * 0.45, 0, 18) : 0;
  const totalRisk = clampClient((100 - confidence) * 0.55 + lateWindowRisk * 0.6 + nearTargetRisk + whipsawRisk * 0.45 + wrongSideRisk + chartConflictRisk, 0, 100);
  const successChance = clampClient(confidence - clampClient(totalRisk * 0.42, 0, 20), 1, 99);
  const entryScore = Math.round(overScore);
  const inOverZone = entryScore >= GENESIS_OVER_SCORE;
  const inUnderZone = entryScore <= GENESIS_UNDER_SCORE;
  const directionZone = inOverZone ? 'OVER zone' : inUnderZone ? 'UNDER zone' : 'middle skip zone';
  const directionalMatch = (pick === 'OVER' && inOverZone) || (pick === 'UNDER' && inUnderZone);
  const settlementRisk = totalRisk < 45 ? 'Low' : totalRisk < 68 ? 'Medium' : 'High';
  let tradeGrade = 'F';
  if (successChance >= 84 && totalRisk < 38) tradeGrade = 'A+';
  else if (successChance >= 78 && totalRisk < 48) tradeGrade = 'A';
  else if (successChance >= 72 && totalRisk < 58) tradeGrade = 'B+';
  else if (successChance >= 66 && totalRisk < 68) tradeGrade = 'B';
  else if (successChance >= 58 && totalRisk < 75) tradeGrade = 'C';
  else if (successChance >= 50) tradeGrade = 'D';
  const allow = directionalMatch && decision.action === pick && successChance >= 66 && totalRisk < 75 && settlementRisk !== 'High';
  const status = allow ? `${directionZone} · ${tradeGrade} · ${settlementRisk} risk` : `${directionZone} · ${tradeGrade} · ${settlementRisk} risk · wait`;
  return {
    allow,
    status,
    pick,
    entryScore,
    overScore: round2(overScore),
    underScore: round2(underScore),
    confidence: round2(confidence),
    successChance: round2(successChance),
    totalRisk: round2(totalRisk),
    tradeGrade,
    settlementRisk,
    directionZone,
    neededPerMin: round2(neededPerMin),
    whipsawRisk: round2(whipsawRisk),
    nearTargetRisk: round2(nearTargetRisk),
    avgOneMinMove: round2(volUnit),
    chartSignal: chart.available ? {
      direction: chart.direction,
      score: chart.score,
      overScore: chart.overScore,
      underScore: chart.underScore,
      supports: chart.supports,
      conflict: chart.conflict
    } : null
  };
}

function getTimeAdjustedCushionSnapshot(side, price, targetPrice, remainingSec, decision = state.decision) {
  const normalized = String(side || '').toUpperCase();
  const currentPrice = Number(price);
  const target = Number(targetPrice);
  if (!['OVER', 'UNDER'].includes(normalized) || !Number.isFinite(currentPrice) || !Number.isFinite(target)) {
    return { available: false, side: normalized, raw: 0, required: 0, score: 0, label: 'No cushion data' };
  }
  const raw = normalized === 'OVER' ? currentPrice - target : target - currentPrice;
  const positive = Math.max(raw, 0);
  const atr = Number(decision?.indicators?.atr || 0);
  const vol = Number(decision?.indicators?.volatility || 0);
  const baseVolatility = Math.max(atr, vol, target * 0.00012, 8);
  const minutes = Math.max(remainingSec / 60, 0);
  let timeRequired;
  if (minutes >= 12) timeRequired = 60;
  else if (minutes >= 10) timeRequired = 48;
  else if (minutes >= 8) timeRequired = 40;
  else if (minutes >= 6) timeRequired = 32;
  else if (minutes >= 4) timeRequired = 24;
  else if (minutes >= 2) timeRequired = 16;
  else timeRequired = 10;
  const required = Math.max(timeRequired, baseVolatility * 0.42);
  const timeBoost = Math.max(0, (10 - minutes) * 3.2);
  const score = raw <= 0 ? Math.round((raw / Math.max(required, 1)) * 100) : Math.round((positive / Math.max(required, 1)) * 100 + timeBoost);
  const tier = score >= 175 ? 'huge' : score >= 115 ? 'strong' : score >= 72 ? 'usable' : score >= 35 ? 'thin' : raw > 0 ? 'weak' : 'wrong side';
  return {
    available: true,
    side: normalized,
    raw: round2(raw),
    required: round2(required),
    score,
    tier,
    label: `${normalized} cushion ${raw >= 0 ? '+' : ''}${round2(raw)} / req ${round2(required)} · ${score}`
  };
}

function isCorrectSideOfTarget(side, price, targetPrice) {
  if (!Number.isFinite(price) || !Number.isFinite(targetPrice)) return false;
  if (side === 'OVER') return price > targetPrice;
  if (side === 'UNDER') return price < targetPrice;
  return false;
}

function maybeLockOfficialCall(decision, remainingSec) {
  const ladder = ensureCurrentLadder();
  if (!ladder || ladder.officialCall) return;
  const candidate = getOfficialLockCandidate(decision, remainingSec);
  if (!candidate.allow) return;
  ladder.officialCall = {
    action: decision.action,
    choice: decision.choice || decision.action,
    minute: candidate.minute,
    checkpoint: nearestCheckpointFallback(remainingSec),
    source: candidate.source,
    confidence: Number(decision.confidence || 0),
    stability: Number(decision.stability || 0),
    flipRisk: Number(decision.flipRisk || 100),
    entryQuality: Number(candidate.entryQuality || 0),
    heldMs: Number(candidate.heldMs || 0),
    profile: PROFILES[$('profileSelect').value]?.label || $('profileSelect').value || 'Balanced',
    profileKey: $('profileSelect').value || 'balanced',
    price: state.ticks.at(-1)?.price ?? null,
    targetPrice: Number($('targetPrice').value),
    lockedAt: Date.now(),
    trackerLockVersion: TRACKER_LOCK_VERSION,
    liveReturn: captureLiveReturnAtLock(decision.action),
    moneyValue: candidate.valueSnapshot || getExpectedValueSnapshot(decision),
    cushion: candidate.cushionSnapshot || getTimeAdjustedCushionSnapshot(decision.action, state.ticks.at(-1)?.price, Number($('targetPrice').value), remainingSec, decision),
    genesisGate: candidate.genesisGate || getGenesisGateSnapshot(decision, remainingSec),
    chartSignals: decision.chartSignals || null,
    targetAuthority: candidate.targetAuthority || getTargetAuthorityStatus(),
    tradingStyle: $('tradingStyleSelect')?.value || DEFAULT_TRADING_STYLE,
    styleRecommendation: getTradingStyleRecommendation(decision, candidate),
    entryEligible: candidate.entryEligible !== false
  };
  saveCurrentLadder();
  renderLiveReturnTracker();
  alertOfficialTrackerLock(ladder);
}

function formatOfficialLock(lock) {
  if (!lock) return 'Waiting for tracker lock';
  return `${lock.action} · ${lock.minute}m · ${lock.source}`;
}

function updateCurrentLadderCheckpoint(cp, decision) {
  const ladder = ensureCurrentLadder();
  if (!ladder) return;
  ladder.checkpoints[String(cp)] = {
    action: decision.action,
    choice: decision.choice,
    confidence: decision.confidence,
    stability: decision.stability,
    flipRisk: decision.flipRisk,
    held: Boolean(decision.held),
    capturedAt: decision.capturedAt || Date.now()
  };
  if (['OVER', 'UNDER'].includes(decision.action)) {
    ladder.lastCall = { ...ladder.checkpoints[String(cp)], checkpoint: cp, ts: Date.now() };
  }
  saveCurrentLadder();
}


function captureEntryMinuteSnapshot(decision, remainingSec) {
  const ladder = ensureCurrentLadder();
  if (!ladder || !decision || !Number.isFinite(remainingSec) || remainingSec <= 0) return;
  const minute = Math.max(1, Math.min(15, Math.ceil(remainingSec / 60)));
  const key = String(minute);
  if (state.capturedEntryMinutes[key] || ladder.entryMinutes?.[key]) return;
  const timing = getTimingSignal(decision);
  const snapshot = {
    minute,
    action: decision.action || 'SKIP',
    choice: decision.choice || decision.action || 'SKIP',
    confidence: Number(decision.confidence || 0),
    stability: Number(decision.stability || 0),
    flipRisk: Number(decision.flipRisk || 100),
    entryQuality: Number(timing.entryQuality || 0),
    moneyScore: estimateMinuteMoneyScore(decision, timing, minute),
    profile: PROFILES[$('profileSelect').value]?.label || $('profileSelect').value || 'Balanced',
    profileKey: $('profileSelect').value || 'balanced',
    price: state.ticks.at(-1)?.price ?? null,
    targetPrice: Number($('targetPrice').value),
    capturedAt: Date.now()
  };
  state.capturedEntryMinutes[key] = snapshot;
  ladder.entryMinutes = { ...(ladder.entryMinutes || {}), [key]: snapshot };
  saveCurrentLadder();
}

function estimateMinuteMoneyScore(decision, timing, minute) {
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) return 0;
  const confidence = Number(decision.confidence || 0);
  const flipRisk = Number(decision.flipRisk || 100);
  const entryQuality = Number(timing?.entryQuality || 0);
  const earlyPremium = clampClient(((minute - 1) / 14) * 100, 0, 100);
  const sixMinuteBonus = Math.max(0, 100 - Math.abs(minute - 6) * 18);
  return Math.round((entryQuality * 0.44 + confidence * 0.16 + (100 - flipRisk) * 0.18 + earlyPremium * 0.12 + sixMinuteBonus * 0.10) * 10) / 10;
}

function scoreEntryMinutes(entryMinutes = {}, finalSide = 'PUSH') {
  const scored = {};
  for (const minute of ENTRY_MINUTES) {
    const item = entryMinutes?.[String(minute)];
    if (!item) continue;
    const action = item.action || 'SKIP';
    let score = 'empty';
    let marker = '';
    let realizedScore = 0;
    if (action === 'SKIP') { score = 'skip'; marker = 'skip'; }
    else if (['OVER', 'UNDER'].includes(action) && finalSide !== 'PUSH') {
      score = action === finalSide ? 'correct' : 'wrong';
      marker = action === finalSide ? '✓' : '✕';
      realizedScore = (action === finalSide ? 1 : -1) * Number(item.moneyScore || 0);
    } else if (['OVER', 'UNDER'].includes(action) && finalSide === 'PUSH') {
      score = 'push'; marker = 'push';
    }
    scored[String(minute)] = { ...item, score, marker, realizedScore };
  }
  return scored;
}

function finalizeCurrentLadder(reason = 'closed') {
  const ladder = state.currentLadder;
  if (!ladder || ladder.settledAt) return null;
  const ladderVerified = Boolean(ladder.targetAuthority?.official) && !String(ladder.ticker || '').toUpperCase().startsWith('LOCAL');
  if (!ladderVerified) {
    state.currentLadder = null;
    localStorage.removeItem(CURRENT_LADDER_KEY);
    return null;
  }
  const close = Date.parse(ladder.closeTime);
  if (Number.isFinite(close) && close - Date.now() > 2500 && reason !== 'window_changed' && reason !== 'new_window') return null;

  const finalPrice = state.ticks.at(-1)?.price ?? ladder.lastSeenPrice;
  const targetPrice = Number(ladder.targetPrice);
  if (!Number.isFinite(finalPrice) || !Number.isFinite(targetPrice)) return null;

  const finalSide = finalPrice > targetPrice ? 'OVER' : finalPrice < targetPrice ? 'UNDER' : 'PUSH';
  const officialCall = ladder.officialCall || null;
  const recommendation = officialCall?.action || 'SKIP';
  const callSource = officialCall ? `${officialCall.minute}m ${officialCall.source}` : 'no official tracker lock';
  const result = finalSide === 'PUSH' ? 'void' : recommendation === 'SKIP' ? 'skipped' : recommendation === finalSide ? 'win' : 'loss';
  const scoredCheckpoints = scoreLadderCheckpoints(ladder.checkpoints, finalSide);
  const scoredEntryMinutes = scoreEntryMinutes(ladder.entryMinutes || {}, finalSide);

  const completed = {
    ...ladder,
    recommendation,
    result,
    finalSide,
    finalPrice: Number(finalPrice),
    callSource,
    scoredCheckpoints,
    scoredEntryMinutes,
    settledAt: Date.now(),
    settleReason: reason
  };

  const alreadySaved = state.ladders.some((item) => item.windowKey === completed.windowKey);
  if (!alreadySaved) state.ladders.unshift(completed);
  state.ladders = state.ladders.slice(0, 25);
  saveLadders();
  addAutoRecordFromLadder(completed);
  state.currentLadder = null;
  localStorage.removeItem(CURRENT_LADDER_KEY);
  renderCompletedLadders();
  renderRecords();
  renderStats();
  renderProfitByLockType();
  renderWouldHaveWonTracker();
  renderMoneyTools();
  return completed;
}

function addAutoRecordFromLadder(ladder) {
  if (!ladder || state.records.some((record) => record.windowKey === ladder.windowKey && record.recordType === 'auto_ladder')) return;
  const call = ladder.officialCall || {};
  const record = {
    id: `${ladder.id}-auto`,
    ts: ladder.settledAt || Date.now(),
    recordType: 'auto_ladder',
    windowKey: ladder.windowKey,
    ticker: ladder.ticker,
    title: ladder.title,
    targetPrice: ladder.targetPrice,
    currentPrice: call.price || null,
    checkpoint: call.minute ? `${call.minute}m lock` : 'no lock',
    profileKey: call.profileKey || ladder.profileKey,
    profile: call.profile || ladder.profile,
    recommendation: ladder.recommendation,
    choice: ladder.recommendation,
    confidence: call.confidence || null,
    stability: call.stability || null,
    flipRisk: call.flipRisk || null,
    userEntry: 'auto-ladder',
    result: ladder.result,
    finalSide: ladder.finalSide,
    finalPrice: ladder.finalPrice,
    settledAt: ladder.settledAt,
    reasons: [`Auto-scored completed 15-minute ladder. Final period ended ${ladder.finalSide}.`],
    checkpoints: ladder.checkpoints || {},
    entryMinutes: ladder.entryMinutes || {},
    officialCall: ladder.officialCall || null,
    callSource: ladder.callSource || 'no official tracker lock',
    trackerLockVersion: TRACKER_LOCK_VERSION,
    moneyValue: ladder.officialCall?.moneyValue || null,
    liveReturn: ladder.officialCall?.liveReturn || null,
    realizedReturn: settleLiveReturn(ladder.officialCall?.liveReturn, ladder.result)
  };
  state.records.unshift(record);
  state.records = state.records.slice(0, 500);
  saveRecords();
}

function renderCompletedLadders() {
  const container = $('completedLadders');
  if (!container) return;
  if (!state.ladders.length) {
    container.innerHTML = '<div class="small-muted">No completed 15-minute ladders yet. Leave the app open through a full period and it will score the final Over/Under automatically.</div>';
    renderLadderStats();
    return;
  }
  container.innerHTML = state.ladders.slice(0, COMPLETED_LADDER_LIMIT).map((ladder) => {
    const scored = ladder.scoredCheckpoints || scoreLadderCheckpoints(ladder.checkpoints, ladder.finalSide);
    const checkpoints = CHECKPOINT_MINUTES.map((minutes) => {
      const cp = scored[String(minutes)] || { action: '—', score: 'empty', marker: '' };
      const cls = String(cp.action || 'empty').toLowerCase();
      return `<div class="history-cp compact ${cls} ${cp.score}"><span>${minutes}m</span><strong>${escapeHtml(cp.action || '—')}</strong><em>${escapeHtml(cp.marker || '')}</em></div>`;
    }).join('');
    const resultClass = ladder.result === 'win' ? 'good' : ladder.result === 'loss' ? 'bad' : 'warn';
    const source = ladder.callSource ? ` · Lock: ${escapeHtml(ladder.callSource)}` : '';
    const entryBest = getLadderBestEntryMinute(ladder);
    return `<div class="ladder-record compact-record">
      <div class="ladder-record-head compact-head">
        <div>
          <strong>${escapeHtml(ladder.recommendation || 'SKIP')} · ${escapeHtml((ladder.result || 'open').toUpperCase())}</strong>
          <span class="small-muted">${new Date(ladder.settledAt || ladder.startedAt).toLocaleTimeString()} · T ${fmtMoney(ladder.targetPrice)} · F ${fmtMoney(ladder.finalPrice)} · Best entry ${escapeHtml(entryBest)}${source}</span>
        </div>
        <div class="final-badge ${resultClass}">Ended ${escapeHtml(ladder.finalSide || '—')}</div>
      </div>
      <div class="history-ladder compact-grid">${checkpoints}</div>
    </div>`;
  }).join('');
  renderLadderStats();
}


function getLadderBestEntryMinute(ladder) {
  if (!ladder || !ladder.finalSide || ladder.finalSide === 'PUSH') return '—';
  const scored = ladder.scoredEntryMinutes || scoreEntryMinutes(ladder.entryMinutes || {}, ladder.finalSide);
  const candidates = Object.values(scored).filter((item) => item.score === 'correct');
  if (!candidates.length) return '—';
  candidates.sort((a, b) => Number(b.realizedScore || 0) - Number(a.realizedScore || 0) || Number(b.minute || 0) - Number(a.minute || 0));
  const best = candidates[0];
  return `${best.minute}m ${best.action}`;
}

function scoreLadderCheckpoints(checkpoints = {}, finalSide = 'PUSH') {
  const scored = {};
  for (const minutes of CHECKPOINT_MINUTES) {
    const cp = checkpoints?.[String(minutes)];
    const action = cp?.action || '—';
    let score = 'empty';
    let marker = '';
    if (action === 'SKIP') { score = 'skip'; marker = 'skip'; }
    else if (['OVER', 'UNDER'].includes(action) && finalSide !== 'PUSH') {
      score = action === finalSide ? 'correct' : 'wrong';
      marker = action === finalSide ? '✓' : '✕';
    } else if (['OVER', 'UNDER'].includes(action) && finalSide === 'PUSH') {
      score = 'push'; marker = 'push';
    }
    scored[String(minutes)] = { ...(cp || {}), action, score, marker };
  }
  return scored;
}

function summarizeLadderAccuracy(ladders = state.ladders) {
  const summary = {
    byCheckpoint: Object.fromEntries(CHECKPOINT_MINUTES.map((m) => [String(m), { calls: 0, correct: 0, wrong: 0, skips: 0, accuracy: 0, skipRate: 0 }])),
    bySide: { OVER: { calls: 0, correct: 0, wrong: 0, accuracy: 0 }, UNDER: { calls: 0, correct: 0, wrong: 0, accuracy: 0 } }
  };
  for (const ladder of ladders) {
    if (!ladder || ladder.finalSide === 'PUSH') continue;
    const scored = ladder.scoredCheckpoints || scoreLadderCheckpoints(ladder.checkpoints, ladder.finalSide);
    for (const minutes of CHECKPOINT_MINUTES) {
      const bucket = summary.byCheckpoint[String(minutes)];
      const cp = scored[String(minutes)];
      const action = cp?.action;
      if (action === 'SKIP') { bucket.skips += 1; continue; }
      if (!['OVER', 'UNDER'].includes(action)) continue;
      bucket.calls += 1;
      summary.bySide[action].calls += 1;
      if (action === ladder.finalSide) {
        bucket.correct += 1;
        summary.bySide[action].correct += 1;
      } else {
        bucket.wrong += 1;
        summary.bySide[action].wrong += 1;
      }
    }
  }
  for (const bucket of Object.values(summary.byCheckpoint)) {
    bucket.accuracy = bucket.calls ? Math.round((bucket.correct / bucket.calls) * 1000) / 10 : 0;
    const totalSeen = bucket.calls + bucket.skips;
    bucket.skipRate = totalSeen ? Math.round((bucket.skips / totalSeen) * 1000) / 10 : 0;
  }
  for (const bucket of Object.values(summary.bySide)) {
    bucket.accuracy = bucket.calls ? Math.round((bucket.correct / bucket.calls) * 1000) / 10 : 0;
  }
  return summary;
}


function summarizeEntryMinuteTracker(ladders = state.ladders) {
  const summary = Object.fromEntries(ENTRY_MINUTES.map((minute) => [String(minute), {
    minute,
    calls: 0,
    correct: 0,
    wrong: 0,
    skips: 0,
    accuracy: 0,
    avgEntryQuality: 0,
    avgMoneyScore: 0,
    avgRealizedScore: 0,
    bestProfile: '—',
    profileCounts: {}
  }]));

  for (const ladder of ladders) {
    if (!ladder || !ladder.finalSide || ladder.finalSide === 'PUSH') continue;
    const scored = ladder.scoredEntryMinutes || scoreEntryMinutes(ladder.entryMinutes || {}, ladder.finalSide);
    for (const minute of ENTRY_MINUTES) {
      const bucket = summary[String(minute)];
      const item = scored[String(minute)];
      if (!item) continue;
      const action = item.action || 'SKIP';
      if (action === 'SKIP') { bucket.skips += 1; continue; }
      if (!['OVER', 'UNDER'].includes(action)) continue;
      bucket.calls += 1;
      bucket.avgEntryQuality += Number(item.entryQuality || 0);
      bucket.avgMoneyScore += Number(item.moneyScore || 0);
      bucket.avgRealizedScore += Number(item.realizedScore || 0);
      const profile = item.profile || ladder.profile || 'Unknown';
      bucket.profileCounts[profile] = (bucket.profileCounts[profile] || 0) + 1;
      if (action === ladder.finalSide) bucket.correct += 1;
      else bucket.wrong += 1;
    }
  }

  for (const bucket of Object.values(summary)) {
    if (bucket.calls) {
      bucket.accuracy = Math.round((bucket.correct / bucket.calls) * 1000) / 10;
      bucket.avgEntryQuality = Math.round((bucket.avgEntryQuality / bucket.calls) * 10) / 10;
      bucket.avgMoneyScore = Math.round((bucket.avgMoneyScore / bucket.calls) * 10) / 10;
      bucket.avgRealizedScore = Math.round((bucket.avgRealizedScore / bucket.calls) * 10) / 10;
      bucket.bestProfile = Object.entries(bucket.profileCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    }
    delete bucket.profileCounts;
  }
  return summary;
}

function getBestEntryMinuteSummary() {
  const stats = summarizeEntryMinuteTracker();
  const candidates = Object.values(stats).filter((item) => item.calls >= 2);
  const bestMoney = candidates.slice().sort((a, b) => b.avgRealizedScore - a.avgRealizedScore || b.accuracy - a.accuracy)[0];
  const bestAccuracy = candidates.slice().sort((a, b) => b.accuracy - a.accuracy || b.calls - a.calls)[0];
  const bestEarly = candidates.filter((item) => item.minute >= 8).sort((a, b) => b.avgRealizedScore - a.avgRealizedScore || b.accuracy - a.accuracy)[0];
  return {
    stats,
    bestMoney,
    bestAccuracy,
    bestEarly,
    bestWindow: bestMoney ? `${bestMoney.minute}m` : '6m priority',
    summaryLabel: bestMoney ? `${bestMoney.minute}m · ${bestMoney.accuracy}% · ${bestMoney.avgRealizedScore}` : 'Waiting'
  };
}

function renderEntryMinuteTracker() {
  const el = $('entryMinuteTracker');
  if (!el) return;
  const { bestMoney, bestAccuracy, bestEarly, stats } = getBestEntryMinuteSummary();
  const top = Object.values(stats)
    .filter((item) => item.calls > 0)
    .sort((a, b) => b.avgRealizedScore - a.avgRealizedScore || b.accuracy - a.accuracy)
    .slice(0, 4);
  const rows = [
    ['Best money', bestMoney ? `${bestMoney.minute}m · ${bestMoney.avgRealizedScore}` : 'Waiting'],
    ['Best win %', bestAccuracy ? `${bestAccuracy.minute}m · ${bestAccuracy.accuracy}%` : 'Waiting'],
    ['Best early', bestEarly ? `${bestEarly.minute}m · ${bestEarly.accuracy}%` : 'Waiting'],
    ['6m priority', formatEntryMinuteStat(stats['6'])]
  ];
  const topRows = top.map((item) => `<div class="mini-row entry-minute-best"><strong>${item.minute}m</strong><span>${item.correct}/${item.calls}</span><span>${item.accuracy}%</span><span>${item.avgRealizedScore}</span></div>`).join('');
  el.innerHTML = rows.map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('') + (topRows ? `<div class="section-subtitle tight">Top minutes</div>${topRows}` : '');
}

function formatEntryMinuteStat(item) {
  if (!item || !item.calls) return 'Waiting';
  return `${item.correct}/${item.calls} · ${item.accuracy}% · ${item.avgRealizedScore}`;
}

function renderLadderStats() {
  const checkpointEl = $('checkpointAccuracy');
  const sideEl = $('sideAccuracy');
  if (!checkpointEl || !sideEl) return;
  const summary = summarizeLadderAccuracy();
  checkpointEl.innerHTML = CHECKPOINT_MINUTES.map((minutes) => {
    const stats = summary.byCheckpoint[String(minutes)];
    return `<div class="mini-row"><strong>${minutes}m</strong><span>${stats.correct}/${stats.calls}</span><span>${stats.accuracy}%</span><span>Skip ${stats.skipRate}%</span></div>`;
  }).join('');
  sideEl.innerHTML = ['OVER', 'UNDER'].map((side) => {
    const stats = summary.bySide[side];
    return `<div class="mini-row"><strong>${side}</strong><span>${stats.correct}/${stats.calls}</span><span>${stats.accuracy}%</span><span>L ${stats.wrong}</span></div>`;
  }).join('');
  renderEntryMinuteTracker();
  renderLiveReturnTracker();
}


function getTimingSignal(decision = state.decision) {
  if (!decision) return { entryQuality: 0, action: 'WAIT', note: 'Waiting for signal', bestWindow: '8m–6m' };
  const remainingSec = getRemainingSec();
  const confidence = Number(decision.confidence || 0);
  const flipRisk = Number(decision.flipRisk || 100);
  const stability = Number(decision.stability || 0);
  const checkpoint = decision.checkpoint || nearestCheckpointFallback(remainingSec);
  const timingScore = scoreEntryTime(remainingSec);
  const chart = getChartSignalSupport(decision);
  const chartEntryBoost = chart.available ? clampClient((Number(chart.supportScore || 50) - 50) * 0.22 - (chart.conflict ? 8 : 0), -12, 12) : 0;
  const entryQuality = clampClient(confidence * 0.40 + (100 - flipRisk) * 0.30 + stability * 0.17 + timingScore * 0.08 + chartEntryBoost, 0, 99);
  let action = 'WAIT';
  if (decision.action === 'SKIP') action = 'SKIP';
  else if (entryQuality >= 78 && remainingSec >= 240) action = 'ENTER';
  else if (entryQuality >= 66 && remainingSec >= 360) action = 'PREPARE';
  else if (entryQuality >= 68 && remainingSec >= 120) action = 'WAIT';
  else if (remainingSec < 120 && entryQuality < 84) action = 'NO CHASE';
  const bestWindow = getLearningSummary().bestEntryWindow || '6m priority';
  const note = action === 'ENTER' ? 'Good timing now'
    : action === 'PREPARE' ? 'Get ready'
    : action === 'NO CHASE' ? 'Too late unless planned'
    : action === 'SKIP' ? 'No clean entry'
    : 'Wait for cleaner entry';
  return { entryQuality: Math.round(entryQuality * 10) / 10, action, note, checkpoint, bestWindow, chartEntryBoost: round2(chartEntryBoost) };
}

function scoreEntryTime(remainingSec) {
  if (!Number.isFinite(remainingSec) || remainingSec <= 0) return 0;
  const minutes = remainingSec / 60;
  if (minutes >= 6 && minutes <= 8.5) return 100;
  if (minutes >= 4 && minutes < 6) return 86;
  if (minutes > 8.5 && minutes <= 10.5) return 74;
  if (minutes > 10.5 && minutes <= 12.5) return 58;
  if (minutes >= 2 && minutes < 4) return 48;
  return 24;
}

function renderTimingEngine(timing = getTimingSignal()) {
  const el = $('timingEngine');
  if (!el) return;
  el.innerHTML = [
    ['Action', timing.action],
    ['Entry quality', `${timing.entryQuality}%`],
    ['Best window', timing.bestWindow],
    ['Chart boost', `${timing.chartEntryBoost >= 0 ? '+' : ''}${timing.chartEntryBoost || 0}`],
    ['Note', timing.note]
  ].map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('');
}

function getLearningSummary() {
  const ladders = state.ladders.filter((ladder) => ladder && ladder.finalSide && ladder.finalSide !== 'PUSH');
  const stats = summarizeLadderAccuracy(ladders);
  const bestCheckpoint = CHECKPOINT_MINUTES
    .map((minutes) => ({ minutes, ...stats.byCheckpoint[String(minutes)] }))
    .filter((item) => item.calls >= 3)
    .sort((a, b) => b.accuracy - a.accuracy || b.calls - a.calls)[0];
  const bestSide = Object.entries(stats.bySide)
    .map(([side, bucket]) => ({ side, ...bucket }))
    .filter((item) => item.calls >= 3)
    .sort((a, b) => b.accuracy - a.accuracy || b.calls - a.calls)[0];
  const dangerous = CHECKPOINT_MINUTES
    .map((minutes) => ({ minutes, ...stats.byCheckpoint[String(minutes)] }))
    .filter((item) => item.calls >= 2)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong)[0];

  const earliestCounts = Object.fromEntries(CHECKPOINT_MINUTES.map((m) => [String(m), 0]));
  for (const ladder of ladders) {
    const scored = ladder.scoredCheckpoints || scoreLadderCheckpoints(ladder.checkpoints, ladder.finalSide);
    const firstCorrect = CHECKPOINT_MINUTES.find((minutes) => scored[String(minutes)]?.score === 'correct');
    if (firstCorrect) earliestCounts[String(firstCorrect)] += 1;
  }
  const bestEarly = Object.entries(earliestCounts).sort((a, b) => b[1] - a[1])[0];
  const minuteSummary = getBestEntryMinuteSummary();
  const bestEntryWindow = minuteSummary.bestMoney ? `${minuteSummary.bestMoney.minute}m` : (bestEarly && bestEarly[1] > 0 ? `${bestEarly[0]}m` : '6m priority');
  return {
    sampleSize: ladders.length,
    mode: ladders.length >= LEARNING_SAMPLE_TARGET ? 'Adaptive ready' : 'Tracking only',
    bestCheckpoint: bestCheckpoint ? `${bestCheckpoint.minutes}m ${bestCheckpoint.accuracy}%` : 'Waiting',
    bestSide: bestSide ? `${bestSide.side} ${bestSide.accuracy}%` : 'Waiting',
    dangerousCall: dangerous ? `${dangerous.minutes}m ${dangerous.accuracy}%` : 'Waiting',
    bestEntryWindow,
    bestMoneyMinute: minuteSummary.summaryLabel
  };
}

function renderLearningEngine() {
  const el = $('learningEngine');
  if (!el) return;
  const summary = getLearningSummary();
  el.innerHTML = [
    ['Mode', summary.mode],
    ['Samples', `${summary.sampleSize}/${LEARNING_SAMPLE_TARGET}`],
    ['Best marker', summary.bestCheckpoint],
    ['Best side', summary.bestSide],
    ['Watch', summary.dangerousCall],
    ['Best entry', summary.bestEntryWindow],
    ['Best money', summary.bestMoneyMinute]
  ].map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('');
}

function copyVersionName() {
  const text = APP_VERSION_FILE;
  const status = $('copyStatus');
  navigator.clipboard?.writeText(text).then(() => {
    if (status) status.textContent = 'Copied';
    setTimeout(() => { if (status) status.textContent = ''; }, 1400);
  }).catch(() => {
    if (status) status.textContent = text;
  });
}

function clampClient(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function nearestCheckpointFallback(remainingSec) {
  const minutes = remainingSec / 60;
  let best = CHECKPOINT_MINUTES[0];
  let diff = Infinity;
  for (const cp of CHECKPOINT_MINUTES) {
    const d = Math.abs(cp - minutes);
    if (d < diff) { best = cp; diff = d; }
  }
  return best;
}

function drawSparkline() {
  const canvas = $('sparkline');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#070a10';
  ctx.fillRect(0, 0, width, height);
  const latestTs = state.ticks.at(-1)?.ts || Date.now();
  let ticks = state.ticks.filter((tick) => tick.ts >= latestTs - 5 * 60 * 1000);
  if (ticks.length < 2) ticks = state.ticks.slice(-180);
  if (ticks.length < 2) {
    ctx.fillStyle = '#8e9db1';
    ctx.font = '22px system-ui';
    ctx.fillText('Waiting for live Coinbase ticks…', 24, 96);
    return;
  }
  const prices = ticks.map((tick) => tick.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max((max - min) * 0.1, 10);
  const lo = min - pad;
  const hi = max + pad;
  const xFor = (i) => i / (ticks.length - 1) * width;
  const yFor = (price) => height - ((price - lo) / (hi - lo)) * height;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = i * height / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const target = Number($('targetPrice').value);
  if (Number.isFinite(target) && target > 0) {
    const y = yFor(target);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.8)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#71a7ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ticks.forEach((tick, i) => {
    const x = xFor(i);
    const y = yFor(tick.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(142,157,177,0.9)';
  ctx.font = '18px system-ui';
  ctx.fillText('5m', 10, height - 12);
  ctx.fillText('now', width - 50, height - 12);
}


async function loadCoinbasePrediction(silent = false) {
  const status = $('predictionStatus');
  if (status && !silent) {
    status.textContent = 'Predictions: loading';
    status.className = 'pill warn';
  }
  try {
    const response = await fetch('/api/coinbase/prediction-btc', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Coinbase prediction lookup failed');
    data.fetchedAt = data.fetchedAt || new Date().toISOString();

    const previousKey = [state.coinbasePrediction?.ticker, state.coinbasePrediction?.targetPrice, state.coinbasePrediction?.closeTime].join('|');
    const nextKey = [data.ticker, data.targetPrice, data.closeTime].join('|');
    state.coinbasePrediction = data;
    state.market = {
      source: data.source || 'kalshi_official',
      ticker: data.ticker || data.eventTicker || 'KXBTC15M-UNKNOWN',
      title: data.title,
      close_time: data.closeTime,
      yes_bid: data.yesPrice,
      no_bid: data.noPrice,
      indicativeOnly: false
    };
    applyPredictionToUi(data, { reset: previousKey !== nextKey, save: true, sourceLabel: 'official auto' });
    evaluateAndRender(false);
    if (status) {
      const sourceNote = data.source === 'kalshi_official' ? 'official KX' : 'official page';
      status.textContent = `Predictions: ${sourceNote}`;
      status.className = 'pill good';
    }
    const debug = $('apiDebug');
    if (debug) debug.textContent = `Official target verified: ${data.title} · ${data.ticker || data.eventTicker} · closes ${new Date(data.closeTime).toLocaleTimeString()}`;
  } catch (error) {
    updateLocalPredictionFromTicks();
    if (status) {
      status.textContent = 'Predictions: official data required';
      status.className = 'pill bad';
    }
    const debug = $('apiDebug');
    if (debug) {
      debug.textContent = `Official target fetch failed: ${error.message}. v20 will not create a local target, tracker lock, money guidance, cash-out alert, or win/loss score until KXBTC15M data is verified.`;
    }
  }
}

function recordCurrentDecision(mode = 'decision') {
  if (!state.decision) evaluateAndRender();
  const decision = mode === 'skip' ? { ...state.decision, action: 'SKIP' } : state.decision;
  const tickerEl = $('marketTicker');
  const record = createRecord({ decision, market: state.market || { ticker: tickerEl?.value || '' }, userEntry: decision.action });
  record.checkpoints = { ...state.capturedCheckpoints };
  state.records.unshift(record);
  saveRecords();
  renderRecords();
  renderStats();
}



function getOddsSnapshotForSide(side) {
  const normalized = String(side || '').toUpperCase();
  const field = normalized === 'OVER' ? 'yesPrice' : 'noPrice';
  const status = getOddsCacheStatus();
  const directCandidates = [
    { value: state.coinbasePrediction?.[field], source: state.coinbasePrediction?.source || 'kalshi_official', ticker: state.coinbasePrediction?.ticker || '', status: 'Official feed' },
    { value: state.orderbook?.[field], source: state.orderbook?.source || 'orderbook', ticker: state.orderbook?.ticker || '', status: 'Orderbook' },
    { value: state.market?.[normalized === 'OVER' ? 'yes_bid' : 'no_bid'], source: state.market?.source || 'market', ticker: state.market?.ticker || state.market?.market_ticker || '', status: 'Market' },
    { value: state.predictionPriceHistory.at(-1)?.[field], source: state.predictionPriceHistory.at(-1)?.source || 'prediction_history', ticker: state.predictionPriceHistory.at(-1)?.ticker || '', status: status.label },
    { value: state.oddsCache?.[field], source: state.oddsCache?.source || 'odds_cache', ticker: state.oddsCache?.ticker || '', status: status.label }
  ];
  for (const item of directCandidates) {
    const oddsPercent = normalizePercentPrice(item.value);
    if (Number.isFinite(oddsPercent) && oddsPercent > 0 && oddsPercent < 100) {
      return {
        available: true,
        side: normalized,
        oddsPercent: round2(oddsPercent),
        source: item.source,
        ticker: item.ticker,
        status: item.status,
        oddsAgeSec: status.ageSec,
        fresh: status.fresh
      };
    }
  }
  return { available: false, side: normalized, oddsPercent: null, source: 'unavailable', status: status.label, oddsAgeSec: status.ageSec, fresh: false };
}

function getPredictionFreshStatus(now = Date.now()) {
  const fetched = Date.parse(state.coinbasePrediction?.fetchedAt || state.coinbasePrediction?.ts || '');
  if (!Number.isFinite(fetched)) return { fresh: false, ageSec: null, label: 'No fresh prediction scrape' };
  const ageSec = Math.max(0, Math.round((now - fetched) / 1000));
  return {
    fresh: ageSec <= ODDS_FRESH_MS / 1000,
    ageSec,
    label: ageSec <= ODDS_FRESH_MS / 1000 ? `Fresh scrape · ${ageSec}s old` : `Stale scrape · ${ageSec}s old`
  };
}

function getCurrentWindowTicker() {
  return state.coinbasePrediction?.ticker || state.market?.ticker || state.market?.market_ticker || state.oddsCache?.ticker || '';
}

function tickerMatchesCurrentWindow(candidateTicker) {
  const current = String(getCurrentWindowTicker() || '').trim();
  const candidate = String(candidateTicker || '').trim();
  if (!current || !candidate) return false;
  return current === candidate;
}

function getStrictOddsSnapshotForSide(side, options = {}) {
  const normalized = String(side || '').toUpperCase();
  const field = normalized === 'OVER' ? 'yesPrice' : 'noPrice';
  const predictionStatus = getPredictionFreshStatus();
  const cacheStatus = getOddsCacheStatus();
  const candidates = [
    {
      value: state.coinbasePrediction?.[field],
      source: state.coinbasePrediction?.source || 'kalshi_official',
      ticker: state.coinbasePrediction?.ticker || '',
      status: predictionStatus.label,
      fresh: predictionStatus.fresh,
      oddsAgeSec: predictionStatus.ageSec
    },
    {
      value: state.predictionPriceHistory.at(-1)?.[field],
      source: state.predictionPriceHistory.at(-1)?.source || 'prediction_history',
      ticker: state.predictionPriceHistory.at(-1)?.ticker || '',
      status: cacheStatus.label,
      fresh: cacheStatus.fresh,
      oddsAgeSec: cacheStatus.ageSec
    },
    {
      value: state.oddsCache?.[field],
      source: state.oddsCache?.source || 'odds_cache',
      ticker: state.oddsCache?.ticker || '',
      status: cacheStatus.label,
      fresh: cacheStatus.fresh,
      oddsAgeSec: cacheStatus.ageSec
    }
  ];
  for (const item of candidates) {
    const oddsPercent = normalizePercentPrice(item.value);
    if (!Number.isFinite(oddsPercent) || oddsPercent <= 0 || oddsPercent >= 100) continue;
    const tickerMatch = tickerMatchesCurrentWindow(item.ticker);
    if (item.fresh && tickerMatch) {
      return {
        available: true,
        side: normalized,
        oddsPercent: round2(oddsPercent),
        source: item.source,
        ticker: item.ticker,
        status: item.status,
        oddsAgeSec: item.oddsAgeSec,
        fresh: true,
        tickerMatch: true
      };
    }
  }
  if (options.allowUnavailable) {
    return { available: false, side: normalized, reason: cacheStatus.fresh ? 'No matching current odds' : cacheStatus.label, status: cacheStatus.label, oddsAgeSec: cacheStatus.ageSec, fresh: false, tickerMatch: false };
  }
  return { available: false, side: normalized, reason: 'Fresh matching Coinbase odds unavailable', status: cacheStatus.label, oddsAgeSec: cacheStatus.ageSec, fresh: false, tickerMatch: false };
}

function estimateWinProbability(decision = state.decision) {
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) return null;
  const confidence = Number(decision.confidence || 0);
  const flipRisk = Number(decision.flipRisk || 100);
  const stability = Number(decision.stability || 0);
  const timing = getTimingSignal(decision);
  const price = Number(state.ticks.at(-1)?.price ?? decision.currentPrice);
  const targetPrice = Number($('targetPrice').value || decision.targetPrice);
  const rightSide = isCorrectSideOfTarget(decision.action, price, targetPrice);
  const wrongSidePenalty = rightSide ? 0 : -0.07;
  const prob = 0.31 + confidence * 0.0047 + (100 - flipRisk) * 0.0017 + stability * 0.0012 + Number(timing.entryQuality || 0) * 0.0007 + wrongSidePenalty;
  return clampClient(prob, 0.45, 0.965);
}

function getExpectedValueSnapshot(decision = state.decision) {
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) {
    return { available: false, status: 'Waiting', reason: 'No active trade call' };
  }
  const odds = getStrictOddsSnapshotForSide(decision.action, { allowUnavailable: true });
  const winProbability = estimateWinProbability(decision);
  if (!odds.available || !Number.isFinite(winProbability)) {
    return { available: false, status: 'Money value unavailable', reason: odds.reason || 'Fresh matching Coinbase odds unavailable', side: decision.action, oddsStatus: odds.status, oddsAgeSec: odds.oddsAgeSec };
  }
  const multiplier = 100 / odds.oddsPercent;
  const winReturn = ASSUMED_STAKE_DOLLARS * multiplier;
  const winProfit = winReturn - ASSUMED_STAKE_DOLLARS;
  const lossProfit = -ASSUMED_STAKE_DOLLARS;
  const expectedProfit = winProbability * winProfit + (1 - winProbability) * lossProfit;
  const evPercent = expectedProfit / ASSUMED_STAKE_DOLLARS * 100;
  const tooExpensive = odds.oddsPercent >= TOO_EXPENSIVE_ODDS_PERCENT || (odds.oddsPercent >= EXPENSIVE_ODDS_PERCENT && evPercent < 6) || (winProfit < 0.07 && winProbability < 0.94);
  const status = tooExpensive ? 'Poor value' : evPercent >= 8 ? 'Good value' : evPercent >= MIN_EV_PERCENT ? 'Thin value' : 'Negative value';
  return {
    available: true,
    side: decision.action,
    oddsPercent: round2(odds.oddsPercent),
    winProbability: round2(winProbability * 100),
    multiplier: round2(multiplier),
    winProfit: round2(winProfit),
    expectedProfit: round2(expectedProfit),
    evPercent: round2(evPercent),
    tooExpensive,
    status,
    oddsStatus: odds.status,
    oddsAgeSec: odds.oddsAgeSec,
    source: odds.source,
    ticker: odds.ticker
  };
}

function getMoneyValueGate(decision = state.decision) {
  const snapshot = getExpectedValueSnapshot(decision);
  if (!snapshot.available) return { allow: true, reason: snapshot.reason || 'EV unavailable', snapshot };
  if (snapshot.tooExpensive || snapshot.evPercent < MIN_EV_PERCENT) {
    return { allow: false, reason: `No-bet value gate: ${snapshot.status.toLowerCase()} at ${snapshot.oddsPercent}% odds.`, snapshot };
  }
  return { allow: true, reason: 'Value acceptable', snapshot };
}

function getTenMinuteEliteStatus(decision = state.decision) {
  if (!decision || !['OVER', 'UNDER'].includes(decision.action)) return 'Waiting';
  const remainingSec = getRemainingSec();
  const minute = Math.max(1, Math.min(15, Math.ceil(remainingSec / 60)));
  if (minute !== 10) return 'Only checked at 10m';
  const timing = getTimingSignal(decision);
  const price = Number(state.ticks.at(-1)?.price ?? decision.currentPrice);
  const targetPrice = Number($('targetPrice').value || decision.targetPrice);
  const rightSide = isCorrectSideOfTarget(decision.action, price, targetPrice);
  const cushion = Math.abs(price - targetPrice);
  const eliteCushion = Math.max(18, targetPrice * 0.00028);
  const genesis = getGenesisGateSnapshot(decision, remainingSec);
  const passes = Number(decision.confidence || 0) >= 92 && Number(decision.stability || 0) >= 90 && Number(decision.flipRisk || 100) <= 48 && Number(timing.entryQuality || 0) >= 76 && getHeldDurationMs(decision) >= 30000 && rightSide && cushion >= eliteCushion && genesis.allow;
  return passes ? `Ready · ${genesis.tradeGrade}` : `Not elite · ${genesis.status}`;
}


function getSelectedTradingStyle() {
  const key = $('tradingStyleSelect')?.value || state.settings.tradingStyle || DEFAULT_TRADING_STYLE;
  return TRADING_STYLES[key] ? key : DEFAULT_TRADING_STYLE;
}

function getTradingStyleRecommendation(decision = state.decision, candidate = null) {
  const styleKey = getSelectedTradingStyle();
  const style = TRADING_STYLES[styleKey] || TRADING_STYLES[DEFAULT_TRADING_STYLE];
  const snapshot = getExpectedValueSnapshot(decision);
  const readiness = getLockReadinessSnapshot(decision);
  const authority = getTargetAuthorityStatus();
  const action = decision?.action;
  const officialLock = state.currentLadder?.officialCall;
  const candidateSnapshot = candidate || getOfficialLockCandidate(decision, getRemainingSec());
  const hasTradeSignal = ['OVER', 'UNDER'].includes(action);
  const profit = Number(snapshot.winProfit ?? snapshot.expectedProfit ?? 0);
  const freshOdds = Boolean(snapshot.available);

  if (!authority.official) {
    return {
      styleKey,
      styleLabel: style.label,
      status: 'Official data required',
      level: 'bad',
      message: `${style.label}: waiting for verified official KXBTC15M target before money guidance.`,
      note: authority.reason
    };
  }
  const targetWarning = '';
  if (!hasTradeSignal) {
    return {
      styleKey,
      styleLabel: style.label,
      status: 'Waiting',
      level: 'quiet',
      message: `${style.label}: no active trade signal yet.`,
      note: style.note
    };
  }
  if (!freshOdds) {
    const base = (officialLock ? `${style.label}: tracker locked ${officialLock.action}, but money value needs fresh matching odds.` : `${style.label}: signal present, but money value needs fresh matching odds.`) + targetWarning;
    return { styleKey, styleLabel: style.label, status: 'Money unavailable', level: 'warn', message: base, note: snapshot.reason || style.note };
  }

  const payoutText = `win +${formatDollar(Math.max(0, Number(snapshot.winProfit || 0)))} on $0.50`;
  if (styleKey === 'safe_cents') {
    const ok = officialLock || (candidateSnapshot.allow && Number(readiness.percent || 0) >= style.minReadiness);
    return {
      styleKey,
      styleLabel: style.label,
      status: ok ? 'Accept small win' : 'Wait',
      level: ok ? 'good' : 'quiet',
      message: (ok ? `Safe / Cents: acceptable. ${payoutText}.` : `Safe / Cents: wait for official tracker lock or ${style.minReadiness}% readiness.`) + targetWarning,
      note: style.note
    };
  }
  if (styleKey === 'value_hunter') {
    const ok = (officialLock || candidateSnapshot.allow) && profit >= style.minProfit && Number(snapshot.evPercent || 0) > 10;
    return {
      styleKey,
      styleLabel: style.label,
      status: ok ? 'Value entry' : 'Skip tiny payout',
      level: ok ? 'good' : 'warn',
      message: (ok ? `Value Hunter: payout passes. ${payoutText}.` : `Value Hunter: tracker may be right, but payout is too small. Needs about +${formatDollar(style.minProfit)} or better.`) + targetWarning,
      note: style.note
    };
  }
  if (styleKey === 'aggressive_value') {
    const genesis = candidateSnapshot.genesisGate || getGenesisGateSnapshot(decision, getRemainingSec());
    const ok = Number(readiness.percent || 0) >= style.minReadiness && genesis.allow && profit >= style.minProfit;
    return {
      styleKey,
      styleLabel: style.label,
      status: ok ? 'Aggressive possible' : 'Wait',
      level: ok ? 'warn' : 'quiet',
      message: (ok ? `Aggressive Value: possible early money idea, not official tracker lock. ${payoutText}.` : `Aggressive Value: needs ${style.minReadiness}% readiness, Genesis agreement, and about +${formatDollar(style.minProfit)} payout.`) + targetWarning,
      note: style.note
    };
  }
  if (styleKey === 'scout') {
    const ok = Number(readiness.percent || 0) >= style.minReadiness && profit >= style.minProfit;
    return {
      styleKey,
      styleLabel: style.label,
      status: ok ? 'Scout idea' : 'Wait',
      level: ok ? 'warn' : 'quiet',
      message: (ok ? `Scout: early high-risk idea only, not official tracker lock. ${payoutText}.` : `Scout: waiting for ${style.minReadiness}% readiness and any worthwhile payout.`) + targetWarning,
      note: style.note
    };
  }

  const balancedOk = (officialLock || candidateSnapshot.allow) && !snapshot.tooExpensive && profit >= style.minProfit;
  return {
    styleKey,
    styleLabel: style.label,
    status: balancedOk ? 'Balanced money OK' : 'Wait / small payout',
    level: balancedOk ? 'good' : 'quiet',
    message: (balancedOk ? `Balanced: money entry acceptable. ${payoutText}.` : `Balanced: official lock may still count, but payout/value is thin.`) + targetWarning,
    note: style.note
  };
}

function renderTradingStyleOverlay() {
  const el = $('styleOverlay');
  if (!el) return;
  const rec = getTradingStyleRecommendation(state.decision);
  el.textContent = rec.message;
  el.className = `style-overlay ${rec.level || 'quiet'}`;
}

function getChartSignalSupport(decision = state.decision) {
  const chart = decision?.chartSignals || state.rawDecision?.chartSignals || null;
  if (!chart?.available) {
    return { available: false, direction: 'NEUTRAL', score: 50, supports: false, conflict: false, supportScore: 50, oppositeScore: 50, label: 'Waiting for candle data' };
  }
  const side = ['OVER', 'UNDER'].includes(decision?.action) ? decision.action : decision?.choice;
  const supportScore = side === 'UNDER' ? Number(chart.underScore || 50) : Number(chart.overScore || 50);
  const oppositeScore = side === 'UNDER' ? Number(chart.overScore || 50) : Number(chart.underScore || 50);
  const supports = ['OVER', 'UNDER'].includes(side) && chart.direction === side && supportScore >= 56;
  const conflict = ['OVER', 'UNDER'].includes(side) && chart.direction !== 'NEUTRAL' && chart.direction !== side && oppositeScore >= 62;
  return { ...chart, supports, conflict, supportScore, oppositeScore, label: `${chart.direction} ${Number(chart.score || 0).toFixed(0)}` };
}

function renderChartSignalLayer(decision = state.decision) {
  const scoreEl = $('microTrendScore');
  const table = $('chartSignalLayer');
  const chart = decision?.chartSignals || state.rawDecision?.chartSignals;
  if (!scoreEl || !table) return;
  if (!chart?.available) {
    scoreEl.textContent = 'Waiting';
    table.innerHTML = '<div class="mini-row"><strong>Status</strong><span>Waiting for candles and verified target.</span></div>';
    return;
  }
  const directionClass = chart.direction === 'OVER' ? 'good-text' : chart.direction === 'UNDER' ? 'bad-text' : '';
  scoreEl.innerHTML = `<span class="${directionClass}">${escapeHtml(chart.direction)} ${Number(chart.score || 0).toFixed(0)}</span>`;
  const rows = [
    ['Micro trend', `${chart.direction} · OVER ${chart.overScore} / UNDER ${chart.underScore}`],
    ['EMA / VWAP', `${chart.emaTrend} · ${chart.vwapSide === 'OVER' ? 'above' : 'below'} VWAP ${fmtMoney(chart.vwap)}`],
    ['Momentum', `15s ${formatDollarSigned(chart.momentum15s)} · 60s ${formatDollarSigned(chart.momentum60s)} · 3m ${formatDollarSigned(chart.momentum3m)}`],
    ['Cushion velocity', `OVER ${formatDollarSigned(chart.overCushionVelocity)}/m · UNDER ${formatDollarSigned(chart.underCushionVelocity)}/m`],
    ['RSI / volatility', `RSI ${chart.rsi} (${chart.rsiSlope >= 0 ? '+' : ''}${chart.rsiSlope}) · ${chart.volatilityState}`]
  ];
  table.innerHTML = rows.map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('');
}


function renderMoneyTools() {
  const el = $('moneyFilter');
  if (!el) return;
  const snapshot = getExpectedValueSnapshot(state.decision);
  const valueGate = getMoneyValueGate(state.decision);
  const odds = snapshot.available ? `${snapshot.oddsPercent}% ${snapshot.oddsStatus ? `· ${snapshot.oddsStatus}` : ''}` : (snapshot.oddsStatus || 'Unavailable');
  const styleRec = getTradingStyleRecommendation(state.decision);
  const rows = [
    ['EV status', snapshot.available ? snapshot.status : `${snapshot.status || 'Waiting'}${snapshot.reason ? ` · ${snapshot.reason}` : ''}`],
    ['Trading style', `${styleRec.styleLabel}: ${styleRec.status}`],
    ['Style guidance', styleRec.message],
    ['Odds cost', odds],
    ['Win est.', snapshot.available ? `${snapshot.winProbability}%` : '—'],
    ['EV / $0.50', snapshot.available ? `${formatDollarSigned(snapshot.expectedProfit)} · ${snapshot.evPercent}%` : '—'],
    ['Expensive rule', snapshot.available ? (valueGate.allow ? 'OK' : 'Warning only') : 'No odds'],
    ['Genesis gate', getGenesisGateSnapshot(state.decision, getRemainingSec()).status],
    ['Latest money entry', '6m marker'],
    ['10m elite', getTenMinuteEliteStatus(state.decision)]
  ];
  el.innerHTML = rows.map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('');
}

function getCashOutAlert() {
  const ladder = state.currentLadder;
  const lock = ladder?.officialCall;
  if (!lock || !['OVER', 'UNDER'].includes(lock.action)) return { level: 'quiet', label: 'Cash out alert: none', reasons: [] };
  const latestPrice = Number(state.ticks.at(-1)?.price ?? ladder.lastSeenPrice);
  const targetPrice = Number(ladder.targetPrice || $('targetPrice').value);
  if (!Number.isFinite(latestPrice) || !Number.isFinite(targetPrice)) return { level: 'quiet', label: 'Cash out alert: none', reasons: [] };
  const side = lock.action;
  const opposite = side === 'OVER' ? 'UNDER' : 'OVER';
  const remainingSec = getRemainingSec();
  const cushion = side === 'OVER' ? latestPrice - targetPrice : targetPrice - latestPrice;
  const priceThroughTarget = cushion < 0;
  const nearLine = cushion >= 0 && cushion < Math.max(10, targetPrice * 0.00016);
  const recentOpposite = state.signalHistory.filter((item) => item.ts >= Date.now() - 45_000 && item.action === opposite).length;
  const rawOpposite = state.rawDecision?.action === opposite && Number(state.rawDecision?.confidence || 0) >= 72;
  const activeOpposite = state.decision?.action === opposite && Number(state.decision?.confidence || 0) >= 72;
  const flipRisk = Math.max(Number(state.rawDecision?.flipRisk || 0), Number(state.decision?.flipRisk || 0));
  const confidenceDrop = Number(lock.confidence || 0) - Number(state.decision?.confidence || 0) >= 15;
  const lockPrice = Number(lock.price);
  const movedAgainst = Number.isFinite(lockPrice)
    ? (side === 'OVER' ? latestPrice <= lockPrice - 18 : latestPrice >= lockPrice + 18)
    : false;
  const chart = getChartSignalSupport(state.decision || state.rawDecision);
  const chartAgainst = chart.available && chart.direction === opposite && Number(chart.score || 0) >= 58;
  const lockCushionVelocity = side === 'OVER' ? Number(chart.overCushionVelocity || 0) : Number(chart.underCushionVelocity || 0);
  const cushionShrinking = chart.available && lockCushionVelocity <= -12;
  const cushionCollapsing = chart.available && lockCushionVelocity <= -24;
  let score = 0;
  let watchScore = 0;
  const reasons = [];
  const watchReasons = [];
  if (priceThroughTarget) { score += 3; reasons.push('price crossed target against lock'); }
  if (nearLine) { score += 1; watchScore += 1; reasons.push('lock cushion nearly gone'); watchReasons.push('lock cushion nearly gone'); }
  if (recentOpposite >= 3) { score += 2; reasons.push('opposite signal persisted'); }
  if (rawOpposite || activeOpposite) { score += 2; reasons.push('opposite raw signal strong'); }
  if (flipRisk >= 70) { score += 2; reasons.push('flip risk very high'); }
  else if (flipRisk >= 60) { score += 1; watchScore += 1; reasons.push('flip risk rising'); watchReasons.push('flip risk rising'); }
  if (confidenceDrop) { score += 1; watchScore += 1; reasons.push('confidence dropped'); watchReasons.push('confidence dropped'); }
  if (movedAgainst) { score += 1; watchScore += 1; reasons.push('price moved against entry'); watchReasons.push('price moved against entry'); }
  if (chartAgainst) { score += 1; watchScore += 2; reasons.push('chart layer turned against lock'); watchReasons.push('chart layer turned against lock'); }
  if (cushionShrinking) { watchScore += 2; watchReasons.push('cushion shrinking fast'); }
  if (cushionCollapsing) { score += 1; watchScore += 1; reasons.push('cushion collapsing'); }
  if (remainingSec <= 60 && priceThroughTarget) {
    return { level: 'danger', label: `Cash out emergency: ${reasons.slice(0, 2).join(', ')}`, reasons, score };
  }
  if (score >= MIN_CASH_OUT_SCORE && (priceThroughTarget || recentOpposite >= 3 || rawOpposite || activeOpposite || cushionCollapsing)) {
    return { level: 'danger', label: `Cash out alert: HIGH · ${reasons.slice(0, 2).join(', ')}`, reasons, score };
  }
  if (remainingSec <= 240 && remainingSec > 60 && watchScore >= 3 && (chartAgainst || cushionShrinking || nearLine || movedAgainst)) {
    const cleanReasons = [...new Set(watchReasons)].slice(0, 2).join(', ');
    return { level: 'warn', label: `Cash out watch: ${cleanReasons}`, reasons: watchReasons, score: watchScore };
  }
  return { level: 'quiet', label: 'Cash out alert: none', reasons, score };
}

function renderCashOutAlert() {
  const el = $('cashOutAlert');
  if (!el) return;
  const alert = getCashOutAlert();
  el.textContent = alert.label;
  el.className = `cash-out-alert ${alert.level}`;
}

function summarizeProfitByLockType() {
  const groups = {};
  for (const record of getOfficialTrackerRecords()) {
    if (!record.realizedReturn?.available || !['win', 'loss'].includes(record.result)) continue;
    const key = record.officialCall?.source || record.callSource || 'unknown lock';
    groups[key] ||= { lockType: key, count: 0, wins: 0, losses: 0, stake: 0, net: 0, roi: 0 };
    const bucket = groups[key];
    bucket.count += 1;
    if (record.result === 'win') bucket.wins += 1;
    if (record.result === 'loss') bucket.losses += 1;
    bucket.stake += Number(record.realizedReturn.stake || ASSUMED_STAKE_DOLLARS);
    bucket.net += Number(record.realizedReturn.profit || 0);
  }
  for (const bucket of Object.values(groups)) {
    bucket.net = round2(bucket.net);
    bucket.stake = round2(bucket.stake);
    bucket.roi = bucket.stake > 0 ? round2((bucket.net / bucket.stake) * 100) : 0;
  }
  return Object.values(groups).sort((a, b) => b.net - a.net || b.count - a.count);
}

function renderProfitByLockType() {
  const el = $('profitByLockType');
  if (!el) return;
  const rows = summarizeProfitByLockType().slice(0, 5);
  if (!rows.length) {
    el.innerHTML = '<div class="small-muted">No settled live-return lock types yet.</div>';
    return;
  }
  el.innerHTML = rows.map((row) => `<div class="mini-row"><strong>${escapeHtml(row.lockType)}</strong><span>${row.wins}/${row.count}</span><span>${formatDollarSigned(row.net)}</span><span>${row.roi}%</span></div>`).join('');
}

function getSkippedHypotheticalSignal(ladder) {
  if (!ladder || ladder.finalSide === 'PUSH') return null;
  const candidates = [];
  for (const item of Object.values(ladder.entryMinutes || {})) {
    if (!['OVER', 'UNDER'].includes(item.action)) continue;
    candidates.push({ source: `${item.minute}m entry`, minute: Number(item.minute || 0), action: item.action, score: Number(item.moneyScore || item.entryQuality || 0) });
  }
  for (const [minute, cp] of Object.entries(ladder.checkpoints || {})) {
    if (!['OVER', 'UNDER'].includes(cp.action)) continue;
    candidates.push({ source: `${minute}m checkpoint`, minute: Number(minute), action: cp.action, score: Number(cp.confidence || 0) * 0.55 + (100 - Number(cp.flipRisk || 100)) * 0.25 + Number(cp.stability || 0) * 0.2 });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || Math.abs(6 - a.minute) - Math.abs(6 - b.minute));
  return candidates[0];
}

function summarizeWouldHaveWon() {
  const ladders = state.ladders.filter((ladder) => ladder && ladder.result === 'skipped' && !ladder.officialCall && ladder.finalSide && ladder.finalSide !== 'PUSH');
  const summary = { skipped: ladders.length, evaluated: 0, wouldWin: 0, wouldLoss: 0, noSignal: 0, examples: [] };
  for (const ladder of ladders) {
    const signal = getSkippedHypotheticalSignal(ladder);
    if (!signal) { summary.noSignal += 1; continue; }
    summary.evaluated += 1;
    const outcome = signal.action === ladder.finalSide ? 'wouldWin' : 'wouldLoss';
    summary[outcome] += 1;
    if (summary.examples.length < 4) {
      summary.examples.push({ ...signal, finalSide: ladder.finalSide, outcome, targetPrice: ladder.targetPrice, finalPrice: ladder.finalPrice });
    }
  }
  return summary;
}

function renderWouldHaveWonTracker() {
  const el = $('wouldHaveWonTracker');
  if (!el) return;
  const summary = summarizeWouldHaveWon();
  const rows = [
    ['Skipped', String(summary.skipped)],
    ['Had signal', String(summary.evaluated)],
    ['Would win', String(summary.wouldWin)],
    ['Would lose', String(summary.wouldLoss)],
    ['No clear signal', String(summary.noSignal)]
  ];
  const exampleRows = summary.examples.map((item) => `<div class="mini-row"><strong>${escapeHtml(item.source)}</strong><span>${escapeHtml(item.action)}</span><span>${item.outcome === 'wouldWin' ? '✓' : '✕'}</span><span>${escapeHtml(item.finalSide)}</span></div>`).join('');
  el.innerHTML = rows.map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('') + (exampleRows ? `<div class="section-subtitle tight">Recent skipped signals</div>${exampleRows}` : '');
}

function captureLiveReturnAtLock(action) {
  const normalized = String(action || '').toUpperCase();
  if (!['OVER', 'UNDER'].includes(normalized)) {
    return { available: false, reason: 'No locked side', stake: ASSUMED_STAKE_DOLLARS };
  }
  const odds = getStrictOddsSnapshotForSide(normalized);
  if (!odds.available) {
    return {
      available: false,
      reason: odds.reason || 'Fresh matching Coinbase odds unavailable at lock',
      stake: ASSUMED_STAKE_DOLLARS,
      side: normalized,
      capturedAt: Date.now(),
      source: odds.source || state.coinbasePrediction?.source || state.oddsCache?.source || 'unavailable',
      ticker: odds.ticker || state.coinbasePrediction?.ticker || state.market?.ticker || state.oddsCache?.ticker || '',
      oddsAgeSec: odds.oddsAgeSec,
      oddsStatus: odds.status || getOddsCacheStatus().label,
      fresh: false,
      tickerMatch: false
    };
  }
  const oddsPercent = odds.oddsPercent;
  const multiplier = 100 / oddsPercent;
  const winReturn = ASSUMED_STAKE_DOLLARS * multiplier;
  const winProfit = winReturn - ASSUMED_STAKE_DOLLARS;
  return {
    available: true,
    stake: ASSUMED_STAKE_DOLLARS,
    side: normalized,
    oddsPercent: round2(oddsPercent),
    multiplier: round2(multiplier),
    winReturn: round2(winReturn),
    winProfit: round2(winProfit),
    lossProfit: round2(-ASSUMED_STAKE_DOLLARS),
    capturedAt: Date.now(),
    source: odds.source,
    ticker: odds.ticker,
    oddsAgeSec: odds.oddsAgeSec,
    oddsStatus: odds.status,
    fresh: true,
    tickerMatch: true
  };
}

function getCurrentCoinbaseOddsForSide(side) {
  const field = side === 'OVER' ? 'yesPrice' : 'noPrice';
  const candidates = [
    state.coinbasePrediction?.[field],
    state.orderbook?.[field],
    state.market?.[side === 'OVER' ? 'yes_bid' : 'no_bid'],
    state.predictionPriceHistory.at(-1)?.[field],
    getFreshCachedOddsForSide(side)
  ];
  for (const value of candidates) {
    const normalized = normalizePercentPrice(value);
    if (Number.isFinite(normalized) && normalized > 0 && normalized < 100) return normalized;
  }
  return null;
}

function normalizePercentPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) return n * 100;
  if (n > 1 && n < 100) return n;
  return null;
}

function settleLiveReturn(snapshot, result) {
  if (!snapshot?.available) {
    return { available: false, reason: snapshot?.reason || 'No Coinbase odds captured' };
  }
  const outcome = String(result || '').toLowerCase();
  if (outcome === 'win') {
    return {
      available: true,
      stake: snapshot.stake,
      returnAmount: snapshot.winReturn,
      profit: snapshot.winProfit,
      result: 'win'
    };
  }
  if (outcome === 'loss') {
    return {
      available: true,
      stake: snapshot.stake,
      returnAmount: 0,
      profit: snapshot.lossProfit,
      result: 'loss'
    };
  }
  return {
    available: true,
    stake: snapshot.stake,
    returnAmount: 0,
    profit: 0,
    result: outcome || 'skipped'
  };
}

function summarizeLiveReturns() {
  const records = getOfficialTrackerRecords();
  const tracked = records.filter((record) => record.liveReturn?.available && record.realizedReturn?.available && ['win', 'loss'].includes(record.result));
  const unavailable = records.filter((record) => !record.liveReturn?.available && ['win', 'loss'].includes(record.result));
  const stake = tracked.reduce((sum, record) => sum + Number(record.realizedReturn?.stake || ASSUMED_STAKE_DOLLARS), 0);
  const net = tracked.reduce((sum, record) => sum + Number(record.realizedReturn?.profit || 0), 0);
  const returns = tracked.reduce((sum, record) => sum + Number(record.realizedReturn?.returnAmount || 0), 0);
  const roi = stake > 0 ? (net / stake) * 100 : 0;
  const last = records.find((record) => record.liveReturn?.available) || null;
  return { tracked: tracked.length, unavailable: unavailable.length, stake, net, returns, roi, last };
}

function renderLiveReturnTracker() {
  const summary = summarizeLiveReturns();
  const stakeEl = $('returnStake');
  const trackedEl = $('returnTracked');
  const netEl = $('returnNet');
  const roiEl = $('returnRoi');
  const tableEl = $('liveReturnTracker');
  if (stakeEl) stakeEl.textContent = formatDollar(ASSUMED_STAKE_DOLLARS);
  if (trackedEl) trackedEl.textContent = String(summary.tracked);
  if (netEl) {
    netEl.textContent = formatDollarSigned(summary.net);
    netEl.className = summary.net > 0 ? 'good-text' : summary.net < 0 ? 'bad-text' : '';
  }
  if (roiEl) roiEl.textContent = `${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(1)}%`;
  if (!tableEl) return;
  const last = summary.last?.liveReturn;
  const lastText = last?.available
    ? `${last.side} · ${last.oddsPercent}% · ${last.multiplier}x`
    : 'No live odds captured yet';
  const oddsStatus = getOddsCacheStatus();
  tableEl.innerHTML = [
    ['Odds cache', oddsStatus.label],
    ['Last lock', lastText],
    ['If win', last?.available ? `${formatDollar(last.winReturn)} return / ${formatDollarSigned(last.winProfit)}` : '—'],
    ['If loss', last?.available ? formatDollarSigned(last.lossProfit) : '—'],
    ['Odds missing', String(summary.unavailable)]
  ].map(([label, value]) => `<div class="mini-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`).join('');
}

function formatDollar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function formatDollarSigned(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function renderRecords() {
  const container = $('records');
  if (!state.records.length) {
    container.innerHTML = '<div class="small-muted">No records yet. Record decisions to start tracking.</div>';
    return;
  }
  container.innerHTML = '';
  const template = $('recordTemplate');
  state.records.slice(0, 30).forEach((record) => {
    const node = template.content.cloneNode(true);
    const confidenceLabel = record.confidence === null || record.confidence === undefined ? 'auto' : `${record.confidence}%`;
    const typeLabel = record.recordType === 'auto_ladder' ? 'auto ladder' : 'manual';
    const finalLabel = record.finalSide ? ` · ended ${record.finalSide}` : '';
    const sourceLabel = record.callSource ? ` · ${record.callSource}` : '';
    const returnLabel = record.realizedReturn?.available ? ` · ${formatDollarSigned(record.realizedReturn.profit)}` : '';
    node.querySelector('.record-title').textContent = `${record.recommendation} · ${confidenceLabel} · ${record.result}${finalLabel}${returnLabel}`;
    node.querySelector('.record-meta').textContent = `${new Date(record.ts).toLocaleString()} · ${typeLabel} · ${record.profile} · ${record.checkpoint}${sourceLabel} · ${record.ticker || 'manual'}`;
    node.querySelectorAll('button[data-result]').forEach((button) => {
      button.addEventListener('click', () => settleAndRender(record.id, button.dataset.result));
    });
    container.appendChild(node);
  });
}

function settleAndRender(id, result) {
  const finalPrice = state.ticks.at(-1)?.price ?? null;
  state.records = state.records.map((record) => record.id === id ? settleRecord(record, result, finalPrice) : record);
  saveRecords();
  renderRecords();
  renderStats();
}

function getOfficialTrackerRecords() {
  return state.records.filter((record) => record.recordType === 'auto_ladder' && Number(record.trackerLockVersion || 0) >= TRACKER_LOCK_VERSION);
}


function summarizeLockEntryTypes(records = getOfficialTrackerRecords()) {
  const summary = {
    money: { total: 0, wins: 0, losses: 0 },
    late: { total: 0, wins: 0, losses: 0 }
  };
  for (const record of records) {
    if (!['win', 'loss'].includes(record.result)) continue;
    const source = String(record.officialCall?.source || record.callSource || '').toLowerCase();
    const isLateProof = record.officialCall?.entryEligible === false || source.includes('late proof') || source.includes('no-entry');
    const bucket = isLateProof ? summary.late : summary.money;
    bucket.total += 1;
    if (record.result === 'win') bucket.wins += 1;
    if (record.result === 'loss') bucket.losses += 1;
  }
  return summary;
}

function renderStats() {
  const summary = summarizeRecords(getOfficialTrackerRecords());
  $('wins').textContent = summary.wins;
  $('losses').textContent = summary.losses;
  $('skipped').textContent = summary.skipped;
  $('winRate').textContent = `${summary.winRate}%`;
  const lockTypes = summarizeLockEntryTypes(getOfficialTrackerRecords());
  const moneyEntryEl = $('moneyEntryLocks');
  const lateProofEl = $('lateProofLocks');
  if (moneyEntryEl) moneyEntryEl.textContent = `W ${lockTypes.money.wins} / L ${lockTypes.money.losses}`;
  if (lateProofEl) lateProofEl.textContent = `W ${lockTypes.late.wins} / L ${lockTypes.late.losses}`;
  const profileRows = Object.entries(summary.byProfile).map(([profile, stats]) =>
    `<div class="mini-row"><strong>${escapeHtml(profile)}</strong><span>W ${stats.wins}</span><span>L ${stats.losses}</span><span>S ${stats.skipped}</span><span>${stats.winRate}%</span></div>`
  ).join('');
  $('profileStats').innerHTML = profileRows || '<div class="small-muted">Official tracker stats start with version 10 locked calls.</div>';
  renderLadderStats();
  renderLiveReturnTracker();
  renderProfitByLockType();
  renderWouldHaveWonTracker();
  renderMoneyTools();
}

function exportTracker() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records: state.records, officialTrackerRecords: getOfficialTrackerRecords(), completedLadders: state.ladders, ladderAccuracy: summarizeLadderAccuracy(), currentLadder: state.currentLadder, learning: getLearningSummary(), entryMinuteStats: summarizeEntryMinuteTracker(), liveReturnStats: summarizeLiveReturns(), lockEntryTypes: summarizeLockEntryTypes(), profitByLockType: summarizeProfitByLockType(), wouldHaveWonStats: summarizeWouldHaveWon(), oddsCache: state.oddsCache }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edge15-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearTracker() {
  const confirmed = confirm('Clear all tracker records on this browser?');
  if (!confirmed) return;
  state.records = [];
  state.ladders = [];
  state.currentLadder = null;
  saveRecords();
  saveLadders();
  localStorage.removeItem(CURRENT_LADDER_KEY);
  localStorage.removeItem(ODDS_CACHE_KEY);
  state.oddsCache = null;
  renderCompletedLadders();
  renderRecords();
  renderStats();
}

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
}

function saveRecords() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.records));
}

function loadLadders() {
  try { return JSON.parse(localStorage.getItem(LADDERS_KEY) || '[]'); }
  catch { return []; }
}

function saveLadders() {
  localStorage.setItem(LADDERS_KEY, JSON.stringify(state.ladders));
}

function loadCurrentLadder() {
  try { return JSON.parse(localStorage.getItem(CURRENT_LADDER_KEY) || 'null'); }
  catch { return null; }
}

function saveCurrentLadder() {
  if (state.currentLadder) localStorage.setItem(CURRENT_LADDER_KEY, JSON.stringify(state.currentLadder));
}

function loadOddsCache() {
  try { return JSON.parse(localStorage.getItem(ODDS_CACHE_KEY) || 'null'); }
  catch { return null; }
}

function saveOddsCache() {
  if (state.oddsCache) localStorage.setItem(ODDS_CACHE_KEY, JSON.stringify(state.oddsCache));
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch { return {}; }
}

function saveSettingsFromUi() {
  const tickerEl = $('marketTicker');
  state.settings = {
    targetPrice: '',
    minutesLeft: '',
    profile: $('profileSelect').value,
    refreshSeconds: $('refreshSeconds').value,
    marketTicker: tickerEl?.value || '',
    tradingStyle: $('tradingStyleSelect')?.value || DEFAULT_TRADING_STYLE,
    manualEndAt: null
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}


function setTargetFromCurrent() {
  $('readiness').textContent = 'Manual target disabled in v20. Waiting for verified KXBTC15M target.';
}

function startManualCountdown(minutes = 15) {
  $('readiness').textContent = 'Manual countdown disabled in v20. Waiting for verified official market close time.';
}

function resetDecisionSession(render = true) {
  state.previousRemainingSec = null;
  state.capturedCheckpoints = {};
  state.capturedEntryMinutes = {};
  state.checkpointHistory = [];
  state.signalHistory = [];
  state.heldDecision = null;
  state.pendingSwitch = null;
  state.currentLadder = null;
  localStorage.removeItem(CURRENT_LADDER_KEY);
  if (render) {
    evaluateAndRender(false);
    renderLadder();
  }
}

async function checkApiHealth() {
  const debug = $('apiDebug');
  if (!debug) return;
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    debug.textContent = response.ok && data.ok ? 'API health: connected.' : 'API health: unexpected response.';
  } catch (error) {
    debug.textContent = `API health: ${error.message}`;
  }
}

function safeJson(value) {
  try { return JSON.parse(value); }
  catch { return null; }
}

function displayCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n > 1 ? n : n * 100).toFixed(1)}¢`;
}

function formatSignedChange(value, suffix = '') {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.05) return '';
  const sign = n > 0 ? '+' : '';
  return ` (${sign}${n.toFixed(1)}${suffix})`;
}

function normalizeDollarPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.0000';
  return (n > 1 ? n / 100 : n).toFixed(4);
}

function formatRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}
