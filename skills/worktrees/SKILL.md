---
name: worktrees
description: "Use when feature work needs an isolated workspace before code is touched — branch or git worktree off the default branch so the main checkout stays clean while a plan is executed. Triggers: 'isolate this work', 'I don't want to touch main', 'set up a worktree', 'work on a branch for this', 'spin up an isolated checkout', 'start the feature without dirtying my tree', 'create a worktree for the plan', 'I'm on main and need to implement', 'keep the working tree clean', 'parallel checkout for this branch'. The on-demand SDD step that runs right before implement: it confirms a clean, isolated workspace exists (native EnterWorktree first, git worktree fallback), records nothing to runtime, and hands back to implement. NOT the task breakdown (tasks), NOT writing code (implement), NOT branch cleanup/merge after the work (that's the ship phase). Honors the harness accompaniment dial."
tags: [git, worktree, isolation]
recommends: []
profiles: [core, full]
origin: risco
---

# worktrees — isolate the work before you touch it

Before you execute a plan you guarantee one thing: **the work happens somewhere that can be thrown
away without harming the main checkout.** A feature branch keeps history clean; a *worktree* goes
further — a second working directory on its own branch, so you can build, run, and test the feature
without disturbing the files you (or another agent, or a running dev server) have open on the
default branch.

`worktrees` is an **on-demand** step in the SDD chain — not a numbered phase, but the gate that
`implement` calls when it finds itself on `main`. It does exactly one job: confirm an isolated
workspace exists, create one if it doesn't, and hand back. It writes no runtime code and leaves no
artifact under `02-DOCS`; isolation is plumbing, not knowledge.

```text
constitution → specify → clarify → plan → tasks → analyze → [ worktrees ] → implement → verify → review → ship
                                                              on-demand, called before the first commit
```

## The one rule that defines this step

**Never run `implement` on the default branch.** The moment a plan is about to become commits, the
work belongs in isolation. If `git rev-parse --abbrev-ref HEAD` says `main` or `master`, you stop
and create the isolated workspace *first* — before the first edit, not after the diff already exists
on the wrong branch. Recovering a half-built feature off `main` is strictly more expensive than
branching one command earlier.

## The decision: branch vs. worktree

Both isolate history. A worktree also isolates the *filesystem*. Pick by what's actually in play.

| Situation | Use | Why |
| --- | --- | --- |
| Solo, single task, clean tree, no parallel work | **branch** (`git switch -c`) | Cheapest isolation; nothing else needs the main checkout right now. |
| A dev server, build watcher, or editor is live on the current files | **worktree** | A branch switch yanks files out from under the running process; a worktree leaves them put. |
| You'll run two streams of work at once (see the parallel pattern) | **worktree** | Each stream gets its own directory; no stash-juggling, no checkout thrash. |
| The current tree is dirty and the user wants both the WIP and the new work | **worktree** | Stash-and-switch risks losing the WIP; a worktree sidesteps the stash entirely. |
| You're an agent that may keep the main session running elsewhere | **worktree** | Filesystem isolation is the whole point — the parent session keeps its files. |

When in doubt, prefer a **worktree**: it is the strictly stronger isolation and the cost is one
extra directory. The rest of this skill assumes a worktree; the branch path is the degenerate case
(skip the directory, keep the branch).

## Before you create anything — the pre-flight gate

Run this in order. Each check prevents a class of "lost work" you can't easily undo.

1. **Read the accompaniment dial.** Open `02-DOCS/wiki/harness/user-profile.md` for the technical +
   accompaniment level (L0..L3) — it sets how much you narrate and whether you confirm before acting
   (see the dial table below). No profile yet → assume non-technical, explain what a worktree is in
   one plain sentence before making one. No `02-DOCS/` at all (a worktree can be created in any git
   repo with no rsc harness present) → skip the dial, assume non-technical, and proceed.
2. **Confirm you're in a git repo.** `git rev-parse --is-inside-work-tree`. If not, there's nothing
   to isolate with git — tell the user; don't fabricate a worktree.
3. **Check the current branch.** `git rev-parse --abbrev-ref HEAD`. On `main`/`master` with work
   about to start → this skill is exactly right. Already on a feature branch with a clean tree →
   isolation may already be sufficient; say so and don't create a redundant one.
4. **Check the tree state.** `git status --short`. A **dirty tree is a fork in the road**, not a
   thing to bulldoze:
   - Uncommitted changes that belong to the *new* feature → a worktree built from a clean base means
     those changes stay on the old branch. Surface this; ask whether to commit/stash them first or
     carry them over. Never silently leave a user's WIP behind.
   - Unrelated WIP → that's the textbook reason to use a worktree (isolate the new work, leave the
     WIP exactly where it sits).
5. **Pick the base ref.** Branch from an up-to-date default branch unless the user wants to build on
   local HEAD. Stale base = predictable merge pain later. Default: fresh from `origin/<default>`.
6. **Choose a name** tied to the feature slug — the same `<slug>` the spec and plan use
   (`feat/<slug>`), so the branch, the spec at `02-DOCS/wiki/sdd/specs/<slug>.md`, and the plan at
   `02-DOCS/wiki/sdd/plans/<slug>.md` all line up and are trivially traceable.

Only once the tree state is understood and the user's WIP is accounted for do you create anything.

## Creating the workspace — native first, git fallback

**Prefer the native worktree tool when it's available in your environment.** An `EnterWorktree`-style
tool typically creates an isolated worktree (often under something like `.claude/worktrees/`, though
the exact location is tool-dependent), switches the session into it, and tracks it for clean exit —
which is exactly the lifecycle this skill wants, with no manual path management.

- **Enter:** create/enter the worktree (e.g. an `EnterWorktree`-style native tool, named for the
  feature slug). The session's working directory moves into the isolated checkout.
- **Exit:** on the native tool, `keep` to leave the worktree and branch on disk for later, `remove`
  to delete both when the work is done or abandoned. Removal of a worktree holding uncommitted or
  unmerged work must be an explicit, confirmed choice — never a silent cleanup.

If no native worktree tool is present, fall back to plain git. The mechanics:

```bash
# from the repo root, default branch up to date
git fetch origin
git worktree add -b feat/<slug> ../<repo>-<slug> origin/<default-branch>
# work happens in ../<repo>-<slug>; the main checkout is untouched
```

```bash
# branch-only path (the degenerate case: no separate directory needed)
git switch -c feat/<slug> origin/<default-branch>
```

```bash
# when the work is done and merged (or abandoned) — clean up the worktree
git worktree remove ../<repo>-<slug>      # refuses if dirty; resolve first, don't force blindly
git branch -d feat/<slug>                  # -d (safe) not -D, unless the user confirms discarding
```

Either way, the contract is identical: **after this step, the cwd is an isolated branch off a clean
base, and the default-branch checkout is exactly as it was.** Confirm that out loud (at the dial's
level) before handing to `implement`.

### Provenance-aware cleanup (don't remove a workspace you didn't create)

Removing the wrong worktree leaves phantom state and can destroy someone else's in-progress work.
Before any `git worktree remove`, clear these guards:

```bash
# 1) Are we even inside a linked worktree? (GIT_DIR != GIT_COMMON_DIR ⇒ yes)
[ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ] && echo "linked worktree"
# 2) Submodule false-positive guard — never treat a submodule as a worktree to remove
git rev-parse --show-superproject-working-tree   # non-empty ⇒ this is a submodule; STOP
# 3) cd to the MAIN working tree before removing (you cannot remove the worktree you stand in)
cd "$(git rev-parse --git-common-dir)/.."
git worktree remove <path>
git worktree prune                                # self-heal stale administrative entries
```

- **Only remove worktrees rsc/you created** — those under `.worktrees/` or `worktrees/`, or the
  `../<repo>-<slug>` this skill made. A worktree the user or a native tool owns is **not yours to
  delete**; leave it and say so.
- **Native tool owns its own lifecycle.** If you isolated via a native `EnterWorktree`-style tool,
  exit through that tool's `remove`/`keep` — do **not** hand-run `git worktree remove` on a workspace
  the native tool created; let it clean up so its tracking stays consistent.
- **`git worktree prune`** after a remove clears stale metadata when a directory vanished out from
  under git — cheap self-healing, safe to run.

## Native vs. git fallback — which you're using

| You have… | Create | Leave intact | Discard |
| --- | --- | --- | --- |
| A native worktree tool (`EnterWorktree`-style) | enter, named for the slug | exit with `keep` | exit with `remove` (confirm if dirty/unmerged) |
| Plain git only | `git worktree add -b feat/<slug> …` | leave the dir; it persists | `git worktree remove` + `git branch -d` |

The native tool is preferred because it owns the session-switch and the exit lifecycle for you. The
git path is the universal fallback and is exactly what the native tool does under the hood.

## Model tier — `light` (opt-in routing)

This phase's default model tier is **`light`** — isolating the workspace is mechanical git work. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Adapting to the dial

Read `02-DOCS/wiki/harness/user-profile.md` and match your volume — the isolation is identical at
every level; only the talking changes.

| Level | How `worktrees` behaves |
| --- | --- |
| **L0** | Create the isolated workspace, state the branch/dir in one line, hand to `implement`. No explanation. |
| **L1** | Same, plus one line of *why* a worktree over a branch (or vice-versa) for this case. |
| **L2** | Justify the base-ref choice and the branch-vs-worktree call; surface the dirty-tree decision explicitly. |
| **L3** | Explain in plain language what a worktree is and why isolation protects their work; ask before touching any uncommitted changes; confirm the base ref. |

At every level, a **dirty tree with the user's uncommitted work is a hard stop for a confirmation** —
the dial controls verbosity, never whether you check before risking someone's WIP.

## Anti-patterns → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "I'll just implement on `main`, it's a small change" | Small changes become commits on the wrong branch. Branch/worktree first — always, before the first edit. |
| "There's uncommitted WIP, I'll stash it and switch" | A worktree avoids the stash entirely and can't drop it. Use a worktree; if you must stash, confirm with the user and name the stash. |
| "I'll branch off local HEAD, fetching is slow" | Stale base = merge conflicts you pay for later. Branch off an up-to-date `origin/<default>` unless the user wants HEAD. |
| "The worktree's dirty but I'll `remove --force` to clean up" | Force-removing a dirty/unmerged worktree throws away work irreversibly. Resolve or confirm explicitly first; never silent-force. |
| "I'll name it `wip` / `temp` / `branch2`" | An untraceable name divorces the branch from its spec/plan. Name it `feat/<slug>` to match the SDD artifacts. |
| "I'll create the worktree AND start writing code right here" | This skill only isolates. Hand a clean isolated workspace to `implement`; don't blur the two steps. |
| "Already on a feature branch, I'll make a worktree anyway" | Redundant isolation is just clutter. If the current branch is already isolated and clean, say so and proceed. |
| "I'll record the worktree path into 02-DOCS so it's tracked" | Isolation is plumbing, not knowledge. No artifact; the branch name traces it. Don't pollute the wiki. |

## Red flags — stop and re-route

- **Not a git repo** → nothing to isolate with git. Tell the user; don't invent a workspace.
- **Dirty tree you don't understand** → don't bulldoze it. Surface every modified path and ask
  before branching/stashing. Lost WIP is the one unrecoverable failure here.
- **Asked to merge, open a PR, or delete the branch after the work** → that's `../ship/SKILL.md`, not
  this one. This skill opens isolation; ship closes it.
- **Asked to actually write the feature code** → that's `../implement/SKILL.md`. Create the workspace,
  then hand off; don't start coding in this step.
- **A native `remove`/`git worktree remove` would drop uncommitted or unmerged work** → refuse the
  silent path. Confirm the discard explicitly with the user, quoting what would be lost.

## Checklist (copy when isolating)

```text
- [ ] Read the accompaniment dial (user-profile.md); set verbosity
- [ ] Confirmed inside a git repo
- [ ] Checked current branch; on main/master if implement is next
- [ ] Checked `git status --short`; accounted for any uncommitted WIP (asked, didn't bulldoze)
- [ ] Picked base ref (fresh origin/<default> unless user chose HEAD)
- [ ] Named the workspace feat/<slug> to match the spec/plan artifacts
- [ ] Created isolation: native worktree tool if available, else git worktree (branch = degenerate case)
- [ ] Confirmed: cwd is the isolated branch; the main checkout is untouched
- [ ] Wrote NO runtime code and NO 02-DOCS artifact here
- [ ] Handed off to implement
```

## What this skill is NOT

- **Not the task breakdown.** Slicing the plan into ordered, verifiable tasks is `../tasks/SKILL.md`.
- **Not the coding.** Writing the feature test-first, task by task, is `../implement/SKILL.md`.
- **Not branch cleanup / merge / PR.** Closing the branch — merge, PR, or discard, with Eric-only
  git authorship — is `../ship/SKILL.md`. This skill only *opens* the isolation.
- **Not a place for runtime or wiki artifacts.** It touches git state only; nothing under `02-DOCS`.

## Where you are in the chain

`constitution` → `specify` → `clarify` → `plan` → `tasks` → `analyze` → **worktrees** (on-demand) →
`implement` → `verify` → `review` → `ship`. The **parallel** pattern leans on this skill too: each
independent stream gets its own worktree so the streams never fight over files.

**Next:** with a clean isolated workspace in hand, hand to **`../implement/SKILL.md`** — walk the
task list test-first, one commit per task, on this branch. When the feature is built and verified,
**`../ship/SKILL.md`** closes the branch.
