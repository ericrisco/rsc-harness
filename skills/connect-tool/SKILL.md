---
name: connect-tool
description: "Use when the user names a specific tool to connect to the agent (an ERP, accounting or desktop program, CRM, WhatsApp, a spreadsheet, a database): research its real docs, choose the safest route, build `01-TOOLS/<TOOL>/` with a test that proves it, and guide the user. NOT a full typed API client (that is `api-connector-builder`), NOT a whole-workspace tooling scan (that is `harness`)."
tags: [connect, integration, erp, legacy, desktop, database, read-only, mcp, api, export, least-privilege, onboarding]
recommends: [harness, api-connector-builder, automation-strategy, automation-flows]
profiles: [minimal, core, full]
origin: risco
---

# Connect a tool: research it, pick the safe route, prove it works

The user said *"connect my Holded"*, *"can the agent read our Sage?"*, *"hook up WhatsApp"*. This
skill turns that sentence into a working, documented connection in `01-TOOLS/<TOOL>/`, for **any**
tool: the ones with a modern API, and the program installed on an office PC fifteen years ago.

rsc ships no ready-made connections. Every project builds only the ones its user asks for, so the
method matters more than any list of vendors: **find the truth, take the least dangerous route,
prove it, leave it written down.**

## Before anything: what does the user want to do?

Ask only what the docs cannot answer, in plain words (`technical_level` in
`02-DOCS/wiki/harness/user-profile.md` sets the register):

- **Which product, exactly?** Name, edition, version. "Sage" is five different products.
- **Where does it run?** In the cloud (a website they log into) or installed on a computer or
  server in the office.
- **Read or write?** Reports and questions need reading. Entering invoices needs writing, and
  writing is a separate, explicit decision (below).

## 1. Research: the docs decide, never memory

Look it up every time, even for a tool you "know": plans, endpoints and MCP servers change monthly.
In this order, stopping when the route is clear:

1. **The vendor's own developer docs**: search `<product> API`, `<product> developers`,
   `<product> MCP`. Prefer the vendor domain over blog posts.
2. **The official MCP registry** (`registry.modelcontextprotocol.io`) and the vendor's docs for an
   official MCP server. An official, read-only MCP is often the fastest safe route.
3. **Library docs** through Context7 when the route is an SDK.
4. **Export and import features** in the product's user manual: scheduled CSV/Excel exports, FTP
   drops, official import file formats.
5. **Where the data lives** for installed software: the vendor's installation guide, the database
   engine it installs (often SQL Server Express, sometimes Access, Firebird or MySQL).

Write every source into the tool's `README.md` with its URL and the date you read it. **If you find
nothing reliable, say so** and stop at a question for the vendor; an invented endpoint costs the
user a week.

## 2. Choose the route: the least dangerous one that does the job

| Route | Use when | Watch for |
|---|---|---|
| Official MCP server | The vendor publishes one | Start it read-only if it offers the mode |
| Official API | Documented REST/GraphQL with scoped tokens | Request read scopes only; full client work goes to `api-connector-builder` |
| Built-in integration (OAuth app, Zapier/Make/n8n connector) | No API for you, but a supported integration exists | The integration's permissions, not yours, are the ceiling |
| Scheduled export | The program can export CSV/Excel or drop files to a folder | Freshness is the export schedule, say so |
| Read-only copy of the database | Installed software with no API and no export | See *Desktop programs* below; never the live database |
| Screen automation (RPA) | Nothing else exists | Last resort: fragile and breaks on every update |

**Connect, or migrate?** If every route above is poor and the program is near end-of-life, or new
legal requirements (Spanish e-invoicing, Veri\*factu) will force a change anyway, say so plainly
and hand the decision to `automation-strategy`. Check the current dates at the tax authority's
site: they have moved before.

## 3. Least privilege, always

- **Read first.** Every connection starts read-only, even when the goal is writing.
- **Writing is explicit.** Only when the user asks for it, only through the vendor's API or its
  official import format, and only for the objects named.
- **Never write directly into a desktop program's database.** It bypasses the program's own
  rules, voids support contracts, and can corrupt accounting. Generate the program's official
  import file instead, and a person imports it.
- **Secrets stay in `.env`** (gitignored, `chmod 600`). Never in the repo, never in `02-DOCS`.

## 4. Build it in `01-TOOLS/<TOOL>/`

Copy `01-TOOLS/_TEMPLATE/` to `01-TOOLS/<TOOL>/` (uppercase id, e.g. `HOLDED`, `SAGE_50`) and fill
every file: `.env.example` with the real variable names, `CREDENTIALS.md` with where each one is
generated and how to rotate it, `README.md` with the route, the sources and their dates, and the
permissions granted. Add a row to `01-TOOLS/README.md`.

**`test_connection` is the proof, not a formality.** It makes one cheap read and prints
`OK — …`. When the connection is meant to be read-only, it must also **prove that writing fails**,
because a read-only promise nobody tested is not one:

```bash
# PostgreSQL: a write must fail with a PERMISSION error. Any other error (wrong host, bad password)
# proves nothing, so it fails the test too instead of passing as "refused".
out=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "BEGIN; CREATE TABLE rsc_write_probe(i int); ROLLBACK;" 2>&1) \
  && { echo "FAIL — this user can write" >&2; exit 1; }
grep -qiE "permission denied|read-only transaction" <<<"$out" \
  && echo "OK — writes refused" || { echo "FAIL — unexpected error: $out" >&2; exit 1; }
```

```bash
# SQL Server: insert into one of the views you exposed; only error 229 (permission denied) passes.
out=$(sqlcmd -S "$MSSQL_HOST" -U "$MSSQL_USER" -P "$MSSQL_PASSWORD" -d "$MSSQL_DB" -b \
  -Q "BEGIN TRAN; INSERT INTO rsc_views.customers DEFAULT VALUES; ROLLBACK;" 2>&1) \
  && { echo "FAIL — this user can write" >&2; exit 1; }
grep -q "Msg 229" <<<"$out" && echo "OK — writes refused" || { echo "FAIL — unexpected error: $out" >&2; exit 1; }
```

For an API, prove it through the token itself: list its scopes from the vendor's token endpoint
or dashboard and fail when a write scope is present. Never fire a real write to "see what happens".

## Desktop programs and old ERPs

Most small-business software was never meant to be connected. The safe pattern:

1. **Find the data.** The vendor's install guide, the Windows ODBC data sources, or the SQL Server
   instance the program installed (often `.\SQLEXPRESS`). Access files are `.mdb`/`.accdb`.
2. **Work on a copy, never the live database.** A nightly copy, off business hours. SQL Server
   Express has no Agent: schedule `sqlcmd` with a `BACKUP DATABASE` from the Windows Task
   Scheduler and restore it where the agent reads. Access: copy the file, then convert or read it
   with `mdbtools` (`mdb-tables`, `mdb-export`).
3. **A dedicated reader.** A login that can only `SELECT`, ideally only on a schema of views that
   expose what is needed:

   ```sql
   CREATE LOGIN ia_reader WITH PASSWORD = '<from .env>';
   CREATE USER ia_reader FOR LOGIN ia_reader;
   GRANT SELECT ON SCHEMA::rsc_views TO ia_reader;
   ALTER ROLE db_denydatawriter ADD MEMBER ia_reader;
   ```

4. **Reach it privately.** Same network, or a private mesh (the `TAILSCALE` tool). Never open the
   database port to the internet.
5. **Check the support terms.** Many vendors restrict direct database access. If they do, use
   their export or their API instead.

## 5. Guide the user, in their words

Say what you found, which route you chose and why, and what happens next, in short sentences.

## 6. Leave it written down

Record the connection in `02-DOCS` following the `harness` wiki protocol: what is connected, the
route, the permissions, who owns the credentials, and the date. The next session, or a colleague,
reads it instead of starting over.

## Anti-patterns

| If you are about to… | Do instead |
|---|---|
| Write the endpoint from memory | Read the vendor docs now and cite them with a date |
| Connect with an admin account "to get started" | Create the read-only user first; it costs ten minutes |
| Write into the program's database because it is quicker | Generate its official import file |
| Point the agent at the live database | Read a nightly copy |
| Call the connection done because it authenticates | Run the test; for read-only, watch the write fail |
| Promise the vendor has an API or MCP | Say what you found, with links, or that you found nothing |
| Build the whole typed client here | Hand it to `api-connector-builder` once the route is chosen |

## See also

- `../harness/SKILL.md`: owns `01-TOOLS/` and `02-DOCS/` as a whole.
- `../api-connector-builder/SKILL.md`: auth, pagination and retries once an API is the route.
- `../automation-strategy/SKILL.md`: whether to connect, migrate or automate at all.
- `../automation-flows/SKILL.md`: chaining the connected tool into a workflow.

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
