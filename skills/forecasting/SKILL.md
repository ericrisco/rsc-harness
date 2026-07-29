---
name: forecasting
description: "Use when projecting history forward — sales, demand, units, revenue, signups, traffic — into a defensible number with an error band: method by data shape, rolling-origin backtest, MASE vs the naive baseline. NOT an assumption-driven P&L or runway model (that is `financial-model`), NOT sizing reorder points or safety stock (that is `inventory`)."
tags: [forecasting, demand-planning, time-series, sales-forecast, statsforecast]
recommends: [inventory, financial-model, unit-economics, data-cleaning, analyze, duckdb]
origin: risco
---

# Forecasting

A forecast that cannot beat "repeat last period" is noise. Baseline first, fancy second. The naive forecast is free, instant, and the bar every model must clear — if your AutoARIMA loses to last-quarter-repeated, ship the repeat and say so.

You are not done when a model produces a number. You are done when you can defend the number: which method, why that method for this data, how it scored against the naive baseline in a backtest, and the interval around the point. A point estimate with no error band is a guess wearing a lab coat.

## The deliverable contract

Every forecast you ship is a reproducible artifact, not a number pasted in chat:

1. A **script** that reads the history and regenerates the forecast (no manual steps).
2. A **CSV/Parquet** with columns `ds, forecast, lo, hi` — timestamp, point, interval bounds.
3. A **one-paragraph accuracy readout**: WAPE + bias from a rolling-origin backtest, and MASE vs the naive baseline (MASE < 1.0 = you beat naive; ≥ 1.0 = ship the naive forecast instead).

If you cannot produce all three, you have not forecast — you have guessed. `scripts/verify.sh` checks the artifact has these columns, the right row count, and an accuracy line.

## The loop

Run these in order. Skipping step 3 is the most common failure.

1. **Frame it.** Pin down the horizon `h` (how many periods forward), the granularity (daily / weekly / monthly), and exactly what is being predicted (units? revenue? per-SKU or aggregate?). Forecast at the level you will *act* on — if you reorder per SKU, forecast per SKU, then sanity-check against the aggregate.
2. **Establish the series.** Regular timestamps, one row per period, gaps filled *explicitly* (a missing month is not zero unless it truly is). Flag promotions, stockouts, and outliers — they distort the signal. If the input is dirty (dupes, missing rows, mixed units), stop and hand off to `data-cleaning` before modeling. Garbage history, garbage forecast.
3. **Build the naive + seasonal-naive baseline.** This is the bar. Naive = repeat last value. Seasonal-naive = repeat the value from one season ago (e.g. last December for this December). Compute its backtest error now — every fancier method must beat it or lose.
4. **Pick the method by data shape** (table below). Do not reach for ARIMA on instinct.
5. **Backtest with rolling-origin cross-validation.** Never a single holdout. Compute WAPE + bias + MASE vs the naive baseline across multiple cutoffs.
6. **Report.** Point + interval, the one-line method rationale, the accuracy readout. Then hand off downstream (`inventory`, `financial-model`).

## Method selection

Match the method to the *shape* of the history, not to what sounds sophisticated. statsforecast (Nixtla, v2.0.3) provides all of these with built-in intervals.

| Data shape | Method | statsforecast call | Why |
|---|---|---|---|
| Flat, no trend or season | Moving average or SES | `AutoCES()` / 3-period MA | Nothing to model; a mean is honest. |
| Trend, with or without season | ETS | `AutoETS(season_length=m)` | ETS captures level+trend+season cleanly, no manual order. |
| Strong known seasonality / autocorrelation | ARIMA | `AutoARIMA(season_length=m)` | Handles autocorrelated errors; ~20x faster than pmdarima. |
| Many zeros (intermittent / lumpy demand) | Croston / SBA | `CrostonOptimized()` | SES is *provably* wrong on sporadic demand (Croston 1972); SBA debiases it. |
| < 2 full seasonal cycles of history | SeasonalNaive **only** | `SeasonalNaive(season_length=m)` | Too little data to fit a model. Do not fit one. Full stop. |

When in doubt between two, fit both plus the baseline in one `StatsForecast` run and let the backtest decide. Theta (`AutoTheta`) is a strong, cheap default that often wins on monthly business series.

## Accuracy and honesty

The metrics are not decoration — they decide what you ship.

- **WAPE, not MAPE.** MAPE divides by the actual, so it explodes and misleads whenever actuals approach zero (constant in SKU and intermittent data). WAPE = total absolute error / total actual volume — volume-weighted and stable. It is the default magnitude metric.
- **Pair WAPE with bias.** WAPE is *how big* the error is; bias is the *direction* — whether you systematically over- or under-forecast. A 10% WAPE with +9% bias means you are almost always forecasting high, an actionable problem quite different from random error.
- **MASE < 1.0 is the pass/fail line.** MASE is scale-free: your error over the naive forecast's error. Below 1.0 you beat naive; at or above it, ship the naive forecast instead. The single most important number in the readout.
- **Rolling-origin, never a single holdout.** Time-series CV repeats the train/test split across multiple cutoffs (expanding window), a far more reliable estimate than one lucky/unlucky split. Use `cross_validation(h=…, n_windows=…)`.
- **Always emit an interval.** A point forecast cannot express uncertainty, and point metrics cannot evaluate a distribution. Report `level=[80]` or `[95]`. The interval is half the deliverable, not optional polish.

Formulas (WAPE, MASE, bias, pinball, coverage), rolling-origin mechanics, and how to read a backtest table are in [`references/accuracy-and-backtesting.md`](references/accuracy-and-backtesting.md). Per-method when-to-use and the exact statsforecast one-liner for each are in [`references/methods-cheatsheet.md`](references/methods-cheatsheet.md).

## Minimal pipeline

The full pipeline: long-format dataframe, fit competing methods + baseline, backtest, forecast with an interval, write the artifact.

```python
# pip install statsforecast  (Nixtla, v2.0.3)
import pandas as pd
from statsforecast import StatsForecast
from statsforecast.models import SeasonalNaive, AutoETS, AutoARIMA

# long format: unique_id, ds, y  (one row per series per period)
df = pd.read_csv("history.csv", parse_dates=["ds"])
m, h = 12, 12  # monthly seasonality; forecast 12 periods ahead

sf = StatsForecast(
    models=[SeasonalNaive(season_length=m), AutoETS(season_length=m), AutoARIMA(season_length=m)],
    freq="MS",
)

# rolling-origin backtest BEFORE trusting any forecast
cv = sf.cross_validation(df=df, h=h, n_windows=3, step_size=h)
def wape(a, f): return (a - f).abs().sum() / a.abs().sum()
for col in ["SeasonalNaive", "AutoETS", "AutoARIMA"]:
    print(col, "WAPE", round(wape(cv["y"], cv[col]), 4))  # pick the lowest that beats SeasonalNaive

# refit on full history, forecast with an 80% interval
fc = sf.forecast(df=df, h=h, level=[80])
# choose the winning model column from the backtest; here AutoETS as example
out = fc.rename(columns={"AutoETS": "forecast", "AutoETS-lo-80": "lo", "AutoETS-hi-80": "hi"})
out[["ds", "forecast", "lo", "hi"]].to_csv("forecast.csv", index=False)
```

Zero-dependency fallback when you cannot install statsforecast — a seasonal-naive baseline in pure pandas. This is also the thing every model must beat, so it is always worth computing:

```python
import pandas as pd

def seasonal_naive(y: pd.Series, m: int, h: int) -> pd.Series:
    """Repeat the last full season forward h periods."""
    last_season = y.iloc[-m:].to_numpy()
    return pd.Series([last_season[i % m] for i in range(h)])

s = pd.read_csv("history.csv", parse_dates=["ds"]).set_index("ds")["y"]
fc = seasonal_naive(s, m=12, h=12)
# crude interval from historical residual spread; honest is better than absent
resid_std = (s - s.shift(12)).dropna().std()
out = pd.DataFrame({"forecast": fc, "lo": fc - 1.28 * resid_std, "hi": fc + 1.28 * resid_std})
out.to_csv("forecast.csv", index=False)
```

## Edge cases

- **New product, no history.** Do not fit a model on three points. Use analogues — a comparable product's curve scaled to expected volume — and say it is an assumption, not a forecast.
- **Short history (< 2 seasonal cycles).** SeasonalNaive only. A fitted model will overfit noise and report a falsely tight interval.
- **Structural breaks.** A pricing change, a relaunch, a regime shift. Do not train across the break — train on the post-break segment, even if it is short, or the model averages two different worlds.
- **Promotions and outliers.** A promo spike is not baseline demand. Mark promo periods and either model them as a regressor or exclude them from the level estimate; otherwise the forecast inherits a spike that will not recur.
- **Granularity.** Forecast at the level you act on. If you must report higher, aggregate the forecasts — and check the aggregate is plausible (this often catches per-SKU nonsense).
- **Hierarchy reconciliation.** When SKU forecasts must sum to a category total, reconcile (bottom-up or MinT). Brief note here; the mechanics belong in [`references/methods-cheatsheet.md`](references/methods-cheatsheet.md).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Report a single point number | A point hides uncertainty the reader needs to plan around. | Report point + 80/95% interval |
| Tune ARIMA orders before any baseline | If you cannot beat the free baseline, the tuning was wasted. | Compute naive/seasonal-naive first |
| Score with MAPE on intermittent demand | MAPE explodes near zero actuals and lies about accuracy. | Use WAPE + bias |
| Single train/test holdout | One split is one sample; CV estimates real out-of-sample error. | Rolling-origin CV (`n_windows≥3`) |
| Fit a model on 8 months of monthly data | Too few points; the model overfits and underreports its own error. | SeasonalNaive only under 2 cycles |
| "The model picked it, so it's right" | A forecast you cannot defend is worse than no forecast. | State method + MASE vs naive |
| Trust SKU forecasts without checking the sum | Per-SKU errors compound; the total exposes nonsense fast. | Sanity-check vs the aggregate |

## Handoffs

- **`../inventory/SKILL.md`** — feed it the demand number; it sizes reorder points and safety stock. Forecasting produces the demand; it does not size the stock.
- **`../financial-model/SKILL.md`** — when the projection is driven by *assumptions and drivers* (pricing, hiring), not history, that is a model, not a forecast.
- **`../unit-economics/SKILL.md`** — contribution margin, CAC/LTV, payback. No time series, route there.
- **`../data-cleaning/SKILL.md`** — dirty input (dupes, missing rows, mixed units) goes here *before* you model.
- **`../analyze/SKILL.md`** — when the question is "why" or a backward-looking metric/aggregation rather than forward extrapolation.
