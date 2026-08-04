# Normalization recipes — copy-paste

Each recipe is deterministic and re-runnable. Drop them into your `normalize(df)` step. Polars equivalents
at the end for when pandas runs out of RAM.

## Category mapping (unmapped → quarantine, never silent pass)

A dict is auditable; a regex tower is not. Anything not in the map becomes NA so the schema gate catches it.

```python
COUNTRY = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states": "US", "us": "US",
    "españa": "ES", "espana": "ES", "spain": "ES", "es": "ES",
    "france": "FR", "fr": "FR",
}

def map_category(s, mapping):
    key = s.str.strip().str.casefold().str.normalize("NFKC")
    mapped = key.map(mapping)
    unmapped = key.notna() & mapped.isna()
    if unmapped.any():
        # surface the new values so you extend the map deliberately, not silently
        print("UNMAPPED categories:", sorted(key[unmapped].unique()))
    return mapped     # unmapped rows are NA -> the schema's isin/nullable=False check rejects them

df["country"] = map_category(df["country"], COUNTRY)
```

## Robust date parsing (explicit format, count the casualties)

```python
def parse_dates(s, fmt="%Y-%m-%d", utc=True):
    parsed = pd.to_datetime(s, format=fmt, utc=utc, errors="coerce")
    failed = parsed.isna() & s.notna()        # coerced to NaT but original wasn't null = parse failure
    if failed.any():
        raise ValueError(f"{failed.sum()} values did not match {fmt!r}: {s[failed].head().tolist()}")
    return parsed
```

If a single source genuinely mixes formats, parse each known format and `combine_first`, then assert no NaT
remains. Never fall back to dayfirst inference — `03/04/2026` is ambiguous and pandas picks silently.

```python
def parse_mixed(s, formats=("%Y-%m-%d", "%d/%m/%Y")):
    out = pd.Series(pd.NaT, index=s.index, dtype="datetime64[ns, UTC]")
    for fmt in formats:
        try_ = pd.to_datetime(s, format=fmt, utc=True, errors="coerce")
        out = out.fillna(try_)
    remaining = out.isna() & s.notna()
    assert not remaining.any(), f"{remaining.sum()} dates matched none of {formats}"
    return out
```

## Unicode / encoding repair

```python
# 1. Read with the RIGHT encoding (don't let pandas/locale guess). If you see mojibake like "RodrÃ­guez",
#    the file is utf-8 misread as latin-1 — re-read as utf-8.
df = pd.read_csv("raw.csv", encoding="utf-8")

# 2. Normalize text: NFKC folds full-width/compatibility forms; strip control chars and zero-width junk.
import re
ZERO_WIDTH = re.compile(r"[​‌‍﻿]")
def clean_text(s):
    return (s.str.normalize("NFKC")
             .str.replace(ZERO_WIDTH, "", regex=True)
             .str.strip())

# 3. Last-resort repair of already-corrupted text (needs `pip install ftfy`):
#    from ftfy import fix_text; df["name"] = df["name"].map(fix_text)
```

## Sentinel → NA

Map the per-column sentinels to real NA *before* any numeric check, so means and ranges aren't poisoned.

```python
SENTINELS = {
    "age":     [-1, 999],
    "income":  [-1, 0, 999999],     # 0 is a sentinel here only if 0 income is impossible in this dataset
    "rating":  [-1],
}
for col, vals in SENTINELS.items():
    df[col] = df[col].mask(df[col].isin(vals))     # -> NA; decide drop/impute/quarantine in handle_missing
```

## Numeric range — clip vs reject

```python
# CLIP: out-of-range is plausibly a recording cap → pull to the bound (keeps the row).
df["age"] = df["age"].clip(lower=0, upper=120)

# REJECT: out-of-range is impossible → set NA so the gate quarantines the row (don't fabricate a value).
df["age"] = df["age"].mask(~df["age"].between(0, 120))
```

Decide per column and write the choice down — clipping a fraud-amount silently hides outliers; rejecting a
sensor reading silently loses data. The right call depends on the field's meaning.

## Polars equivalents (clean-at-scale)

Same profile→normalize→dedupe→validate shape, lazy and parallel. Pin Polars and stay deterministic.

```python
import polars as pl

lf = pl.scan_csv("raw.csv", infer_schema_length=10_000)     # lazy: nothing reads until .collect()

clean = (
    lf
    # strings: strip + lowercase + (NFKC via map if needed)
    .with_columns(pl.col("country").str.strip_chars().str.to_lowercase().alias("country"))
    # category mapping table
    .with_columns(pl.col("country").replace_strict(COUNTRY, default=None))
    # sentinels -> null
    .with_columns(pl.when(pl.col("age").is_in([-1, 999])).then(None).otherwise(pl.col("age")).alias("age"))
    # dates: explicit format, strict=False coerces failures to null (then check the count)
    .with_columns(pl.col("signup").str.to_datetime("%Y-%m-%d", strict=False, time_zone="UTC"))
    # missing: drop rows missing the required key
    .drop_nulls(subset=["customer_id"])
    # dedupe: deterministic — sort then keep first per key
    .sort(["customer_id", "updated_at"], descending=[False, True])
    .unique(subset=["customer_id"], keep="first")
    .collect()                                              # execute the lazy plan
)

# fill_null deliberately (with a flag column), never a blind 0:
clean = clean.with_columns(
    pl.col("income").is_null().alias("income_was_missing"),
    pl.col("income").fill_null(strategy="mean"),
)
```

pandera validates Polars frames too (`import pandera.polars as pa`), so the gate from
[validation-patterns.md](validation-patterns.md) carries over. Hand multi-GB analytical SQL to
[`duckdb`](../../duckdb/SKILL.md) — the engine changes, the discipline does not.
