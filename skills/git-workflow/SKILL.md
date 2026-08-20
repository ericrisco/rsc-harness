---
name: git-workflow
description: "Use when naming or scoping a branch, writing or fixing a commit message, picking the gitmoji for a commit, untangling history (rebase versus merge versus squash), or cutting a versioned release — the portable git-convention layer for any repo. Covers gitmoji + Conventional Commits, SemVer tags, branch hygiene, force-push safety and gh pr/release mechanics. NOT the land-it decision and pre-ship checklist (that is `ship`), NOT an isolated checkout before coding (that is `worktrees`), NOT CI/CD release automation (that is `deployment`)."
tags: [git, version-control, conventional-commits, gitmoji, semver, pull-request]
recommends: [ship, worktrees, deployment, github-actions]
origin: risco
---

# git-workflow — the grammar and hygiene of version control

Git history is a message to the next human who reads `git log`, runs `git blame` on a broken line,
or bisects a regression at 2am. That human is usually future-you. **Every rule in this skill exists
to make the next reader's job faster**, not to make this moment cheaper. A repo with legible branch
names, conventional commits, and a clean linear narrative is a repo you can reason about; a repo with
`wip`, `fix stuff`, and force-pushed shared history is one you fight.

This is the **portable convention layer**. It is independent of any SDD phase or CI platform — it is
the grammar that `../ship/SKILL.md`, `../worktrees/SKILL.md`, and `../deployment/SKILL.md` all lean on.
It does not decide *whether to land* the work (that is ship) and it does not automate releases in a
pipeline (that is deployment). It tells you how to name, commit, untangle, and tag — correctly.

## Branch naming

Name a branch from its *intent*, prefixed by its kind, as a kebab-case slug. Keep it short-lived:
hours to days, not weeks. Long branches drift from `main` and turn into merge pain.

| Prefix       | Use for                                      | Why                                              |
|--------------|----------------------------------------------|--------------------------------------------------|
| `feat/`      | a new capability                             | matches the `feat` commit type; signals a MINOR  |
| `fix/`       | a bug fix                                     | matches `fix`; signals a PATCH                    |
| `hotfix/`    | an urgent fix landing straight to production  | flags "skip the slow path" to reviewers          |
| `chore/`     | tooling, deps, config — no product behavior  | keeps non-feature noise out of the feature log   |
| `docs/`      | documentation only                            | reviewers can fast-track, no test gate needed    |
| `refactor/`  | restructure without behavior change           | sets the expectation: tests stay green, no new behavior |

Slug rules: derive it from the issue title or the one-sentence intent, lowercase, dash-separated, no
spaces or `/` inside the slug. Optionally suffix the issue number.

```text
Bad   my-stuff            (kind unknown, intent unknown)
Bad   eric-branch-2       (names the author and a counter, not the work)
Good  feat/oauth-pkce-flow
Good  fix/expired-refresh-token-401
Good  chore/bump-node-22
```

## Commit grammar — gitmoji + Conventional Commits

Write every commit to **Conventional Commits 1.0.0**, opened by a **gitmoji**. The structure:

```text
<gitmoji> type(scope)!: subject

body — what changed and why, wrapped, optional

BREAKING CHANGE: description of the incompatible change
Fixes #123
```

- The **gitmoji is mandatory** and comes first — the intention of the change, readable in one glyph
  when you scan `git log --oneline`. `type` is what tooling reads; the emoji is what humans read.
- `type` is mandatory. `scope` in parentheses is optional. `!` before the colon marks a breaking change.
- Subject: imperative mood ("add", not "added"/"adds"), ≤72 chars, no trailing period.
- Body explains *why*, not *what the diff already shows*. Separate from subject by a blank line.
- Footers go last. `Fixes #123` / `Closes #123` in the body auto-closes that issue when the PR merges.

Type → SemVer effect:

| Type                              | SemVer bump | Notes                                              |
|-----------------------------------|-------------|----------------------------------------------------|
| `feat`                            | MINOR       | a new capability                                   |
| `fix`                             | PATCH       | a bug fix                                           |
| `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`, `style`, `revert` | none | allowed, but no implicit version bump              |
| any type with `!` or a `BREAKING CHANGE:` footer | **MAJOR** | overrides the above regardless of type             |

`BREAKING CHANGE` **must be uppercase** in the footer; the type/scope units are case-insensitive but
write them lowercase by convention.

Type → gitmoji, the everyday set (the full 75-emoji table, and *why* the emoji never replaces the
type, are in **`references/gitmoji.md`**):

| Type       | gitmoji | Type       | gitmoji | Type      | gitmoji |
|------------|---------|------------|---------|-----------|---------|
| `feat`     | ✨      | `refactor` | ♻️      | `build`   | 📦️      |
| `fix`      | 🐛      | `test`     | ✅      | `style`   | 🎨      |
| `docs`     | 📝      | `perf`     | ⚡️      | `revert`  | ⏪️      |
| `chore`    | 🔧      | `ci`       | 👷      | breaking  | 💥      |

Pick by **intention**, not by which file changed, and prefer the specific one: 🚑️ for a production
hotfix, 🩹 for a trivial non-critical fix, 🔥 for a deletion, 🚚 for a rename, ⬆️ for a dep bump,
🔖 for a release commit.

```text
Bad   fix stuff
Bad   updates
Bad   Fixed the login bug.            (past tense, capitalized, trailing period)
Bad   fix(auth): reject expired refresh tokens        (no gitmoji)
Bad   ✨ added a search endpoint                       (gitmoji but no type → no derivable bump)
Good  🐛 fix(auth): reject expired refresh tokens
Good  ✨ feat(api): add /v2/search endpoint with cursor paging
Good  ♻️ refactor(parser): extract token scanner, no behavior change
```

A breaking change, both forms equivalent:

```text
💥 feat(api)!: drop the legacy /v1 search endpoint

BREAKING CHANGE: /v1/search is removed; callers must migrate to /v2/search.
```

If the repo runs a **strict** conventional parser (commitlint, semantic-release) it anchors the type
at position 0 and rejects the emoji prefix. Either widen its `headerPattern` — the config is in
`references/gitmoji.md` — or move the emoji behind the header (`feat(api): ✨ add cursor paging`),
which every parser accepts. Both forms satisfy this convention; dropping the gitmoji does not.

**Authorship is always Eric.** Never add a `Co-Authored-By: Claude` trailer, never a
"Generated with" footer, never any line crediting an AI tool — in a commit *or* a PR body. The work
is Eric's; the agent is a tool, like the compiler.

## History hygiene — rebase, merge, or squash?

Decide by who else has the commits. The lease rule below is non-negotiable.

| Situation                                            | Do this                                              | Why                                                        |
|------------------------------------------------------|------------------------------------------------------|------------------------------------------------------------|
| Private branch, only you have it, want linear history | `git rebase main`, then `git push --force-with-lease`| rebase rewrites hashes; safe because nobody built on them  |
| Branch others have pulled / built on                  | `git merge main` — **never** rebase it               | rebase changes every hash; collaborators' work diverges    |
| Noisy PR (many `wip` commits)                         | squash-merge into one gitmoji + conventional commit            | `main` gets one meaningful entry, not 9 scratch commits    |
| Already pushed, shared, *and* you rewrote it          | **STOP** — coordinate, or `git revert` instead       | force-pushing shared history breaks everyone downstream     |

After a rebase, push with `--force-with-lease`, never bare `--force`:

```bash
git push --force-with-lease   # refuses if the remote moved since you fetched — catches a teammate's push
git push --force              # blindly overwrites — can erase a teammate's commits
```

The interactive cleanup loop (`rebase -i`, `fixup`/`squash`/`reword`/`drop`, `--autosquash`,
the conflict→continue cycle, and recovery via `git reflog`) is a long branchy procedure — see
**`references/interactive-rebase.md`** rather than reaching for it on every commit.

## Releases

Derive the version bump from the commit log, never by guessing. Scan the commits since the last tag:

- any `BREAKING CHANGE:` / `!` → **MAJOR** (`v1.4.2` → `v2.0.0`)
- otherwise any `feat:` → **MINOR** (`v1.4.2` → `v1.5.0`)
- otherwise only `fix:`/others → **PATCH** (`v1.4.2` → `v1.4.3`)

Tag with the `vMAJOR.MINOR.PATCH` form, annotated, then create the release with auto-generated notes:

```bash
git tag -a v2.0.0 -m "v2.0.0"
git push origin v2.0.0
gh release create v2.0.0 --generate-notes              # notes via the GitHub Release Notes API
gh release create v2.0.0 --generate-notes --draft      # stage notes, publish later
gh release create v2.0.0-rc.1 --generate-notes --prerelease
```

GitHub auto-assigns the "latest" label by semver order unless you set it. With release immutability
enabled, **a published release's tag cannot be edited or deleted** — get the version right before you
publish.

```text
Bad   added a feature + a breaking config change, tagged v1.5.0   (breaking change → must be MAJOR)
Good  same changes → v2.0.0, bump derived from the BREAKING CHANGE footer in the log
```

Automating any of this on tag push (a `release.yml` workflow, OIDC to a registry) is **deployment** —
see `../deployment/SKILL.md`. This skill covers the manual/local release act.

## PR mechanics — then hand off to ship

Open the PR with autofilled title/body from the commits, against the right base:

```bash
gh pr create --fill --base main          # title/body from commits; --base falls back to repo default
```

Put `Fixes #123` in the body to link and auto-close the issue on merge. A PR body should let the
reviewer understand the change without reading every line of the diff.

The **decision to land** — direct-merge vs PR vs park, the pre-ship safety checklist, the actual
merge — belongs to `../ship/SKILL.md`. This skill only makes the branch, commits, and PR body clean
enough to hand over. Setting up the isolated checkout *before* you start coding is
`../worktrees/SKILL.md`.

## Anti-patterns

| Anti-pattern                                          | Why it hurts                                              | Instead                                              |
|-------------------------------------------------------|-----------------------------------------------------------|------------------------------------------------------|
| `git push --force` on a shared branch                 | silently erases teammates' commits                        | `--force-with-lease`, or don't rewrite shared history |
| `git commit -m "wip"` / `"fix"` / `"updates"`         | the log carries zero signal for the next reader           | `<gitmoji> type(scope): imperative subject`           |
| Commit message with no gitmoji                         | `git log --oneline` reads as a wall of undifferentiated text | pick the intention's emoji (`references/gitmoji.md`) |
| Mixing unrelated changes in one commit                | can't revert or review one concern in isolation           | one logical change per commit                         |
| Long-lived branch (weeks)                             | diverges from `main`, merge becomes a battle              | short-lived; rebase or merge `main` in often          |
| Hand-computing the semver bump                        | breaking change shipped as a MINOR → broken downstream    | derive the bump from the commit log                   |
| Rebasing a public/shared branch                       | rewrites hashes others built on                           | merge shared branches; rebase only private ones       |
| Committing generated/secret files                     | leaks credentials, bloats history irreversibly            | `.gitignore`; rotate any secret that slipped in       |
| `BREAKING CHANGE` lowercase                            | tooling won't detect it → wrong (too-low) bump            | uppercase `BREAKING CHANGE:` in the footer            |
| PR with no description                                | reviewer reverse-engineers intent from the diff           | `--fill` plus a why, link the issue                   |
| Tagging a release with no notes                       | users can't tell what changed                             | `gh release create --generate-notes`                  |
| `Co-Authored-By: Claude` / "Generated with" footer    | forges authorship onto a tool                             | author is always Eric; no AI attribution              |

## Checklist — before a PR or a release

- [ ] Working tree clean (`git status`), no stray or generated files staged.
- [ ] Branch rebased on / merged with current `main`; no avoidable conflicts.
- [ ] Every commit carries its gitmoji **and** a conventional header; `wip`/scratch commits squashed away.
- [ ] No secrets, no AI-attribution trailers.
- [ ] PR body explains the why and links the issue (`Fixes #`).
- [ ] (Release) version bump **derived from the commit log**, tag is `vX.Y.Z`, annotated.
- [ ] (Release) `gh release create vX.Y.Z --generate-notes`; version confirmed before publishing (immutable once published).
