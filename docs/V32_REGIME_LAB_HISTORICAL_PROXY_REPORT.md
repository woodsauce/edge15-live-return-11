# Edge15 V32 Regime Lab Historical Proxy Replay

This is a proxy replay because the old Genesis exports do not contain full tick tape/orderbook history. It tests V32-style score/grade/risk/distance logic against old resolved outcomes, then the live app adds extra regime/tape checks from current chart/tick fields.

| Dataset | Windows | Native W-L / Acc / Trade rate | V31 proxy W-L / Acc / Trade rate | V32 proxy W-L / Acc / Trade rate |
|---|---:|---:|---:|---:|
| Genesis-019 | 453 | 216-22 / 90.8% / 52.5% | 248-28 / 89.9% / 60.9% | 247-28 / 89.8% / 60.7% |
| Genesis-020 | 450 | 214-22 / 90.7% / 52.4% | 246-28 / 89.8% / 60.9% | 245-28 / 89.7% / 60.7% |
| Genesis-027 | 364 | 179-14 / 92.7% / 53.0% | 203-19 / 91.4% / 61.0% | 202-19 / 91.4% / 60.7% |
| Pooled | 1267 | 609-58 / 91.3% / 52.6% | 697-75 / 90.3% / 60.9% | 694-75 / 90.2% / 60.7% |

## Read

V32 is intentionally different from V31. It tests a regime/tape-pressure path that should become more active when the market is directional and less active in chop/exhaustion. The proxy shows the activity gain, but live testing is still required because the actual V32 regime engine uses chart/tick fields that are not present in these old exports.
