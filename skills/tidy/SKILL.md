---
name: tidy
description: "Use when every repository in the workspace must end synced and clean: each one on its default branch, everything pushed, everything pulled, no leftover branches or worktrees. Covers the root repo and every nested repo (child projects). Fires on 'limpia el harness', 'actualiza todo', 'sincroniza todo', 'déjalo todo en main', 'sube y baja todo', 'tidy up the repos', 'sync everything'. NOT upgrading the rsc version (that is `npx @ericrisco/rsc upgrade`), NOT opening isolation for new work (that is `worktrees`), NOT landing one finished branch (that is `ship`)."
tags: [git, sync, cleanup, branches, worktrees, limpieza, sincronizar, main]
recommends: [worktrees, ship]
profiles: [minimal, core, full]
origin: risco
---

# tidy — every repo on main, pushed, pulled, nothing left over

One request, every repository in the workspace. When it ends, each repo shows the same picture:

- the main checkout is on the **default branch**, up to date with the remote;
- **nothing local is missing from the remote** — no unpushed commit, on any branch;
- **no worktree and no branch whose work has already landed**, locally or on the remote.

The job is cleanup, and cleanup is where work gets lost. So the rule under every step: **delete only
what is proven to be in the default branch already.** Anything else is pushed, kept and reported —
never thrown away to make the picture look clean.

## 1. Find the repositories

The workspace root, plus every nested git repository below it (child projects keep their own git):

```bash
git rev-parse --show-toplevel                          # the root repo, if any
find . -name .git -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.worktrees/*'
```

A `.git` that is a *file* is a linked worktree or a submodule, not a repo of its own: skip it here,
it is handled from its parent in step 4. Name the list in one line before touching anything.

**Never change the working directory into a child repo.** Use `git -C <repo>` and absolute paths.
Session hooks take the cwd as the project, and a `cd` plants state inside the child.

## 2. Read everything before changing anything

Per repo, one pass, no writes except the fetch:

```bash
git -C <repo> fetch --all --prune --quiet
git -C <repo> symbolic-ref --short refs/remotes/origin/HEAD     # the default branch (origin/main)
git -C <repo> status --short --branch                           # current branch, ahead/behind, dirty
git -C <repo> for-each-ref --format='%(refname:short) %(upstream:short) %(upstream:track)' refs/heads
git -C <repo> worktree list --porcelain
git -C <repo> stash list
gh pr list --state open --json number,headRefName 2>/dev/null   # open PRs, when gh is there
```

No remote at all → the repo cannot be "pushed"; report it and only tidy what is local.

## 3. Classify every item

Each branch, worktree and remote branch lands in exactly one row. Decide by the commands, not by
reading names.

| Item | Proof | Action |
| --- | --- | --- |
| Worktree whose work landed | `npx @ericrisco/rsc worktrees` calls it safe | `npx @ericrisco/rsc worktrees reap` |
| Worktree whose directory is gone | `prunable` in the porcelain list | `git -C <repo> worktree prune` |
| Worktree with live or unsaved work | anything the reaper refuses | keep; report the reaper's reason |
| Local branch merged into the default | `merge-base --is-ancestor <b> origin/<default>` | `git branch -d <b>` |
| Local branch squash-merged | its content is in the default (below) | `git branch -D <b>`, tip SHA in the report |
| Local branch with unlanded commits | neither of the two above | push it (`git push -u origin <b>`), keep it |
| Remote branch whose content landed | same content check, against `origin/<b>` | delete it, after one confirmation (step 6) |
| Remote branch with an open PR | `gh pr list` | keep; it is live |
| Remote branch unlanded, no PR | not in the default, no PR | keep; report it as an open question |
| Stash | any | keep; report it. Never `stash drop` without a yes |

**The content check** (what makes a squash merge count as landed): merge the branch into the default
in memory and see whether anything changes.

```bash
git -C <repo> merge-tree --write-tree origin/<default> <branch> | head -1   # resulting tree
git -C <repo> rev-parse origin/<default>^{tree}                             # default's tree
```

Same tree → the branch adds nothing; it has landed. A conflict, a different tree, or a git older
than 2.38 (no `--write-tree`) → **not proven**, so it is kept. A branch that never carried a commit
of its own is a live workspace someone just opened, not leftovers: keep it.

Never delete the default branch, the current branch of another checkout, or `rsc/knowledge`.

## 4. Act, in this order

1. **Uncommitted changes stop that repo.** Show the files and ask once: commit them, stash them, or
   leave the repo as is. Never commit or discard someone's work in progress on your own. Another
   session working in that checkout (the isolation notice says so) → do not touch its branch or its
   files at all; report it.
2. **Push what is only local.** Every branch with unlanded commits goes to the remote. The default
   branch ahead of `origin`: push it if the default branch is open here; if it is protected
   (branches and PRs), move those commits to a branch and open a PR — ask first.
3. **Retire what landed.** `npx @ericrisco/rsc worktrees reap` for worktrees (it refuses anything
   that would lose a file, and its refusal stands), `worktree prune`, then the branches from step 3.
   Without rsc in that repo, follow the manual path in `../worktrees/SKILL.md`.
4. **Back to the default and pull.** Clean checkout on another branch whose work is pushed →
   `git -C <repo> switch <default>`. Then `git -C <repo> pull --ff-only`. A pull that cannot
   fast-forward means the local default diverged: stop and report, never `reset --hard`.

## 5. What is never done

- `reset --hard`, `clean -fdx`, `push --force`, `worktree remove --force`, `stash drop` or `clear` —
  not to make the picture tidy, not on a "probably fine".
- Deleting a branch or worktree because its name looks old. Only the proofs in step 3 count.
- Committing straight to a protected default branch.

## 6. Remote branches: one confirmation, for all of them

Deleting a remote branch reaches everyone who clones the repo. Collect every remote branch whose
content landed, across all repos, and ask **once** with the full list:

> Remote branches already in main, to delete: `rsc-harness: feat/x, fix/y` · `rsc-brain: feat/z`.
> ¿Las borro? (sí/no)

On yes: `git -C <repo> push origin --delete <b> ...`. On no: keep them and say so in the report.

## 7. The report

One table, one row per repo, then the open questions. Only facts you observed in this run.

| Repo | Branch | ↑ / ↓ | Worktrees | Local branches | Remote branches | Pending |
| --- | --- | --- | --- | --- | --- | --- |
| rsc-harness | main | 0 / 0 | 0 | 0 | 2 deleted | — |
| rsc-brain | main | 0 / 0 | 1 kept | 1 pushed | — | `feat/z`: live, no PR |

Under it: every deleted squash-merged branch with its tip SHA (it can be brought back with
`git branch <name> <sha>`), and every item kept with the one action that would close it. A repo that
is not fully clean is reported as not clean, with the reason; a tidy-looking summary that hides one
kept item is the failure this skill exists to prevent.

## Anti-patterns → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "It's an old branch, nobody uses it" | Age proves nothing. Ancestor or same tree, or it stays. |
| "Squash-merged, so `-D` is fine without checking" | Check the tree first. A branch with one extra commit after the PR looks identical by name. |
| "The tree is dirty, I'll stash it to switch to main" | That is someone's work. Ask first; a stash is easy to forget for ever. |
| "Pull failed, I'll `reset --hard origin/main`" | That throws away local commits. Report the divergence instead. |
| "I'll `cd` into each child to run git" | `git -C <repo>`. A `cd` plants session state inside the child. |
| "I'll delete the remote branches as I go" | One list, one confirmation, at the end. |
| "Report says clean; the kept worktree is a detail" | Say what was kept and why. The report is the deliverable. |

**Next:** after a clean report there is nothing to hand over. Neighbours: `../worktrees/SKILL.md`
opens isolation for new work; `../ship/SKILL.md` lands one finished branch; `npx @ericrisco/rsc
upgrade` updates the harness itself, which is a different "actualiza".

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
