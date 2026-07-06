/*
Edge15 Browser Storage Exporter

Use this for older Edge15 versions that did NOT have a JSON export button.
Steps:
1. Open the older Edge15 program in the same browser/profile where it had the high win rate.
2. Press F12 or Ctrl+Shift+I to open DevTools.
3. Open the Console tab.
4. Paste this entire script and press Enter.
5. A file named edge15-browser-storage-export-<timestamp>.json will download.
6. Upload that JSON for analysis.

This tries localStorage first and also attempts IndexedDB database names when the browser supports it.
*/

(async function exportEdge15BrowserStorage() {
  const now = new Date().toISOString();
  const keyLooksRelevant = (k) => /edge15|btc|kalshi|commit|trade|tracker|genesis|strategy|profile|version|quality|timing|accuracy|journal/i.test(k);

  function parseMaybeJson(value) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }

  const localStorageDump = {};
  const sessionStorageDump = {};

  try {
    for (const k of Object.keys(localStorage)) {
      if (keyLooksRelevant(k)) localStorageDump[k] = parseMaybeJson(localStorage.getItem(k));
    }
  } catch (err) {
    localStorageDump.__error = String(err?.message || err);
  }

  try {
    for (const k of Object.keys(sessionStorage)) {
      if (keyLooksRelevant(k)) sessionStorageDump[k] = parseMaybeJson(sessionStorage.getItem(k));
    }
  } catch (err) {
    sessionStorageDump.__error = String(err?.message || err);
  }

  async function dumpIndexedDbNames() {
    if (!indexedDB.databases) return { supported: false, note: 'indexedDB.databases() not supported in this browser.' };
    try {
      const dbs = await indexedDB.databases();
      return {
        supported: true,
        databases: dbs.filter((db) => keyLooksRelevant(db.name || '')).map((db) => ({ name: db.name, version: db.version }))
      };
    } catch (err) {
      return { supported: true, error: String(err?.message || err) };
    }
  }

  const exportPayload = {
    app: 'Edge15',
    exportType: 'browser-storage-recovery',
    exportedAt: now,
    page: location.href,
    userAgent: navigator.userAgent,
    localStorage: localStorageDump,
    sessionStorage: sessionStorageDump,
    indexedDB: await dumpIndexedDbNames(),
    notes: [
      'If localStorage contains the Edge15 storage keys, this is enough to analyze the old high-win-rate version.',
      'If this file is empty, the old app may have stored data under different keys, in a different browser profile, or only in memory.'
    ]
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edge15-browser-storage-export-${now.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  console.log('Edge15 browser storage export created:', exportPayload);
})();
