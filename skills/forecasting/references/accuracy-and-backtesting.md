# Accuracy and backtesting

The metrics decide what you ship. This is the reference for the formulas, the
rolling-origin mechanics, and how to read a backtest table.

## Metrics

### WAPE (a.k.a. WMAPE) — the default magnitude metric

```
WAPE = sum(|actual - forecast|) / sum(|actual|)
```

Weights error by volume. Stable when actuals approach zero, which is exactly where
MAPE fails. Report as a percentage. This is your headline accuracy number.

### MAPE — avoid for demand

```
MAPE = mean(|actual - forecast| / |actual|)
```

Divides by each actual, so a single near-zero period sends it to infinity. Fine for
smooth high-volume aggregate series; wrong for SKU-level and intermittent demand.
Default to WAPE and only use MAPE when actuals are reliably far from zero.

### Bias — direction of error

```
bias = sum(forecast - actual) / sum(|actual|)
```

Positive = systematic over-forecast, negative = under-forecast. Always report
alongside WAPE: WAPE is magnitude, bias is direction. A persistent bias is a
fixable, structural problem (wrong seasonality, ignored trend); random error around
zero bias is not.

### MASE — the pass/fail line vs naive

```
MASE = MAE(forecast) / MAE(naive forecast on the training set)
```

Scale-free. **MASE < 1.0 means you beat the naive forecast.** MASE ≥ 1.0 means the
naive forecast was more accurate — ship the naive one. For seasonal series the
denominator is the seasonal-naive MAE. This is the single number that justifies the
existence of your model.

### Interval quality — coverage and pinball

A point metric cannot grade an interval. Use:

- **Coverage:** the fraction of actuals that fall inside the interval. An 80%
  interval should contain ~80% of actuals in the backtest. Far below = overconfident
  (intervals too tight); far above = useless (too wide).
- **Pinball loss (quantile loss):** the proper scoring rule for a quantile forecast.
  Lower is better; it penalizes both miscalibration and width.

## Rolling-origin cross-validation

Never trust a single holdout — it is one sample of out-of-sample error and can be
lucky or unlucky. Rolling-origin (expanding-window) CV repeats the split across
several cutoffs and averages the error.

Mechanics (statsforecast `cross_validation`):

```
window 1:  train [.................]  test [###]
window 2:  train [....................]  test [###]
window 3:  train [.......................]  test [###]
```

- `h` — forecast horizon per window (match your real horizon).
- `n_windows` — how many cutoffs (≥ 3; more is better if history allows).
- `step_size` — gap between cutoffs (commonly `= h` for non-overlapping tests).

```python
cv = sf.cross_validation(df=df, h=12, n_windows=3, step_size=12)
# cv has: ds, cutoff, y, and one column per model
```

## Reading a backtest table

`cross_validation` returns the actual `y` and each model's prediction per cutoff.
Collapse to one row per model:

| model         | WAPE | bias  | MASE | verdict                         |
|---------------|------|-------|------|---------------------------------|
| SeasonalNaive | 0.18 | +0.02 | 1.00 | the bar (MASE ≈ 1: the scaling reference)|
| AutoETS       | 0.12 | -0.01 | 0.67 | beats naive — ship this         |
| AutoARIMA     | 0.13 | +0.06 | 0.72 | beats naive but biased high      |

Pick the lowest WAPE among models with **MASE < 1**. If no model has MASE < 1, ship
SeasonalNaive and report it honestly. Prefer a slightly higher-WAPE model with near-
zero bias over a lower-WAPE model with strong bias — bias compounds when you sum or
roll forward.

## Interval calibration

After choosing a model, check the chosen interval's coverage in the backtest. If an
80% interval covers only ~55% of actuals, the model is overconfident — widen the
level, switch to a method whose intervals are better calibrated for the series, or
state the limitation explicitly in the readout. An interval nobody calibrated is no
better than the point alone.
