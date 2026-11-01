# Spain: invoicing rules and the files Spanish programs exchange

Load this only when the business is in Spain. Dates and rules below were checked on 2026-10-09
(sources at the end). **They move: check the tax agency (AEAT) and the BOE before quoting any date
to the user**, and say which date you checked.

## The line that matters: prepare vs issue

- **Preparing** an invoice (gathering what to bill, computing amounts, a draft, a payment reminder)
  can be done by the agent, a spreadsheet or a script.
- **Issuing** it (numbering, signing, chaining, recording, and in Veri\*factu mode sending to the
  AEAT) is done by **invoicing software that complies with the regulation**, with a person who
  presses the button.

| Piece | Who can do it |
|---|---|
| Gather and compute what to invoice | Agent, Excel, script |
| Create the invoice as a **draft** in the program | Agent through the API, with a dedicated user and approval |
| **Issue** it (number, chain, sign, send to the AEAT) | **The invoicing program**, with a person pressing |
| Warn about collections and overdue invoices | Agent (read-only, plus drafts of the messages) |
| Build its own issuing system | Only when assuming full compliance; not recommended for a small business |

An agent never "connects to Veri\*factu" by itself. It drafts; the compliant program issues and
sends the record.

## Veri\*factu (invoicing systems regulation)

- **What it requires** (RD 1007/2023): the software that issues invoices guarantees integrity,
  conservation, accessibility, legibility, traceability and inalterability of the records. Each
  invoice carries a fingerprint chained to the previous one: a numbered, stamped invoice book where
  no page can be torn out or rewritten without a trace. In **Veri\*factu** mode the program also
  sends every record to the AEAT almost as it issues it; the other mode keeps its own signature and
  event log.
- **Responsible declaration**: the software producer signs one per version, visible inside the
  program (Orden HAC/1177/2024). **The AEAT does not certify programs**: there is no "approved by
  Hacienda" seal. Ask for the declaration and the exact version, in writing.
- **Dates, as checked on 2026-10-09**: before **1 January 2027** for corporate income tax payers and
  **1 July 2027** for everyone else, self-employed included (RDL 15/2025). On 5 October 2026 the
  Treasury **announced** a postponement to October 2028; no published rule formalised it at the date
  checked. Plan with the legal dates and treat the postponement as possible, not certain.
- **Out of scope**: businesses in the SII, and the foral territories with TicketBAI or Batuz.
- **Software vendors** may only sell adapted systems with a declaration since 29 July 2025.
- **Own software**: the regulation applies to any taxpayer using an invoicing system, own or third
  party. An app built with Claude Code that stores, numbers and issues invoices **is** an invoicing
  system and must meet all of the above. The AEAT has FAQs on own software: read them before
  deciding.
- **Never** let an agent edit invoices in an invoicing program's database: it breaks the chain.

## B2B e-invoicing

- **RD 238/2026** and **Orden HAC/1028/2026** (BOE of 5 October 2026): e-invoicing between
  businesses becomes mandatory on **6 October 2027** for those invoicing more than €8M and on
  **6 October 2028** for everyone else.
- Structured format following EN 16931 (UBL, CII, EDIFACT or Facturae); the AEAT's public solution
  uses UBL. A PDF no longer counts between businesses. A private platform must send a UBL copy to
  the public solution.
- Each invoice is identified by issuer tax ID + series + number + date.
- The receiver reports acceptance, rejection and payment; the issuer can report collection or
  non-payment. Reporting statuses becomes a new, mandatory write: a good candidate to automate,
  with human approval.
- It is the real migration trigger for old programs: the program must issue and receive UBL or
  Facturae. Ask the vendor in writing ([connect or migrate](connect-or-migrate.md)).

Effects on connections:

1. **Accounting import files are not invoices** and do not change. They remain the right way for a
   person to validate an entry ([file exchange](file-exchange.md)).
2. **Received invoices will arrive as structured XML.** The agent reads tax IDs, bases and taxes
   without OCR and keeps the XML as the supporting document.
3. **Issued invoices**: the agent does not generate or sign UBL or Facturae on its own, nor call
   issuing endpoints. It leaves data or drafts for the adapted program.
4. **An invoice already issued elsewhere only enters accounting.** It is never re-issued by
   importing it into another program's invoicing module.

## File formats Spanish programs exchange

| Format | What it is | Where it appears |
|---|---|---|
| **SUENLACE.DAT** | A3's accounting link file: fixed-width ASCII, 512-byte records | a3asesor imports; accounting firms that use A3. Details in [file exchange](file-exchange.md) |
| **ContaPlus files** (XDiario, XSubCta) | Legacy fixed-width or dBase exchange format | Still accepted by Sage 50 and ContaSOL |
| **ContaSOL books** (APU, FAC/LFA, FRE/LFR) | Excel books with fixed names | ContaSOL imports; FactuSOL passes invoices to ContaSOL |
| **Norma 43** | The Spanish banking standard (AEB/CSB 43) for account statements: fixed-width text | Exported by every Spanish bank's online banking; imported by accounting programs for bank reconciliation. A clean read-only source of movements |
| **Facturae** | Spain's structured XML e-invoice, mandatory with the public administration (FACe) | Invoicing programs; accepted for B2B e-invoicing |
| **UBL** (EN 16931) | The European structured e-invoice | The AEAT public solution for B2B e-invoicing |
| **BC3** (FIEBDC-3) | The construction standard for budgets, price databases and measurements: plain text | Presto and construction software; installer software imports it |
| **SII** | Immediate VAT information supply to the AEAT | Larger companies; A3 and others carry SII fields in their import files |

Norma 43, Facturae and BC3 are public standards: a script reads them without the program that wrote
them. Still copy the structure from a real sample.

## Sources

Checked on 2026-10-09; adapted from Executive Lab's guides (see `../THIRD_PARTY.md`).

1. AEAT, Sistemas informáticos de facturación y Veri\*factu: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html
2. AEAT, note on the extended adaptation period: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html
3. BOE, Orden HAC/1028/2026: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20587
4. BOE, Real Decreto 1007/2023: https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840
5. BOE, Orden HAC/1177/2024: https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138
6. BOE-A-2026-7295, cited by the source guide for B2B e-invoicing: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7295

Not verified at that date: the AEAT FAQ text on own software, the full text of RD 238/2026, a rule
formalising the postponement, penalties.
