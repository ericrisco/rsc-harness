---
name: spreadsheet-ops
description: "Use when working a spreadsheet programmatically — writing or repairing a formula, generating an .xlsx with Python including charts and conditional formats, driving Google Sheets from a script, building a read-transform-write pipeline, or writing an in-sheet macro or trigger. Covers formula errors, Sheets API quota, service-account permissions, and formulas that read back blank. NOT pure dedupe or normalisation with no sheet output (that is `data-cleaning`), NOT scraping a web table into rows (that is `data-scraper`), NOT multi-app event wiring (that is `automation-flows`)."
tags: [spreadsheet, excel, google-sheets, openpyxl, gspread, apps-script, formulas, automation]
recommends: [data-cleaning, data-scraper, automation-flows, google-workspace, reporting, duckdb, document-processing]
origin: risco
---

# spreadsheet-ops — the spreadsheet as a programmable surface

A spreadsheet is a runtime, not a document. Your job is to emit a **checkable artifact** — a `.xlsx`
file that opens, a script that compiles, a cell range you can re-read — never a hand-waved formula in
prose. Pick the tool that matches the runtime (local file vs cloud sheet, one-shot vs event-driven),
write the formula with comma arguments, and verify before you claim it works.

The trap that bites everyone first: **openpyxl writes formulas but does not compute them.** The string
is stored; Excel evaluates it on open. If you read the cell back with Python it is `None` until a real
Excel/LibreOffice session has saved it. Internalize that before you touch a workbook.

## Pick the tool first (this branches, so decide before coding)

| Your situation | Reach for | Why |
| --- | --- | --- |
| Read **and** modify an existing local `.xlsx` | **openpyxl** | Only mainstream lib that round-trips an existing file. |
| Write a new `.xlsx` rich with charts/conditional formats, possibly large | **xlsxwriter** (via pandas `ExcelWriter`) | Write-only but the richest formatting + low-memory `constant_memory` mode. |
| Dump a DataFrame to a sheet, minimal fuss | **pandas** `df.to_excel(...)` | Wraps an engine; pass `engine=` explicitly so the result does not depend on what is installed. |
| Read/write a cloud Google Sheet from a script | **gspread** (+ `gspread-formatting` for colors/rules) | Friendly wrapper over the Sheets API for CRUD. |
| High-volume cloud writes, must beat quotas | **Sheets API v4** `batchUpdate` | One batched call counts as one request — survives the per-minute limit. |
| In-sheet menus, time-driven triggers, custom functions | **Apps Script (V8)** | Runs inside the sheet; the only place for `onEdit`/menus. |

Two you will confuse: **xlsxwriter cannot open an existing file** — if you need to edit one in place,
that is openpyxl. And gspread vs the raw Sheets API is convenience vs throughput: reach for raw
`batchUpdate` only when gspread's per-call writes would blow the quota.

Versions seen on PyPI when this was written (2026-06-02): openpyxl **3.1.5**, gspread **6.2.1**
(Python 3.8+), gspread-formatting **1.2.1**, pandas on the **3.x** line, Sheets API **v4**, Apps
Script on the **V8** runtime. Treat these as a floor, re-check PyPI before pinning, and pin whatever
you actually resolve — do not copy a point release from a doc as gospel.

## Formula rules (each rule, one reason)

1. **Arguments are comma-separated, always — never semicolons.** openpyxl and the file format use
   commas regardless of your machine's locale; a semicolon is the single most common "my written
   formula is broken" cause. Bad: `=SUM(A1;A2)` → Good: `=SUM(A1,A2)`.
2. **A formula string must start with `=`.** `ws["A1"] = "SUM(1,1)"` stores literal text; `ws["A1"] =
   "=SUM(1,1)"` stores a formula. No leading `=` means no calculation, ever.
3. **Anchor references you intend to fill.** A lookup table dragged down breaks unless absolute: Bad:
   `=VLOOKUP(A2,Sheet2!A:B,2,0)` → Good: `=XLOOKUP(A2,Sheet2!$A:$A,Sheet2!$B:$B)`.
4. **Prefer XLOOKUP over VLOOKUP** — exact match by default, no magic column index to miscount, works
   leftward. VLOOKUP's 4th arg silently defaulting to approximate match is a classic wrong-result bug.
5. **Prefer dynamic arrays over Ctrl+Shift+Enter array formulas** — `=FILTER(...)`, `=SORT(...)`,
   `=UNIQUE(...)` spill automatically and are readable. A spill blocked by data below it raises
   `#SPILL!`; clear the range, do not array-enter.
6. **Never deep-nest IFs.** Past two levels use `LET` (name sub-expressions once) or a helper column.
   Bad: `=IF(A1>90,"A",IF(A1>80,"B",IF(A1>70,"C","D")))` → Good: a lookup table + `XLOOKUP`, or
   `=LET(g,A1, IF(g>90,"A", IF(g>80,"B","C")))` kept shallow.

When generating cross-sheet formulas, `SHEET()` returns a sheet's index and `SHEETS()` returns the
sheet count — both have shipped in Excel for years (SHEET/SHEETS since Excel 2013) and exist in Google
Sheets, so they are safe to emit. Full XLOOKUP/SUMIFS/LET patterns and the `#VALUE!/#REF!/#N/A/#NAME?`
error decoder live in [`references/formula-cookbook.md`](references/formula-cookbook.md).

## Python → Excel

The no-compute trap, stated as code:

```python
from openpyxl import load_workbook
wb = load_workbook("report.xlsx")
ws = wb.active
ws["C2"] = "=A2*B2"          # stores the FORMULA string, not a number
wb.save("report.xlsx")
# Re-reading C2 now returns "=A2*B2" (the formula), or with data_only=True
# returns None — because no Excel has opened+saved the file to cache a value.
back = load_workbook("report.xlsx", data_only=True)
assert back.active["C2"].value is None   # last cached value: none yet
```

So: if a downstream step needs the computed number, either compute it in Python and write the value, or
open the file once in Excel/LibreOffice headless to populate the cache. Do not assume openpyxl evaluated it.

Append a sheet to an existing file (the only mode that does not silently truncate):

```python
import pandas as pd
with pd.ExcelWriter("report.xlsx", engine="openpyxl", mode="a",
                    if_sheet_exists="replace") as xl:
    df.to_excel(xl, sheet_name="2026-Q2", index=False)
```

Charts and conditional formatting on a new file go through **xlsxwriter** (richer) — it is write-only,
so never point it at a file you need to keep. Recipes (chart, conditional format, `write_only`/
`constant_memory` for big files) are in [`references/python-excel.md`](references/python-excel.md).

## Google Sheets from a script

```python
import gspread
gc = gspread.service_account(filename="bot-key.json")  # service account
sh = gc.open_by_key("SPREADSHEET_ID")
ws = sh.worksheet("Orders")
ws.append_rows([["2026-06-02", "INV-1001", 240.00]],
               value_input_option="USER_ENTERED")      # parses formulas/dates
```

The failure that wastes the most time: **a service account has zero access until the sheet is shared
with its email.** Open the key JSON, copy `client_email`, and share the sheet with it (Editor) — a
`PermissionError`/`SpreadsheetNotFound` here is almost always an unshared sheet, not bad code.

Quotas (as published 2026-06-02 — re-check Google's "Usage limits" page, these shift): **300 read
req/min/project, 60 read req/min/user** (writes mirror this), refilled each minute, no daily cap under
the per-minute ceiling. A `batchUpdate` — with all its sub-requests inside — counts as **one** request.
So batch: build one `batchUpdate` body instead of N `update` calls, and wrap calls in exponential
backoff on HTTP 429. Batching is the difference between a nightly job that survives and one that 429s.

Creating the OAuth client or service account itself is [`google-workspace`](../google-workspace/SKILL.md)'s
job; this skill assumes the credential exists and owns the Sheets surface. `batchUpdate` request shapes
and backoff code are in [`references/sheets-api-appsscript.md`](references/sheets-api-appsscript.md).

## In-sheet automation (Apps Script V8)

Write for **V8** — Google deprecated the legacy Rhino runtime (Feb 2025) and set its retirement for on
or after 2026-01-31, so new code should never target it. V8 has **no `fetch`, no timers, no streams**
— use `UrlFetchApp.fetch()` (or `fetchAll()` for parallel) for HTTP. No ES6 `import/export`, no private
`#fields`.

Read and write the sheet in **one** range operation, never a per-cell loop — `getValue()`/`setValue()`
inside a loop makes one API round-trip per cell and times out on real data:

```javascript
function colorOverdue() {
  const sh = SpreadsheetApp.getActiveSheet();
  const data = sh.getDataRange().getValues();   // ONE read, all rows
  const out = data.map(r => r[3] === "OVERDUE" ? ["#fde0e0"] : ["#ffffff"]);
  sh.getRange(1, 1, out.length, 1).setBackgrounds(out.map(c => c)); // ONE write
}
```

Time-driven triggers (run nightly), `onEdit` simple triggers, and custom menus are covered in
[`references/sheets-api-appsscript.md`](references/sheets-api-appsscript.md).

## Pipeline pattern: read → transform → write

A pipeline that reruns must not duplicate rows. Decide the write mode first:

1. **Define a header contract** — the exact columns and order. Assert the live header matches before
   writing; a shifted column silently corrupts everything downstream.
2. **Choose the write mode:**
   - *Full overwrite* — clear the data range, write all rows. Simple, safe when the sheet is yours alone.
   - *Keyed upsert* — read existing keys (e.g. `order_id`) into a map, update matched rows, append the
     rest. Idempotent: rerunning yields the same sheet, no duplicates.
3. **Dry-run first.** Compute the diff (rows to add/update) and log it; only write when a `--apply` flag
   is set. This catches a wrong key or a header drift before it touches the live sheet.
4. **Batch the write** (`batchUpdate` / `setValues`) and back off on 429.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Semicolon arguments `=SUM(A1;A2)` | File format is comma-only; locale display fools you | Always commas `=SUM(A1,A2)` |
| Formula string without leading `=` | Stored as literal text, never calculates | Start the string with `=` |
| Assuming openpyxl computed the result | It only stores the formula; value is `None` until Excel opens it | Write the value, or open once to cache |
| Per-cell `getValue()`/`setValue()` loop (Apps Script) | One round-trip per cell → timeout | `getValues()`/`setValues()` once per range |
| N single `update` calls to the Sheets API | Blows 60/user-min, 300/project-min quota | One `batchUpdate`; backoff on 429 |
| Service account not shared with the sheet | `PermissionError`, looks like a code bug | Share the sheet with `client_email` from the key |
| Deep-nested `IF` chains | Unreadable, miscounted parens, hard to repair | `LET`, a lookup table, or a helper column |
| xlsxwriter to modify an existing file | It is write-only; you lose the original | openpyxl for read+modify |
| `df.to_excel("f.xlsx")` over an existing file | Default mode truncates the whole workbook | `ExcelWriter(..., mode="a")` to append |
| VLOOKUP with a hardcoded column index | Index miscounts when columns move; approximate-match default | `XLOOKUP` with explicit ranges |

## Verify

Run `scripts/verify.sh` (read-only by default; pass a path to a generated `.py`/`.xlsx`). It
`py_compile`s generated scripts, opens produced workbooks with openpyxl to confirm a sheet + header row,
and lints formula strings for the semicolon-argument bug. Cloud paths are validated by structure, not
live Google calls — no network or credentials required. On an empty/clean target it exits 0.

References: [`python-excel.md`](references/python-excel.md) ·
[`sheets-api-appsscript.md`](references/sheets-api-appsscript.md) ·
[`formula-cookbook.md`](references/formula-cookbook.md).
