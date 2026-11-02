# Third-party work in this skill

Everything here comes from **Conectores para pymes** by Executive Lab
(https://github.com/Executive-Lab/conectores-pymes, archived), proposed for this skill in
rsc-harness issue #337. The exact commit is in `bridge-kit/UPSTREAM.json`.

## bridge-kit/: the bridge scripts

- **Source:** `kit-puente/` of that repository.
- **Licence:** MIT, Copyright (c) 2026 Executive Lab. Full text: `bridge-kit/LICENSE`.
- **What is here:** the whole folder: README, SQL Server login, user, views and acceptance test,
  the nightly copy in PowerShell, Access to SQLite, the DBHub configuration, the Tailscale and
  Cloudflare Tunnel examples, and the `01-TOOLS` template. Comments and file names are in Spanish,
  as upstream. Copied unmodified except for the change below.
- **Changed here (modified):** `sqlserver/03-prueba-solo-lectura.sql` counted any error on a
  forbidden statement as a pass, never tried an INSERT, and its UPDATE needed SELECT, so a user
  who could INSERT, or UPDATE without SELECT, got `RESULTADO: OK`. It now checks the names before
  it starts, tests INSERT, and passes a statement only when `HAS_PERMS_BY_NAME` denies the
  permission and the attempt fails with `Msg 229`/`262`. Its row in `README.md` now says it tests
  INSERT too. Both changes are listed in `UPSTREAM.json`.
- **Known gap, documented in `references/database-bridge.md` instead of patched:**
  `01-TOOLS-plantilla/` has no `.env.example`, although the kit's README lists one. The reference
  gives its two variables.
- **Updating:** upstream is archived, so fixes to the kit are made here and listed under
  `changes` in `UPSTREAM.json`. Never an automatic download.

## references/: adapted guides

- **Source:** `guias/` and `skill/conectar-herramienta/` of the same repository.
- **Licences:** the guides are **CC BY 4.0** (`LICENSE-datos.md` upstream), © 2026 Executive Lab;
  the skill and its templates are MIT.
- **What is adapted, and how (modified):** translated into English, pointed at this skill's
  `01-TOOLS/` and `02-DOCS/` conventions, and stripped of every dependency on the external catalogue
  and of screen automation (RPA), which this skill does not use.
  - `messages.md` ← `skill/conectar-herramienta/references/plantillas.md` and
    `guias/hablar-con-el-informatico.md`; the vendor message from `guias/mi-programa-no-tiene-api.md`.
    The message for a distributor-hosted program is new.
  - `database-bridge.md` ← `guias/kit-puente-tecnico.md` (its RPA section removed).
  - `file-exchange.md` ← `guias/escribir-en-contabilidad-por-importacion.md` (formats table and
    rules) and the export route of `guias/mi-programa-no-tiene-api.md` and `guias/kit-puente-tecnico.md`.
  - `connect-or-migrate.md` ← `guias/conectar-o-migrar.md` and step 7 of the upstream skill.
  - `spain.md` ← `guias/facturas-emitidas-y-verifactu.md` and the e-invoicing section of
    `guias/escribir-en-contabilidad-por-importacion.md`; the exchange-formats table is new.
  - `what-to-find-out.md` takes its fields from the upstream catalogue's record schema; the text
    is new.
  - `program-types.md` is new, written from the cases in issue #337.
