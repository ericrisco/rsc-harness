<div align="center">

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/og.png" alt="rsc-harness: you build the product, rsc-harness builds your agent's harness, following strict best practices instead of improvising one." width="960">

# `rsc-harness`

**You build the product. rsc-harness builds its harness.**

[![npm](https://img.shields.io/npm/v/@ericrisco/rsc?color=63d68a&labelColor=12161c&label=npm)](https://www.npmjs.com/package/@ericrisco/rsc)
[![downloads](https://img.shields.io/npm/dm/@ericrisco/rsc?color=63d68a&labelColor=12161c&label=downloads)](https://www.npmjs.com/package/@ericrisco/rsc)
[![skills](https://img.shields.io/badge/skills-271-63d68a?labelColor=12161c)](#the-catalog)
[![license](https://img.shields.io/badge/license-MIT-63d68a?labelColor=12161c)](LICENSE)
[![stars](https://img.shields.io/github/stars/ericrisco/rsc-harness?color=63d68a&labelColor=12161c)](https://github.com/ericrisco/rsc-harness/stargazers)

Every time you open a project, your agent starts from zero. rsc is a meta-harness: it gives the
assistant you already use (Claude Code, Codex, Cursor and 15 more) a memory, hands, a trade and
reflexes, so it stops starting over.

Give this URL to your agent and paste the request in the chat:

```text
Read https://ericrisco.github.io/rsc-harness/ and set up rsc for this project.
Ask me the onboarding questions, show me the exact plan, and wait for my acceptance before writing.
```

Or start from the terminal:

```bash
npx @ericrisco/rsc@latest onboard
```

</div>

---

## The problem

- **You explain everything again.** Every new session, every new project: the stack, the
  conventions, what was decided, what must not be touched.
- **What the agent does not know, it invents.** And the guess looks plausible, which is worse than
  an obvious error.
- **Decisions die with the chat.** What you settled yesterday is gone the moment the window closes.

The most important thing an agent needs is documentation, and nobody keeps it for the agent.

When people fix this by hand, the result is a **Frankenstein harness**: duplicated instructions,
unrelated skills, premature hooks, unnecessary MCPs and no clear owner. Open standards cover single
parts ([Agent Skills](https://agentskills.io/specification), [MCP](https://modelcontextprotocol.io/),
[AGENTS.md](https://agents.md/)), but none of them decides which complete harness your project needs.

---

## The idea: documentation is your agent's memory

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/meta-harness.png" alt="rsc-harness turns an outcome into a verified plan: memory, tools, knowledge and rules selected, deferred or excluded according to evidence." width="960">

The model is the brain your agent rents, and you already have it. rsc adds the rest, in four pieces:

| Piece | Where it lives | What it does |
| --- | --- | --- |
| **Memory** | `02-DOCS/` | A wiki the agent reads before it works and keeps up to date while it works. |
| **Hands** | `01-TOOLS/` | One folder per tool, with a test that proves the connection works. |
| **Trade** | skills | Only the skills your project needs: 271 available, a handful installed. |
| **Reflexes** | hooks | Rules that hold even when the agent forgets them mid-session. |

### Why documentation comes first

An agent without documentation spends most of its effort searching. It opens files, greps, reads the
same module twice, and still ends up guessing. Every one of those turns costs tokens, and the guess
costs more later.

With a well-structured `02-DOCS/`, the agent knows where to look. It finds what it needs in one read
instead of ten, so the same task costs fewer tokens.

And because it finds what already exists, it builds on it:

- It reuses the function you already have instead of writing a second one.
- It follows the structure your project already uses, every time.
- It works from what is true about your code, not from a plausible guess, so less of what it writes
  breaks.

Good documentation is not overhead for your agent. It is what makes it cheaper and better at the
same time.

---

## A day with rsc

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/lanes.svg" alt="The rsc lane decisor: the agent classifies each request into answer (read-only), FTD (simple change, one feature document) or SDD (the ten-phase chain for big or complex work, entered by the agent; you approve the spec)." width="960">

1. **You install it.** It asks a few questions in plain language: how technical to talk, what the
   project is for, its goal, and which assistants you use. It reads only the project root.
2. **It shows the plan before it writes anything.** Every piece is selected, deferred or excluded,
   each with its reason. Nothing is written until you accept that exact plan.
3. **You ask for things.** The agent decides how much process each request needs, and says so in one
   line: an answer, a quick change (FTD), or the full chain (SDD).
4. **It documents as it goes.** Decisions, connections and progress land in `02-DOCS/`, not in the
   chat.
5. **Tomorrow, the agent already knows.** You, a teammate on another machine, or another assistant
   open the project and continue where the last session stopped.

---

## What changes for you

- **You never explain your project again.** The knowledge lives in the repo, not in your head.
- **Fewer tokens, more consistent code.** The agent finds instead of searching (see
  [why documentation comes first](#why-documentation-comes-first)).
- **The right amount of process.** A typo gets fixed; a new subsystem gets a spec. The agent picks.
- **Safe for teams by default.** Shared knowledge, one workspace per agent, and no surprise commits
  on `main`.
- **Any assistant, or several at once.** 18 are supported, and they share one installation.
- **It talks so you understand.** Short sentences, in your language, technical or with analogies.

---

## Install in one minute

```bash
npx @ericrisco/rsc@latest onboard
```

The first run asks **one** question about conversation (technical, or with analogies), then what the
project is for, its goal and the assistants to target. Then it presents the complete plan. A small
website can defer SDD, agents and code guards; an operations harness does not receive them merely
because it lives in a repository. Deferred components record the evidence that would make rsc
recommend them later, and `rsc reassess` reports it without installing anything.

Everything stays **in the project**. The real skill files are written once to `.rsc/skills/<id>/`, and
each assistant gets a symlink back to that shared base, so picking several duplicates nothing. Skills
load progressively: only their description is paid for until a task needs them.

Prefer a short `rsc` command? `npm install -g @ericrisco/rsc`.

> **Run it inside the project you are equipping, not inside a clone of this repo.** The catalog's own
> `package.json` is named `@ericrisco/rsc`, so `npx @ericrisco/rsc` from within a clone resolves to
> the local bin and fails with `sh: rsc: command not found`. Working on the catalog itself? Use
> `node scripts/rsc.js …` or `npm link`.

### For agents: "install this harness"

If you are an AI coding agent and your user asked you to **install rsc, this harness or these
skills**, run this in the root of the project they are equipping:

```bash
npx @ericrisco/rsc@latest onboard
```

It asks the user how technical to talk, the project kind and the goal **before it writes anything**,
and shows every selected or deferred skill, agent and hook with its reason. Relay those questions;
never invent or default the answers. The first pass writes nothing and prints a SHA-256 plan id. Rerun
with `--accept-plan <id>` only after the user accepts that exact plan. If the project already has a
skill of its own with a catalog name, the plan lists it under **Your own skills this plan replaces**:
tell the user before accepting.

Non-interactive, with the answers collected first:

```bash
npx @ericrisco/rsc@latest onboard --technical-level technical \
  --project-kind software --goal "small compound-interest website" \
  --software-scope small --target codex
# After the user accepts the printed plan:
npx @ericrisco/rsc@latest onboard --technical-level technical \
  --project-kind software --goal "small compound-interest website" \
  --software-scope small --target codex --accept-plan PRINTED_SHA256_ID
```

If project evidence changes between preview and acceptance, rsc returns `RSC_PLAN_CHANGED` and writes
nothing. After applying, it verifies the result and prints `RSC_ONBOARDING_READY`, or
`RSC_ONBOARDING_INCOMPLETE` with each missing path and the action that creates it.

---

## How it works inside

### The knowledge model: `02-DOCS/` and `01-TOOLS/`

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/company-brain.svg" alt="The rsc company brain as a 3D knowledge graph: loose material drifts in from the inbox and is absorbed into the wiki cluster, whose brightest hubs are its .base views; dim clusters are raw sources and the agent's own worklog; an amber cluster is gaps.md, what the wiki knows it is missing." width="960">

Anything you drop into `02-DOCS/inbox/` is ingested. The wiki consolidates it as plain markdown that
every skill reads before acting, so the next session starts where the last one stopped. Raw sources
and the agent's worklog stay underneath, never deleted. You can open `02-DOCS/` as an Obsidian vault,
and every `02-DOCS/wiki/` is a valid [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
bundle: markdown with YAML frontmatter, standard links, and the reserved `index.md` and `log.md`.

`01-TOOLS/` holds one folder per tool: `.env.example`, `CREDENTIALS.md`, a README and a
`test_connection` that proves it works. When you name a tool ("connect my Holded", "can the agent
read our Sage?"), the `connect-tool` skill researches the vendor's current docs, picks the least
dangerous route (official MCP, API, export, a read-only copy of the database), and builds the folder.
For a read-only connection, the test also proves that writing fails.

### Three lanes, and the agent picks

Every turn takes exactly one lane, and the agent names it in one line, in your language.

1. **Answer.** The request asks for information: explain, compare, investigate, audit, review,
   propose. It is **read-only**: nothing is written and no artifact is created. When intent is
   unclear it asks one question and stays here.
2. **FTD, Fast-Track Development.** The request authorises a change. This is the default for ordinary
   work. One feature document holds intent, scope, a checklist, the evidence and the next step. Tasks
   are checked off against observed proof, never against intention.
3. **SDD, the ten-phase chain.** For the big or complex: several decisions that affect each other.
   **The agent enters it on its own**, and you still decide *what* gets built: you approve the spec
   and answer the clarifying questions, then review each phase or let it run on autopilot. Publishing
   always asks.

Ask for the other lane and it switches.

### Skills, and how they are recommended

The unit of installation is **one skill**: install `fastapi` without ever pulling `go`. Two faces
share one catalog (`manifest.json`):

- **In the terminal**, `rsc consult` ranks the catalog against your words and what it detects in the
  repo (`package.json` + `next` → `nextjs`, `go.mod` → `go`, `Dockerfile` → `docker`).
- **In the chat**, the always-on `suggest` notices when a task needs a skill you do not have, names
  it, and installs it on a one-word yes.

Every skill passed a research → spec → implement → adversarial review pipeline and an objective
rubric (`scripts/skill-rubric.md`) written before any skill existed. Skills that scored 8.0 were sent
back and fixed, not waved through.

### Hooks and guards

In Claude Code, hooks enforce what instructions only ask for: the lane decisor on every turn, a
refusal before a commit on a closed `main`, a confirmation before destructive commands, and a nudge
to write the feature document before the first code edit. Every refusal says how to carry on. The
rules only see what the **agent** runs; a person committing in their own terminal is never touched.

> **Limit, stated plainly.** Those guards run in **Claude Code**. In Codex, Gemini, Cursor and
> OpenCode the same rules travel in the skills and the session memory. They are followed, but no hook
> enforces them.

### Working as a team

Day ninety is where harnesses break, especially with several people, assistants and sessions on one
project. rsc handles four things by default:

| | What happens | Turn it off |
| --- | --- | --- |
| **You choose how the project works** | The install asks once: straight on `main`, or branches and pull requests? With branches, a commit on `main` is refused and the agent asks before each change: this branch, a new one, or unlock `main`? It never opens a branch on its own. | «unlock main», or `rsc main unlock` |
| **One workspace per agent** | If another session works in the same folder, new work goes to `.worktrees/<branch>/`, inside the project and never committed. A `post-merge` hook retires it once the branch lands. | `rsc isolation off` |
| **The agent picks the method** | FTD for simple changes, SDD for complex ones. The agent decides and says why. | Ask for the other lane |
| **Knowledge reaches everyone** | `01-TOOLS/`, `02-DOCS/wiki/` and `02-DOCS/attachments/` travel through one exchange branch, `rsc/knowledge`, and reach `main` inside your normal pull requests. | `rsc knowledge-sync off` |

**How it knows a project is complex.** A hook counts what anyone can check: a CI setup, a deployment
file (`Dockerfile`, `vercel.json`, `fly.toml`…) or at least two people in the last 50 commits. The
answer you gave at install always wins over this detection.

#### Knowledge sync, step by step

```text
ana    · feat/login     edits 02-DOCS/wiki/api.md ──► rsc/knowledge      (when her turn ends)
eric   · feat/payments  📥 1 change from Ana        ◄── rsc/knowledge      (before his next message)
main   · protected      untouched, gets it inside the next merged pull request
new    · clones main    has it all after the first message
```

- **When a turn ends**, your changes in those folders are committed on your branch as
  `📝 docs(auto): …` and sent to `rsc/knowledge`. Only the copy on `rsc/knowledge` carries
  `[skip ci]`, so your own pushes still run CI. On a closed `main`, or with code of yours still
  uncommitted, nothing is committed on your branch: the snapshot only goes to `rsc/knowledge`.
- **Before each message**, what teammates sent comes into the branch you are on as a
  `📥 docs(auto): sync` commit, and you are told in one line. Only knowledge folders are touched.
- **It never** pushes to `main`, pushes your code, brings in anybody else's code, syncs your personal
  `user-profile.md`, or overwrites a file you are editing.

It runs in the turn hooks of Claude Code, Codex, Gemini, Cursor, OpenCode and DeepSeek Harness. It is
a **project** switch: if one person stopped sending, the rest would stop seeing their work.

#### Sharing the harness through git

**Commit these:** `.rsc.json` (which assistants, which skills, which catalog version), `01-TOOLS/`,
`02-DOCS/`, and skills or agents you wrote by hand. **rsc ignores the rest for you:** `.rsc/` (machine
state) and the skill entries it manages (symlinks here, copies on Windows).

Three files carry the harness through git: `.rsc.json`, `.claude/settings.json` and
`.claude/rsc-bootstrap.mjs`, the small file that notices in a clone that the rest is not built yet.
Commit all three. Because `rsc-bootstrap.mjs` runs on every session, review changes to it the way you
would review a CI workflow.

Whoever clones runs **one command** and gets the same harness, at the version the project pinned in
its `.rsc.json` as `catalogVersion`:

```bash
npx @ericrisco/rsc@<catalogVersion> sync
```

You do not have to know that. Open the project and the assistant tells you, in the first message,
what is missing and the exact command, naming the pinned version. It asks; it never installs on its
own. A teammate who clones in three months gets what you had, not what shipped since. After a
`git pull`, `rsc doctor` tells you what no longer matches; nothing is written by a pull.

**Own skills.** A skill your team wrote lives in the repo and works for whoever clones. rsc never installs, updates or overwrites
it: its version is the commit. Installing a catalog skill with the
same name is refused, and `doctor` lists what is yours by reading the files. Declaring a skill under
`ownSkills` still works.

#### Git permissions

A harness installed from scratch lets the agent run `git commit`, `git push` and `gh pr create`
without asking, because those steps close every lane. A force-push still asks, and in Claude Code a
commit on a closed `main` is still refused. It is saved as `gitPermissions` in `.rsc.json`.

| Assistant | Where it goes |
| --- | --- |
| Claude Code | `.claude/settings.json` → `permissions.allow` (force-push under `ask`) |
| Codex | `.codex/rules/rsc-git.rules` (force-push → `prompt`) |
| Gemini | `.gemini/settings.json` → `tools.allowed` |
| OpenCode | `opencode.json`: the `permissions` list on OpenCode 2, `permission.bash` on 1.x. An `opencode.jsonc` is never rewritten; rsc prints the rules to paste. |
| Cursor, DeepSeek Harness | Not covered: neither has a safe per-command allow list. |

`rsc git-permissions status | on | off` explains, per assistant, what rsc controls and what is left
to the assistant.

### Memory between sessions

On supported local targets, rsc checkpoints observable repository state (branch, worktree, HEAD,
changed paths, commits, SDD status) and injects it before the first action of a new session in the
same checkout.

- **Full:** Claude Code, Codex, Gemini CLI, OpenCode and DeepSeek Harness. Codex asks you to trust the
  project hook once with `/hooks`.
- **Assisted:** Cursor desktop, through an always-on rule that reads before acting.
- **Never cloud:** the memory runtime makes no network request.

The journal never stores prompts, responses, tool output, file contents or secrets. It stays in a
git-excluded local path, keeps 30 days, and injects at most 4,096 bytes. `rsc memory off` disables it.

### Review that only brings you what is real

In SDD, `review` sends three adversarial reviewers at the diff (correctness, security, tests). They
often report the same defect in different words, and a reviewer hunting for problems can overstate
one. So `rsc review consolidate` merges the duplicates, and every serious finding left goes to a
fresh `finding-verifier` agent whose starting position is that the finding is false. It blocks the
merge only if the verifier reproduces or traces it. You get "11 reported → 4 unique → 2 confirmed",
with the refuted ones listed and their reason.

### It talks so you understand

- **Short sentences, one idea each,** in the style of ASD-STE100 (the controlled writing of aircraft
  manuals), always in your language.
- **The answer first.** Every answer stands alone, without "that fix" or "as above".
- **One setting:** technical, or with analogies.
- **A ladder when you do not follow:** text, then a diagram, then an HTML page, and a video only if
  you ask.

Every turn closes with a short compass: where you are, and the next step as a question. Text you send
to other people (emails, posts, READMEs) goes through `unslop`, so it sounds like a person.

---

## Supported assistants

The real files land once in `.rsc/skills/<id>/`; each assistant gets a symlink or a converted file.
The wizard asks which ones; `--target a,b` does it non-interactively.

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
| `deepseek` | `.dsh/skills/<id>/` → symlink (discovered natively) | block in `AGENTS.md` |
| `jules` | `.jules/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `junie` | `.junie/rsc/<id>/` → symlink | block in `.junie/guidelines.md` |
| `kiro` | `.kiro/rsc/<id>/` → symlink | doc in `.kiro/steering/rsc-suggest.md` |
| `aider` | `.aider/rsc/<id>/` → symlink | block in `CONVENTIONS.md` |

> `codex`, `zed`, `amp`, `opencode`, `deepseek` and `jules` share one root `AGENTS.md`; the block is
> written once.

> **DeepSeek Harness** (`dsh`) has no project-level hooks, so once per machine rsc adds one marked
> block to `~/.dsh/cordis.patch.yml` that runs the hooks of whichever project the session is in.
> Restart dsh once after the first install; delete the block to turn it off.

| Targets | Stack agents | Native commands | Session memory |
| --- | --- | --- | --- |
| Claude Code | yes | agent + memory entries | full |
| Codex | yes | no separate surface | full after `/hooks` trust |
| Cursor desktop | yes | yes | assisted |
| Gemini CLI, OpenCode | yes | yes | full |
| DeepSeek Harness | unsupported | unsupported | full (machine bridge) |
| GitHub Copilot | yes | yes | unsupported |
| Junie, Kiro | yes | unsupported | unsupported |
| Windsurf, Cline, Roo | unsupported | yes | unsupported |
| Antigravity, Zed, Continue, Amp, Jules, Aider | unsupported | unsupported | unsupported |

`manifest.json` is the generated public inventory: 34 agents (5 base + 29 selective specialists) and
53 command entries (20 fixed + 33 stack aliases). Unsupported means rsc writes nothing for that
surface. Generated agents carry no `model:` on OpenCode, so they use the session's model; pin one for
the team with `rsc agent-model <target> <model>`. If you edit a generated agent, `rsc sync` keeps your
file, and `rsc agents reset <name>` takes rsc's version back after a backup.

---

## CLI

```bash
# Setup
rsc onboard                          # plain-language onboarding; writes nothing until you accept
rsc reassess                         # check deferred components against new evidence
rsc add fastapi postgresdb           # install skills by name
rsc consult "I want to launch a SaaS"  # recommend only
rsc sync                             # refresh managed skills and hooks

# Team
rsc main status | unlock | lock      # whether the agent may work on main
rsc isolation status | off           # worktrees for parallel sessions
rsc knowledge-sync status | off      # the shared knowledge exchange
rsc git-permissions status | on | off

# Agents and review
rsc agent-model opencode inherit     # agents use the session's model
rsc agents status | reset <name>     # installed agents, and the ones you edited
rsc review consolidate c.md s.md t.md  # merge reviewer findings; serious ones go to finding-verifier

# Memory and diagnostics
rsc memory status | off | resume
rsc doctor                           # harness health and onboarding readiness
rsc repair                           # put the harness back to what is declared
rsc backups | restore latest         # project-local snapshots
rsc uninstall <id> | purge           # remove one skill, or everything rsc installed
```

### `rsc doctor`

`doctor` answers two questions, on separate lines:

```text
Harness health: healthy
Onboarding readiness: pending
Pending: 02-DOCS/wiki/sdd/constitution.md (draft)
```

**Harness health** says whether what is installed works, and it is the only thing the exit code
follows. **Onboarding readiness** says whether onboarding is finished (`ready`, `pending`,
`incomplete`, or `not onboarded` for a manual install); it never changes the exit code.

### Something's off? `rsc repair`

If the harness is wired for the wrong assistant, a hook runs several times, or skills appear that you
never asked for, run `npx @ericrisco/rsc@latest repair`. It shows what it found before touching
anything, keeps a recoverable copy, and never touches skills or agents you wrote by hand. Add
`--dry-run` to see the pass without writing.

### Update

**rsc updates itself.** At session start it checks npm. A release in the same major installs in the
background and takes effect next session; a new major asks first. To turn it off, create
`.rsc/.no-auto-update`. By hand: `npm install -g @ericrisco/rsc@latest && rsc sync`. Every sync
snapshots the project first, so `rsc restore latest` undoes a bad update.

---

## The catalog

271 skills, grouped by what you are trying to do. Click any skill to read its `SKILL.md`. It fires on
its own when a task matches.

### 🧭 Core & control plane

[init](skills/init/) · [harness](skills/harness/) · [orient](skills/orient/) · [suggest](skills/suggest/) · [unslop](skills/unslop/) · [author-skill](skills/author-skill/) · [sdd-init](skills/sdd-init/)

### 📐 Spec-Driven Development

Two lanes for change: `ftd` for ordinary work, and the ten-phase chain when durable artifacts would
settle a real ambiguity. `idea-refinement` runs inside `specify`; `decision-challenge` is on demand.

[ftd](skills/ftd/) · [sdd](skills/sdd/) · [constitution](skills/constitution/) · [idea-refinement](skills/idea-refinement/) · [specify](skills/specify/) · [clarify](skills/clarify/) · [plan](skills/plan/) · [tasks](skills/tasks/) · [analyze](skills/analyze/) · [decision-challenge](skills/decision-challenge/) · [implement](skills/implement/) · [source-grounded-development](skills/source-grounded-development/) · [verify](skills/verify/) · [review](skills/review/) · [simplify-code](skills/simplify-code/) · [ship](skills/ship/) · [debug](skills/debug/) · [worktrees](skills/worktrees/) · [parallel](skills/parallel/)

### 💼 Run a business

[finance-ops](skills/finance-ops/) · [invoicing](skills/invoicing/) · [bookkeeping](skills/bookkeeping/) · [pricing](skills/pricing/) · [sales-pipeline](skills/sales-pipeline/) · [lead-gen](skills/lead-gen/) · [cold-outreach](skills/cold-outreach/) · [proposals](skills/proposals/) · [contracts](skills/contracts/) · [customer-support](skills/customer-support/) · [client-onboarding](skills/client-onboarding/) · [retention](skills/retention/) · [hiring](skills/hiring/) · [people-ops](skills/people-ops/) · [inventory](skills/inventory/) · [logistics-ops](skills/logistics-ops/) · [procurement](skills/procurement/) · [meeting-notes](skills/meeting-notes/) · [sop-builder](skills/sop-builder/) · [project-ops](skills/project-ops/)

### 💸 Raise & model money

[pitch-deck](skills/pitch-deck/) · [investor-materials](skills/investor-materials/) · [financial-model](skills/financial-model/) · [fundraising](skills/fundraising/) · [unit-economics](skills/unit-economics/) · [grants](skills/grants/)

### ⚖️ Legal, privacy & compliance

[gdpr-privacy](skills/gdpr-privacy/) · [terms-conditions](skills/terms-conditions/) · [compliance](skills/compliance/) · [data-policy](skills/data-policy/) · [ip-trademark](skills/ip-trademark/)

### 📣 Market & brand

[marketing](skills/marketing/) · [seo-geo](skills/seo-geo/) · [content-engine](skills/content-engine/) · [social-publisher](skills/social-publisher/) · [brand-voice](skills/brand-voice/) · [brand-identity](skills/brand-identity/) · [newsletter](skills/newsletter/) · [landing-copy](skills/landing-copy/) · [ads](skills/ads/) · [article-writing](skills/article-writing/) · [case-studies](skills/case-studies/) · [video-shorts](skills/video-shorts/) · [podcast](skills/podcast/) · [market-research](skills/market-research/) · [competitor-watch](skills/competitor-watch/) · [press-kit](skills/press-kit/) · [community](skills/community/) · [webinar](skills/webinar/) · [review-management](skills/review-management/)

### 🎬 Grow a channel

Each with a `02-DOCS` feedback loop that learns from your own results.

[youtube-api](skills/youtube-api/) · [youtube-strategy](skills/youtube-strategy/) · [youtube-ideation](skills/youtube-ideation/) · [youtube-thumbnails](skills/youtube-thumbnails/) · [youtube-packaging](skills/youtube-packaging/) · [remotion-video](skills/remotion-video/) · [tiktok-api](skills/tiktok-api/) · [instagram-api](skills/instagram-api/) · [shortform-strategy](skills/shortform-strategy/) · [shortform-ideation](skills/shortform-ideation/) · [shortform-packaging](skills/shortform-packaging/) · [shortform-editing](skills/shortform-editing/) · [viral-score](skills/viral-score/) · [linkedin-api](skills/linkedin-api/) · [linkedin-strategy](skills/linkedin-strategy/) · [linkedin-content](skills/linkedin-content/) · [linkedin-carousels](skills/linkedin-carousels/) · [linkedin-outreach](skills/linkedin-outreach/) · [medium-writing](skills/medium-writing/) · [medium-publishing](skills/medium-publishing/) · [medium-strategy](skills/medium-strategy/)

### 🔌 Connect & automate

[connect-tool](skills/connect-tool/) · [stripe](skills/stripe/) · [email-connector](skills/email-connector/) · [google-workspace](skills/google-workspace/) · [notion-connector](skills/notion-connector/) · [whatsapp-telegram](skills/whatsapp-telegram/) · [automation-flows](skills/automation-flows/) · [api-connector-builder](skills/api-connector-builder/) · [webhooks](skills/webhooks/) · [data-scraper](skills/data-scraper/) · [spreadsheet-ops](skills/spreadsheet-ops/) · [calendar-scheduling](skills/calendar-scheduling/) · [document-processing](skills/document-processing/) · [e-signature](skills/e-signature/)

### ⚙️ Automation

Drive the big automation platforms through their REST API or MCP server. `automation-strategy` decides
whether, what and which platform.

[automation-strategy](skills/automation-strategy/) · [n8n](skills/n8n/) · [make](skills/make/) · [zapier](skills/zapier/) · [power-automate](skills/power-automate/)

### 📊 Data & analytics

[analytics](skills/analytics/) · [dashboard](skills/dashboard/) · [kpi-framework](skills/kpi-framework/) · [reporting](skills/reporting/) · [ab-testing](skills/ab-testing/) · [forecasting](skills/forecasting/) · [data-cleaning](skills/data-cleaning/) · [business-intelligence](skills/business-intelligence/)

### 🤖 AI: build it in

[building-agents](skills/building-agents/) · [rag](skills/rag/) · [embeddings-search](skills/embeddings-search/) · [prompt-engineering](skills/prompt-engineering/) · [llm-pipeline](skills/llm-pipeline/) · [agent-eval](skills/agent-eval/) · [chatbot](skills/chatbot/) · [ai-media](skills/ai-media/) · [replicate-images](skills/replicate-images/) · [structured-extraction](skills/structured-extraction/) · [agent-safety](skills/agent-safety/) · [cost-tracking](skills/cost-tracking/)

### 🛰️ AI: run it on

[replicate](skills/replicate/) · [runpod](skills/runpod/) · [modal](skills/modal/) · [huggingface](skills/huggingface/) · [ollama](skills/ollama/) · [together-fireworks](skills/together-fireworks/) · [fal](skills/fal/)

### 🎓 AI: train it

[machine-learning](skills/machine-learning/) · [deep-learning](skills/deep-learning/) · [nlp](skills/nlp/) · [finetuning](skills/finetuning/) · [training-data](skills/training-data/) · [unsloth](skills/unsloth/) · [open-weights](skills/open-weights/) · [vllm](skills/vllm/)

### 🗣️ Languages

[typescript](skills/typescript/) · [python](skills/python/) · [java](skills/java/) · [csharp-dotnet](skills/csharp-dotnet/) · [php](skills/php/) · [ruby](skills/ruby/) · [cpp](skills/cpp/) · [elixir](skills/elixir/) · [bash-scripting](skills/bash-scripting/) · [sql](skills/sql/) · [go](skills/go/)

### 🏗️ Frameworks & app stacks

[fastapi](skills/fastapi/) · [nextjs](skills/nextjs/) · [react](skills/react/) · [react-native](skills/react-native/) · [vue-nuxt](skills/vue-nuxt/) · [angular](skills/angular/) · [svelte](skills/svelte/) · [astro](skills/astro/) · [solid-js](skills/solid-js/) · [htmx](skills/htmx/) · [nodejs](skills/nodejs/) · [nestjs](skills/nestjs/) · [django](skills/django/) · [laravel](skills/laravel/) · [rails](skills/rails/) · [spring-boot](skills/spring-boot/) · [phoenix](skills/phoenix/) · [flutter](skills/flutter/) · [swift-ios](skills/swift-ios/) · [kotlin-android](skills/kotlin-android/) · [compose-multiplatform](skills/compose-multiplatform/) · [expo](skills/expo/) · [tauri](skills/tauri/) · [electron](skills/electron/) · [rust](skills/rust/) · [wordpress](skills/wordpress/) · [shopify](skills/shopify/) · [no-code-app](skills/no-code-app/) · [chrome-extension](skills/chrome-extension/) · [api-design](skills/api-design/)

### 🎮 Game development

[godot](skills/godot/) · [unity](skills/unity/) · [unreal](skills/unreal/) · [game-design](skills/game-design/) · [game-storytelling](skills/game-storytelling/) · [level-design](skills/level-design/) · [gamedev-shaders](skills/gamedev-shaders/) · [gamedev-multiplayer](skills/gamedev-multiplayer/) · [gamedev-physics](skills/gamedev-physics/) · [gamedev-pathing](skills/gamedev-pathing/) · [gamedev-shipping](skills/gamedev-shipping/)

### 🗄️ Databases & data layer

[postgresdb](skills/postgresdb/) · [mysql](skills/mysql/) · [mongodb](skills/mongodb/) · [redis](skills/redis/) · [supabase](skills/supabase/) · [neon](skills/neon/) · [planetscale](skills/planetscale/) · [sqlite-turso](skills/sqlite-turso/) · [prisma-orm](skills/prisma-orm/) · [drizzle-orm](skills/drizzle-orm/) · [firebase](skills/firebase/) · [dynamodb](skills/dynamodb/) · [vector-db](skills/vector-db/) · [clickhouse-analytics](skills/clickhouse-analytics/) · [duckdb](skills/duckdb/) · [db-migrations](skills/db-migrations/) · [backups](skills/backups/)

### ☁️ Ship & operate: platforms

[vercel](skills/vercel/) · [netlify](skills/netlify/) · [cloudflare](skills/cloudflare/) · [railway](skills/railway/) · [render](skills/render/) · [fly-io](skills/fly-io/) · [coolify](skills/coolify/) · [hetzner](skills/hetzner/) · [digitalocean](skills/digitalocean/) · [aws-essentials](skills/aws-essentials/) · [gcp-essentials](skills/gcp-essentials/)

### 🛠️ Ship & operate: devops

[docker](skills/docker/) · [github-actions](skills/github-actions/) · [git-workflow](skills/git-workflow/) · [domains-dns](skills/domains-dns/) · [monitoring](skills/monitoring/) · [email-deliverability](skills/email-deliverability/) · [scaling](skills/scaling/) · [deployment](skills/deployment/) · [deprecation](skills/deprecation/)

### 🔒 Ship & operate: quality & security

[code-review](skills/code-review/) · [security-scan](skills/security-scan/) · [secure-coding](skills/secure-coding/) · [testing-py](skills/testing-py/) · [testing-web](skills/testing-web/) · [testing-go](skills/testing-go/) · [e2e-testing](skills/e2e-testing/) · [accessibility](skills/accessibility/) · [performance](skills/performance/) · [error-handling](skills/error-handling/) · [observability](skills/observability/)

### 🌀 Motion & interface craft

[motion-craft](skills/motion-craft/) · [ui-engineering](skills/ui-engineering/) · [variant-explorer](skills/variant-explorer/)

### 🎨 Design & content craft

[design-loop](skills/design-loop/) · [design](skills/design/) · [design-dna](skills/design-dna/) · [presentations](skills/presentations/) · [course-storytelling](skills/course-storytelling/) · [course-builder](skills/course-builder/) · [technical-writing](skills/technical-writing/) · [translation-l10n](skills/translation-l10n/)

### 🧠 Knowledge & meta

[knowledge-ops](skills/knowledge-ops/) · [codebase-onboarding](skills/codebase-onboarding/) · [research-ops](skills/research-ops/) · [decision-records](skills/decision-records/) · [continuous-learning](skills/continuous-learning/) · [skill-scout](skills/skill-scout/) · [context-budget](skills/context-budget/) · [roast-me](skills/roast-me/) · [fable-operator](skills/fable-operator/)

---

## Why you can trust it

The harness is built on ten principles. Three of them shape everything else:

- **Evidence over claims.** A task is done when its check was observed, not when someone believes it
  works. The same rule applies to this README: every number here comes from `manifest.json` or the
  code, and tests check that the README and the code agree.
- **A gate that checks nothing is worse than no gate.** Every rule rsc declares binding ships with the
  mechanism that enforces it and a test that watches that mechanism fail and pass.
- **Friction proportional to risk.** Silence for the trivial, ceremony only where failure is
  expensive. A harness that nags on harmless work gets switched off.

**Known limits, stated openly:** the hard guards run only in Claude Code; OpenCode 2 and Windows have
had less real-world testing than macOS and Linux; and the session memory is local by design, never
cloud.

---

## Contributing

`skills/<name>/` is the single source of truth. Each skill is a directory whose `SKILL.md` frontmatter
drives triggering and recommendations:

```yaml
---
name: my-skill
description: Use when [specific triggers]… NOT x (that is sibling).
tags: [keyword, keyword]        # what the consult advisor searches over
recommends: [sibling-skill]     # what the system offers to install next
origin: risco
---
```

After editing any skill:

```bash
npm run manifest            # regenerate manifest.json from skills/*/SKILL.md
npm run validate            # validate frontmatter and recommends integrity
npm test                    # unit and integration tests
bash scripts/eval-lint.sh   # validate every skills/*/evals/cases.yaml
```

`manifest.json` is generated, never edited by hand; CI fails if it is stale. The rubric every skill is
held to is `scripts/skill-rubric.md`. Bug reports are welcome as GitHub issues. Release notes are in
[GitHub Releases](https://github.com/ericrisco/rsc-harness/releases).

### Third-party skills

Most of this catalog is written here. These are not, and they keep their author's credit:

| Skills | Source | License |
| --- | --- | --- |
| `design-eng` · `animate` · `animate-expo` · `review-animations` · `improve-animations` · `find-animation-opportunities` · `animation-vocabulary` · `apple-design` · `prototype` · `pick-ui-library` · `write-swift` · `ask-sonner` | [emilkowalski/skills](https://github.com/emilkowalski/skills) by Emil Kowalski, commit `d23d7f8` | MIT |
| part of the AI-tell corpus in `design` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT |
| the answer-first habits in `orient` | [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) | MIT |

Adapted, not mirrored: each carries rsc frontmatter, routing evals and hand-offs to its siblings. The
craft bar in them is the original author's.

## License

MIT. See [LICENSE](LICENSE).
