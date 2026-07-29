---
name: machine-learning
description: "Use when predicting a column from rows of tabular features with classic models — scikit-learn pipelines, RandomForest, XGBoost/LightGBM, leak-free cross-validation, metrics for imbalanced classes, or a model that aced CV then collapsed in production. NOT PyTorch neural nets (that is `deep-learning`), NOT cleaning the dirty table first (that is `data-cleaning`), NOT forecasting a dated series (that is `forecasting`), NOT text/token modeling (that is `nlp`)."
tags: [machine-learning, scikit-learn, sklearn, xgboost, lightgbm, tabular, gbdt, cross-validation, data-leakage, classification, regression, pipeline]
recommends: [deep-learning, data-cleaning, python, training-data]
origin: risco
---

# Machine learning — classic/tabular models, done without lying to yourself

Tabular ML is easy to *run* and easy to *fool yourself with*. The deliverable is never "the notebook
printed 0.99" — it is an **honest estimate of how the model behaves on data it has never seen**: a
`Pipeline` that fits every transform on train only, a metric that survives class imbalance, and a
`DummyClassifier` baseline it beats. A number you can't reproduce on a sacred test set you touched exactly
once isn't a result — it's a leak you haven't found yet.

## Is this the right skill? (decide first)

| Your situation | Reach for |
| --- | --- |
| Rows of features, predict a column, with trees / linear models / sklearn | **machine-learning** (this skill) |
| Images, audio, long text, sequences, or you need a neural net / PyTorch | [`deep-learning`](../deep-learning/SKILL.md) |
| The table is still dirty (nulls, dupes, mixed types, bad dates) | [`data-cleaning`](../data-cleaning/SKILL.md) **first** — it hands you a validated table |
| Text/token classification, NER, tokenization, LLM-adjacent NLP metrics | [`nlp`](../nlp/SKILL.md) (a TF-IDF + linear/GBDT baseline still lives happily in this skill's pipeline) |
| KPIs, dashboards, "explain the business" | [`analytics`](../analytics/SKILL.md) / [`business-intelligence`](../business-intelligence/SKILL.md) |
| Forecast a dated series forward (revenue next quarter) | [`forecasting`](../forecasting/SKILL.md) |
| Building a training corpus of JSONL messages / preference pairs for an LLM | [`training-data`](../training-data/SKILL.md) |

This skill **starts** at a clean, validated table (rows × features + a target) and **ends** at a fitted,
honestly-scored model with a test-set number and a baseline it beats. Cleaning is upstream — consume the
validated frame `data-cleaning` produced; don't re-teach it here.

## Version reality (verify at author time — this line moves monthly)

Verified 2026-07: **scikit-learn current major ~1.9** (1.9.0 shipped 2026-06-02, Python 3.11–3.14) — do
NOT pin from memory; check the current stable at scikit-learn.org, the 1.x line ships every few months.
GBDTs: **XGBoost 3.x** and **LightGBM 4.x** (`xgboost` 3.3, `lightgbm` 4.6 current), plus sklearn's own
**`HistGradientBoostingClassifier`/`...Regressor`** — a fast native GBDT that eats NaN and (with
`categorical_features="from_dtype"`) categoricals with **no** preprocessing. Pin what you ship
([`python`](../python/SKILL.md) owns the environment and the pinning); state versions as "~X (verify)",
never as frozen fact.

## The one rule everything else serves: fit on train only

Every preprocessing step — imputation, scaling, encoding, feature selection, target encoding, resampling —
learns parameters from data. Learn them from rows the model is later *scored* on and the score inflates
while production underperforms: that is **leakage**, the #1 way tabular ML lies. The whole apparatus below —
`Pipeline`, `ColumnTransformer`, CV, the untouched test set — exists to make "fit on train only" automatic
instead of something you remember to do by hand (you won't).

## scikit-learn: estimators, Pipeline, ColumnTransformer

Every model is an **estimator** with the same contract: `fit(X, y)`, then `predict(X)` /
`predict_proba(X)` (classifiers) / `score(X, y)`. Transformers add `transform(X)` / `fit_transform(X, y)`.
A **`Pipeline`** chains transformers + a final estimator into one estimator — so `fit` fits every step on
train, and `predict`/CV `transform`s test data with parameters learned on train. That is the leakage guard.

A **`ColumnTransformer`** routes different columns down different transformer branches (scale the numerics,
encode the categoricals) and stitches the result back together — all still *inside* the pipeline.

```python
from sklearn.compose import ColumnTransformer, make_column_selector as mcs
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression

numeric = Pipeline([("impute", SimpleImputer(strategy="median")),
                    ("scale",  StandardScaler())])           # scaling matters for LINEAR/SVM/KNN
categoric = Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                      ("onehot", OneHotEncoder(handle_unknown="ignore"))])  # unseen category -> all-zeros, no crash

pre = ColumnTransformer([
    ("num", numeric,   mcs(dtype_include="number")),
    ("cat", categoric, mcs(dtype_include=["object", "category"])),
], remainder="drop")

model = Pipeline([("pre", pre), ("clf", LogisticRegression(max_iter=1000, class_weight="balanced"))])
model.fit(X_train, y_train)          # imputers/scaler/encoder ALL fit on X_train only
model.predict_proba(X_test)          # X_test transformed with train-learned params — no leak
```

Two load-bearing details: `OneHotEncoder(handle_unknown="ignore")` so a category unseen in train doesn't
crash prediction, and `remainder="drop"` so unrouted columns don't silently leak through raw;
`model.set_output(transform="pandas")` keeps named-column DataFrames through the pipeline.

**Trees skip most of this** — scaling is pointless for tree models, and `HistGradientBoostingClassifier`
ingests NaN and categoricals natively, so its pipeline is often just the estimator. Preprocess for the
*model that needs it*, not as a ritual. More patterns (`make_column_transformer`, `FunctionTransformer`)
→ [references/pipelines-and-cv.md](references/pipelines-and-cv.md).

## GBDTs are your default on tabular data

Gradient-boosted decision trees are the correct first (and usually last) model for tabular problems.
This isn't taste: **Grinsztajn, Oyallon & Varoquaux (2022), "Why do tree-based models still outperform
deep learning on tabular data?"** ([arXiv:2207.08815](https://arxiv.org/abs/2207.08815)) benchmarked across
45 datasets and found GBDTs beat tuned neural nets on medium-sized tabular data, tracing it to three
inductive biases NNs lack: **robustness to uninformative features**, **not being rotationally invariant**
(so they exploit the meaning of individual columns), and ease of **learning irregular / non-smooth target
functions**. Start with a GBDT; reach for `deep-learning` on tabular only with a specific reason.

| Library | Import | Reach for it when |
| --- | --- | --- |
| `HistGradientBoostingClassifier` | `sklearn.ensemble` | Default. Fast, zero extra deps, native NaN + categorical. |
| XGBoost 3.x | `xgboost.XGBClassifier` | Battle-tested; `early_stopping_rounds`, rich regularization. |
| LightGBM 4.x | `lightgbm.LGBMClassifier` | Fastest on wide/large data; leaf-wise; strong native categoricals. |

All three expose the sklearn estimator API, so they drop into the pipeline and CV below unchanged. Don't
agonize over XGBoost-vs-LightGBM before you have a baseline and a leak-free CV — split discipline dwarfs the
library choice. Tuning knobs (`learning_rate`, `num_leaves`/`max_depth`, early stopping, `monotonic_cst`)
and importance/SHAP → [references/gbdt-and-tuning.md](references/gbdt-and-tuning.md).

## Leakage-safe feature engineering

Feature engineering is where leakage sneaks back in after the pipeline "protected" you. Rules:

- **Any transform that learns from data goes INSIDE the pipeline**, so CV re-fits it per fold. A scaler fit
  on the whole dataset, a `SelectKBest` run before splitting, an imputer using the global mean — each leaks
  test statistics into train. The `common_pitfalls` canonical example: `SelectKBest(k=25).fit_transform(X, y)`
  *before* `train_test_split` produces a beautiful, meaningless score.
- **Target/mean encoding of high-cardinality categoricals must cross-fit.** sklearn's
  `preprocessing.TargetEncoder` does this: its `fit_transform(X, y)` uses an internal cross-fitting scheme
  so each row is encoded from *other* folds' targets — `fit(X, y).transform(X)` deliberately differs and
  would leak. Use `fit_transform` on train (inside the pipeline); never hand-roll a group-mean encoder.
- **No target-derived features.** A column computed from the label (or a near-proxy: "was_refunded" when
  predicting "will_refund") is leakage wearing a feature's clothes. If a feature is impossibly predictive,
  suspect it.
- **Respect time.** With any temporal structure, a feature may use only information available *at prediction
  time* — no future aggregates, no lifetime values that include post-cutoff rows. Split by time
  (`TimeSeriesSplit`), not randomly.

## Split + cross-validation: protect the sacred test set

Hold out a **test set once, at the very start** (`train_test_split(..., stratify=y, random_state=0)`) and
do not look at it until you have a single final model. Every glance — tuning, feature choice, "let me just
check" — bleeds information and re-inflates the estimate. Tune and compare with **cross-validation on the
training portion only**; the test set is the one honest number at the end (see the lifecycle below). Score
with `cross_validate(pipeline, X_tr, y_tr, cv=cv, scoring=[...], return_train_score=True)` — a large
train-minus-test gap is your overfitting alarm.

Pick the splitter to match the data ([cross_validation docs](https://scikit-learn.org/stable/modules/cross_validation.html)):

- **`StratifiedKFold`** — default for classification; preserves class balance per fold (essential when
  imbalanced). `KFold` for regression.
- **`TimeSeriesSplit`** — any time ordering. Trains on past, tests on future; never shuffles the future
  into train. A random `KFold` on time-series data is leakage.
- **`GroupKFold` / `StratifiedGroupKFold`** — when rows cluster (same user/patient/store across many rows).
  Keep a group entirely in train *or* test, or the model memorizes the group and CV lies.
- Pass **integer `random_state`** to splitters for reproducible folds. Put preprocessing in the pipeline so
  CV re-fits it every fold — `cross_validate(pipeline, ...)`, never `cross_validate(model, X_scaled, ...)`.

For tuning, wrap CV in `GridSearchCV` / `RandomizedSearchCV` / `HalvingRandomSearchCV`; for an unbiased
estimate *of the tuning process itself*, use nested CV → [references/pipelines-and-cv.md](references/pipelines-and-cv.md).

## Metrics: the accuracy trap and what to use instead

**Accuracy lies on imbalanced data.** At 99% negatives, a model that predicts "negative" always scores 99%
accuracy and is worthless. Choose the metric for the task and the cost of each error type
([model_evaluation docs](https://scikit-learn.org/stable/modules/model_evaluation.html)):

| Task / question | Metric (`sklearn.metrics`) | scoring string |
| --- | --- | --- |
| Ranking quality, threshold-free, balanced-ish | `roc_auc_score` | `"roc_auc"` |
| **Imbalanced** ranking (rare positive: fraud, disease) | `average_precision_score` (PR-AUC) | `"average_precision"` |
| Cost of false positives high (don't cry wolf) | `precision_score` | `"precision"` |
| Cost of misses high (don't miss a case) | `recall_score` | `"recall"` |
| Balance both, per-class fairness | `f1_score` (use `f1_macro` multiclass) | `"f1"` / `"f1_macro"` |
| Multiclass, care about every class equally | `balanced_accuracy_score` | `"balanced_accuracy"` |
| See the actual error breakdown | `confusion_matrix`, `classification_report` | — |
| Regression | `r2_score`, `mean_absolute_error`, `root_mean_squared_error` | `"r2"`, `"neg_mean_absolute_error"`, `"neg_root_mean_squared_error"` |

**Prefer PR-AUC (`average_precision`) to ROC-AUC when positives are rare** — ROC-AUC can look great while
precision is dismal, since it ignores the negative flood. Feed AUC metrics `predict_proba`, not hard labels.
The default 0.5 threshold is a *choice*: tune it on validation to hit your precision/recall target.
Regression uses `root_mean_squared_error` now (`mean_squared_error(squared=False)` is gone). Threshold
tuning, calibration, `class_weight`/resampling → [references/metrics-and-imbalance.md](references/metrics-and-imbalance.md).

## Anti-patterns — the cardinal sins

| Anti-pattern | Do instead |
| --- | --- |
| Modeling straight off the raw, dirty table | This skill starts at a **clean, validated frame**. Run [`data-cleaning`](../data-cleaning/SKILL.md) first — nulls, dupes and mixed dtypes are its job, not a modeling problem. |
| Scaling / encoding / selecting features, *then* splitting | **Leakage (#1 sin).** Test statistics are now in train. Split first; put every learned transform *inside* the `Pipeline` so CV re-fits per fold. |
| Celebrating an amazingly predictive feature | Suspect **target leakage** — a column derived from the label or unavailable at prediction time. Audit provenance before you celebrate. |
| Reporting 99% accuracy on 1% positives | The **accuracy trap**. A constant predictor matches it. Report PR-AUC / precision / recall / F1 and a `confusion_matrix`. |
| `SMOTE`-ing the whole dataset because the classes are imbalanced | Resampling *before* the split, or on the test fold, leaks and evaluates on synthetic rows. Resample **inside CV, on the train fold only** (imblearn `Pipeline`), or just use `class_weight="balanced"`. |
| Shipping on the CV score alone | You never touched a **held-out test set**, or you peeked at it while tuning. One final, untouched test number — or the estimate is optimistic. |
| Random `KFold` on time-series / multi-user data | Future or same-group rows leak into train. Use `TimeSeriesSplit` / `GroupKFold`. |
| Waving off a big train/test gap | **Overfitting.** Regularize, reduce capacity (`max_depth`, `min_samples_leaf`), get more data, or use early stopping. Watch `return_train_score`. |
| Going straight to XGBoost with no baseline | Without a **`DummyClassifier(strategy="most_frequent")`** / `DummyRegressor` floor (and a simple linear model), you can't tell if the fancy model adds anything. |
| Grid-searching 10k combos over all the data | Tuning against the test set *is* fitting to it. Tune with CV on train, confirm once on test; consider nested CV. |
| Unset `random_state`, unpinned versions | Folds and fits stop being reproducible and re-trains stop being comparable. Set an integer `random_state` on splitters *and* estimators; pin the versions you ship. |

## Worked lifecycle (end to end)

```python
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import average_precision_score, classification_report

X_tr, X_test, y_tr, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=0)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)

# 0. BASELINE first — the floor every real model must clear
base = DummyClassifier(strategy="most_frequent")
print("baseline PR-AUC:", cross_val_score(base, X_tr, y_tr, cv=cv, scoring="average_precision").mean())

# 1. default GBDT (native NaN + categoricals -> minimal pipeline). class_weight for imbalance.
clf = HistGradientBoostingClassifier(categorical_features="from_dtype",
                                     class_weight="balanced", random_state=0)
cv_pr = cross_val_score(clf, X_tr, y_tr, cv=cv, scoring="average_precision")
print("model CV PR-AUC:", cv_pr.mean().round(3), "+/-", cv_pr.std().round(3))

# 2. it clears the baseline -> commit, fit on all train, judge ONCE on the sacred test set
clf.fit(X_tr, y_tr)
proba = clf.predict_proba(X_test)[:, 1]
print("TEST PR-AUC:", round(average_precision_score(y_test, proba), 3))
print(classification_report(y_test, (proba >= 0.5).astype(int)))   # threshold is a choice — tune it
```

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki), record the modeling
contract in `02-DOCS/wiki/ml/<target>.md`, linked from the root `CLAUDE.md` `## Knowledge map`: target
definition, split strategy + `random_state`, CV scheme, chosen metric and *why*, baseline, pinned versions,
and the dated final test-set score. Read it first on every re-train so results stay comparable. No
`02-DOCS/`? Skip silently — conventions are recorded, never gated.
