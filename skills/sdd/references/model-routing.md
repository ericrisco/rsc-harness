# Per-phase model routing — the protocol

*Different SDD phases ask for different kinds of thinking. Architecture and adversarial
review reward the strongest model; scaffolding and git plumbing don't. This is the protocol
that lets each phase run on the model its work deserves — cheaper where it's safe, strong
where it matters — without surprising anyone and without faking a switch a tool can't make.*

This file is the **single source of truth** for the behavior. `sdd-init` writes the profile,
`sdd` summarizes it, and every phase skill points here for the procedure. If the three ever
disagree, this file wins.

## Why this exists

By default every SDD phase runs on whatever model the session happens to be on. That's either
wasteful (running `ship`'s `git push` on the most expensive model) or risky (running an
architecture `plan` on the cheapest one). Routing assigns each phase a **tier** and lets the
phase put its work on the right model. It is **opt-in**: until the user turns it on, nothing
changes and nothing is announced.

## The three tiers (provider-neutral)

Tiers are abstract so the profile survives a provider switch. A phase only ever names a tier;
the concrete model is resolved from config.

| Tier | For | Typical work |
| --- | --- | --- |
| **heavy** | deep reasoning | architecture, consistency gates, adversarial review, root-cause diagnosis |
| **balanced** | execution | writing specs, code, tests, breaking work into tasks, interpreting check output |
| **light** | mechanical / high-volume / exploration | scaffolding, file sweeps, scans, git plumbing, repo detection |

## The profile (lives in `02-DOCS/wiki/sdd/config.yaml`)

`sdd-init` writes this block. It is the canonical shape — keep it byte-for-byte in sync with
the Config Shape in `../../sdd-init/SKILL.md` and the table in `../SKILL.md`.

```yaml
models:
  enabled: false              # opt-in master switch; false = honor the session model, announce nothing
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
  overrides: {}               # per-phase tier overrides set by the user; preserved across re-calibration
```

**Master switch.** `enabled: false` (the default) means routing does nothing: honor the
session model, never announce a switch, never nag. Everything below applies only when
`enabled: true`.

**Two phases are deliberately absent from `phases`:**

- `sdd` (the dispatcher) — routing decisions are cheap; it stays on the session model.
- `parallel` — it has no fixed tier. Each fanned-out subagent inherits the tier of the *kind
  of work* its unit does (an implement-type unit → `balanced`; a scan/research unit → `light`;
  a deep-reasoning unit → `heavy`).

## Default phase → tier mapping (quality-biased) and why

| Phase | Tier | Why |
| --- | --- | --- |
| constitution | heavy | Sets the project's non-negotiables — highest leverage, worth the best reasoning. |
| specify | balanced | Drafts the what/why spec through dialogue; not architecture. |
| clarify | balanced | Ranks and asks the few high-leverage questions; not architecture. |
| plan | heavy | Architecture, interfaces, data flow, risks — the heaviest cognitive load. |
| tasks | balanced | Decomposes the plan into verifiable tasks; structured but mechanical. |
| analyze | heavy | Adversarial consistency gate across constitution ↔ spec ↔ plan ↔ tasks. |
| implement | balanced | The bulk of TDD execution — cost-sensitive, quality sufficient. |
| verify | balanced | Runs the checks and interprets failures with judgment. |
| review | heavy | Adversarial diff reading — where the strongest model pays off most. |
| ship | light | Close the branch: PR / merge / cleanup — mechanical. |
| debug | heavy | Root-cause diagnosis — deep reasoning. |
| worktrees | light | Isolate the workspace (git) — mechanical. |
| sdd-init | light | Repo detection and calibration — mechanical. |

The user owns this. They change a phase by adding it to `models.overrides` (e.g.
`overrides: { implement: heavy }`), which wins over `phases`.

## How a phase applies the profile (the procedure)

Run this at the start of any SDD phase, after reading the accompaniment dial:

1. **Read** `models` from `02-DOCS/wiki/sdd/config.yaml`. If the block is absent or
   `enabled: false` → **do nothing**: honor the session model, say nothing about models.
2. **Resolve the tier** for this phase: `models.overrides[phase]` if present, else
   `models.phases[phase]`. (`parallel` resolves a tier per unit instead — see below.)
3. **Resolve the model**: `models.tiers[tier]` for the active `models.provider`.
4. **Apply, in two layers:**
   - **Programmatic (real routing, where the assistant supports delegation).** When the phase
     delegates work to a subagent (the `Task`/Agent tool) or fans out via `parallel`, set that
     subagent's `model` to the resolved model. This is real routing regardless of the session
     model and is the most reliable application — prefer it.
   - **Advisory (all assistants, inline work).** If the resolved model differs from the current
     session model and the work isn't being delegated, **announce** it at the phase boundary,
     gated by the accompaniment dial (below), and give the switch command for the active
     assistant (mechanism table below). Never block — the human may decline and continue.
5. **Skip routing entirely** for a one-line / trivial change, exactly as the SDD skip rule says
   for the rest of the chain. Ceremony serves shipping, not the other way around.
6. **Record** the model actually used in the phase's result envelope (`model` field, below).
   Log it to `02-DOCS/wiki/sdd/decisions.md` only when the choice actually mattered (e.g. you
   overrode a tier for a hard plan) — not on every phase.

### Announcement volume by accompaniment dial

The dial controls how loudly you announce a switch; it never changes whether routing happens.

| Level | On a model switch you… |
| --- | --- |
| **L0** "cavernícola" | Switch/dispatch silently. One short line only if the user must act (e.g. "para esta fase conviene opus: `/model opus`"). |
| **L1** "breve" | One line: which tier/model and the one-word why. |
| **L2** "explica decisiones" | Name the tier, the model, and why this phase warrants it; give the switch command. |
| **L3** "acompañamiento total" | Explain the tier system as it applies here, the cost/quality trade-off, and how to override in config. |

## Per-assistant switch mechanism

We route programmatically only where the assistant exposes a per-subagent model. Everywhere
else routing is advisory — announce the tier, the user switches in their tool.

| Assistant | Programmatic (delegation) | Advisory (inline) |
| --- | --- | --- |
| **Claude Code** | `model` on the `Task`/Agent tool and on `parallel` subagents (`opus`/`sonnet`/`haiku`) | `/model <name>` for the session |
| **Codex CLI** | — (solo-agent) | model flag / `model` in config |
| **Cursor** | native subagent model where exposed | model picker in the UI |
| **Gemini CLI** | — (experimental) | model flag |
| **Copilot / Windsurf / Cline / others** | — | announce the tier; user switches in the tool's model selector |

When the active assistant has **no** way to switch, still announce the recommended tier so the
human can decide — but **never claim a switch happened**. Honesty over magic.

## Provider → concrete models (repoint the tiers here)

To target another provider, change `models.provider` and set `models.tiers` to that row.

| provider | heavy | balanced | light |
| --- | --- | --- | --- |
| `anthropic` | `claude-opus-4-8` | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001` |
| `openai` | `gpt-5.1` (or current flagship) | `gpt-5.1-mini` | `gpt-5.1-nano` |
| `google` | `gemini-2.5-pro` | `gemini-2.5-flash` | `gemini-2.5-flash-lite` |
| `openrouter` | a strong model slug | a mid model slug | a cheap/free model slug |

These are starting points — set them to whatever your account actually has. The tiers are the
contract; the concrete names are yours to edit.

## The `developer` subagent (the installed implementation worker)

rsc installs a **`developer`** subagent into every assistant that supports file-based agents
(Claude Code `.claude/agents/`, Cursor, OpenCode, Gemini, Copilot, Junie, Kiro, Codex) when the
harness is installed. It is the concrete embodiment of "run the fan-out on a smaller model":

- It is pinned to the **balanced** tier — **Sonnet** for Anthropic-backed tools, the provider's
  mid model elsewhere (Gemini Flash, GPT-mini). It is **never** `light`/Haiku — that tier is too
  weak to build with. The floor for implementation is balanced.
- The tier is chosen at **onboarding** (`init`, Step 4): balanced (default) or heavy. It is stored
  in `.rsc/developer.json` and the installer writes the per-target agent file with the resolved
  model on every (re)install/sync. If onboarding never asks, the install-time default is balanced.
- `implement` and `parallel` **dispatch implementation/fan-out work to this agent**, so the
  session model orchestrates while the cheaper-but-capable model does the bulk of the typing.
- On assistants without file-based agents (Amp, Zed, Windsurf, Cline, Roo, Continue, Aider, Jules,
  Antigravity), there is no agent file — the developer tier is advisory there, like the rest of
  routing. The per-target model id is an editable default (see the provider table above).

## Result-envelope `model` field

Every phase's result envelope carries the model it ran on, so the chain is auditable:

```json
{
  "status": "complete",
  "model": { "tier": "heavy", "resolved": "claude-opus-4-8", "routing": "on|off" },
  "...": "rest of the standard envelope"
}
```

When routing is off, emit `"model": { "routing": "off" }` (no tier/resolved) — don't invent a
tier you didn't use.

## Honesty rules / anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "Routing sounds good, I'll switch models even though the user never enabled it." | It's opt-in. `enabled: false` (and a missing block) means honor the session model and say nothing. |
| "I'll tell the user I switched to Opus." (on an assistant with no programmatic switch) | You can't switch there. Announce the tier and the command; never claim a switch you didn't make. |
| "L0 means terse, so I'll skip routing." | L0 changes words, not behavior. Route the same; just announce silently (or only when the user must act). |
| "It's a one-line typo fix but the phase is `review`, so → heavy." | Skip routing on trivial changes, like the rest of the chain. Don't spin up the expensive model for a copy tweak. |
| "I'll log the model on every phase." | Log to `decisions.md` only when the model choice mattered. The envelope `model` field already records the routine case. |
| "config has no `models` block, I'll assume the defaults are active." | A missing block means routing is **off**. Defaults describe what `sdd-init` *writes*, not an implicit on-state. |
| "Two parallel units, I'll run both on the phase's tier." | `parallel` has no fixed tier. Give each unit the tier of its own work. |
