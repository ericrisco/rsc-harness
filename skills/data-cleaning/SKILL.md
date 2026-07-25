---
name: data-cleaning
description: "Use when a raw table is too dirty to trust — nulls, sentinels, duplicate rows, category sprawl, mixed types, bad dates — and you need a re-runnable clean() plus a schema gate that fails loud. NOT emitting .xlsx (that is spreadsheet-ops), NOT acquiring rows (that is data-scraper), NOT parsing PDF/HTML into rows (that is structured-extraction)."
tags: [data-cleaning, data-quality, pandas, pandera, validation, deduplication, reproducibility, polars]
recommends: [duckdb, spreadsheet-ops, structured-extraction, data-scraper, analytics, business-intelligence, forecasting, python]
profiles: []
origin: risco
---

# Data cleaning — make dirty data trustworthy, and make the cleaning auditable

A clean table is **typed + deduped + normalized + validated + reproducible**. The deliverable here is
never "I opened a notebook and fixed some rows by hand." It is a re-runnable function `clean(raw) -> df`
plus a **schema gate** that fails loud when next month's file violates the contract. Reproducible means
the same input always yields the same output: versions pinned, sorts deterministic, nothing random without
a seed. If you can't re-run it tomorrow and get the identical result, you haven't cleaned the data — you've
edited a snapshot.

Cleaning **starts** once you hold tabular rows and **ends** at a validated table/DataFrame/Parquet. Before
that boundary the job is acquisition ([`data-scraper`](../data-scraper/SKILL.md),
[`structured-extraction`](../structured-extraction/SKILL.md)); after it, consumption
([`spreadsheet-ops`](../spreadsheet-ops/SKILL.md), [`analytics`](../analytics/SKILL.md),
[`business-intelligence`](../business-intelligence/SKILL.md),
[`forecasting`](../forecasting/SKILL.md)). Multi-GB analytical SQL is an engine choice, not a cleaning one
— [`duckdb`](../duckdb/SKILL.md).

Current stack (verified 2026-06-02): **pandas 3.0.x** (3.0.0 shipped 2026-01-21) and **pandera 0.31.1**
(supports pandas ≥ 3) for in-pipeline schema validation; **Polars** and **DuckDB** when pandas runs out of
RAM. Pin them: `pandas==3.0.3`, `pandera==0.31.1`.

## The pipeline shape

One canonical order. Each step is positioned for a reason, not by habit.

```python
import pandas as pd

def clean(raw_path: str) -> pd.DataFrame:
    df = read_typed(raw_path)     # 1. read with explicit dtypes — never let pandas guess
    df = normalize(df)            # 2. strings/categories/numbers/dates — collapse invisible variance
    df = dedupe(df)               # 3. AFTER normalize+type, so "1"/1 and "US "/"US" actually collapse
    df = handle_missing(df)       # 4. decide per column: drop / impute+flag / leave NA / quarantine
    df = Schema.validate(df, lazy=True)  # 5. the GATE — fail loud, surface every violation at once
    return df
```

- **Type before dedupe** — otherwise `"1"` (string) and `1` (int) survive as two distinct keys.
- **Normalize before dedupe** — `"US "` and `"US"` are the same customer; dedupe can't see that until
  whitespace/case are collapsed.
- **Validate last** — it is the gate, not a cleaning step. It asserts the contract holds *after* all fixes.
- **Write to a NEW artifact** — the raw file is read-only; you never overwrite your only source.

## Read it right

The single most common reproducibility footgun: pandas' legacy numpy path silently casts an integer column
containing one NaN to `float64`, so your `id` becomes `1001.0`. Control the dtype on read.

```python
# BAD — pandas guesses: ids become floats, "N/A" stays a string, "" is sometimes NaN sometimes ""
df = pd.read_csv("raw.csv")

# GOOD — explicit, deterministic, real nullable types
df = pd.read_csv(
    "raw.csv",
    dtype_backend="pyarrow",          # real nullable ints/strings; no silent float-cast
    na_values=["", "N/A", "NA", "null", "-1", "999"],  # YOUR sentinels become real NA
    keep_default_na=True,             # keep pandas' default NA tokens too
    encoding="utf-8",                 # state it; don't let locale decide
)
```

Two pandas 3.0 facts that read depends on. `dtype_backend="pyarrow"` only works if pyarrow is actually
installed — PDEP-14 deliberately kept a NumPy-object fallback so PyArrow stays *recommended, not required*
— so `pip install pyarrow` for the faster backed path, or pass `dtype_backend="numpy_nullable"` when it is
absent. And the default `str` dtype (PyArrow-backed when pyarrow is present, NumPy-object-backed otherwise)
uses **`NaN` missing-value semantics** like every other default dtype: test for null with `pd.isna()`, never
by comparing against whichever null token happened to appear.

## Profile before you fix

Let the numbers drive the plan, not a glance at `df.head()`. Run this first, every time.

```python
def profile(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({
        "dtype":     df.dtypes.astype(str),
        "null_pct":  (df.isna().mean() * 100).round(1),
        "n_unique":  df.nunique(dropna=True),       # cardinality — catches category sprawl
        "sample":    df.apply(lambda s: s.dropna().unique()[:3].tolist()),
    })

print(profile(df))
print("rows:", len(df), "exact dupes:", df.duplicated().sum())
```

A column at 90% null is a drop candidate; one with 400 distinct "countries" needs a mapping table; an
"age" with min `-1`/max `999` has sentinels to map. The profile is your TODO list.

## Normalize

Each fix below: **Bad → Good**, with a one-line why.

**Strings** — invisible variance (trailing space, mixed case, lookalike unicode) silently breaks joins
and dedupe.

```python
# BAD: "US ", "us", "ｕｓ" all look different to a join
# GOOD:
s = df["country"].str.strip().str.casefold().str.normalize("NFKC")
```

**Categories** — use a **mapping table**, never a tower of regex. A dict is auditable and an *unmapped*
value gets quarantined instead of silently passing through.

```python
COUNTRY = {"usa": "US", "u.s.": "US", "united states": "US", "u.s.a.": "US", "es": "ES", "españa": "ES"}
key = df["country"].str.strip().str.casefold()
df["country"] = key.map(COUNTRY)            # unmapped -> NA, which the gate below will catch (no silent pass)
```

**Numbers** — turn sentinels into NA, then choose a range policy explicitly: *clip* (cap to bound) when
out-of-range is plausibly a recording cap, *reject* (→ NA / quarantine) when it is impossible.

```python
df["age"] = df["age"].mask(df["age"].isin([-1, 999]))   # sentinels -> NA
df["age"] = df["age"].clip(lower=0, upper=120)          # clip policy; or .mask(~df["age"].between(0,120)) to reject
```

**Dates** — state the `format`, coerce, then **count the casualties**. Never trust dayfirst inference;
`03/04/2026` is ambiguous and pandas will pick silently.

```python
parsed = pd.to_datetime(df["signup"], format="%Y-%m-%d", utc=True, errors="coerce")
bad = parsed.isna() & df["signup"].notna()
assert bad.sum() == 0, f"{bad.sum()} dates failed the expected format — inspect before proceeding"
df["signup"] = parsed
```

Copy-paste versions of all of these — category mapping with unmapped→quarantine, a robust date parser,
unicode/encoding repair, a sentinel→NA table, numeric clip-vs-reject, plus Polars equivalents — are in
[references/normalization-recipes.md](references/normalization-recipes.md).

## Dedupe

`drop_duplicates(keep="first")` is meaningless without a defined key and a stable sort — "first" of what
order? Define both.

```python
key = ["customer_id"]                                   # the BUSINESS key, stated explicitly
df = (df.sort_values(["customer_id", "updated_at"], ascending=[True, False], kind="stable")
        .drop_duplicates(subset=key, keep="first"))     # keep most-recent per customer, deterministically
```

Near-duplicates (`"Acme Inc"` vs `"Acme, Inc."`) are a *normalization* problem — collapse them in the
normalize step first; only then does exact dedupe catch them. Fuzzy matching is a separate, riskier
decision — make it visible, never automatic.

## Missing values — decide per column

No silent `fillna(0)`: a zero is a value, and treating "unknown" as zero poisons every mean, sum, and model
downstream. Pick deliberately.

| Situation | Action | Why |
| --- | --- | --- |
| Column is mostly null (e.g. >70%) and not load-bearing | Drop the **column** | Imputing it invents signal that isn't there |
| A few rows missing a *required* key (id, date) | Drop the **row** (and log/quarantine) | Can't dedupe or join without the key |
| Numeric gap you must fill for a model | Impute **and add a `_was_missing` flag** | The model can learn "was missing"; you keep the audit trail |
| Genuinely optional field | **Leave NA** | NA is information; don't fabricate a value |
| Value is present but *invalid* (unmapped category, bad date) | **Quarantine the row** | Don't drop silently and don't let it pass the gate |

```python
df["income_was_missing"] = df["income"].isna()
df["income"] = df["income"].fillna(df["income"].median())   # impute + flag, never bare fillna(0)
```

## Validate — the gate

This is where cleaning becomes *trustworthy*. Declare the contract as a pandera `DataFrameModel`, validate
**output** (and input expectations where they exist), and split valid rows from failures instead of
crashing — the failures become your quarantine.

```python
import pandera.pandas as pa
from pandera.typing import Series

class CustomerSchema(pa.DataFrameModel):
    customer_id: Series[int]   = pa.Field(unique=True, ge=1)
    country:     Series[str]   = pa.Field(isin=["US", "ES", "FR"])     # only mapped categories survive
    age:         Series[float] = pa.Field(ge=0, le=120, nullable=True)
    signup:      Series[pa.DateTime] = pa.Field(nullable=False)

    class Config:
        strict = True       # reject unexpected columns
        coerce = True       # coerce to declared dtype, fail loud if impossible

# lazy=True collects EVERY violation at once instead of dying on the first
try:
    valid = CustomerSchema.validate(df, lazy=True)
except pa.errors.SchemaErrors as e:
    failures = e.failure_cases          # dataframe of exactly which rows/checks failed
    failures.to_parquet("quarantine.parquet")   # keep, don't drop — someone investigates these
    valid = df.drop(index=e.failure_cases["index"].dropna().unique())  # proceed with the clean subset
```

`coerce=True` fixes types the contract expects; `nullable` states which columns may hold NA; field
`Check`s (`ge`, `le`, `isin`, `unique`) are the allowed-value rules. `strict` catches columns that
shouldn't be there. Together they are the data contract in code. Log the row-count diff on every run —
`in`, `out`, coerced, quarantined — so what the pipeline changed is an auditable record, not an assumption.

When to escalate beyond pandera: reach for **GX Core 1.0** (Great Expectations' rebranded OSS — Data
Context → Data Source → Expectation Suite → Validation Definition → Checkpoint) when you need a *shared
data-quality platform* across many datasets and teams with a results store and docs. Use **dbt model
contracts** (enforced at build) plus **dbt tests** (post-materialization) when the cleaning lives in a
SQL warehouse, not Python. The full `DataFrameModel` (custom `@pa.check`, lazy `SchemaErrors` report,
valid/quarantine split helper), the GX checkpoint sketch, the dbt model-contract + `data_tests` YAML, and
the "which validator" chooser are in [references/validation-patterns.md](references/validation-patterns.md).

## Scale — when pandas hurts

Heuristic: pandas is fine while the data fits comfortably in RAM (roughly ≤ 1–2 GB working set). Beyond
that, or when a groupby/join dominates the runtime, switch the *mechanics* (not the principles):

- **Polars** for clean-at-scale: `pl.scan_csv(...)` (lazy, parallel, Rust), then `.unique()`,
  `.drop_nulls()`, `.fill_null(...)`, `.str.*` — the same profile→normalize→dedupe→validate shape, faster.
  pandera validates Polars frames too, and the
  [recipes reference](references/normalization-recipes.md) has the Polars equivalent of every fix above.
- **DuckDB** when the bottleneck is analytical SQL over multi-GB files — point heavy joins/aggregations
  there: [`duckdb`](../duckdb/SKILL.md). It is an *engine* choice; correctness/normalization is still this
  skill's job.

## Anti-patterns

| Anti-pattern | Why it breaks |
| --- | --- |
| "`fillna(0)` to get rid of the nulls" | Zero is a value; it distorts every mean/sum/model. Impute deliberately and add a `_was_missing` flag. |
| "`drop_duplicates()` — done" | No `subset`, no sort → which row survives is nondeterministic. Define the key, `sort_values(kind="stable")`, set `keep`. |
| "`pd.read_csv(path)` and start cleaning" | pandas guesses: ids become floats, dates become strings. Pass `dtype_backend` + `na_values`. |
| "I fixed the rows in a notebook cell" | Not reproducible — next month's file gets nothing. Wrap it in `clean(raw) -> df`. |
| "Drop the rows that look wrong" | Silent data loss with no audit trail. Quarantine to a file; someone investigates. |
| "A few regexes will normalize the countries" | Unmaintainable and silent on new values. Use a mapping dict; unmapped → NA → caught by the gate. |
| "`pd.to_datetime` figures out the format" | Ambiguous dates parse silently wrong. State `format=`, `errors="coerce"`, then assert the NaT count. |
| "Validation passed, so we're good" | A gate that never fails is a no-op. Feed it a known-bad row and confirm it *rejects*. |
| "It's slow, rewrite everything in Polars" | Switch the engine, not the discipline — profile→normalize→dedupe→validate still applies. |

## Verify

`scripts/verify.sh` runs from anywhere, no network. It does static structure checks on this skill
(frontmatter keys, references present) always, and — when pandas + pandera are installed — extracts the
documented pattern, feeds it one clearly-good row and one clearly-bad row, and asserts the good row PASSES
validation while the bad row is FLAGGED/quarantined, proving the gate is not a no-op. Without
pandas/pandera it prints SKIP for the runtime check and still passes the static checks.

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki), record this dataset's
cleaning decisions — the schema/contract, the category mapping tables, the dedupe key, the quarantine
location, version pins — in `02-DOCS/wiki/data/<dataset>.md`, link it from the root `CLAUDE.md`
`## Knowledge map`, and read it first on every re-run so the contract stays consistent. No `02-DOCS/`? Skip
silently. Conventions are recorded, never gated.
