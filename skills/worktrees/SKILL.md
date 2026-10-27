---
name: worktrees
description: "Use when work is about to become commits and needs isolation first — check the tree state, then branch or cut a git worktree off a clean base (native EnterWorktree first, git fallback) so implement never runs on main. NOT what may run concurrently inside those workspaces (that is `parallel`), NOT the merge/cleanup after (that is `ship`)."
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

**Never open a branch on your own; follow the project's decision.** Where the default branch is open
(chosen at install, or nothing complex), `implement` runs on it. Where it is closed («ramas y PR»,
CI, team), stop before the first edit and ask «¿esta rama, una nueva, o desbloqueo `main`?» — not
after the diff already exists. The one exception is another session in this folder: then the
worktree is mandatory, not a question.

## The decision: branch vs. worktree

Both isolate history. A worktree also isolates the *filesystem*. Pick by what's actually in play.

| Situation | Use | Why |
| --- | --- | --- |
| Solo, single task, clean tree, no parallel work | **branch** (`git switch -c`) | Cheapest isolation; nothing else needs the main checkout right now. |
| A dev server, build watcher, or editor is live on the current files | **worktree** | A branch switch yanks files out from under the running process; a worktree leaves them put. |
| You'll run two streams of work at once (see the parallel pattern) | **worktree** | Each stream gets its own directory; no stash-juggling, no checkout thrash. |
| The current tree is dirty and the user wants both the WIP and the new work | **worktree** | Stash-and-switch risks losing the WIP; a worktree sidesteps the stash entirely. |
| You're an agent that may keep the main session running elsewhere | **worktree** | Filesystem isolation is the whole point — the parent session keeps its files. |
| **Another session is working in this same folder** (rsc says so on each message) | **worktree — mandatory** | Switching branches would change its files under it; rsc's branch guard denies the switch. Tell the person that `.worktrees/<branch>/` is where the project now runs. Off for the project: `npx @ericrisco/rsc isolation off`. |

When in doubt, prefer a **worktree**: it is the strictly stronger isolation and the cost is one
extra directory. The rest of this skill assumes a worktree; the branch path is the degenerate case
(skip the directory, keep the branch).

## Before you create anything — the pre-flight gate

Run this in order. Each check prevents a class of "lost work" you can't easily undo.

1. **Read the register** — `technical_level` in `02-DOCS/wiki/harness/user-profile.md` picks
   technical terms or plain words with analogies (see "Talking about it" below). No profile yet, or
   no `02-DOCS/` at all (a worktree can be created in any git repo with no rsc harness present) →
   use analogies: explain what a worktree is in one plain sentence before making one, and proceed.
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
   - A dirty tree you don't understand is a hard stop: surface every modified path and ask before
     branching or stashing. Lost WIP is the one unrecoverable failure in this step.
5. **Pick the base ref.** Branch from an up-to-date default branch unless the user wants to build on
   local HEAD. Stale base = predictable merge pain later. Default: fresh from `origin/<default>`.
6. **Choose a name** tied to the feature slug — the same `<slug>` the spec and plan use
   (`feat/<slug>`), so the branch, the spec at `02-DOCS/wiki/sdd/specs/<slug>.md`, and the plan at
   `02-DOCS/wiki/sdd/plans/<slug>.md` all line up and are trivially traceable. A change that is not
   a feature takes the type that fits — `fix/<slug>`, `docs/<slug>`, `chore/<slug>` — from the same
   Conventional Commits vocabulary the commit guard already enforces here. **The prefix is load
   bearing**: the automatic cleanup uses it, with the location, as the two signals that say a
   worktree is ours to remove. A name outside that vocabulary is never swept for you.

Only once the tree state is understood and the user's WIP is accounted for do you create anything.

## Creating the workspace — native first, git fallback

**Prefer the native worktree tool when it's available in your environment.** An `EnterWorktree`-style
tool typically creates an isolated worktree (often under something like `.claude/worktrees/`, though
the exact location is tool-dependent), switches the session into it, and tracks it for clean exit —
which is exactly the lifecycle this skill wants, with no manual path management. The git path is the
universal fallback and is exactly what the native tool does under the hood.

| You have… | Create | Leave intact | Discard |
| --- | --- | --- | --- |
| A native worktree tool (`EnterWorktree`-style) | enter, named for the feature slug; the session's working directory moves into the isolated checkout | exit with `keep` — worktree and branch stay on disk for later | exit with `remove` — deletes both when the work is done or abandoned |
| Plain git only | `git worktree add -b feat/<slug> .worktrees/<slug>` | leave the dir; it persists until its work lands | `git worktree remove` + `git branch -d` |

Removing a worktree that holds uncommitted or unmerged work must be an explicit, confirmed choice,
never a silent cleanup: refuse the silent path and confirm the discard with the user, quoting what
would be lost.

**You do not have to remember to clean up.** Once the work lands on the trunk, a `post-merge` hook
retires the worktree and its branch on its own — it removes only what the reaper already classifies
as safe, and anything holding unsaved work is refused exactly as it is above. Nothing to run, and
nothing to remember: the previous version of this skill asked an agent to remember, and it was
skipped on both features that reached that point.

```bash
# from the repo root, default branch up to date
git fetch origin
git worktree add -b feat/<slug> .worktrees/<slug> origin/<default-branch>
# work happens in .worktrees/<slug>; the main checkout is untouched
```

**At the root you work in, always — never inside a project folder, never a sibling.** The root is
the folder holding `.rsc.json`. For the repo at that root the worktree is `.worktrees/<slug>`. For a
project that lives in a folder under it (a workspace with `03-PROJECTS/<p>/`), it is
`<root>/.worktrees/<p>-<slug>`, and the path is written absolute — a relative one resolves inside
the project, which is how they ended up there:

```bash
git -C 03-PROJECTS/<p> fetch origin
git -C 03-PROJECTS/<p> worktree add -b feat/<slug> <root>/.worktrees/<p>-<slug> origin/<default-branch>
```

A worktree at the root is a fresh checkout with nothing above it to borrow from: install its
dependencies inside it (`npm ci`, `uv sync`, …) before running anything. Inside the project, a
missing `node_modules` was silently taken from the parent; at the root it fails loudly instead.

rsc's branch guard denies any other place, with the right command in its message. `.worktrees/` is
already gitignored at the root, the reaper recognises both shapes as its own, and a sibling
directory would sit outside the tree, survive every cleanup and stop being visible to whoever would
retire it. Deleting the workspace deletes its worktrees with it.

```bash
# branch-only path (the degenerate case: no separate directory needed)
git switch -c feat/<slug> origin/<default-branch>
```

```bash
# when the work has landed — the cleanup is the default, and it is a command, not a judgement call
npx @ericrisco/rsc worktrees reap
```

Either way, the contract is identical: **after this step, the cwd is an isolated branch off a clean
base, and the default-branch checkout is exactly as it was.** Confirm that out loud, in
one line, before handing to `implement`.

### Cleanup is the default, and it is not yours to judge

A worktree whose work is already in the trunk is retired **by default** — you do not decide that by
reading the situation, because "is this safe to delete?" is a deterministic question and a wrong
answer costs a directory that cannot be brought back. Ask the command:

```bash
npx @ericrisco/rsc worktrees        # every landed worktree, with a verdict and a reason
npx @ericrisco/rsc worktrees reap   # retire the ones that are safe with nothing to lose
npx @ericrisco/rsc worktrees reap <path>   # retire one the user has just confirmed
```

Three things have to hold before a worktree is retired without asking, and each fails towards
**keeping** it:

- **rsc created it** — location *and* branch shape both match. Only one matches → it might be the
  user's, so it is asked about, never removed silently. Neither → foreign; not touched, not offered.
- **The branch adds nothing the trunk does not have** — asked about *content*, so a squash-merged
  pull request counts as landed. Its branch is kept even so: git will not delete it safely, and while
  it exists the commits survive a wrong call.
- **Nothing inside would be lost** — not just "no pending changes": untracked and ignored files count,
  because a worktree that git calls clean can still hold the only copy of a `.env` or a local
  database. Installed dependencies and build output are the one carve-out.

Anything else is reported with the reason and the way out. A refusal you cannot act on is not safety.

**The native tool owns its own lifecycle.** If you isolated via a native `EnterWorktree`-style tool,
exit through that tool's `remove`/`keep`; the reaper is for worktrees git alone knows about.

**When the command is unavailable** (no rsc in this project), the manual equivalent is: confirm it is
a linked worktree (`git rev-parse --git-dir` ≠ `--git-common-dir`), rule out a submodule
(`git rev-parse --show-superproject-working-tree` must be empty), `cd` to the main working tree, then
`git worktree remove` and `git worktree prune`. Never `-D` a branch to make the cleanup succeed.

## Model tier — `light` (opt-in routing)

This phase's default model tier is **`light`** — isolating the workspace is mechanical git work. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch in one line when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Talking about it

The isolation is identical for every reader; only the words change. In the `orient` voice: state
the branch/dir in one line, add one line of *why* a worktree over a branch (or vice-versa) for this
case, and confirm the base ref. For a `non-technical` reader, say what a worktree is with an
everyday analogy (a second copy of the desk, so the first one stays as it was).

A **dirty tree with the user's uncommitted work is always a hard stop for a confirmation** — no
wish for brevity removes the check before risking someone's WIP.

## Anti-patterns → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "I'll just implement on `main`, it's a small change" | Small changes become commits on the wrong branch. Branch/worktree first — always, before the first edit. |
| "There's uncommitted WIP, I'll stash it and switch" | A worktree avoids the stash entirely and can't drop it. Use a worktree; if you must stash, confirm with the user and name the stash. |
| "I'll branch off local HEAD, fetching is slow" | Stale base = merge conflicts you pay for later. Branch off an up-to-date `origin/<default>` unless the user wants HEAD. |
| "The worktree's dirty but I'll `remove --force` to clean up" | Force-removing a dirty/unmerged worktree throws away work irreversibly. Resolve or confirm explicitly first; never silent-force. |
| "I'll name it `wip` / `temp` / `branch2`" | An untraceable name divorces the branch from its spec/plan, and the automatic cleanup will not claim it. Use `<type>/<slug>` — `feat/` for a feature, `fix/`, `docs/`, `chore/` for the rest. |
| "I'll create the worktree AND start writing code right here" | This skill only isolates. Hand a clean isolated workspace to `implement`; don't blur the two steps. |
| "Already on a feature branch, I'll make a worktree anyway" | Redundant isolation is just clutter. If the current branch is already isolated and clean, say so and proceed. |
| "I'll record the worktree path into 02-DOCS so it's tracked" | Isolation is plumbing, not knowledge. No artifact; the branch name traces it. Don't pollute the wiki. |

**Next:** with a clean isolated workspace in hand, hand to `../implement/SKILL.md` — walk the task
list test-first, one commit per task, on this branch. Neighbours: `../tasks/SKILL.md` slices the plan
before you get here; `../parallel/SKILL.md` decides *what may run concurrently* inside these
workspaces — it leans on this skill (each independent stream gets its own worktree, so the streams
never fight over files) but the partition-then-gather call is its own; `../ship/SKILL.md` closes the
branch afterwards — merge, PR, or discard, with Eric-only git authorship. This skill only *opens* the
isolation, and it touches git state only: no runtime code, nothing under `02-DOCS`.
