# File exchange: reading exports, generating imports

A route of its own, with its method and its proof. Most small-business programs export to Excel or
CSV and import an official file, even when they have no API. **To read**, the program exports to a
folder and the agent reads. **To write**, the agent generates the program's official import file and
a person imports it.

Reading this way is often the best first route for an installed program: it needs no database
access, keeps the vendor's support, and takes an afternoon. Writing this way is the **only** safe
way to write into an installed accounting or invoicing program.

## Reading: an export to a folder

1. **Choose what comes out.** Few, useful things: sales of the day, pending invoices, stock, open
   jobs. Only the columns needed (GDPR).
2. **Find the function in the program.** Almost every program exports its list screens to Excel or
   CSV. Some export by FTP, set up by the distributor. Construction software exports BC3, a plain
   text standard any script can read.
3. **Schedule it.** The program's own scheduler if it has one; otherwise the Windows Task Scheduler
   or a script run by the IT person. If it cannot be automated, a weekly manual export is a valid
   start.
4. **Choose the folder.** A folder on a server or synced with OneDrive or Google Drive. The program
   only writes there; the agent only reads.

Rules for the folder:

- The exporter writes to a temporary name and **renames at the end**: a half-written file must
  never be read.
- File events are not reliable on network shares (SMB/NFS) or Docker volumes on Windows: read on a
  schedule instead of on change.
- **Validate the structure of every file** against the described format, and warn when it changes:
  a program update breaks a parser silently.
- The data is as fresh as the last export. Say so to the user.

## Writing: the official import file

The agent does not write in the program. It reads the source (invoices, tickets, an Excel), proposes
the records, and generates the program's **official import file** in `01-TOOLS/<TOOL>/out/`
(gitignored). A person reviews it, runs the program's own validation, and imports it with the
program's button. So the program's integrity and support stay intact, the Spanish Veri\*factu record
chain is never touched, and a person always says "yes" before anything enters the books.

Rules:

1. **Sample file first.** Before generating anything, get a file exported from the user's own
   program, or the vendor's official examples, and copy its structure exactly. Fixed-width
   positions change between versions.
2. **Existing accounts only.** The file uses accounts from the current chart of accounts. A missing
   one is flagged for review, never invented. (Some programs **create** an unknown account on
   import: a typo becomes a new sub-account.)
3. **Totals balance.** Base + tax = total on every invoice; debit = credit on every entry. If it does
   not balance, it does not leave.
4. **No duplicates.** A batch log (supplier + number + amount + batch) in
   `01-TOOLS/<TOOL>/out/lotes.csv`, checked before every new file.
5. **The person imports.** After the program's validation and a backup.
6. **Never issue.** The agent does not create **issued** invoices in an invoicing program. It
   prepares data or drafts; a person issues from the program.

## Describe the format

In `01-TOOLS/<TOOL>/README.md`, for every file read or generated:

| Property | Example |
|---|---|
| Columns, in order, with type | `fecha` date · `cuenta` text(10) · `debe` decimal · `haber` decimal |
| Encoding | Windows-1252 (common in Spanish desktop programs) or UTF-8, with or without BOM |
| Separator | `;` (Spanish Excel default), `,`, tab, or fixed width |
| Decimal mark | `,` or `.`; thousands separator, if any |
| Date format | `dd/mm/yyyy`, `yyyymmdd`… |
| Fixed widths | positions and lengths, for fixed-width formats |
| Line ending | CRLF or LF |

## The proof

`test_connection` for this route checks:

- **Reading:** the latest export exists, is **recent** (within the expected schedule) and **matches
  the described format** (columns, encoding, separator). A stale or changed file fails the test.
- **Writing:** a generated file validates: structure, balances, existing accounts, no duplicates.
- **The first import** is done in the program's **test company** (most accounting programs have
  one, or the user creates one), never in the real books. Only after that test import looks right
  does the route go live.

## Formats of common Spanish accounting programs

Checked against vendor documentation on 2026-10-09 (source: see `../THIRD_PARTY.md`). Formats and
positions change between versions: always generate a sample from the user's own program and
compare.

| Program | Format | What it imports | Paid? | Main risks |
|---|---|---|---|---|
| **A3 (a3asesor eco/con)** | **SUENLACE.DAT**: fixed-width ASCII, 512-byte records. Type at position 15: 0 entry without VAT, 1 invoice with VAT, 2 corrective, 9 VAT detail, C new accounts, V/B due dates, A/D analytics | Entries, issued and received invoices with VAT and SII, corrective invoices, accounts, due dates, analytics | No (standard). Excel-to-link importers are separate | An unknown account is **created automatically**. Always run the **Chequeo**. Official examples in the install: `SUENLAC5.TXT`, `SUENLAC5.EJE` |
| **a3innuva Contabilidad** | **Importia** (Excel with a column wizard and .zip templates) or the **API** with entries and invoices in **Draft** | Issued and received invoices, entries, chart of accounts, payroll link | Yes: Importia and Conectia (API) are separate subscriptions | Re-importing without "undo" duplicates. A wrong VAT operation code misclassifies |
| **Sage 50 (Spain)** | Free **entry import/export** add-on: three files (sub-accounts, journal, notes) as fixed-width .txt, .csv or .dbf, ContaPlus-compatible | Entries (VAT in the journal), sub-accounts, notes. **Not** invoices as sales documents | No (enable it in Add-ons) | Import in order: accounts → entries → notes. Shorter account codes are zero-padded and can land on the wrong sub-account. No blank template: export a sample entry and copy it |
| **Sage 200 (Spain)** | **Import manager** with Excel guides (entries, invoices plugin) | Customers and items (official); entries and invoices as entries through guides or plugins | Probably (partner guides) | Empty invoice type after import → incomplete VAT books. With its Veri\*factu module, invoices certified by other software are not imported |
| **ContaSOL** (and FactuSOL → ContaSOL) | Excel books with fixed names: **APU** (journal), **FRE + LFR** (received), **FAC + LFA** (issued), **PLA + LPL** (templates). Also ContaPlus ASCII and the ASCII Connector | Entries, invoices (VAT books), master data, opening | No (Utilities > Imports) | Different account lengths fail. Fields too long are **dropped silently**; text in a numeric field becomes 0. The Connector writes straight into the DATOS folder: back up first |
| **ContaPlus** (legacy) | XDiario, XSubCta, XDatAsi (fixed-width .txt or .dbf) | Entries, sub-accounts, comments | No | No official support for years. Still an exchange format Sage 50 and ContaSOL accept, but VAT may not reach the books and form 303 correctly |
| **Holded** | Excel/CSV templates: Journal, Accounts, Sales, Purchases, Contacts | Entries, chart of accounts, sales and purchase invoices, contacts | No | Widen account digits **before** creating data. Contacts must exist (matched by tax ID). Undo is not documented |
| **Odoo** | Generic importer (CSV/XLSX) on `account.move` and its lines | Entries, invoices, contacts, statements | No | **Imports are permanent**: use "Test" and small batches, with External IDs to avoid duplicates. Entries stay in **draft** (good for review). With Veri\*factu active, posting a customer invoice sends it to the tax agency |

Other programs: ask the distributor which import format they accept, and get a sample.

What changes with Spanish B2B e-invoicing, and why import files are unaffected: [Spain](spain.md).
