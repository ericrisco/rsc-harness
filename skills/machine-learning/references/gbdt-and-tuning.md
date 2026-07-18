# GBDTs: parameters, early stopping, categoricals, importance (depth)

Three interchangeable sklearn-API GBDTs. Versions verified 2026-07 — XGBoost 3.x, LightGBM 4.x, and
sklearn's `HistGradientBoosting*` (~1.9). Verify current versions before pinning; APIs shift between majors.

## What the knobs mean (they translate across libraries)

| Concept | HistGradientBoosting | XGBoost | LightGBM |
| --- | --- | --- | --- |
| Step size | `learning_rate` | `learning_rate` (`eta`) | `learning_rate` |
| Number of trees | `max_iter` | `n_estimators` | `n_estimators` |
| Tree size | `max_leaf_nodes` / `max_depth` | `max_depth` | `num_leaves` (leaf-wise!) / `max_depth` |
| L2 penalty | `l2_regularization` | `reg_lambda` / `reg_alpha` | `reg_lambda` / `reg_alpha` |
| Min data per leaf | `min_samples_leaf` | `min_child_weight` | `min_child_samples` |
| Row/col subsample | (n/a) | `subsample` / `colsample_bytree` | `bagging_fraction` / `feature_fraction` |

Tuning order that pays off: get `learning_rate` low-ish with enough trees (use early stopping to pick the
count), then control complexity (`num_leaves`/`max_depth`, `min_*_leaf`), then regularization and subsampling.
**Lower `learning_rate` + more trees + early stopping** beats a high learning rate almost always. LightGBM
grows **leaf-wise**, so cap `num_leaves` (and/or `max_depth`) or it overfits fast.

## Early stopping (stop adding trees when validation stops improving)

Needs a validation signal. Keep it out of the sacred test set — use a train-derived eval split.

```python
# XGBoost 3.x: early_stopping_rounds is a CONSTRUCTOR param; pass eval_set to fit()
from xgboost import XGBClassifier
xgb = XGBClassifier(n_estimators=2000, learning_rate=0.05,
                    early_stopping_rounds=50, eval_metric="aucpr")
xgb.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
print(xgb.best_iteration)

# LightGBM 4.x: callbacks
from lightgbm import LGBMClassifier, early_stopping, log_evaluation
lgbm = LGBMClassifier(n_estimators=2000, learning_rate=0.05, num_leaves=31)
lgbm.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], eval_metric="average_precision",
         callbacks=[early_stopping(50), log_evaluation(0)])

# HistGradientBoosting: built-in, no eval_set needed (carves its own validation slice)
from sklearn.ensemble import HistGradientBoostingClassifier
hgb = HistGradientBoostingClassifier(max_iter=2000, learning_rate=0.05,
                                     early_stopping=True, validation_fraction=0.1,
                                     n_iter_no_change=50, random_state=0)
```

## Native categorical handling (skip one-hot)

- **HistGradientBoosting**: `categorical_features="from_dtype"` — columns with pandas `category` dtype are
  handled natively. No `OneHotEncoder`, no explosion of columns.
- **XGBoost**: `enable_categorical=True` + columns as pandas `category` dtype; `tree_method` `hist`/`approx`.
- **LightGBM**: pass `categorical_feature=` (names/indices) or use `category` dtype; native by default.

One-hot only when cardinality is low and a *linear* model needs it. For trees, native categorical or, for
very high cardinality, `TargetEncoder` (cross-fit — see pipelines-and-cv.md) beats a thousand dummy columns.

## Monotonic constraints (domain priors)

Force the model's response to move only one way with a feature (price ↑ ⇒ risk never ↓). Guards against
noise inverting a known relationship and helps trust/compliance.

```python
# HistGradientBoosting: dict of feature -> {-1, 0, +1}
HistGradientBoostingClassifier(monotonic_cst={"income": +1, "num_late_payments": -1})
# XGBoost: monotone_constraints="(1,0,-1,...)"   LightGBM: monotone_constraints=[1,0,-1,...]
```

## Feature importance — don't trust the default blindly

- **Impurity / gain importance** (`feature_importances_`): fast but biased toward high-cardinality and
  continuous features; computed on train.
- **Permutation importance** (`sklearn.inspection.permutation_importance`): model-agnostic, measures the
  metric drop when a feature is shuffled — run it **on held-out data**, and beware correlated features
  sharing credit.
- **SHAP** (separate `shap` library): per-prediction attributions; the most faithful local explanations,
  the heaviest to compute. Use for "why this row" and to sanity-check for leakage — a feature dominating
  SHAP that shouldn't be predictive is a leak flag.

```python
from sklearn.inspection import permutation_importance
r = permutation_importance(model, X_test, y_test, scoring="average_precision",
                           n_repeats=10, random_state=0)
```
