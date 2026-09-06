<div align="center">

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/og.png" alt="rsc — your agent needs a memory (02-DOCS/, or it invents what it cannot remember), arms (01-TOOLS/, or it never touches your database), a trade (272 skills, or it guesses how the job is done), and reflexes (deterministic hooks, or it forgets the rule mid-session). One meta-harness for 17 coding assistants." width="960">

# `rsc` — 272 skills, 33 agents, one CLI

[![npm](https://img.shields.io/npm/v/@ericrisco/rsc?color=63d68a&labelColor=12161c&label=npm)](https://www.npmjs.com/package/@ericrisco/rsc)
[![downloads](https://img.shields.io/npm/dm/@ericrisco/rsc?color=63d68a&labelColor=12161c&label=downloads)](https://www.npmjs.com/package/@ericrisco/rsc)
[![skills](https://img.shields.io/badge/skills-272-63d68a?labelColor=12161c)](#the-catalog)
[![license](https://img.shields.io/badge/license-MIT-63d68a?labelColor=12161c)](LICENSE)
[![stars](https://img.shields.io/github/stars/ericrisco/rsc-harness?color=63d68a&labelColor=12161c)](https://github.com/ericrisco/rsc-harness/stargazers)

**A self-recommending skill catalog for 17 coding assistants** — Claude Code,
Codex, GitHub Copilot, Cursor, Gemini, Windsurf, Cline, Antigravity, Zed and more.
Describe what you want in plain language. It reads your repo, installs *only* the
skills that fit — one at a time — into every assistant you pick, and keeps them
equipped as you work.

From *"document my company"* to *"ship a FastAPI service"* to *"grow my YouTube
channel"* — **272 skills across 23 domains**, every one researched against live
2025-2026 sources and **adversarially scored ≥ 8.5/10** before it shipped.

```bash
npx @ericrisco/rsc@latest onboard   # interview → exact plan → explicit acceptance → verified install
```

<br>

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/meta-harness.png" alt="rsc — the model (Claude, GPT, Gemini) is the brain your coding agent rents, and you already have that. Claude Code, Codex and opencode sit in the middle. Below them the rsc meta-harness adds everything the model lacks: memory (02-DOCS/) so it stops inventing, arms (01-TOOLS/) so it can execute, a trade (272 skills) so it stops guessing, and reflexes (deterministic hooks) so it cannot forget the rule mid-session." width="960">

**The model is the only part your agent already has.** `rsc` is the meta-harness that adds
the rest: a **memory** so it stops inventing, **arms** so it can execute, a **trade** so it stops
guessing, and **reflexes** so it cannot forget the rule mid-session — into whichever assistant
you already use, and kept in sync as you work.

</div>

---

## 🤖 For agents: "install this harness"

If you're an AI coding agent (Claude Code, Cursor, Copilot, Codex, Gemini…) and your user
asked you to **install rsc / this harness / these skills**, run this in the **root of the
project they're equipping** — not inside a clone of this repo (see the note under *Install*):

```bash
npx @ericrisco/rsc@latest onboard
```

That launches the binding plain-language onboarding. It asks the user for technical level,
accompaniment, project kind and goal **before it writes anything**, reads only the selected project
root, and shows every selected or deferred skill, agent and hook with its reason. Relay those
questions to the user; never invent or default their answers. The first pass writes nothing and
prints a SHA-256 plan id. Only rerun with `--accept-plan <id>` after the user accepts that exact plan.

For a non-interactive agent, collect the answers and preview the same plan explicitly:

```bash
npx @ericrisco/rsc@latest onboard --technical-level mixed --accompaniment L1 \
  --project-kind software --goal "small compound-interest website" \
  --software-scope small --target codex
# After the user accepts the printed plan:
npx @ericrisco/rsc@latest onboard <same-answers> --accept-plan <printed-id>
```

- **Choose assistants non-interactively:** add `--target claude` (comma-separate for several) to `onboard`.
- **Two assistants already installed?** rsc asks instead of guessing. `--target` settles it in one word.
- **Already installed, just refreshing skills + hooks:** `rsc sync` (or re-run the command above).
- **Add one skill by id:** `rsc add <id>` · **browse the catalog:** `rsc consult "<what you want>"` or `rsc list`.

From then on it's self-driving: `rsc-suggest` proposes the next skill as tasks appear, and in
Claude Code a hook re-asserts the spec-first **new-feature gate** on every turn — so a feature
request routes through `specify` before any skill writes code.

---

## Why this exists

Most skill packs dump hundreds of files into your context and call it a day. This
one is the opposite bet:

- **Granular by default.** The unit of installation is *one skill*. Install
  `fastapi` without ever pulling `go`. Nothing you don't use touches your context.
- **Self-recommending.** Both the terminal (`rsc consult`) and the chat
  (`rsc-suggest`, an always-on detector) watch what you're doing and propose the
  *next* skill the moment a task needs it — a one-word confirm installs it.
- **Not code-only.** First-class support for running a *company*: bookkeeping,
  invoicing, hiring, GDPR, pitch decks, SEO, a YouTube/TikTok/LinkedIn presence —
  each wired to a `02-DOCS/` knowledge loop that learns from your own results.
- **Specialists follow the stack.** The four base agents stay small; installing a
  supported stack adds only its reviewer and build resolver. `rsc add go`, for
  example, adds the Go pair without pulling reviewers for every other language.
- **A new local session continues the old one.** Claude Code, Codex, Gemini CLI
  and OpenCode load a bounded checkpoint for the current branch and worktree at
  session start. Cursor desktop uses an assisted read-before-action fallback.
- **Honestly good.** Every skill was built by a research → spec → implement →
  *adversarial review* pipeline and had to clear an objective rubric
  (`scripts/skill-rubric.md`, written *before* any skill existed). The bar was
  real: skills that scored 8.0 were sent back and fixed, not waved through.

`skills/<name>/` is the single source of truth. There are no bundles to argue
over: you start with a tiny floor and grow one piece at a time.

---

## New sessions pick up the latest local work

On supported local targets, rsc checkpoints observable repository state at safe
boundaries: branch, worktree, HEAD, changed paths, commits and SDD ledger status.
When a new session opens in the same checkout, that state is injected before the
first agent action. A completed edit is preserved even if the previous client
closed before its normal session-end event.

- **Full:** Claude Code, Codex, Gemini CLI and OpenCode. Codex asks you to inspect
  and trust the project hook once with `/hooks`; until then `doctor` reports that
  trust is still required.
- **Assisted:** Cursor desktop. Its start hook is fire-and-forget, so rsc also
  installs a local always-on rule that performs the read before acting.
- **Never cloud:** Cursor Cloud, Codex Cloud, remote agents, cloud storage and
  synchronization are intentionally unsupported. The memory runtime makes no
  network request.

The journal never stores prompts, responses, tool output, file contents or
secrets. It stays in a git-excluded project-local path, retains 30 days, and
injects at most 4,096 bytes. Disable every memory surface for a project with
`rsc memory off`; re-enable it with `rsc memory on`.

---

## Install

```bash
npx @ericrisco/rsc@latest onboard
```

Prefer the short `rsc` command? Install once, globally:

```bash
npm install -g @ericrisco/rsc   # then just: rsc
```

Run it inside any project and describe what you want. Working on the catalog
itself? Clone and link:

```bash
git clone https://github.com/ericrisco/rsc-harness.git ~/rsc-skills
cd ~/rsc-skills && npm install && npm link
```

> **Run it inside the project you're equipping — not inside this repo.** The
> catalog's own `package.json` is named `@ericrisco/rsc`, so `npx @ericrisco/rsc`
> *from within a `rsc-harness` clone* resolves to the local (unlinked) bin and
> dies with `sh: rsc: command not found`. Working on the catalog itself? Use
> `node scripts/rsc.js …`, the `npm link` above, or pin the published build with
> `npx @ericrisco/rsc@latest …`.

The first run asks **how technical the conversation should be**, the accompaniment level, what the
project is for, its goal and the assistants to target. It then presents the complete plan. A small
website can defer SDD, agents and code guards; an operations harness does not receive them merely
because it lives in a repository. Deferred components record the evidence that would make rsc
recommend them later. `rsc reassess` reports that evidence but still cannot install anything
without a newly accepted plan.

Everything stays **in the project**, and the real skill files are written
**once** to `.rsc/skills/<id>/`. Each assistant you pick gets a lightweight
symlink back to that shared base — no copy is duplicated across IDEs. (If the
filesystem can't symlink, it falls back to a real copy automatically.)
On targets with file-based agents, the four base agents are installed too;
stack specialists remain selective. Native command targets receive only entry
points whose backing skill, agent or local-memory capability actually exists.

---

## 30-second tour

```
$ rsc onboard
 ██████╗ ███████╗ ██████╗     ← animated gradient wordmark
 ██╔══██╗██╔════╝██╔════╝
 ██████╔╝███████╗██║
  272 skills · one CLI · zero bloat

How technical should the conversation be?
How much accompaniment do you want?
What are you building or running?
What do you want this project to achieve?

RSC_ONBOARDING_PLAN
Plan id: <sha256>
Selected: …
Deferred: …
Accept this exact harness plan?
```

The terminal and chat adapters produce the same normalized answers and plan id. If project evidence
changes between preview and acceptance, rsc returns `RSC_PLAN_CHANGED` and writes nothing. After an
accepted application it verifies the receipt and managed state before printing `RSC_ONBOARDING_READY`.

---

## The CLI

Fresh projects enter through `rsc onboard`. The direct `add` and `install --profile` forms below
are maintenance controls for projects that already carry an `.rsc.json` declaration; they cannot
bypass onboarding in a new folder.

```bash
rsc onboard                         # binding plain-language onboarding (recommended)
rsc reassess                        # check persisted deferral triggers; never installs by itself
rsc add fastapi postgresdb           # install specific skills, by name
rsc add youtube-api remotion-video   # …grow a channel, edit with Remotion
rsc add fastapi --target claude,codex   # install into several assistants at once
rsc install --profile minimal        # the base: orient + suggest + bro + unslop + show-me + eli5 + harness + init
rsc install --profile core           # floor + the full SDD workflow
rsc install --profile full           # everything (all 272 skills)
rsc install --profile full --without go
rsc consult "I want to launch a SaaS"  # recommend only, no install
rsc registry refresh                 # write .rsc/skill-registry.{json,md}
rsc list                             # installed skills, agents and commands
rsc capabilities                    # installed/available surfaces + memory mode
rsc doctor                           # health, missing backing, hooks and local memory
rsc memory status                    # full / assisted / unsupported / degraded
rsc memory save --session handoff    # force a deterministic local checkpoint
rsc memory resume                    # print this branch/worktree continuation
rsc memory learn --text "…" --evidence "…" --confidence 0.8 --approve
rsc memory off                       # disable hooks, commands and injection project-wide
rsc sync --target claude,codex       # refresh managed skills/hooks from the current package version
rsc backups                          # list project-local snapshots
rsc restore latest --dry-run         # preview restoring the newest snapshot
rsc restore <snapshot-id>            # restore a project-local snapshot
rsc upgrade --dry-run                # show npm upgrade + sync commands
rsc uninstall postgresdb --dry-run   # preview a removal
```

---


## 👥 Sharing a harness with your team

The harness travels by git, but not all of it — and the split is the point.

**Commit these:**

| | |
| --- | --- |
| `.rsc.json` | The decision: which assistants, which skills, **which catalog version**, the developer tier, which gates you disarmed |
| `01-TOOLS/` · `02-DOCS/` | Your tooling and your wiki, if you use them |
| Skills and agents you wrote by hand | They are yours. rsc does not claim them, does not count them as drift, and does not touch them |

**Do not commit these** — rsc adds them to `.gitignore` for you:

| | Why |
| --- | --- |
| `.rsc/` | Machine state: hook scripts, seals, logs and fallback session memory |
| `02-DOCS/raw/worklog/.rsc-memory/` | Preferred session journal when a local wiki exists; protected with git's local exclude |
| The skill entries rsc manages | Symlinks on macOS/Linux, real copies on Windows — two incompatible shapes of one thing |

Whoever clones runs **one command** and ends up with the same harness:

```bash
npx @ericrisco/rsc@latest sync
```

Same skills, same version — `.rsc.json` pins the catalog, so a teammate who clones in three
months gets what you had, not what shipped since. Upgrading is a deliberate act, never a side
effect of rebuilding.

When someone changes the harness and you `git pull`, `rsc doctor` tells you what no longer
matches. **Nothing is ever written to your machine by a pull** — you are told, and you decide.

**Own skills.** A skill your team wrote lives in the repo and already works for whoever clones,
with no command at all. Declare it in `.rsc.json` under `ownSkills` and `doctor` will also say
when someone is missing it — that is all declaring does. rsc never installs, updates or
overwrites it: its version is the commit.


## 🩹 Something's off? One command

Recognise any of these? They are all the same fix.

| What you see | |
| --- | --- |
| `"target": "codex"` when you work in Claude Code | |
| `This target has no hook injection` and you did not expect that | |
| Skills appear that you never asked for | |
| You cloned a repo and your assistant sees no skills at all | |
| A hook seems to run several times per turn | |
| Template lines showed up inside your hand-written `AGENTS.md` | |

```bash
npx @ericrisco/rsc@latest repair
```

Safe in any folder: with no rsc there, it says so and writes nothing. It shows what it
found before touching anything, keeps a recoverable copy, and running it twice changes
nothing the second time. Add `--dry-run` to see the whole pass without a single write.

**What it fixes on its own** — putting the harness back to what was already declared:
dangling links from a clone, hooks wired several times, the 0.1 layout no assistant reads.

**What it asks about** — anything that changes a decision: moving the harness to another
assistant, or touching files you already committed.

**What it never touches:** skills and agents you wrote by hand. rsc did not install them,
so rsc does not repair, move or delete them — not even when rebuilding from scratch.

## Update

`rsc` is an npm package, so updating is two steps — bump the package, then
re-sync what's already wired into your project:

```bash
npm install -g @ericrisco/rsc@latest   # global install: pull the newest catalog
rsc sync                               # refresh managed skills + hooks (auto-detects your assistant)
```

Not sure what a bump touches? Preview the exact commands without writing anything:

```bash
rsc upgrade --dry-run                  # prints the npm install + rsc sync lines for your target
```

Running through `npx` (no global install)? There's nothing to upgrade —
`npx @ericrisco/rsc@latest` always fetches the latest published catalog; just run
`rsc sync` afterwards if the project already has skills installed.

Every sync snapshots the project first, so a bad update is always reversible:

```bash
rsc backups                            # list project-local snapshots
rsc restore latest --dry-run           # preview restoring the newest
rsc restore <snapshot-id>              # restore it
```

---

## How recommendation works

Two faces, one catalog (`manifest.json`):

- **In the terminal** — `rsc` / `rsc consult` rank the catalog against your words
  (multilingual TF-IDF blended with exact tag/id weights and intent synonyms), merge that with what they
  detect in your repo, and expand via each skill's `recommends`.
- **In the chat** — `rsc-suggest` is a tiny always-on skill. When a task would
  benefit from a skill you don't have, it names it and (one-word confirm) runs
  `rsc add <id>` for you. It's the floor — installed with every profile.

Repo detection maps real signals to skills: `package.json` + `next` → `nextjs`;
`go.mod` → `go`; `pyproject.toml` → `fastapi`; `*.sql`/`prisma/` → `postgresdb`;
`Dockerfile`/`.github/` → `docker`/`github-actions`; and so on. An empty repo
just asks in plain language.

---

## The catalog

272 skills, grouped by what you're trying to do. Click any skill to read its
`SKILL.md`. It fires on its own when a task matches.

### 🧭 Core & control plane
The front door and the workspace brain.

[init](skills/init/) · [harness](skills/harness/) · [orient](skills/orient/) · [suggest](skills/suggest/) · [bro](skills/bro/) · [unslop](skills/unslop/) · [author-skill](skills/author-skill/) · [sdd-init](skills/sdd-init/)

> **harness** is the Karpathy *chaos→knowledge* engine — a `01-TOOLS/` layer (one
> folder per provider, each with a working `test_connection`) and a `02-DOCS/`
> self-improving wiki. It governs software *or* a whole company. **orient** is the
> always-on compass that keeps a non-technical human oriented after every step.
> **bro** is installed with every profile and rewrites any answer in plain, natural
> language when the user asks — without making its full body always-on.

> #### 📦 The `02-DOCS/` brain is now 100% Open Knowledge Format (OKF v0.1) conformant
>
> Google Cloud published the [**Open Knowledge Format**](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
> — a vendor-neutral standard for portable, agent-readable knowledge — built on the
> same Karpathy *LLM-wiki* pattern our `02-DOCS/` engine has used from day one. We
> independently converged on the same design, so adopting the standard cost almost
> nothing. As of now, **every `02-DOCS/wiki/` is a valid, portable OKF bundle**:
>
> - **Markdown + YAML frontmatter**, `type` on every concept doc, OKF-standard
>   fields (`title`, `description`, `resource`, `tags`, `timestamp`).
> - **Standard markdown links** (not wikilinks) form the knowledge graph — any OKF
>   consumer reads it, *and* it stays a native Obsidian vault (graph, backlinks,
>   Properties, Bases). Same files, no export step.
> - **Reserved files** honored: `index.md` (no frontmatter) for navigation,
>   `log.md` (newest-first, ISO 8601) for history.
>
> Tarball a `wiki/` and any OKF tool — including Google's own viewer — can read it.
> And the brain now **keeps your repo clean**: a loose file it ingests (a PDF at the
> root, anything in `inbox/`) is *moved* into `raw/`, never left as clutter.

### 📐 Spec-Driven Development
Take a fuzzy intent to a shipped, verified change — phase by phase. `npx @ericrisco/rsc install --profile core`.

[sdd](skills/sdd/) · [constitution](skills/constitution/) · [idea-refinement](skills/idea-refinement/) · [specify](skills/specify/) · [clarify](skills/clarify/) · [plan](skills/plan/) · [tasks](skills/tasks/) · [analyze](skills/analyze/) · [decision-challenge](skills/decision-challenge/) · [implement](skills/implement/) · [source-grounded-development](skills/source-grounded-development/) · [verify](skills/verify/) · [review](skills/review/) · [simplify-code](skills/simplify-code/) · [ship](skills/ship/) · [debug](skills/debug/) · [worktrees](skills/worktrees/) · [parallel](skills/parallel/)

> Two of those are not phases the chain walks on its own. `idea-refinement` **is** invoked — `specify` runs its FRAME block before the first question round. `decision-challenge` is **on-demand**: it exists, it is good, and no phase calls it yet. Listed so you can reach for it, not because the chain will. And the limit of what FRAME buys you, stated rather than implied: a second reading by the same model breaks correlation of **framing**, not of model — it shares the priors it is checking.

### 💼 Run a business

[finance-ops](skills/finance-ops/) · [invoicing](skills/invoicing/) · [bookkeeping](skills/bookkeeping/) · [pricing](skills/pricing/) · [sales-pipeline](skills/sales-pipeline/) · [lead-gen](skills/lead-gen/) · [cold-outreach](skills/cold-outreach/) · [proposals](skills/proposals/) · [contracts](skills/contracts/) · [customer-support](skills/customer-support/) · [client-onboarding](skills/client-onboarding/) · [retention](skills/retention/) · [hiring](skills/hiring/) · [people-ops](skills/people-ops/) · [inventory](skills/inventory/) · [logistics-ops](skills/logistics-ops/) · [procurement](skills/procurement/) · [meeting-notes](skills/meeting-notes/) · [sop-builder](skills/sop-builder/) · [project-ops](skills/project-ops/)

### 💸 Raise & model money

[pitch-deck](skills/pitch-deck/) · [investor-materials](skills/investor-materials/) · [financial-model](skills/financial-model/) · [fundraising](skills/fundraising/) · [unit-economics](skills/unit-economics/) · [grants](skills/grants/)

### ⚖️ Legal, privacy & compliance

[gdpr-privacy](skills/gdpr-privacy/) · [terms-conditions](skills/terms-conditions/) · [compliance](skills/compliance/) · [data-policy](skills/data-policy/) · [ip-trademark](skills/ip-trademark/)

### 📣 Market & brand

[marketing](skills/marketing/) · [seo-geo](skills/seo-geo/) · [content-engine](skills/content-engine/) · [social-publisher](skills/social-publisher/) · [brand-voice](skills/brand-voice/) · [brand-identity](skills/brand-identity/) · [newsletter](skills/newsletter/) · [landing-copy](skills/landing-copy/) · [ads](skills/ads/) · [article-writing](skills/article-writing/) · [case-studies](skills/case-studies/) · [video-shorts](skills/video-shorts/) · [podcast](skills/podcast/) · [market-research](skills/market-research/) · [competitor-watch](skills/competitor-watch/) · [press-kit](skills/press-kit/) · [community](skills/community/) · [webinar](skills/webinar/) · [review-management](skills/review-management/)

### 🎬 Grow a channel
Each with a `02-DOCS` feedback loop that learns from your own results. `remotion-video` edits programmatically — transitions, Whisper captions, silence removal.

[youtube-api](skills/youtube-api/) · [youtube-strategy](skills/youtube-strategy/) · [youtube-ideation](skills/youtube-ideation/) · [youtube-thumbnails](skills/youtube-thumbnails/) · [youtube-packaging](skills/youtube-packaging/) · [remotion-video](skills/remotion-video/) · [tiktok-api](skills/tiktok-api/) · [instagram-api](skills/instagram-api/) · [shortform-strategy](skills/shortform-strategy/) · [shortform-ideation](skills/shortform-ideation/) · [shortform-packaging](skills/shortform-packaging/) · [shortform-editing](skills/shortform-editing/) · [viral-score](skills/viral-score/) · [linkedin-api](skills/linkedin-api/) · [linkedin-strategy](skills/linkedin-strategy/) · [linkedin-content](skills/linkedin-content/) · [linkedin-carousels](skills/linkedin-carousels/) · [linkedin-outreach](skills/linkedin-outreach/) · [medium-writing](skills/medium-writing/) · [medium-publishing](skills/medium-publishing/) · [medium-strategy](skills/medium-strategy/)

### 🔌 Connect & automate

[stripe](skills/stripe/) · [email-connector](skills/email-connector/) · [google-workspace](skills/google-workspace/) · [notion-connector](skills/notion-connector/) · [whatsapp-telegram](skills/whatsapp-telegram/) · [automation-flows](skills/automation-flows/) · [api-connector-builder](skills/api-connector-builder/) · [webhooks](skills/webhooks/) · [data-scraper](skills/data-scraper/) · [spreadsheet-ops](skills/spreadsheet-ops/) · [calendar-scheduling](skills/calendar-scheduling/) · [document-processing](skills/document-processing/) · [e-signature](skills/e-signature/)

### ⚙️ Automation

Operate the big automation platforms **programmatically or via MCP** — create and manage automations *dynamically*, not just design them on a canvas. `automation-strategy` decides whether / what / which platform; the platform skills drive the live REST API or MCP server (harness connectors ship for each). Complements `automation-flows` (visual design + importable workflow JSON).

[automation-strategy](skills/automation-strategy/) · [n8n](skills/n8n/) · [make](skills/make/) · [zapier](skills/zapier/) · [power-automate](skills/power-automate/)

### 📊 Data & analytics

[analytics](skills/analytics/) · [dashboard](skills/dashboard/) · [kpi-framework](skills/kpi-framework/) · [reporting](skills/reporting/) · [ab-testing](skills/ab-testing/) · [forecasting](skills/forecasting/) · [data-cleaning](skills/data-cleaning/) · [business-intelligence](skills/business-intelligence/)

### 🤖 AI — build it in

[building-agents](skills/building-agents/) · [rag](skills/rag/) · [embeddings-search](skills/embeddings-search/) · [prompt-engineering](skills/prompt-engineering/) · [llm-pipeline](skills/llm-pipeline/) · [agent-eval](skills/agent-eval/) · [chatbot](skills/chatbot/) · [ai-media](skills/ai-media/) · [replicate-images](skills/replicate-images/) · [structured-extraction](skills/structured-extraction/) · [agent-safety](skills/agent-safety/) · [cost-tracking](skills/cost-tracking/)

### 🛰️ AI — run it on

[replicate](skills/replicate/) · [runpod](skills/runpod/) · [modal](skills/modal/) · [huggingface](skills/huggingface/) · [ollama](skills/ollama/) · [together-fireworks](skills/together-fireworks/) · [fal](skills/fal/)

### 🎓 AI — train it

Train and adapt open models end to end: classic ML, deep learning, NLP, fine-tuning (with Unsloth), building training datasets, choosing open-weight models by license/size, and serving them at throughput with vLLM. Facts that move monthly (versions, model licenses) are verified at author time and hedged.

[machine-learning](skills/machine-learning/) · [deep-learning](skills/deep-learning/) · [nlp](skills/nlp/) · [finetuning](skills/finetuning/) · [training-data](skills/training-data/) · [unsloth](skills/unsloth/) · [open-weights](skills/open-weights/) · [vllm](skills/vllm/)

### 🗣️ Languages

[typescript](skills/typescript/) · [python](skills/python/) · [java](skills/java/) · [csharp-dotnet](skills/csharp-dotnet/) · [php](skills/php/) · [ruby](skills/ruby/) · [cpp](skills/cpp/) · [elixir](skills/elixir/) · [bash-scripting](skills/bash-scripting/) · [sql](skills/sql/) · [go](skills/go/)

### 🏗️ Frameworks & app stacks

[fastapi](skills/fastapi/) · [nextjs](skills/nextjs/) · [react](skills/react/) · [react-native](skills/react-native/) · [vue-nuxt](skills/vue-nuxt/) · [angular](skills/angular/) · [svelte](skills/svelte/) · [astro](skills/astro/) · [solid-js](skills/solid-js/) · [htmx](skills/htmx/) · [nodejs](skills/nodejs/) · [nestjs](skills/nestjs/) · [django](skills/django/) · [laravel](skills/laravel/) · [rails](skills/rails/) · [spring-boot](skills/spring-boot/) · [phoenix](skills/phoenix/) · [flutter](skills/flutter/) · [swift-ios](skills/swift-ios/) · [kotlin-android](skills/kotlin-android/) · [compose-multiplatform](skills/compose-multiplatform/) · [expo](skills/expo/) · [tauri](skills/tauri/) · [electron](skills/electron/) · [rust](skills/rust/) · [wordpress](skills/wordpress/) · [shopify](skills/shopify/) · [no-code-app](skills/no-code-app/) · [chrome-extension](skills/chrome-extension/) · [api-design](skills/api-design/)

### 🎮 Game development

Three engines + engine-agnostic disciplines. Every engine skill pins the current version and bans deprecated APIs, so the agent stops emitting stale Godot-3 / legacy-Unity code.

[godot](skills/godot/) · [unity](skills/unity/) · [unreal](skills/unreal/) · [game-design](skills/game-design/) · [game-storytelling](skills/game-storytelling/) · [level-design](skills/level-design/) · [gamedev-shaders](skills/gamedev-shaders/) · [gamedev-multiplayer](skills/gamedev-multiplayer/) · [gamedev-physics](skills/gamedev-physics/) · [gamedev-pathing](skills/gamedev-pathing/) · [gamedev-shipping](skills/gamedev-shipping/)

### 🗄️ Databases & data layer

[postgresdb](skills/postgresdb/) · [mysql](skills/mysql/) · [mongodb](skills/mongodb/) · [redis](skills/redis/) · [supabase](skills/supabase/) · [neon](skills/neon/) · [planetscale](skills/planetscale/) · [sqlite-turso](skills/sqlite-turso/) · [prisma-orm](skills/prisma-orm/) · [drizzle-orm](skills/drizzle-orm/) · [firebase](skills/firebase/) · [dynamodb](skills/dynamodb/) · [vector-db](skills/vector-db/) · [clickhouse-analytics](skills/clickhouse-analytics/) · [duckdb](skills/duckdb/) · [db-migrations](skills/db-migrations/) · [backups](skills/backups/)

### ☁️ Ship & operate — platforms

[vercel](skills/vercel/) · [netlify](skills/netlify/) · [cloudflare](skills/cloudflare/) · [railway](skills/railway/) · [render](skills/render/) · [fly-io](skills/fly-io/) · [coolify](skills/coolify/) · [hetzner](skills/hetzner/) · [digitalocean](skills/digitalocean/) · [aws-essentials](skills/aws-essentials/) · [gcp-essentials](skills/gcp-essentials/)

### 🛠️ Ship & operate — devops

[docker](skills/docker/) · [github-actions](skills/github-actions/) · [git-workflow](skills/git-workflow/) · [domains-dns](skills/domains-dns/) · [monitoring](skills/monitoring/) · [email-deliverability](skills/email-deliverability/) · [scaling](skills/scaling/) · [deployment](skills/deployment/) · [deprecation](skills/deprecation/)

### 🔒 Ship & operate — quality & security

[code-review](skills/code-review/) · [security-scan](skills/security-scan/) · [secure-coding](skills/secure-coding/) · [testing-py](skills/testing-py/) · [testing-web](skills/testing-web/) · [testing-go](skills/testing-go/) · [e2e-testing](skills/e2e-testing/) · [accessibility](skills/accessibility/) · [performance](skills/performance/) · [error-handling](skills/error-handling/) · [observability](skills/observability/)

### 🌀 Motion & interface craft

[motion-craft](skills/motion-craft/) · [ui-engineering](skills/ui-engineering/) · [variant-explorer](skills/variant-explorer/)

### 🎨 Design & content craft

[design-loop](skills/design-loop/) · [design](skills/design/) · [design-dna](skills/design-dna/) · [presentations](skills/presentations/) · [course-storytelling](skills/course-storytelling/) · [course-builder](skills/course-builder/) · [technical-writing](skills/technical-writing/) · [translation-l10n](skills/translation-l10n/)

### 🧠 Knowledge & meta

[knowledge-ops](skills/knowledge-ops/) · [codebase-onboarding](skills/codebase-onboarding/) · [research-ops](skills/research-ops/) · [decision-records](skills/decision-records/) · [continuous-learning](skills/continuous-learning/) · [skill-scout](skills/skill-scout/) · [context-budget](skills/context-budget/) · [roast-me](skills/roast-me/) · [show-me](skills/show-me/) · [eli5](skills/eli5/) · [fable-operator](skills/fable-operator/)

---

## Multi-target

`skills/<name>/` is the catalog source. On install the real files land **once**
in the project at `.rsc/skills/<id>/`; each assistant you pick gets a symlink
(or a converted file) back to that shared base — pick several and nothing is
duplicated. The wizard asks which ones; `--target a,b` does it non-interactively.

| Target | Skill destination (→ `.rsc/skills/<id>/`) | Always-on detector |
| --- | --- | --- |
| `claude` | `.claude/skills/<id>/` → symlink (copy on Windows) | SessionStart hook in `.claude/settings.json` |
| `codex` | `.codex/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `copilot` | `.github/rsc/<id>/` → symlink | block in `.github/copilot-instructions.md` |
| `cursor` | `.cursor/rules/<id>.mdc` (converted) | always-apply rule |
| `gemini` | `.gemini/rsc/<id>/` → symlink | block in `GEMINI.md` |
| `windsurf` | `.windsurf/rsc/<id>/` → symlink | rule in `.windsurf/rules/rsc-suggest.md` |
| `cline` | `.clinerules/rsc/<id>/` → symlink | rule in `.clinerules/rsc-suggest.md` |
| `antigravity` | `.antigravity/rsc/<id>/` → symlink | block in `.antigravity/AGENTS.md` |
| `zed` | `.zed/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `continue` | `.continue/rsc/<id>/` → symlink | rule in `.continue/rules/rsc-suggest.md` |
| `roo` | `.roo/rsc/<id>/` → symlink | rule in `.roo/rules/rsc-suggest.md` |
| `amp` | `.amp/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `opencode` | `.opencode/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `jules` | `.jules/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `junie` | `.junie/rsc/<id>/` → symlink | block in `.junie/guidelines.md` |
| `kiro` | `.kiro/rsc/<id>/` → symlink | doc in `.kiro/steering/rsc-suggest.md` |
| `aider` | `.aider/rsc/<id>/` → symlink | block in `CONVENTIONS.md` |

> `codex`, `zed`, `amp`, `opencode` and `jules` all share the one root
> `AGENTS.md`; the block is idempotent, so picking several writes it once.

The richer surfaces are intentionally narrower than skill support:

| Targets | Stack agents | Native commands | Local session continuation |
| --- | --- | --- | --- |
| Claude Code | yes | agent + memory entries; skills already invoke natively | full |
| Codex | yes | no separate project-command surface | full after `/hooks` trust |
| Cursor desktop | yes | yes | assisted |
| Gemini CLI, OpenCode | yes | yes | full |
| GitHub Copilot | yes | yes | unsupported |
| Junie, Kiro | yes | unsupported | unsupported |
| Windsurf, Cline, Roo | unsupported | yes | unsupported |
| Antigravity, Zed, Continue, Amp, Jules, Aider | unsupported | unsupported | unsupported |

`manifest.json` is the generated public inventory: 33 agents (4 base + 29
selective specialists) and 53 command entries (20 fixed + 33 stack aliases).
Unsupported means rsc writes nothing for that surface; it does not emulate a
provider feature with an unverified file.

---

## Skill format

Each skill is a directory under `skills/<name>/` whose `SKILL.md` frontmatter
drives both triggering and the installer's recommendations:

```yaml
---
name: my-skill
description: Use when [specific triggers]… Triggers: 'phrase', 'frase'. NOT x (that is sibling).
tags: [keyword, keyword]        # what the consult advisor searches over
recommends: [sibling-skill]     # what the system offers to install next
profiles: [core, full]          # optional: named-profile membership
origin: risco
---
```

The full agent-skill spec lives at
[agentskills.io/specification](https://agentskills.io/specification).

---

## Repo layout & contributing

`skills/<name>/` is the **single source of truth** — every skill is authored
there, once. After editing any skill:

```bash
npm run manifest      # regenerate manifest.json from skills/*/SKILL.md
npm run validate      # ajv-validate frontmatter + check recommends integrity
npm test              # unit + integration tests
bash scripts/eval-lint.sh   # validate every skills/*/evals/cases.yaml
```

`manifest.json` is generated, never hand-edited; CI runs `npm run manifest:check`
and fails if it's stale or the skill count drifts. Adding a skill is: create
`skills/<id>/SKILL.md` with `tags` + `recommends`, run `npm run manifest`, done —
the rubric to hold it to is `scripts/skill-rubric.md`.

This is a personal catalog. Bug reports welcome via GitHub issues; PRs fixing
detector patterns, provider endpoints, or typos are appreciated.

## Third-party skills

Most of this catalog is written here. These are not, and they keep their author's credit:

| Skills | Source | License |
| --- | --- | --- |
| `design-eng` · `animate` · `animate-expo` · `review-animations` · `improve-animations` · `find-animation-opportunities` · `animation-vocabulary` · `apple-design` · `prototype` · `pick-ui-library` · `write-swift` · `ask-sonner` | [emilkowalski/skills](https://github.com/emilkowalski/skills) by Emil Kowalski, commit `d23d7f8` | MIT |
| part of the AI-tell corpus in `design` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT |

Adapted, not mirrored: each one carries rsc frontmatter, routing evals, hand-offs to its siblings
and — where it declares a binding rule — a checker with a test. The craft bar in them is the
original author's. If you want the source of the motion material rather than this adaptation, go to
[animations.dev](https://animations.dev/).

## License

MIT. See [LICENSE](LICENSE).
