---
name: github-actions
description: "Use when authoring or fixing GitHub Actions CI/CD — workflows under .github/workflows, triggers, job matrix, caching, token permissions, OIDC cloud deploys, environment gates, reusable workflows. NOT the Dockerfile or image build strategy (that is `docker`), NOT the branching model (that is `git-workflow`), NOT release readiness (that is `ship`)."
tags: [github-actions, ci-cd, workflows, oidc, caching]
recommends: [docker, git-workflow, ship, deployment, secure-coding, aws-essentials, vercel]
origin: risco
---

# GitHub Actions CI/CD

A workflow is config that runs on an event. Before you write a single step, decide three things: **which events** fire the workflow, **what permissions** the token needs, and **where credentials come from**. Get those wrong and you have a fast pipeline that leaks secrets or a secure one nobody can trigger. Everything after that — checkout, install, test, build — is just steps.

This skill owns the workflow layer — the `.github/workflows/*.yml` files, their triggers, jobs, matrix, caching, secret/OIDC handling, environments and deploy gates. Route the rest out:

| Not this skill | Goes to | Because |
| --- | --- | --- |
| The `Dockerfile`, image build strategy | `../docker/SKILL.md` | The workflow may *call* `docker build`; designing the image is not this skill. |
| Branching model, PR hygiene, merge vs rebase, commit conventions | `../git-workflow/SKILL.md` | That is the source-control model, not the CI config layer. |
| Release readiness checklist, changelog, the shipping decision | `../ship/SKILL.md` | Whether to release is a decision; this skill only automates the mechanics. |
| Blue/green, canary, rollback *theory* | `../deployment/SKILL.md` | Actions triggers the deploy; the strategy is deployment's. |
| Choosing the host and its deploy primitives | `../vercel/SKILL.md`, `../aws-essentials/SKILL.md` | Actions *triggers* the deploy; the host owns the target. |
| Triaging SAST/CVE findings, threat modeling | `../secure-coding/SKILL.md` | This skill runs a scanner *as a job*; it does not interpret the report. |

## Decide the trigger first

Pick the event(s) for each job class before writing YAML — the trigger decides what context and secrets the run gets.

| Event | Use it for | Why |
| --- | --- | --- |
| `pull_request` | lint, test, build-check | Runs on the merge ref; from forks it gets **no secrets** (safe). |
| `push` (to `main`) | deploy, publish artifacts, build the release | The trusted ref with full secrets/OIDC. |
| `workflow_dispatch` | manual ops, one-off backfills, manual deploys | Human-triggered with inputs; auditable. |
| `schedule` (cron) | nightly builds, dependency audits, cache warmers | Cron in UTC; no human in the loop. |
| `release` / `push` tags | publish to a registry, cut a GitHub Release | Fires on the tag, not every commit. |
| `workflow_call` | reusable workflow invoked by others | Library of jobs; never runs on its own. |
| `pull_request_target` | label/comment bots that need write on forks | **Runs trusted with secrets** — never check out PR head here. |

Do **not** run the same heavy job on both `push` and `pull_request` for the same commit — you pay runner minutes twice. Use `pull_request` for the checks and a separate `push: branches: [main]` job for deploy.

## Anatomy of a CI workflow

The minimal good CI: scoped trigger, read-only token, concurrency that cancels stale PR runs, built-in cache.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read            # least privilege; widen per-job only when needed

concurrency:
  group: ci-${{ github.ref }}      # one run per branch/PR
  cancel-in-progress: true         # newer push kills the stale run (PR feedback)

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6        # first-party, current major
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm                     # built-in lockfile-keyed cache
      - run: npm ci                       # not install — fails on a stale lockfile, reproducible
      - run: npm run lint
      - run: npm test
```

Why those three lines are not optional:
- `permissions: contents: read` at the top — **default token permissions may be write**, and a leaked write token can push tags or publish packages. Widen per job and only to what that job needs (`packages: write` to publish, `id-token: write` for OIDC), never at the top.
- `concurrency` + `cancel-in-progress: true` — without it every push to an open PR leaves the old run finishing and billing. One group per ref keeps at most one running + one pending.
- `actions/checkout@v6`, `setup-node@v6` are the current majors (checkout v6.0.2, setup-node v6.4.0). Old majors run on Node 20, removed from runners in **September 2026**; JS actions are forced onto **Node 24** by default since June 2026.

## Caching

Two mechanisms, in order of preference:

1. **Built-in `cache:` on `setup-*`** — `setup-node`, `setup-python`, `setup-go`, etc. cache the package manager's store keyed on the lockfile. Free, one line. Use it.
2. **`actions/cache@v4`** — for anything else (build output, custom tool dirs, compiled artifacts).

The cache key is the whole game. A cache is **immutable once written for a key** — if your key never changes, you cache stale deps forever.

```yaml
# Bad — fixed key never invalidates; you restore yesterday's broken node_modules forever
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-cache

# Good — key changes when the lockfile changes; restore-keys gives a warm partial hit
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

`restore-keys` is a prefix fallback: an exact-key miss still restores the most recent cache whose key starts with the prefix, so a one-package change does not cold-start. Monorepo keys, Docker layer caching (`type=gha`), and runner-minute cost tradeoffs live in `references/caching-and-matrix.md`.

## Matrix

Run one job definition across combinations — OS x version is the common case.

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false            # see all combos' results, not just the first failure
      max-parallel: 4
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [20, 22, 24]
        exclude:
          - os: macos-latest      # don't pay the macOS multiplier on every version
            node: 20
        include:
          - os: ubuntu-latest     # one extra cell: lint only on the canonical combo
            node: 24
            lint: true
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: "${{ matrix.node }}", cache: npm }
      - run: npm ci && npm test
```

Set `fail-fast: false` when you want every combination's verdict (a compatibility matrix); leave it `true` (default) when one failure should abort the rest to save minutes. macOS and Windows runners bill at a multiple of Linux minutes — `exclude` the cells you do not need.

## Secrets and OIDC — the security heart

The rule: **no long-lived cloud keys in repo secrets.** Use OIDC. GitHub mints a short-lived JWT per run; AWS/Azure/GCP exchange it for a token scoped to that job, valid for minutes. Nothing static to steal — by 2026, static CI credentials are a compliance violation in regulated orgs.

```yaml
# Bad — static AWS keys live in the repo forever; one leak = standing access
- uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

# Good — OIDC: no stored keys, the role is assumed for this run only
permissions:
  id-token: write       # required for GitHub to mint the OIDC JWT
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@<full-40-char-sha>
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gh-deploy
      aws-region: eu-west-1
```

Hard rules:
- **Never `echo` a secret** or pass it to an untrusted step. Secrets are masked in logs, but a third-party action or a crafted `printf` can exfiltrate them.
- **Scope the cloud trust to repo + ref (+ environment).** The common 2026 misconfig is a trust policy with `repo:ORG/*` — that lets *any* repo in the org assume your prod role. Scope `sub` to `repo:ORG/REPO:ref:refs/heads/main` or `environment:production`.
- **Gate prod with an `environment` + required reviewers** so a human approves before the deploy job runs.

Per-cloud trust setup (AWS role, GCP Workload Identity Federation, Azure federated credentials), the over-permissioned-trust footgun, and a full deploy-on-tag workflow with approval are in `references/oidc-deploys.md`.

## Supply chain and least privilege

- **SHA-pin third-party actions to a full 40-char commit SHA, not a tag.** Tags are mutable: the **tj-actions/changed-files compromise (2025)** retargeted *all* tags to malicious code that dumped secrets. A SHA is the only immutable reference. GitHub now offers repo/org/enterprise policy to *enforce* full-SHA pinning across the whole tree.

  ```yaml
  # Bad — mutable tag; whoever controls the repo can repoint v1 at anything
  - uses: some-org/some-action@v1
  # Good — immutable, with a comment recording the human-readable version
  - uses: some-org/some-action@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0  # v1.4.2
  ```

  First-party `actions/*` and `github/*` may stay on a major tag (GitHub controls them), but pinning everything is the stronger posture.
- **`pull_request_target` + checking out the PR head = remote code execution with your secrets.** That trigger runs in the *base* repo's trusted context. If you then `checkout` `github.event.pull_request.head.sha`, you execute a fork's code with full secret access. Never combine them.

## Reuse: workflow vs composite action

Both kill copy-paste; pick by scope.

| You need to reuse... | Use | Note |
| --- | --- | --- |
| whole jobs with their own `runs-on` / `services` / matrix | reusable workflow (`on: workflow_call`) | `secrets: inherit` to forward; set `concurrency` *inside* it. |
| a set of steps that run inside one existing job | composite action | Lives at `.github/actions/<name>/action.yml`. |

```yaml
# caller — reuse a whole job
jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    secrets: inherit
```

Gotcha: `concurrency` on the job that *calls* a reusable workflow does not behave as you expect — declare it inside the called workflow.

## Deploy job pattern

A deploy depends on the build, gets its own environment gate, and must **never** be cancelled mid-release.

```yaml
deploy:
  needs: build              # only deploy a green build
  runs-on: ubuntu-latest
  environment: production   # required-reviewer gate lives on the environment
  concurrency:
    group: deploy-production
    cancel-in-progress: false   # NEVER interrupt a release
  permissions:
    id-token: write
    contents: read
  steps:
    - uses: actions/checkout@v6
    - uses: aws-actions/configure-aws-credentials@<full-40-char-sha>
      with:
        role-to-assume: arn:aws:iam::123456789012:role/gh-deploy
        aws-region: eu-west-1
    - run: ./scripts/deploy.sh
```

`cancel-in-progress: false` here is the opposite of the CI default: cancelling a half-finished deploy can leave prod in a broken state.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Third-party action pinned to a tag (`@v1`) | tj-actions 2025: tags got repointed to secret-stealing code | Pin to a full 40-char SHA, comment the version |
| `permissions: write-all` or no `permissions:` block | Default token may be write; a leak can push/publish | Top-level `contents: read`, widen per job |
| Static cloud keys in repo secrets | Standing credentials; one leak = lasting access | OIDC `id-token: write` + `role-to-assume` |
| OIDC trust scoped to `repo:ORG/*` | Any org repo can assume your prod role | Scope `sub` to repo + ref + environment |
| No `concurrency` block | PR runs pile up and bill; deploys race | `cancel-in-progress: true` for CI, `false` for deploy |
| Cache key with no lockfile hash | Restores stale deps forever (immutable per key) | `key: ...-${{ hashFiles('**/lock') }}` + restore-keys |
| `pull_request_target` + checkout PR head | Runs fork code with your secrets (RCE) | Use `pull_request`; never check out untrusted head with secrets |
| Same heavy job on `push` **and** `pull_request` | Double-bills runner minutes per commit | `pull_request` for checks, `push: [main]` for deploy |
| `echo`-ing a secret to debug | Crafted steps/actions exfiltrate the masked value | Never print secrets; use OIDC short-lived tokens |

## Verify

After writing or editing workflows, run the static check on the repo:

```bash
skills/github-actions/scripts/verify.sh .
```

It globs `.github/workflows/*.{yml,yaml}`, runs `actionlint` if present, and independently flags unpinned third-party actions, missing `permissions:`, an OIDC nudge for jobs using cloud secrets, and the `pull_request_target` + PR-head footgun. It exits non-zero only on a hard error, so it works as a CI gate.
