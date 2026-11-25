# Methods cheatsheet

One page per method: when to use it and the exact statsforecast (Nixtla, v2.0.3)
call. `m` = seasonal period (12 monthly, 7 daily-with-weekly-season, 52 weekly),
`h` = horizon. Always include `level=[80]` or `[95]` for an interval.

## Naive

Repeat the last observed value. The cheapest baseline; the bar for non-seasonal
series. Use when the series has no trend and no seasonality.

```python
from statsforecast.models import Naive
Naive()
```

## SeasonalNaive

Repeat the value from one season ago (last December → this December). The bar for
any seasonal series, and the **only** thing you should ship when you have fewer than
2 full seasonal cycles of history. Do not fit a model on that little data.

```python
from statsforecast.models import SeasonalNaive
SeasonalNaive(season_length=m)
```

## Moving average / simple exponential smoothing (SES)

Flat series with no trend or season. SES weights recent observations more. Honest
for a noisy mean; do not use SES on intermittent demand (see Croston). `SimpleExponentialSmoothingOptimized`
auto-tunes the smoothing.

```python
from statsforecast.models import SimpleExponentialSmoothingOptimized
SimpleExponentialSmoothingOptimized()
```

## ETS (error-trend-season)

The workhorse for business series with trend and/or seasonality. `AutoETS` selects
the additive/multiplicative components automatically — no manual order picking.
Strong, fast, well-calibrated intervals. Usually try this first after the baseline.

```python
from statsforecast.models import AutoETS
AutoETS(season_length=m)
```

## Theta

A simple, robust method that decomposes the series into theta-lines. Often wins on
monthly business data and is cheap to run. A great cheap default alongside ETS.

```python
from statsforecast.models import AutoTheta
AutoTheta(season_length=m)
```

## ARIMA

Use when errors are autocorrelated and seasonality is strong and known. `AutoARIMA`
searches orders automatically and is roughly 20x faster than pmdarima. More flexible
than ETS but slower and easier to overfit on short history — let the backtest, not
the AIC alone, decide whether it earns its place over ETS.

```python
from statsforecast.models import AutoARIMA
AutoARIMA(season_length=m)
```

## Croston / SBA / TSB — intermittent demand

Sporadic demand with many zero periods (slow-moving SKUs, spare parts). SES is
provably inappropriate here (Croston 1972): it reacts to zeros as if they were
demand. Croston forecasts demand size and inter-arrival interval separately; SBA
(Syntetos–Boylan 2001) debiases Croston; TSB handles obsolescence. `CrostonOptimized`
auto-tunes; `IMAPA`/`ADIDA` aggregate-then-disaggregate. An Auto classifier can pick
between Croston/SBA/SES by demand pattern.

```python
from statsforecast.models import CrostonOptimized, CrostonSBA, TSB
CrostonOptimized()           # default optimized Croston
CrostonSBA()                 # Syntetos–Boylan bias correction
TSB(alpha_d=0.2, alpha_p=0.2)  # demand-probability variant, handles obsolescence
```

## Hierarchy reconciliation

When SKU forecasts must sum to a category/region total, forecast each level then
reconcile so they are coherent. Bottom-up is the simplest; MinT (minimum trace) is
the statistically efficient default and is available via Nixtla's `hierarchicalforecast`
package (`pip install hierarchicalforecast`). Forecast all levels, then apply a
reconciler — do not just trust independent per-SKU forecasts to add up.
