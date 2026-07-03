# 00 — Mapa del sistema rsc-harness

> FASE 1 de la auditoría. Documento base, sin specs. Generado 2026-07-03 contra `main` (v0.1.34, commit a9e9499).
> **Nota de realidad:** el catálogo tiene **232 skills en 19 dominios** (no 231/21 como dice parte de la documentación externa). Verificado con `jq '.skills|length' manifest.json` y `scripts/lib/domains.js`.

## Qué es

`@ericrisco/rsc` v0.1.34: catálogo de 232 agent-skills + CLI npm que las instala en 17 asistentes de código. ESM, Node ≥18. Deps runtime: `ajv`, `sql.js`, `@iarna/toml`. Bins: `rsc` → `scripts/rsc.js`, `rsc-install` → `scripts/install-apply.js`.

## Flujo completo: autoría → manifest → instalación → symlinks → detectores

```
skills/<id>/SKILL.md  ──(build-manifest.js)──▶  manifest.json (generado, 281KB, commiteado)
        │                                              │
        │ evals/cases.yaml (eval-lint.sh en CI)        │ rsc add / wizard / install --profile
        │ references/*.md · scripts/verify.sh          ▼
        │                                    install-plan.js (plan puro)
        │                                              │
        ▼                                    install-apply.js
skill-build/<id>/spec.md+plan.md              │  1. copia real ÚNICA → .rsc/skills/<id> (base compartida)
(specs SDD de autoría; nada del                │  2. backup previo (lib/backups.js)
 pipeline las lee)                             │  3. puntero por target: symlink relativo (macOS/Linux)
                                               │     o copia (Windows / symlink falla) — targets/index.js:19
                                               ▼
                       17 targets (targets/index.js SPEC, :38) en 3 clases de adaptador:
                       · claude  → .claude/skills/<id> + 5 hooks en .claude/settings.json
                       · cursor  → .cursor/rules/<id>.mdc (frontmatter alwaysApply)
                       · md      → bloque idempotente <!-- rsc-suggest:start/end --> en
                                   AGENTS.md / GEMINI.md / copilot-instructions.md / etc.
```

- La instalación es **project-local** (`.rsc/skills/` + puntero en `.claude/skills/` etc.), no en `~/.claude`.
- Estado por target en `.rsc-state.json`; versiones de base en `.rsc/.base-versions.json` (se re-copia al cambiar la versión del CLI).
- `add`/wizard fuerzan siempre `orient` + `suggest`. El grafo `recommends` se expande **un solo salto** (`lib/recommend.js`), con tope base ≤4 / out ≤6.

## Los 19 dominios (recuento verificado)

| Dominio | Skills |
|---|---|
| Frameworks & app stacks | 30 |
| Run a business | 20 |
| Grow a channel (YouTube/TikTok/Reels/LinkedIn/Medium) | 20 |
| Market & brand | 19 |
| Databases & data layer | 17 |
| Spec-Driven Development | 14 |
| Connect & automate | 13 |
| AI — build it in | 12 |
| Languages | 11 |
| Ship & operate — platforms | 11 |
| Ship & operate — quality & security | 11 |
| Data & analytics | 8 |
| Knowledge & meta | 8 |
| AI — run it on | 7 |
| Core & control plane | 6 |
| Raise & model money | 6 |
| Design & content craft | 6 |
| Legal, privacy & compliance | 5 |
| Ship & operate — devops | 8 |
| **Total** | **232** |

Cross-check limpio: 0 skills sin dominio, 0 ids de dominio inexistentes en el manifest (`tests/domains.test.js` lo fuerza).

## Autoría de una skill

- `skills/<id>/`: `SKILL.md` (232/232) + `evals/cases.yaml` (232/232) + `references/` (219/232) + `scripts/` (190/232).
- Frontmatter (parser artesanal en `scripts/lib/frontmatter.js`): `name` (debe = dir), `description` (rica en triggers, patrón "Use when… Triggers: '…'. NOT x (that is y)"), `tags[]`, `recommends[]`, `profiles[minimal|core|full]`, `origin`.
- Schema (`schema/frontmatter.schema.json`, draft-07): solo exige `name`/`description`(≥10)/`tags`(≥1). `recommends` colgantes se **descartan en silencio** en el build (`build-manifest.js:30`) — no hay gate.
- `evals/cases.yaml`: `should_trigger` (≥5), `should_not_trigger` (≥4, con `route_to` a hermana real), `capability` (≥1, con `must_include`). Mínimos forzados por `scripts/eval-lint.sh:22-24` en CI.
- `skill-build/` (11 dirs): specs SDD humanas (`spec.md`+`plan.md`) de las que nacieron algunas skills. Solo documentación de diseño; el pipeline no las consume.

## Manifest

`scripts/build-manifest.js`:
- `buildManifest()` (:20) escanea `skills/*/SKILL.md` → `{id, description, tags, recommends (filtrados a ids existentes), profiles}` ordenado por id → `manifest.json` `{version, counts.skills, skills[]}`.
- `--check` (:61): regenera y compara byte a byte (CI falla si está desfasado). `--validate` (:53): Ajv contra el schema por cada frontmatter.
- El hook `version` de npm regenera el manifest en cada bump (`package.json:16`).

## CLI (`scripts/rsc.js`, dispatch :162)

| Comando | Qué hace |
|---|---|
| (sin args) | Wizard interactivo: base / base+SDD / manual por dominios → multi-select de agentes |
| `add <ids…>` | Instala skills (+ `orient`+`suggest` siempre) |
| `install --profile <p>` | Instala un perfil del manifest (`full` = todas) |
| `consult "<texto>"` | Ranker léxico multilingüe + FTS5 → ids con etiqueta de outcome |
| `catalog [--available]` | Vuelca todo el catálogo id⇥estado⇥desc (para descubrimiento semántico in-agent) |
| `audit` | Inventario advisory: overlaps, dominios pesados, no-footprint; escribe informe en 02-DOCS/wiki/harness/ |
| `list` / `doctor` | Instaladas / snapshot de salud por target |
| `sync [--dry-run]` | Re-aplica el set instalado registrado |
| `backups` / `restore <id\|latest>` | Motor de snapshots en `.rsc/backups/` |
| `upgrade [--global]` | Plan/ejecución de `npm i -g @ericrisco/rsc@latest` + sync |
| `registry refresh\|status` | `.rsc/skill-registry.{json,md}` con sha256 por skill |
| `uninstall <ids…>\|--all` / `purge` | Desinstala / barre skills+hooks+`.rsc/` en todos los targets (conserva `02-DOCS/` salvo `--with-docs`) |

Módulos `scripts/lib/`: `registry` (registro+hashes), `recommend` (BFS 1 salto + outcome-labels), `state` (`.rsc-state.json`), `upgrade`, `backups` (con guardas anti path-traversal), `harden-policy` (control del loop de harden, MAX_ROUNDS=2), `behavior-score` (gate ABS_MIN=8.5, LIFT_MIN=1.0; score=0.6·coverage+0.4·quality), `result-envelope` (bloque JSON de resultado validado), `frontmatter` (parser YAML mínimo), `manifest`, `domains`, `ui`.

## Targets: 17 adaptadores, 3 clases

- **claude** (`targets/claude.js`): skills como dirs enlazados en `.claude/skills/<id>`; `wireHook` escribe 4 scripts `.mjs` en `.rsc/` y registra 5 entradas de hook en `.claude/settings.json` (idempotente, migra legacy).
- **cursor** (`targets/cursor.js`): cada skill → un `.mdc` (frontmatter `alwaysApply:false` + cuerpo sin frontmatter original); el hook suggest → `.mdc` con `alwaysApply:true`.
- **md** (`targets/_md-block.js`): skills symlinkadas + cuerpo de suggest inyectado entre marcadores `<!-- rsc-suggest:start/end -->`. Usado por: codex/opencode/amp/jules/zed→`AGENTS.md`, gemini→`GEMINI.md`, copilot→`.github/copilot-instructions.md`, windsurf/cline/roo/continue/kiro→su rule file, junie→guidelines, aider→`CONVENTIONS.md`.
- `detectTarget()` (:88) elige por presencia de config-dir; default `claude`.
- `targets/agents.js`: instala el subagente `developer` por formato (md/json/toml según target; `TIER_MODEL` mapea proveedor→modelo).

### Hooks (todos node-run, Windows-safe)

| Hook | Evento | Qué hace |
|---|---|---|
| `session-start.mjs` | SessionStart | Inyecta cuerpo de suggest + nudges: onboarding, auto-ingest inbox, git-required, Context7, audit cada 14 días, higiene CLAUDE.md >200 líneas, update npm disponible |
| `userprompt-gate.mjs` | UserPromptSubmit | Re-inyecta el gate SDD "specify primero" en cada turno; opt-out `.rsc/.no-feature-gate` |
| `danger-guard.mjs` | PreToolUse/Bash | DENIEGA foot-guns (rm -rf, dd, curl\|bash, push --force, DROP/TRUNCATE, DELETE sin WHERE…) para perfiles no técnicos; opt-out `.rsc/.no-danger-guard` |
| `ship-guard.mjs` | PreToolUse/Bash | DENIEGA checkout/merge a main con trabajo sin commitear/pushear → enruta a `ship`; fail-open |
| `worklog-checkpoint.mjs` | PreCompact+SessionEnd | Recuerda escribir worklog en `02-DOCS/raw/worklog/` |

## Detectores repo→skill (`scripts/detect-repo.js:4-17`)

| Señal en cwd | Añade |
|---|---|
| `package.json` con dep `next` o `react` | `nextjs`, `design` |
| `pubspec.yaml` | `flutter`, `design` |
| `requirements.txt` o `pyproject.toml` | `fastapi` |
| `go.mod` | `go` |
| `prisma/` o `migrations/` o `*.sql` | `postgresdb` |
| `Dockerfile` o `compose.yaml` o `.github/` | `deployment` |

`detectRepoProfile()` (:20) detecta además package manager (pnpm/yarn/bun/npm), test runner (vitest/jest/playwright/pytest/go test/flutter test), monorepo (workspaces/turbo/nx/lerna) y deriva `commands.{apply,verify}` + `strictTdd`.

## Pipeline de calidad

- **Rúbrica documental** (`scripts/skill-rubric.md`): 7 dimensiones ponderadas — Triggering 0.15, Scope 0.10, Body craft 0.15, **Correctness/grounding/freshness 0.25**, Actionability 0.15, Evals 0.10, Originality/safety 0.10. Gate de ship: **≥8.5 ponderado + todos los gates deterministas en verde**. Reviewer adversarial basado en evidencia.
- **Gate conductual** (`skill-behavior-rubric.md` + `lib/behavior-score.js`): baseline vs treatment con grader ciego; pasa si `absolute ≥ 8.5` Y `lift ≥ +1.0` (lift≤0 = fail automático).
- **Workflows**: `skill-behavior-eval.workflow.js` (motor A/B ciego), `skill-harden.workflow.js` (loop detect-and-fix, máx 2 rondas, con guardas anti-gaming: diff-judge anti keyword-stuffing + re-score con escenario hold-out), `skill-scoreboard.workflow.js` (eval masiva detect-only).
- **`eval-lint.sh`**: mínimos de cases.yaml en CI. **`reviewer-guard.sh`**: apunta a `plugins/rsc-review/agents/*.md`, que **no existe en este repo** (sale con exit 1; no está cableado en CI) — candidato a spec en fases posteriores.

## CI/CD (`.github/workflows/`)

- **ci.yml** (push+PR): `npm ci` → `validate` → `manifest:check` → `npm test` → `eval-lint.sh` → gate grep anti-reaparición de fingerprints del plugin-marketplace retirado.
- **release.yml** (push a main o dispatch manual): mismos gates → `npm version` (`[skip ci]`) → `npm publish --provenance` → tag → GitHub Release con notas automáticas.

## Tests (`tests/`, node:test + c8)

Cubren: ciclo install/apply multi-target y versionado de base (mayor superficie), purge, subagente developer, CLI/roast-me/plan, detectores, recommends/registry/manifest/domains/frontmatter, result-envelope, matemática de scoring (behavior-score, harden-policy), audit, backups, ranking de consult, scripts de handoff del harness.

## Observaciones sembradas para fases posteriores (no son specs aún)

1. `recommends` colgantes se descartan en silencio en el build — sin gate en `--validate` (→ FASE 3).
2. `reviewer-guard.sh` apunta a un directorio inexistente y no está en CI (→ FASE 7/9).
3. `consult` es ranker léxico: intent natural en catalán/es con score bajo devuelve vacío (→ FASE 5).
4. El README/descr. externa dice 231 skills / otras cifras; la realidad es 232/19 (→ FASE 9).
5. Windows: fallback a copia en vez de symlink — divergencia de base tras upgrade a verificar (→ FASE 5/6).
