const KEY = 'edge15:cloud-tracker:v21:records';
const MAX_RECORDS = 500;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    const loaded = await kvGet(KEY);
    if (!loaded.enabled) {
      return res.status(200).json({
        ok: true,
        cloudEnabled: false,
        records: [],
        message: 'Cloud tracker storage is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel to sync phone and PC history.'
      });
    }
    return res.status(200).json({ ok: true, cloudEnabled: true, records: loaded.records || [] });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const incoming = Array.isArray(body?.records) ? body.records : [];
    const loaded = await kvGet(KEY);
    if (!loaded.enabled) {
      return res.status(200).json({
        ok: true,
        cloudEnabled: false,
        saved: false,
        records: [],
        message: 'Cloud tracker storage is not configured.'
      });
    }

    const merged = mergeRecords(loaded.records || [], incoming).slice(0, MAX_RECORDS);
    await kvSet(KEY, merged);
    return res.status(200).json({ ok: true, cloudEnabled: true, saved: true, count: merged.length, records: merged.slice(0, 75) });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

function mergeRecords(existing, incoming) {
  const map = new Map();
  const add = (record) => {
    if (!record || typeof record !== 'object') return;
    const ticker = String(record.ticker || '');
    if (!ticker.startsWith('KXBTC15M-')) return;
    const key = record.id || `${record.windowKey || ''}|${record.ticker || ''}|${record.ts || ''}`;
    if (!String(key).trim()) return;
    const prev = map.get(key);
    if (!prev || Number(record.settledAt || record.ts || 0) >= Number(prev.settledAt || prev.ts || 0)) map.set(key, record);
  };
  existing.forEach(add);
  incoming.forEach(add);
  return [...map.values()].sort((a, b) => Number(b.settledAt || b.ts || 0) - Number(a.settledAt || a.ts || 0));
}

async function readJson(req) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function kvGet(key) {
  const config = kvConfig();
  if (!config) return { enabled: false, records: [] };
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(['GET', key])
    });
    const data = await response.json().catch(() => ({}));
    const raw = data.result;
    if (!response.ok) throw new Error(data.error || `KV GET failed: ${response.status}`);
    if (!raw) return { enabled: true, records: [] };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { enabled: true, records: Array.isArray(parsed?.records) ? parsed.records : Array.isArray(parsed) ? parsed : [] };
  } catch (error) {
    return { enabled: false, records: [], error: error.message };
  }
}

async function kvSet(key, records) {
  const config = kvConfig();
  if (!config) throw new Error('KV not configured');
  const payload = JSON.stringify({ updatedAt: new Date().toISOString(), records });
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(['SET', key, payload])
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `KV SET failed: ${response.status}`);
}
