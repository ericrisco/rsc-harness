# Generic gate — when no stack skill ships `scripts/verify.sh`

A project in a stack the catalog has no gate for (a plain Node CLI, a Rust crate, a shell tool) is
still verified. The gate is the commands the project itself declares, as `sdd-init` recorded them.
This is a first-class path, not a fallback to apologise for.

## Where the commands come from

`02-DOCS/wiki/sdd/config.yaml` → `testing.commands.verify` (and `testing.commands.apply` for the
suite), filled by `sdd-init` from the manifests (`package.json` scripts, `Makefile`, `Cargo.toml`,
`pyproject.toml`…). No config → run `sdd-init` first; do not pick commands from memory.

## The five layers

| Layer | What counts | Typical source |
| --- | --- | --- |
| test | the full suite | `npm test`, `cargo test`, `pytest` |
| lint | the project's linter | `npm run lint`, `cargo clippy` |
| type | the type checker | `tsc --noEmit`, `mypy` |
| build | the build or compile | `npm run build`, `cargo build` |
| audit | dependency vulnerabilities | `npm audit`, `cargo audit`, `pip-audit` |

## Procedure

1. List the five layers. For each, take the command from `config.yaml`; if it declares none, look
   for one in the manifest and say where you found it.
2. Run each command once, after the last edit, from the project root. Capture the exit code and the
   relevant output verbatim.
3. Record every layer as exactly one of:
   - **pass** — the command ran and exited 0;
   - **fail** — the command ran and exited non-zero (a hard FAIL of the verdict);
   - **not run** — no command is declared or the tool is missing. Label it as `verify` does:
     `NO-APLICA` (no such surface, e.g. no types in plain JS), `HERRAMIENTA-AUSENTE` (the surface
     exists, nothing checked it).
4. Write the layers under `## Stack gate` in the record, as `generic gate (config.yaml) → …`, one
   line per layer, with the command that ran.

## Rules that still apply

- A `not run` layer whose surface exists fails the verdict, exactly like a SKIP in a stack script.
- A command the project wrote (a custom check script) is a home-grown gate: watch it fail and pass
  before trusting it.
- Suggest a stack skill if one fits — but the generic gate is the verdict for this run.
