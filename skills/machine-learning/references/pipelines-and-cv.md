# Pipelines, custom transforms, and cross-validation (depth)

Everything here keeps the SKILL.md rule: transforms that *learn* live inside the pipeline, so CV/tuning
re-fit them on each train fold only. API current as of scikit-learn ~1.9 (verify at scikit-learn.org).

## make_column_transformer — the terse ColumnTransformer

`make_column_transformer` auto-names steps; `make_column_selector` picks columns by dtype/regex.

```python
from sklearn.compose import make_column_transformer, make_column_selector as mcs
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

pre = make_column_transformer(
    (make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), mcs(dtype_include="number")),
    (make_pipeline(SimpleImputer(strategy="most_frequent"),
                   OneHotEncoder(handle_unknown="ignore")), mcs(dtype_include=["object", "category"])),
    remainder="drop",
    verbose_feature_names_out=False,   # cleaner get_feature_names_out()
)
pre.set_output(transform="pandas")     # keep a DataFrame with real column names flowing through
```

## Stateless custom feature: FunctionTransformer

For a transform with **no learned state** (log, ratio, date parts), `FunctionTransformer` is leak-safe by
construction — there is nothing fit on data.

```python
import numpy as np
from sklearn.preprocessing import FunctionTransformer

log1p = FunctionTransformer(np.log1p, feature_names_out="one-to-one")
```

## Stateful custom transformer: fit on train only

If the transform learns anything (a mean, a fitted mapping), write a class so CV re-fits it per fold.
`fit` must store state from **train** only; `transform` applies it. Never compute the statistic in `__init__`
or over the whole dataset.

```python
from sklearn.base import BaseEstimator, TransformerMixin

class GroupRareCategories(BaseEstimator, TransformerMixin):
    """Fold categories seen < min_count times in TRAIN into '__other__'."""
    def __init__(self, min_count=10):
        self.min_count = min_count
    def fit(self, X, y=None):
        counts = X.iloc[:, 0].value_counts()
        self.keep_ = set(counts[counts >= self.min_count].index)   # learned on train fold
        return self
    def transform(self, X):
        col = X.iloc[:, 0]
        return col.where(col.isin(self.keep_), "__other__").to_frame()
```

## High-cardinality categoricals: TargetEncoder cross-fitting

`sklearn.preprocessing.TargetEncoder` encodes each category by the target mean — the classic leakage trap
if done naively. Its `fit_transform(X, y)` uses an **internal cross-fitting** scheme (each row encoded from
*other* folds' targets), which is why `fit(X, y).transform(X)` deliberately differs and must not be used on
train. Put it in the pipeline and let CV call `fit_transform`; never hand-roll a group-mean encode.

```python
from sklearn.preprocessing import TargetEncoder
enc = TargetEncoder(smooth="auto", cv=5)   # cv controls the internal cross-fit
# inside a ColumnTransformer branch for the high-cardinality columns
```

## Hyperparameter tuning — over the whole pipeline

Address a step's parameter with `stepname__param` (double underscore). Tuning searches must wrap the
*pipeline*, so preprocessing is re-fit each fold — tuning on globally-preprocessed data leaks.

```python
from sklearn.pipeline import Pipeline
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold

pipe = Pipeline([("pre", pre), ("clf", HistGradientBoostingClassifier(random_state=0))])
param_dist = {
    "clf__learning_rate": [0.01, 0.05, 0.1, 0.2],
    "clf__max_leaf_nodes": [15, 31, 63],
    "clf__l2_regularization": [0.0, 1.0, 10.0],
}
search = RandomizedSearchCV(
    pipe, param_dist, n_iter=30,
    cv=StratifiedKFold(5, shuffle=True, random_state=0),
    scoring="average_precision", random_state=0, n_jobs=-1, refit=True,
)
search.fit(X_tr, y_tr)          # X_tr only — the test set stays sealed
print(search.best_params_, search.best_score_)
```

- `GridSearchCV` — exhaustive; use for a small, discrete grid.
- `RandomizedSearchCV` — sample `n_iter` combos from distributions; the default for anything nontrivial.
- `HalvingRandomSearchCV` / `HalvingGridSearchCV` (`sklearn.model_selection`) — successive halving: cheap
  runs on many candidates, more budget to survivors. Fastest when fits are expensive.

## Nested CV — unbiased estimate of the tuning process

If you report `search.best_score_` as your performance, it is optimistic (you selected on it). To estimate
how the *whole tuning procedure* generalizes, nest an inner CV (tuning) inside an outer CV (scoring).

```python
from sklearn.model_selection import cross_val_score
outer = StratifiedKFold(5, shuffle=True, random_state=1)
nested = cross_val_score(search, X_tr, y_tr, cv=outer, scoring="average_precision")
print(nested.mean(), nested.std())   # honest estimate of "tune-then-fit" on unseen data
```

## Splitters beyond StratifiedKFold

```python
from sklearn.model_selection import TimeSeriesSplit, GroupKFold, StratifiedGroupKFold

# time order: train on past, test on future (expanding window); never shuffle the future into train
for tr, te in TimeSeriesSplit(n_splits=5).split(X):
    ...

# clustered rows (same user/store): keep a group wholly in train OR test
for tr, te in GroupKFold(n_splits=5).split(X, y, groups=user_id):
    ...

# clustered AND imbalanced: preserve class ratio while keeping groups intact
for tr, te in StratifiedGroupKFold(n_splits=5).split(X, y, groups=user_id):
    ...
```

Pass `groups=` through tuning too: `search.fit(X, y, groups=user_id)` with a group-aware `cv`. A random
`KFold` on time-series or grouped data is leakage — CV will look great and production will not.
```
