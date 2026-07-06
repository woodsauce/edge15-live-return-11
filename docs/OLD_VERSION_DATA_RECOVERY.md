# Recovering Data From an Older Edge15 Version With No JSON Button

Yes, there is a good chance the data can be recovered.

The older program probably stored its results in the browser using `localStorage`. Genesis-027 used storage keys such as:

- `edge15.commitmentAccuracy.v3.replay`
- `edge15.signalPlan.v2.commitment`
- `edge15.tradeJournal.v1`
- `edge15.engineAverages.v1`
- `edge15.tradeQualityFilter.v1`
- `edge15.commitTimingLab.v1`
- `edge15.versionLab.v1`
- `edge15.strategyProfileLab.v1`
- `edge15.adaptiveCommitLab.v1`

## Easiest recovery method

1. Open the older high-win-rate program in the same browser/profile where you used it.
2. Press `F12` or `Ctrl + Shift + I`.
3. Open the `Console` tab.
4. Paste the full contents of:

   `tools/edge15-devtools-storage-exporter.js`

5. Press Enter.
6. Upload the downloaded JSON file.

## If nothing exports

Try these checks:

1. Use the exact same browser where the high win rate was recorded.
2. Use the same domain/Vercel URL. Browser storage is separated by website origin.
3. Open DevTools > Application > Local Storage and check each Edge15/Vercel domain manually.
4. Search storage keys for `edge15`, `trade`, `commit`, `tracker`, `genesis`, `version`, or `journal`.

If the old app never saved results to browser storage, then we cannot recover exact historical records from the program itself. In that case, screenshots or manually written win/loss logs are the fallback.
