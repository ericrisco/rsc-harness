---
name: document-processing
description: "Use when the deliverable is a document's bytes or its literal content — text/tables out of PDFs, AcroForm fill and flatten, page merge/split, PDF/DOCX from templates, OCR of image-only scans. NOT schema-typed fields pulled from text (that is structured-extraction), NOT signature routing (e-signature) or spreadsheet cells/formulas (spreadsheet-ops)."
tags: [pdf, ocr, docx, forms, extraction, document-ai]
recommends: [structured-extraction, e-signature, spreadsheet-ops, rag, data-scraper]
origin: risco
---

# Document processing

File in, content out — or data in, file out. You open a byte stream (PDF, DOCX, scan) and either pull the content out, or you build a new document from a template and a data dict. That is the whole job: the deliverable is **bytes of a document or the literal content of one**.

The boundary test, apply it first:

- Deliverable is **raw text / Markdown / table cells / a generated file** → you are in the right place.
- Deliverable is **a typed object matching a schema** (`{parties: [...], total: 1234.50}`) → that is `structured-extraction`. This skill stops at "clean Markdown out of the file"; the schema-constrained extraction runs on that Markdown.

Everything else routes too: signing with an audit trail → `e-signature`, spreadsheet grids/formulas/XLSX-as-data → `spreadsheet-ops`, indexing for cross-document Q&A → `rag` (this skill *produces* the text `rag` ingests, it does not index it), downloading the files off a site → `data-scraper`.

## Step 0 — does the PDF have a text layer?

The most expensive mistake in this skill is OCR'ing a PDF that already has a text layer. A digital PDF (exported from Word, a browser, a report tool) carries selectable text — extracting it is free, instant, and lossless. OCR is slow, costs money or GPU, and *introduces* errors. **Never OCR a PDF you can extract.**

Check before you pick an engine:

```python
import pdfplumber

with pdfplumber.open("doc.pdf") as pdf:
    txt = pdf.pages[0].extract_text() or ""

if len(txt.strip()) > 20:
    print("text layer present -> extract directly (pdfplumber / pypdf)")
else:
    print("image-only or empty -> this is an OCR job")
```

If `extract_text()` returns empty (or near-empty) across the first few pages, it is a scan or image-only PDF and you go to the OCR branch. Symptom from the user's side: *"the text copies out as garbage / random symbols"* usually means a broken/embedded font, not a missing text layer — try `pypdf` extraction too before assuming OCR.

## Engine selection

| Goal | Use | Why |
|---|---|---|
| Extract text + tables with layout | **pdfplumber** | Layout-aware; `extract_tables()` returns rows/cols as Python lists → pandas/CSV. |
| Raw text, merge, split, rotate, page ops | **pypdf** (6.12.2) | Pure-Python, no C deps, runs in Lambda/containers; the maintained core — import `pypdf`, never the dead `PyPDF2`, which was merged back into it. |
| Fill an interactive PDF form | **pypdf** | `update_page_form_field_values` writes AcroForm fields; can flatten. |
| Generate a Word/DOCX from a template | **docxtpl** (0.20.x) | A real `.docx` becomes a Jinja2 template; author in Word, tag, render. |
| Generate a PDF from scratch | **ReportLab** | Canvas / Platypus flowables for laid-out PDFs. |
| OCR a scan, local / no API budget | **Docling** (or Marker) | Layout + reading order + table structure, fully local, wraps Tesseract/RapidOCR. |
| OCR messy scans / handwriting / hard tables, API ok | **Mistral OCR** | `mistral-ocr-2512` (OCR 3), ~$2 / 1,000 pages, tuned for forms + handwriting. |
| Fastest extract / easiest page→PNG raster | **PyMuPDF** ⚠️ **AGPL** | Fast, but AGPL: shipping it imposes an open-source obligation or needs a paid license. Flag this before recommending. |

## Extraction recipes

Text + tables with `pdfplumber`, straight to CSV:

```python
import csv
import pdfplumber

rows = []
with pdfplumber.open("invoice.pdf") as pdf:
    for page in pdf.pages:
        for table in page.extract_tables():
            rows.extend(table)

with open("out.csv", "w", newline="") as f:
    csv.writer(f).writerows(rows)
```

Raw text, merge, split, rotate with `pypdf`:

```python
from pypdf import PdfReader, PdfWriter

# raw text
text = "\n".join(p.extract_text() or "" for p in PdfReader("doc.pdf").pages)

# merge two files
w = PdfWriter()
for src in ("a.pdf", "b.pdf"):
    w.append(src)
with open("merged.pdf", "wb") as f:
    w.write(f)

# split first 3 pages + rotate one
w2 = PdfWriter()
reader = PdfReader("doc.pdf")
for page in reader.pages[:3]:
    w2.add_page(page)
w2.pages[0].rotate(90)
with open("first3.pdf", "wb") as f:
    w2.write(f)
```

## Form filling (AcroForm)

Dump the field names first — guessing them is the #1 reason a fill silently does nothing:

```python
from pypdf import PdfReader

fields = PdfReader("form.pdf").get_fields() or {}
for name, f in fields.items():
    print(name, "->", f.get("/FT"))  # /Tx text, /Btn checkbox/radio, /Ch choice
```

Then write the values. Set `auto_regenerate=False` and bake with `flatten=True` if it must not be editable:

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("form.pdf")
writer = PdfWriter()
writer.append(reader)

for page in writer.pages:
    writer.update_page_form_field_values(
        page,
        {"applicant_name": "Eric Risco", "agree": "/Yes"},  # checkbox = its on-state
        auto_regenerate=False,  # else a spurious "save changes?" prompt fires on open
    )

# flatten=True bakes the values and drops the editable widgets
with open("filled.pdf", "wb") as f:
    writer.write(f)
```

`auto_regenerate` defaults to `True` for legacy reasons, and you almost never want it. Checkbox/radio values are the field's `/V` on-state (often `/Yes`), not `True` — read the field to find it.

## Generation

DOCX from a Word template you authored and tagged with Jinja2 (`{{ client }}`, `{% tr for row in items %}` on a table row, `InlineImage` for pictures):

```python
from docxtpl import DocxTemplate

doc = DocxTemplate("contract_template.docx")
doc.render({
    "client": "Acme SL",
    "date": "2026-06-02",
    "items": [{"desc": "Audit", "amount": "1.200,00 €"}],
})
doc.save("contract_2026-06-02.docx")
```

PDF from scratch with ReportLab Platypus:

```python
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()
doc = SimpleDocTemplate("report.pdf", pagesize=A4)
doc.build([
    Paragraph("Quarterly Report", styles["Title"]),
    Spacer(1, 12),
    Paragraph("Generated automatically from the data dict.", styles["BodyText"]),
])
```

## OCR

Branch on cost and privacy. **Local, no API budget, or data must not leave the machine → Docling/Marker.** **Messy scans, handwriting, brutal tables, and an API budget is fine → Mistral OCR.**

Local with Docling (wraps Tesseract / RapidOCR, exports Markdown preserving tables):

```python
from docling.document_converter import DocumentConverter

result = DocumentConverter().convert("scan.pdf")
markdown = result.document.export_to_markdown()
open("scan.md", "w").write(markdown)
```

Hosted with Mistral OCR (~$2 / 1,000 pages, 50% off via Batch API; outputs interleaved text+images as Markdown):

```python
from mistralai import Mistral

client = Mistral(api_key=os.environ["MISTRAL_API_KEY"])
resp = client.ocr.process(
    model="mistral-ocr-2512",
    document={"type": "document_url", "document_url": signed_url},
)
markdown = "\n\n".join(p.markdown for p in resp.pages)
```

**Never trust OCR output blind.** OCR confuses `0/O`, `1/l/I`, and drops or shifts decimal points — a `1.234,50` can come back as `1234,50` or `1,234.50`. Always spot-check totals, dates, and ID numbers against the rendered page before you hand the text downstream. For clean scans with no budget, plain `pytesseract` is the zero-cost baseline, but it is weak on layout/tables versus the pipelines above.

## Scale

Batch jobs: parallelize per-file, cap concurrency on the hosted API (rate limits + cost), and use Mistral's Batch API for the 50% discount on large runs. Engine install matrix, exact version pins, the full licensing table, the Docling-vs-Marker-vs-Mistral feature/cost comparison, and troubleshooting (encrypted PDFs, mangled AcroForm field names, multi-column reading order, CJK/handwriting) live in `references/engines.md` — read it before a non-trivial install.

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|---|---|---|
| Pipe every PDF straight to OCR | OCR'ing a digital PDF is slow, costs money, and *adds* errors to text you could extract losslessly | Step 0: check the text layer first; OCR only image-only PDFs |
| `import PyPDF2` | Unmaintained; merged into `pypdf` years ago — a stale-code smell | `from pypdf import PdfReader, PdfWriter` |
| Recommend PyMuPDF without a word about its license | PyMuPDF is **AGPL**; shipping it silently creates an open-source obligation | Flag AGPL; prefer pdfplumber/pypdf, or get a commercial license knowingly |
| Leave `auto_regenerate=True` on a form fill | Marks the AcroForm dirty → a spurious "save changes?" prompt for every user | Pass `auto_regenerate=False` |
| Trust OCR'd totals/numbers as-is | `0/O`, `1/l`, shifted decimals silently corrupt amounts | Spot-check totals/dates/IDs against the page image |
| Hand-roll a regex to pull typed fields from the Markdown | Brittle, re-implements a sibling, breaks on layout drift | Output clean Markdown, hand it to `structured-extraction` |
| Use Mistral OCR when the user said "no cloud / local only" | Sends documents off-machine, violating the privacy constraint | Use Docling/Marker + Tesseract/RapidOCR locally |
