# Metrics, thresholds, calibration, and imbalance (depth)

Picking the metric and handling imbalance is where "0.99 accuracy" turns into an honest number. API current
as of scikit-learn ~1.9 (verify at scikit-learn.org).

## Choosing the classification metric

Everything in `sklearn.metrics`. Score **probabilities** (`predict_proba`) for AUC/ranking metrics; score
**labels** for precision/recall/F1 (which depend on the decision threshold).

| You care about… | Metric | Notes |
| --- | --- | --- |
| Ranking, threshold-free, roughly balanced | `roc_auc_score` | Insensitive to the negative flood — flatters rare-positive problems. |
| Ranking with **rare positives** (fraud/disease) | `average_precision_score` (PR-AUC) | The honest ranking metric under imbalance. |
| Not crying wolf (false positives costly) | `precision_score` | TP / (TP+FP). |
| Not missing cases (false negatives costly) | `recall_score` | TP / (TP+FN). |
| Both, single number | `f1_score` | Harmonic mean; `average="macro"` treats classes equally, `"weighted"` by support. |
| Per-class fairness, multiclass | `balanced_accuracy_score`, `f1_macro` | Macro-averaging stops the majority class dominating. |
| The full picture | `confusion_matrix`, `classification_report` | Always look before trusting one scalar. |
| Probability quality | `brier_score_loss`, `log_loss` | For calibrated-probability use cases. |

Multiclass averaging: `micro` (global TP/FP counts — dominated by frequent classes), `macro` (unweighted
class mean — each class equal), `weighted` (by class support). State which and why.

## Regression metrics

`r2_score` (proportion of variance explained; can be negative), `mean_absolute_error` (robust, same units),
`root_mean_squared_error` (penalizes large errors; note this is the current function —
`mean_squared_error(squared=False)` was removed), `mean_absolute_percentage_error` (scale-free but explodes
near zero). Scoring strings negate losses: `"neg_root_mean_squared_error"`, `"neg_mean_absolute_error"`.

## The threshold is a decision, not 0.5

`predict()` thresholds probability at 0.5, which is rarely the business-optimal cut under imbalance or
asymmetric costs. Tune it on validation, either manually from the PR curve or with the built-in estimator.

```python
from sklearn.metrics import precision_recall_curve
prec, rec, thr = precision_recall_curve(y_val, proba_val)
# e.g. smallest threshold that reaches precision >= 0.90:
import numpy as np
ok = np.where(prec[:-1] >= 0.90)[0]
chosen = thr[ok[0]] if len(ok) else 1.0

# Or let sklearn tune + wrap it (added 1.5):
from sklearn.model_selection import TunedThresholdClassifierCV, FixedThresholdClassifier
tuned = TunedThresholdClassifierCV(clf, scoring="f1", cv=5).fit(X_tr, y_tr)
print(tuned.best_threshold_)
fixed = FixedThresholdClassifier(clf, threshold=0.30).fit(X_tr, y_tr)  # pin a known-good cut
```

## Probability calibration

Tree ensembles and SVMs produce distorted probabilities. If you use the probability itself (expected-value
decisions, thresholds you trust), calibrate — on a held-out fold, never on train.

```python
from sklearn.calibration import CalibratedClassifierCV
cal = CalibratedClassifierCV(clf, method="isotonic", cv=5)   # or method="sigmoid" (Platt)
```

## Imbalance — in order of preference

1. **Do nothing to the data; fix the metric + threshold.** Often enough. Use PR-AUC and a tuned threshold.
2. **`class_weight="balanced"`** (LogisticRegression, RandomForest, SVC, HistGradientBoosting…) or
   `scale_pos_weight` (XGBoost) — reweight the loss, no synthetic rows, no leakage risk.
3. **Resampling (SMOTE / undersampling) — only if 1–2 fall short, and only inside CV on the train fold.**
   Resampling before the split, or touching the test fold, leaks and evaluates on synthetic data. Use the
   **imbalanced-learn `Pipeline`** (not sklearn's) so the resampler runs per fold, train-only:

```python
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import HistGradientBoostingClassifier

pipe = ImbPipeline([("pre", pre), ("smote", SMOTE(random_state=0)),
                    ("clf", HistGradientBoostingClassifier(random_state=0))])
# In cross_validate/GridSearchCV, SMOTE fits on each TRAIN fold only; test folds stay real.
```

Never resample the test set, and never report accuracy on the resampled (artificially balanced) data as if
it were the real distribution.
