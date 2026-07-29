---
name: sdd-init
description: "Use when calibrating an existing repo for the rsc SDD chain: detect stack, package manager, test runners and apply/verify commands, refresh the skill registry, and write the runtime config at 02-DOCS/wiki/sdd/config.yaml. NOT the dispatcher that routes SDD phases (that is `sdd`), NOT first-contact user/workspace bootstrap (that is `init`)."
tags: [sdd, init, config, testing, registry]
recommends: [sdd, specify, implement, verify]
profiles: [core, full]
origin: risco
---

# sdd-init — calibrate the repo before the SDD chain

Step zero for technical SDD work: read the repo, detect how it should be built and tested, refresh the cheap skill registry, and write one durable config:

```text
02-DOCS/wiki/sdd/config.yaml
```

That config is the runtime contract later phases read before choosing commands, TDD strictness, artifact paths, review budget or skill briefs. `sdd` dispatches the phases that consume it, `init` owns first contact and user profiling, `harness` owns `01-TOOLS/` and `02-DOCS/` scaffolding. This skill only calibrates.

## Inputs

Read-only first:

- `package.json`, lockfiles, `pnpm-workspace.yaml`, `pyproject.toml`, `requirements.txt`, `go.mod`, `pubspec.yaml`, `Dockerfile`, `.github/`.
- Existing `02-DOCS/wiki/sdd/config.yaml`, if present.
- `02-DOCS/wiki/harness/user-profile.md`, if present, for accompaniment level only.
- `.rsc/skill-registry.json`, if present, to decide whether it is stale or missing.

If `02-DOCS/` does not exist, create only the `02-DOCS/wiki/sdd/` path needed for the config. Do not run full harness scaffolding unless the user asked for `harness`.

## Preflight Choices

Ask only when the answer changes behavior; let the accompaniment level in the profile set how much you explain each trade-off.

| Setting | Default | Options |
| --- | --- | --- |
| `execution_mode` | `interactive` | `interactive` pauses at review-risk gates; `automatic` chains phases until a blocker/risk appears. |
| `artifact_store` | `02-DOCS/wiki/sdd` | Keep RSC artifacts in `02-DOCS`; do not create an `openspec/` parallel tree. |
| `review_budget.line_budget` | `400` | Lower for solo tight review; higher only with explicit approval. |
| `delivery_strategy.default` | `ask-on-risk` | `ask-on-risk`, `single-pr`, `autochain`, `exception`. |
| `models.enabled` | `false` | Per-phase model routing is opt-in; leave off unless the user asks for it. |
| `models.provider` | `anthropic` | Which provider the tiers resolve to. Set from the detected assistant when obvious, else `anthropic`. See `../sdd/references/model-routing.md` for other providers. |

## Detection

Use the repo detector exposed by the CLI code (`detectRepoProfile`) or reproduce the same facts manually if running inside an agent without code access:

- stacks: Next.js/React, FastAPI/Python, Go, Flutter, Postgres, deployment signals;
- package managers: pnpm, npm, yarn, bun;
- scripts: `test`, `lint`, `typecheck`, `build`;
- runners: Vitest, Jest, Playwright, pytest, `go test`, `flutter test`;
- monorepo signals;
- recommended apply and verify commands;
- the active assistant/provider when it's obvious from the environment (Claude Code, Codex, Gemini…), to seed `models.provider` — default `anthropic` when unsure. This only sets the *concrete model names*; routing itself stays off until the user opts in.

If any runner is detected, set `testing.strict_tdd: true`. Strict TDD means implement phases must do red -> green -> triangulate edge cases -> refactor, with command evidence. If no runner is detected, set it false and record the gap rather than pretending.

## Skill Registry

Refresh the project registry:

```bash
npx @ericrisco/rsc registry refresh
```

This writes:

```text
.rsc/skill-registry.json
.rsc/skill-registry.md
```

Later phases use it as a cheap index — id, trigger, tags, path, installed/available, hash — to select the few skills matching the phase and stack and digest them into compact rules for subagents.

## Equip the repo — install the skills this stack needs

Calibration is the moment to make sure the relevant skills are actually present, not just indexed. Detect → propose → install:

1. **Detect what this repo needs.** Use the stack you just detected, or ask the CLI: `npx @ericrisco/rsc consult "<one line: stack + what we're building>"`. Map signals to skills — e.g. `next`→`nextjs`+`design`, `go.mod`→`go`, FastAPI→`fastapi`, `*.sql`/Prisma→`postgresdb`/`prisma-orm`, Stripe→`stripe`, Dockerfile/CI→`docker`/`github-actions`, tests→`testing-*`/`e2e-testing`. The SDD phase skills (`specify`…`ship`) should already be present from `--profile core`; install any that are missing.
2. **Show the shortlist + confirm.** List the skills with a one-line *why* each, matched to the accompaniment dial, and get a one-word confirm before touching their environment.
3. **Install them yourself.** You have a terminal — run it via Bash:
   ```bash
   npx @ericrisco/rsc add <skill> [<skill> ...]
   ```
   If you genuinely cannot run a shell, print the exact command and ask the user to paste it in another terminal tab.
4. **Flag the new session.** Newly installed skills load at the START of a session. Tell the user: *"Instaladas. Abre una pestaña/sesión nueva de tu asistente (o recarga) en esta carpeta para que se activen."* Then refresh the registry again so `installed/available` is accurate.

## Config Shape

Write `02-DOCS/wiki/sdd/config.yaml` in this shape:

```yaml
version: 1
project:
  root: .
  stacks: []
  package_managers: []
  monorepo: false
  signals: []
sdd:
  artifact_store: 02-DOCS/wiki/sdd
  execution_mode: interactive
  registry_path: .rsc/skill-registry.json
  review_budget:
    line_budget: 400
    file_budget: 12
  delivery_strategy:
    default: ask-on-risk
testing:
  strict_tdd: false
  runners: []
  commands:
    apply: []
    verify: []
phase_rules:
  proposal: optional-on-ambiguity
  specify: requires intent or proposal
  plan: requires spec
  tasks: requires plan and spec
  analyze: requires spec plan tasks
  implement: requires analyze pass, strict_tdd when testing.strict_tdd is true
  verify: requires spec tasks evidence
  archive: requires verify record and review/ship outcome
models:
  enabled: false              # opt-in master switch; false = honor session model, announce nothing
  provider: anthropic         # which provider the tiers below resolve to
  tiers:
    heavy: claude-opus-4-8
    balanced: claude-sonnet-4-6
    light: claude-haiku-4-5-20251001
  phases:
    constitution: heavy
    specify: balanced
    clarify: balanced
    plan: heavy
    tasks: balanced
    analyze: heavy
    implement: balanced
    verify: balanced
    review: heavy
    ship: light
    debug: heavy
    worktrees: light
    sdd-init: light
  overrides: {}               # per-phase tier overrides set by the user
```

The `models` block is the **per-phase model routing** profile: each phase declares a tier (`heavy`/`balanced`/`light`) and the tiers resolve to concrete models for `provider`. The full protocol — how phases apply it, the per-assistant switch mechanism, the provider→model table — lives in `../sdd/references/model-routing.md`. Keep this block byte-for-byte in sync with that reference.

Preserve user edits if the file exists: update detected facts and leave comments/custom policy fields intact when possible. **Never flip `models.enabled` or drop `models.overrides` on re-calibration** — a calibration pass that silently switches the user's models is the one failure they cannot detect from the diff, so preserve both verbatim and only refresh `tiers`/`provider` if the user asks. If preservation is risky, write a proposed replacement next to it as `config.proposed.yaml` and ask.

## Result Envelope

End with the standard SDD result envelope:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "SDD config calibrated and registry refreshed.",
  "artifact": "02-DOCS/wiki/sdd/config.yaml",
  "next_recommended": "sdd",
  "risk": "low",
  "skill_resolution": {
    "used": ["sdd-init"],
    "missing": [],
    "fallback": [],
    "compact_rules": [
      "Read config.yaml before choosing commands.",
      "Use .rsc/skill-registry.json as the cheap skill index.",
      "Per-phase model routing ships off (models.enabled:false); never switch models unasked."
    ]
  },
  "evidence": ["npx @ericrisco/rsc registry refresh", "detected test commands recorded"]
}
```

## Anti-patterns

| Temptation | Reality |
| --- | --- |
| "I'll skip config and remember the commands in chat." | Chat is not source of truth. Write `config.yaml`. |
| "No test command detected, but I'll still say strict TDD is active." | Strict TDD needs a runner. Record the gap. |
| "Load all skills so the agent has context." | That pollutes context. Use registry -> selected skills -> compact rules. |
| "This is the same as init." | No. `init` profiles user/workspace, `sdd` dispatches the phases, `sdd-init` calibrates the technical SDD runtime they both rely on. |
| "Create openspec/ because Gentle does." | RSC uses `02-DOCS/wiki/sdd/` as source of truth. |

## Next

After `sdd-init`, return to `sdd`. If no spec exists, route to `specify`. If the work is ambiguous or architectural, write a proposal first under `02-DOCS/wiki/sdd/proposals/`.
