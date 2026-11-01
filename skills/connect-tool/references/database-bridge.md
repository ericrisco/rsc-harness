# Database bridge: reading an installed program, read-only

Goal: the agent **reads** the data of a desktop or office program (SQL Server or Access) **without
being able to write**, **without opening ports** and **without losing the vendor's support**. Writing
never goes through the bridge: it goes through the [official import file](file-exchange.md).

The real "read-only" guarantee lives **in the database**: a login with minimal permissions over
curated views. The "read-only mode" of an MCP server is almost always a statement filter. It helps;
it is not enough.

The scripts are in [`../bridge-kit/`](../bridge-kit/README.md), shipped unmodified from their source
(Spanish comments and file names; see `../THIRD_PARTY.md`). This page is how to use them.

## Architecture

```
[Program's server or PC]                                       [Agent]
  SQL Server (production)
     └─ nightly backup → restore into ERP_IA (copy)       ┌─ Claude Code on a laptop ── Tailscale (grant to the MCP port only)
           └─ schema "ia": curated views                  │
                └─ login ia_lectura (SELECT on "ia")      │
                     └─ DBHub (readonly, predefined SQL) ─┤
                        listening on 127.0.0.1            └─ claude.ai connector / cloud n8n ── Cloudflare Tunnel + Access
```

## Step by step

### 0. Permission first

Ask the distributor (Sage, ICG, Prevengos, CONTPAQi, Wolters Kluwer…) whether creating a login and
views affects support, **in writing** ([messages](messages.md), B). If it does, work **only on the
copy** (step 1). Some vendors put database reading outside support altogether (Prevengos, for one).

### 1. Isolate the data: a nightly copy

- **SQL Server, Express included.** Express has **no SQL Server Agent**. The pattern is the Windows
  Task Scheduler plus `sqlcmd`: a `BACKUP ... WITH COPY_ONLY` of production (it does not break the
  program's own backup chain) and a `RESTORE` into a separate database, `ERP_IA`, every night off
  hours. `bridge-kit/sqlserver/copia-nocturna.ps1` does it: backup, restore with the file moves,
  recreate the user and views (the restore wipes them), run the acceptance test, keep three days
  of backups, log every step.
- **Access** (`.mdb`/`.accdb`, e.g. FactuSOL local): copy the file off hours and convert the copy to
  SQLite: `bridge-kit/access/access_a_sqlite.py --origen <file> --destino <file.sqlite>`. It copies
  first, skips binary attachments and replaces the target atomically. **Never** connect an MCP to
  the live `.mdb`.
- **Production** only when real time is truly needed, and then with the login of step 2 and row and
  time limits.

Schedule the copy with an account that administers SQL Server, **never** with the reader:

```powershell
$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-ExecutionPolicy Bypass -File C:\KitPuente\sqlserver\copia-nocturna.ps1 -Origen "<PROGRAM_DB>"'
$cuando = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "KitPuente copia nocturna" -Action $accion -Trigger $cuando -RunLevel Highest
```

### 2. A read-only login over views

`bridge-kit/sqlserver/01-login-servidor.sql` (once, server level) and `02-usuario-y-vistas.sql`
(database level, idempotent):

1. A schema `ia` with **curated views**: only the columns needed. No IBANs, no health data, no
   payroll. One view per business question.
2. A login `ia_lectura` that is **not** `sa`, `db_owner` or `sysadmin`, with a long random password
   kept only on the server.
3. `GRANT SELECT ON SCHEMA::ia`. The views belong to `dbo`, so ownership chaining lets the login read
   the tables **through** them without any permission on the tables. Plus `db_denydatawriter` and
   `DENY CREATE TABLE/VIEW/PROCEDURE/FUNCTION`.
4. The view templates use placeholders (`<tabla_facturas_emitidas>`, `<columna_fecha>`…). Table and
   column names depend on the program and its version and are **not public**: confirm them with the
   distributor.

If the server only allows Windows authentication, use a dedicated Windows account instead of the
SQL login.

### 3. The acceptance test

`bridge-kit/sqlserver/03-prueba-solo-lectura.sql` impersonates `ia_lectura` inside a transaction it
rolls back, and checks: it **can** read the `ia` views; it **cannot** read the tables directly,
delete, update or create a table. It must end in `RESULTADO: OK`. Without it, the agent is not
connected.

> **Check this before trusting an OK.** The script counts *any* error on the forbidden statements
> as a pass. If a placeholder such as `<tabla_facturas_emitidas>` was not replaced, or the table
> name is wrong, those statements fail with "invalid object name", not with a permission error,
> and the test reports OK without proving anything. Replace every placeholder with a real table,
> and confirm that the errors are permission errors (`Msg 229` / `Msg 262`), the same rule as the
> `test_connection` probes in SKILL.md.

### 4. The database MCP server

| Option | When | Read-only | Limiting tables | Notes |
|---|---|---|---|---|
| **DBHub** (Bytebase, MIT) — the kit's choice | SQL Server, PostgreSQL, MySQL/MariaDB, Oracle, SQLite | `readonly=true` per tool in `dbhub.toml`: only SELECT, SHOW, DESCRIBE, EXPLAIN, PRAGMA. A filter: combine it with the login | **Predefined SQL tools** with typed parameters | npx or Docker; several sources in one TOML; `max_rows`; SSH tunnel. Over HTTP, a shared bearer token. No Windows integrated auth |
| **SQL MCP Server** (Microsoft, Data API builder 2.x, MIT) | SQL Server, Azure SQL, PostgreSQL, MySQL | Per-role permissions (e.g. `anonymous:read`), no free SQL | Only the entities declared in `dab-config.json` | Over HTTP everything enters as **anonymous** by default: put JWT/Entra ID or Cloudflare Access in front. Needs .NET |
| **mcpFirebird** (MIT) | Firebird | `allowedOperations=['SELECT']`, no free SQL | `allowedTables` | Low-to-medium maturity |
| Access | — | — | — | No mature MCP: **copy → SQLite → DBHub** |

SQL Server MCP servers with no read-only mode do not belong in the bridge.

`bridge-kit/dbhub/dbhub.toml.ejemplo` has one tool per business question ("sales per day",
"pending collections", "stock below minimum"), each a `SELECT` on the `ia` views, so the agent does
not improvise SQL against the program. `execute_sql` cannot be removed according to DBHub's docs:
it stays `readonly` with a row cap. The file holds the reader's password: keep it on the program's
server, readable only by the account that runs DBHub, never in git or on a laptop. **DBHub listens
on `0.0.0.0` by default: always pass `--host`**, and pin the npm version.

### 5. The network: no open ports

**Rule:** port 1433 (and any database or MCP port) is **never** opened on the router. MS-SQL servers
exposed to the internet are a classic ransomware entry for small businesses.

| If the agent is… | Use | How it is limited | Indicative cost |
|---|---|---|---|
| Claude Code on the owner's laptop | **Tailscale** | Tag `tag:erp` on the server and a grant that lets only the owner reach **the MCP port** (not 1433). `bridge-kit/red/tailscale-grants.hujson` | Standard plan per user per month; the Personal plan is non-commercial only. Check current pricing |
| A claude.ai remote connector, Cowork or cloud n8n | **Cloudflare Tunnel + Access** in front of the MCP's HTTP endpoint | Access application with an email policy, service tokens for machines; the MCP listens on 127.0.0.1 with its own token. `bridge-kit/red/cloudflared-config.yml.ejemplo` | Zero Trust has a free tier (check the current limit). Needs a domain on Cloudflare |

Remote claude.ai connectors leave from Anthropic's infrastructure and **do not reach a VPN or
Tailscale**. Using the bridge from claude.ai or Cowork needs the Cloudflare tunnel.

### 6. In the harness

`01-TOOLS/<PROGRAM>/`, from `bridge-kit/01-TOOLS-plantilla/`:

- `.env`: the MCP URL and token (`ERP_MCP_URL`, `ERP_MCP_TOKEN`), **not** the database password,
  which stays on the program's server. The kit's README mentions an `.env.example` that the source
  does not ship: write it with those two variables.
- `test_connection.sh`: initialises the MCP, lists its tools and warns about any tool the kit did
  not expect. It proves the bridge answers; the read-only proof is test 03 on the server.
- `CREDENTIALS.md`: who created the login, where the copy lives, when the token rotates (every
  quarter).

Plus the entry in `.mcp.json`.

## Plan B: an export folder

When no database is reachable: a nightly CSV export to a folder (Task Scheduler with `sqlcmd`/`bcp`
over the views, or the program's own export) and the harness reads the folder. Details in
[file exchange](file-exchange.md). With n8n: version 2 disables the Local File Trigger and Execute
Command by default; re-enable them deliberately and restrict paths with
`N8N_RESTRICT_FILE_ACCESS_TO`, and keep n8n updated.

## When to pay instead of building: unified APIs

| Service | Spanish coverage (check current list) | Local or cloud | MCP | Watch for |
|---|---|---|---|---|
| **Chift** | Holded, ContaSOL (cloud only), a3ERP, Sage 200 ES, Odoo, Ágora, Revo, Business Central… | Both: Sage 200 ES and a3ERP through a local Windows agent (outbound, no ports) | Yes, official | Asks for broad permissions (read and write). Price not public |
| Apideck | Holded, Odoo | Cloud | Yes | Expensive for a small business |
| Unified.to | Holded, Odoo, Sage 200 (beta) | Cloud | Yes | — |

For a single small business the own bridge is usually cheaper. Check coverage and prices at the
source before recommending one.

## What the bridge does not do

- It does not write into the program: that is the import file.
- It ships no table schemas of commercial programs.
- It does not replace the vendor's support: when the program updates and changes its tables, the
  views need review. Test 03 and `test_connection` detect it.
