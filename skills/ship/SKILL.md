---
name: ship
description: "Use when the work is complete and verified and it is time to CLOSE the development branch — the final phase of the rsc SDD chain, after review approves the diff. Triggers: 'ship it', 'close the branch', 'open the PR', 'merge this', 'merge into main', 'create the pull request', 'how do I land this work', 'finish this feature', 'haz el merge', 'abre el PR', 'cierra la rama', 'súbelo a main', 'clean up the branch', 'I'm done, what now'. HARD RULE it enforces: git authorship is ALWAYS Eric — never a Co-Authored-By or 'generated with' footer in any commit or PR. NOT running lint/type/test (that is `verify`), NOT reading the diff adversarially (that is `review`), NOT deploy/release mechanics to a server (that is `deployment`). Honors the harness accompaniment dial."
tags: [sdd, ship, release, pr]
recommends: []
profiles: [core, full]
origin: risco
---

# Ship — close the development branch

Ship is the **last gate** of the rsc SDD chain: `constitution → specify → clarify → plan → tasks → analyze → implement → verify → review → **ship**`. Everything upstream proved the work is *correct* and *green*; ship is the act of **landing it** — turning an approved branch into merged history, a pull request, or a clean parked branch — without breaking the trunk and without ever forging the author.

This skill owns one decision and its safe execution: **how does this work integrate?** It does not write code, run test gates, or read the diff for defects — those phases already happened. It takes a diff that *earned* its verdict and gets it home.

## The hard rule: git authorship is Eric, never Claude

> **Every commit and every PR ships under Eric's name. No `Co-Authored-By: Claude`. No `Co-Authored-By` for any AI. No "🤖 Generated with Claude Code" footer. No "made by an agent" line in the PR body. Nothing that attributes the work to a tool.**

This is non-negotiable and it is the reason this skill exists as its own phase. The work is Eric's; the agent is a tool he used, like an editor or a compiler. You do not credit the compiler in the commit message.

Concretely, before any commit or PR:

- **Never** append a trailer, footer, or body line crediting Claude, an AI, an agent, or "Claude Code".
- **Never** pass `--author` to set a non-Eric author. The repo's configured `user.name` / `user.email` (Eric's) is the author and committer.
- If `git config user.email` is unset or clearly not Eric's, **stop and ask** which identity to commit under — do not guess, and do not substitute an agent identity.
- If you find a Claude/AI trailer in a commit you are about to push (e.g. left over from an upstream tool), **strip it** before the branch lands.

Verify it after writing the commit:

```bash
git log -1 --format='%an <%ae>%n%n%b' | grep -iE 'co-authored-by.*(claude|anthropic|ai)|generated with|claude code' \
  && echo "AUTHORSHIP VIOLATION — strip the trailer before shipping" \
  || echo "authorship clean"
```

A non-empty match is a blocker. Amend the commit and re-check before the branch goes anywhere.

## Read these first

1. `02-DOCS/wiki/harness/user-profile.md` — the **accompaniment dial** (L0..L3). It sets how much you narrate and how you frame the three options, never whether you run the safety checklist. See "Accompaniment dial" below.
2. The **review verdict** for this branch — ship runs only on `APPROVE` or `APPROVE WITH NITS`. If the last verdict was `CHANGES REQUESTED`, the loop goes back to `implement`, not forward to ship.
3. `02-DOCS/wiki/sdd/decisions.md` and the spec/plan slug — so the commit message and PR body describe *what shipped against which spec*, not a vague "various changes".

If there is no review verdict on record, say so and treat it as a red flag — do not ship a diff that skipped the `review` phase. Offer to run review first.

## When to use / When NOT to use

Use when:

- A branch has passed `verify` (green gates) and `review` (approved), and the work needs to land.
- The user says "ship it", "merge this", "open the PR", "close the branch", "I'm done" — and the code is actually ready.
- A finished branch needs to be parked or discarded cleanly (abandoned spike, superseded approach).

Do NOT use when (route elsewhere):

- Lint / type-check / tests / audit still need to run and go green → that is the **verify** phase (`../verify/SKILL.md`). Ship assumes green.
- The diff hasn't been read for defects, or a review comment needs processing → that is **review** (`../review/SKILL.md`).
- The merge is clean but now it must reach a *server* — provisioning, release pipeline, environment promotion, rollback → that is **deployment** (`../deployment/SKILL.md`). Ship lands the code in the repo; deployment puts it in production.
- You need to *create* the isolated branch/worktree to start work → that is **worktrees** (`../worktrees/SKILL.md`). Ship is the close, not the open.

## The pre-ship safety checklist

Run this before presenting the landing options. Any unchecked item is a stop — surface it, don't ship around it.

- [ ] **Review verdict is APPROVE / APPROVE WITH NITS** (not CHANGES REQUESTED, not absent).
- [ ] **Working tree is clean** — `git status --short` is empty. No stray edits sneaking into the merge.
- [ ] **On a feature branch, not the trunk** — `git rev-parse --abbrev-ref HEAD` is not `main`/`master`. If work landed directly on the trunk, that is its own problem; flag it.
- [ ] **Rebased / up to date with the base** — branch is on top of latest `main`; conflicts resolved locally, not punted to the merge.
- [ ] **No secrets in the diff** — scan the staged/branch diff for keys, tokens, `.env` values (`git diff main... | grep -iE 'api[_-]?key|secret|password|token|BEGIN .*PRIVATE KEY'`). A hit is a blocker.
- [ ] **Authorship is Eric** — `git config user.email` is Eric's; no AI trailer in any commit on the branch (run the grep above across `main..HEAD`).
- [ ] **Commit history is intelligible** — squashed or organized so the history reads as deliberate, not "wip wip fix fix".

```bash
# one-shot pre-ship snapshot (read-only)
echo "branch:   $(git rev-parse --abbrev-ref HEAD)"
echo "clean?:   $([ -z "$(git status --short)" ] && echo yes || echo NO-dirty)"
echo "behind:   $(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?') commits behind origin/main"
git log main..HEAD --format='%an <%ae>' | sort -u   # authors on this branch — expect only Eric
git diff main...HEAD | grep -icE 'api[_-]?key|secret|password|token|BEGIN .*PRIVATE KEY' \
  | sed 's/^/secret-hits: /'
```

### Automated guard (PreToolUse) — you cannot quietly abandon a feature

When rsc is installed for Claude Code, a `PreToolUse` hook (`.rsc/ship-guard.mjs`) enforces this
phase at the one deterministic moment it matters: it **denies** any Bash command that switches to
`main`/`master` or merges while the current feature branch has **uncommitted changes** or **commits
that were never pushed**. The denial reason names the branch and routes you here. The guard is
local-only (no network), **fail-open** (any ambiguity allows the command), and can be disabled per
project with `.rsc/.no-ship-guard`. It guarantees the commit → push step; opening the PR is still
this skill's job (and its hard rule). If the guard blocks you, do not work around it — run ship.

## The three landing options — always present exactly three

This mirrors the harness "siempre 3 opciones" pattern. Gather the one fact that changes the answer (does this repo use PRs / require review on `main`?), then present **exactly three** with an honest recommendation matched to the workflow and the accompaniment level.

| Option | What it does | Choose it when |
| --- | --- | --- |
| **1. Direct merge to trunk** | Fast-forward or `--no-ff` merge into `main`, push, delete the branch | Solo repo or trusted-trunk workflow; `main` is not protected; you are the only reviewer and review already passed |
| **2. Pull request** | Push the branch, open a PR with a spec-linked body, let CI / a human gate the merge | `main` is protected; a team or CI must sign off; you want the change reviewable in the forge even if you self-merge |
| **3. Park or discard** | Keep the branch un-merged (park) or delete it (discard) | The approach was superseded, the spike answered its question, or the work is paused — it should not land |

Recommend based on repo signals: protected `main` or an existing PR culture (look for `.github/`, prior PRs via `gh pr list`) → recommend **option 2**. A solo project with no protection and a passed review → **option 1** is honest and faster. Never default to a PR ceremony the repo doesn't use, and never force-merge a repo that gates `main`.

### Delivery strategy from SDD config

Read `02-DOCS/wiki/sdd/config.yaml` and the `Review Workload Forecast` in the plan if present.

- `single-pr` keeps option 2 as one PR.
- `ask-on-risk` pauses when the forecast exceeds the review budget and asks before landing a large diff.
- `autochain` uses stacked PRs when tasks are reviewable in dependency order.
- `exception` permits a larger single PR only when the user explicitly accepts the review risk.

Stacked PR / feature-track support still fits inside the three landing options: it is a shape of **option 2**, not a fourth option. Use a feature-track branch when several stacked PRs should integrate together before trunk.

## Executing each option

### Option 1 — direct merge

```bash
git switch main && git pull --ff-only
git merge --no-ff feature/<slug> -m "feat: <what shipped> (<spec-slug>)"   # no AI trailer
git push origin main
git branch -d feature/<slug>          # delete merged branch; -D only if intentionally dropping unmerged work
git push origin --delete feature/<slug> 2>/dev/null || true
```

Use `--no-ff` so the feature is one legible merge commit tied to the spec. Confirm the trunk still builds after the merge if the repo has a local gate (defer the actual run to `verify`).

### Option 2 — pull request

Write the **commit(s)** clean, push, then open the PR with `gh`. The PR body links the spec/plan and lists what shipped — **and carries no AI attribution.**

```bash
git push -u origin feature/<slug>
gh pr create \
  --title "feat: <what shipped> (<spec-slug>)" \
  --body-file /tmp/ship-pr-body.md          # body authored per the template below — NO AI footer
```

PR body shape (no generated-with line, ever):

```markdown
## What

<one-paragraph summary of the change, in plain terms>

## Why

Implements `02-DOCS/wiki/sdd/specs/<slug>.md`. <the user-facing reason>

## How

- <key implementation point>
- <key implementation point>

## Verification

- `verify` phase: lint / types / tests green (see the verification record).
- Acceptance criteria from the spec: all met.
- Review verdict: APPROVE.
```

Then either let the gate run (team/CI) or self-merge once green: `gh pr merge --squash --delete-branch` (or `--merge` to preserve the history). Squash when the branch history is noisy; preserve when each commit is meaningful.

For stacked PRs, create each PR against the previous branch or against a feature-track branch, with bodies that name their dependency:

```markdown
Depends on: <previous PR or feature-track branch>
Part of: <spec-slug>
```

Never stack to hide review risk. Stack because each slice is independently reviewable and follows the task dependency order.

### Option 3 — park or discard

- **Park:** leave the branch, push it so it's not lost (`git push -u origin feature/<slug>`), and log *why it's parked* to `02-DOCS/wiki/sdd/decisions.md`. Do not merge.
- **Discard:** deletion is **destructive** — require an explicit confirmation that quotes the branch name (e.g. the literal `yes, delete feature/<slug>`) before `git branch -D`. Anything ambiguous means keep it. Log the discard and the reason so the dead-end is remembered, not re-attempted.

**If the work lived in a worktree, clean it up provenance-aware.** After the merge/park/discard, only
remove a worktree **rsc created** (under `.worktrees/`/`worktrees/` or the `../<repo>-<slug>` dir),
never one the user or a native tool owns. Guard first: confirm it's a linked worktree
(`git rev-parse --git-dir` ≠ `--git-common-dir`), rule out a submodule
(`git rev-parse --show-superproject-working-tree` is empty), `cd` to the main working tree before
removing, and run `git worktree prune` after. Full procedure: `../worktrees/SKILL.md` (Provenance-aware
cleanup). If a native `EnterWorktree`-style tool created it, exit through that tool, not raw git.

## Commit message discipline

The commit is the durable record. Make it describe the change and tie it to the spec — and keep it Eric's.

- **Subject:** `type: imperative summary (<spec-slug>)` — `feat:`, `fix:`, `refactor:`, etc. Under ~72 chars.
- **Body:** *why*, not a restatement of the diff. Reference the spec slug and any decision logged in `decisions.md`.
- **Footer:** issue/PR refs only. **No `Co-Authored-By` for any AI. No "generated with" line.** This is where the violation usually sneaks in — leave the footer clean.

## Model tier — `light` (opt-in routing)

This phase's default model tier is **`light`** — closing the branch (PR / merge / cleanup) is mechanical. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change. The Eric-only authorship rule is independent of the model and never relaxes.

## Accompaniment dial (L0..L3)

Read the level from `02-DOCS/wiki/harness/user-profile.md`. It changes the narration, **never** the safety checklist or the authorship rule.

- **L0** — run the checklist silently, state the recommended option in one line, execute on a yes. `Clean, rebased, authorship Eric. Recommend PR (main is protected). Open it?`
- **L1** — the three options as one-liners with the recommendation and its *why*.
- **L2** — the full options table, the checklist results, and why the recommended option fits this repo's workflow.
- **L3** — the above plus teaching: what a fast-forward vs `--no-ff` merge does to history, why a protected `main` wants a PR, what squashing trades away — framed for a non-technical owner ("a PR is asking permission before changing the shared copy"). Still never skips a checklist item.

When no profile exists, default to L2 and proceed — don't stall the ship to ask for a dial setting.

## Anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "I'll add `Co-Authored-By: Claude` to be transparent" | No. The work is Eric's. No AI trailer, ever — this is the whole point of the phase. |
| "A 'Generated with Claude Code' footer is just polite" | It forges the record. Strip it. The commit credits Eric and only Eric. |
| "Review didn't formally approve but it's obviously fine" | No verdict = not ready. Ship runs on APPROVE only. Route back to review. |
| "The tree has a couple of stray edits, they're harmless" | A dirty tree means the merge is not the reviewed diff. Clean it or stash it first. |
| "`main` is protected but I'll just force-merge, I'm sure" | Protected means PR. Don't bypass the gate the repo deliberately set. |
| "I'll rebase and resolve conflicts during the merge" | Resolve before. A conflicted merge commit hides what actually shipped. |
| "This branch is dead, I'll just delete it" | Discard is destructive — confirm with the quoted branch name and log why first. |
| "Squash everything, history doesn't matter" | Squash noise, preserve meaning. The history is the next reader's spec. |
| "There's a key in the diff but it's a test key" | A secret in the diff is a blocker regardless. Pull it out before landing. |

## Red flags — abort and re-plan

- Any commit on the branch carries an AI `Co-Authored-By` or "generated with" line → strip it; do not push until clean.
- `git config user.email` is unset or not Eric's → stop and ask which identity to commit under.
- No review verdict, or the last verdict was `CHANGES REQUESTED` → not shippable; route to review/implement.
- The branch is `main`/`master` itself → work landed on the trunk directly; flag it, don't paper over it.
- A secret matches in the branch diff → blocker; remove it (and rotate it if it was ever pushed).

## Where this writes

Ship is mostly git actions, but the outcome is recorded so the knowledge model stays whole:

- **The landing decision** (which of the three options, and why) → append to `02-DOCS/wiki/sdd/decisions.md`, the same append-only log `implement`, `verify`, and `review` write to. Parks and discards are logged with their reason so dead-ends aren't re-walked.
- A **shipped feature** flips its spec under `02-DOCS/wiki/sdd/specs/<slug>.md` to a shipped state (note the merge commit / PR). The harness owns the wiki; ship just keeps the `sdd/` rows in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) honest.
- An **archive bundle** closes the loop under `02-DOCS/wiki/sdd/archive/<slug>/`:
  - `final-report.md` — what shipped, why, landing decision, links.
  - `apply-progress.md` — copy or link to `progress/<slug>.md`.
  - `verification.md` — copy or link to the verification record.
  - `review.md` — review verdict and nits.
  - `state.yaml` — `shipped`, `parked` or `discarded`, PR/merge refs, date.

Archive after option 1/2 lands, and also after option 3 parks/discards so paused or abandoned work is remembered.

## Result envelope

End with:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Branch landed/parked/discarded and SDD archive updated.",
  "artifact": "02-DOCS/wiki/sdd/archive/<slug>/final-report.md",
  "next_recommended": "none",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["ship"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Keep exactly three landing options.", "Archive the final state."]
  },
  "evidence": ["review verdict", "verification record", "PR/merge/park/discard reference"]
}
```

## Next in the chain

Ship is the end of the SDD loop for a feature. Two onward paths:

- The code is merged but must reach a **server / release** — provisioning, pipeline, environment promotion, rollback → hand off to **deployment** (`../deployment/SKILL.md`). Ship lands it in the repo; deployment puts it in front of users.
- The next feature starts the loop again at **specify** (`../specify/SKILL.md`) — or at **constitution** if the project's principles changed. The `sdd` dispatcher (`../sdd/SKILL.md`) routes whichever comes next.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

