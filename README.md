<div align="center">

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/og.png" alt="rsc-harness — You decide what to build. rsc-harness builds your agent’s harness, following strict best practices instead of improvising a Frankenstein stack." width="960">

# `rsc-harness` — You decide what to build. It builds your agent's harness.

[![npm](https://img.shields.io/npm/v/@ericrisco/rsc?color=63d68a&labelColor=12161c&label=npm)](https://www.npmjs.com/package/@ericrisco/rsc)
[![downloads](https://img.shields.io/npm/dm/@ericrisco/rsc?color=63d68a&labelColor=12161c&label=downloads)](https://www.npmjs.com/package/@ericrisco/rsc)
[![skills](https://img.shields.io/badge/skills-271-63d68a?labelColor=12161c)](#the-catalog)
[![license](https://img.shields.io/badge/license-MIT-63d68a?labelColor=12161c)](LICENSE)
[![stars](https://img.shields.io/github/stars/ericrisco/rsc-harness?color=63d68a&labelColor=12161c)](https://github.com/ericrisco/rsc-harness/stargazers)

**You decide what to build. rsc-harness builds your agent’s harness.** Tell it whether you are
shipping software, running operations, researching, creating content, or mixing them. Its wizard
reads the project, applies strict best practices, and shows the exact harness plan before writing.

Give this URL to your agent:

```text
Read https://ericrisco.github.io/rsc-harness/ and set up rsc for this project.
Ask me the onboarding questions, show me the exact plan, and wait for my acceptance before writing.
```

Or start from the terminal:

```bash
npx @ericrisco/rsc@latest onboard
```

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/meta-harness.png" alt="rsc-harness wizard turns an outcome into a verified plan: memory, tools, knowledge and rules selected, deferred or excluded according to evidence." width="960">

</div>

## 🐋 New: DeepSeek Harness

[DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (`dsh`) is now a supported
assistant, the 18th. Pick it in the wizard or pass `--target deepseek`:

```bash
npx @ericrisco/rsc@latest onboard --target deepseek
```

- **Skills** go to `.dsh/skills/`, where dsh finds them on its own.
- **Instructions** go in the rsc block of `AGENTS.md`, which dsh already reads.
- **Session memory, knowledge sync and the update notice** run from dsh's own hooks. dsh has no
  hooks per project, so rsc adds one marked block to `~/.dsh/cordis.patch.yml` once per machine. That
  block runs the hooks of whichever project the session is in. It works in `dsh web` with several
  projects open, and in a project without rsc it does nothing. Restart dsh once after the first
  install. To turn it off, delete the block.

Details: [targets table](#multi-target).

---

## Your agent needs a harness. It should not improvise one.

A model is only the brain. Real work also needs project memory, tools, domain knowledge, rules and
repeatable workflows. Add those pieces ad hoc and the result becomes a **Frankenstein harness**:
duplicated instructions, unrelated skills, premature hooks, unnecessary MCPs and no clear owner.

Open standards already cover individual parts — [Agent Skills](https://agentskills.io/specification),
[MCP](https://modelcontextprotocol.io/) and [AGENTS.md](https://agents.md/) — but they do not decide
which complete harness this project needs. rsc-harness does that job through one guided flow:

1. **You state the outcome.** No skill, hook or MCP vocabulary required.
2. **The wizard reads only the project root** and asks how technical to talk, project kind, goal and
   assistants.
3. **A proportional plan explains every choice.** Selected, deferred and excluded pieces all have a
   reason. Nothing writes before you accept the exact plan.
4. **The result is verified.** Shared sources prevent duplication; knowledge loads progressively;
   local state stays local; deterministic checks prove the installed harness matches the plan.
5. **It grows from evidence.** A deferred capability is proposed later only when the project actually
   develops the need for it.

That is what “best practices” means here: a small, separated, project-bound and auditable harness —
not a pile of whatever an agent happened to install.

---

## 🛡️ New in 3.0: safe for teams by default

Day one with agents is easy. Day ninety is where harnesses break, especially with several people,
several assistants and several sessions on one project:

- every machine drifts, and what one person teaches their agent never reaches anyone else;
- two agents end up working in the same folder and switch branches under each other;
- someone's agent commits straight to `main` on a project in production;
- every request gets the same process, whether it is a typo or a new subsystem.

rsc 3.0 fixes all four, by default, with no new commands to learn:

| | What happens | Turn it off |
| --- | --- | --- |
| **You choose how the project works** | The install asks once: straight on `main`, or branches and pull requests? Branches are recommended only for long-lived, complex code. With `main` the agent works on it and never asks about branches. With branches a commit on `main` is refused, and before each code change the agent asks: this branch, a new one, or unlock `main`? It never opens a branch on its own. | Say **«unlock main»** / **«lock main»**, or `rsc main unlock` / `lock` |
| **One workspace per agent** | If another assistant session is working in the same folder, new work goes to a worktree under `.worktrees/<branch>/`. It stays inside the project, is never committed, and is removed once that branch is merged. | `rsc isolation off` |
| **The agent picks the method** | A simple change takes Fast-Track (one document, proof for every task). Something big or complex takes the spec-driven chain. The agent decides and says why. You still approve *what* gets built: the spec and the clarifications, then step by step or autopilot. | Ask for the other lane |
| **Knowledge reaches everyone** | `01-TOOLS/`, `02-DOCS/wiki/` and `02-DOCS/attachments/` travel through one exchange branch, `rsc/knowledge`. They go up when your turn ends and come down into whatever branch each person is on. They reach `main` inside your normal pull requests. | `rsc knowledge-sync off` |

**Commit, push and pull request without a prompt each time.** A harness installed from scratch lets
the agent run `git commit`, `git push` and `gh pr create` without asking, because those are the steps
that close every lane. A force-push still asks. In Claude Code, rsc's guards still decide: a commit on a
closed `main` is refused whatever the permission says. No other assistant runs those guards. It is a project decision, saved as `gitPermissions` in
`.rsc.json`. A clone gets the same setting. A project adopted before this is left as it was until
someone runs `rsc git-permissions on`.

| Assistant | Where it goes |
| --- | --- |
| Claude Code | `.claude/settings.json` → `permissions.allow` (force-push under `ask`). Claude Code applies it once the folder is trusted. |
| Codex | `.codex/rules/rsc-git.rules` (`prefix_rule`; force-push → `prompt`). Loaded when the project is trusted. |
| Gemini | `.gemini/settings.json` → `tools.allowed` |
| OpenCode | `opencode.json`. With OpenCode 2 installed: the top-level `permissions` list (`shell` rules; force-push → `ask`). rsc's rules go before yours, so any rule of yours that matches later still wins; only a leading `"*"` allow/ask default stays in front. With OpenCode 1.x, or when `opencode --version` cannot be read: `permission.bash`, which both versions read. Moving to 2 moves rsc's entries over. An `opencode.jsonc` is read but never rewritten (its comments would be lost): rsc prints the rules to paste. |
| Cursor | Not covered: its CLI matches only the first word, so allowing a push would allow every git command. |
| DeepSeek Harness | Not covered: dsh has no per-command allow list. Its own Permissions selector (`/permission`) sets approval for every command at once. |

```bash
rsc git-permissions status   # per assistant: wired or not, and in which format (--json for scripts)
rsc git-permissions off      # remove rsc's rules (saved in .rsc.json)
rsc git-permissions on       # turn it on, also for a project adopted before
```

**What `off` turns off.** Only rsc's allow rules. Each command says, per assistant, what rsc controls
there, what stops when it is off, and what is left to the assistant. `off` does not hand rsc's
protections to the assistant. Claude Code keeps rsc's guards (branch-guard, danger-guard), because
they do not depend on this switch. OpenCode, Codex and Gemini run no rsc guard. There, your own
settings decide. With no rule matching, OpenCode 2 asks and OpenCode 1.x runs the command. To refuse a
force-push in OpenCode 2, add this at the end of `permissions` (use `"ask"` to get a human approval):

```json
{ "action": "shell", "resource": "git push --force*", "effect": "deny" },
{ "action": "shell", "resource": "git push -f*", "effect": "deny" },
{ "action": "shell", "resource": "git push * --force*", "effect": "deny" },
{ "action": "shell", "resource": "git push * -f*", "effect": "deny" }
```

In OpenCode 1.x the same patterns go at the end of `permission.bash` (`"git push --force*": "deny"`, …).

**How does it know a project is "complex or in production"?** There are two layers. A hook counts
what anyone can check: a CI setup, a deployment file (`Dockerfile`, `vercel.json`, `fly.toml`…) or
at least two people in the last 50 commits. If any of those is there, a commit on the default branch
is refused before it runs, and the agent asks you whether to open a branch or unlock it. If none is,
`main` is open and the agent simply works on it. **The answer you gave at install always wins over
this detection**; it only decides for projects installed before the question existed. If the hook gets it wrong and the project really is simple, «unlock main» opens it for
the project. That decision is saved in `.rsc.json`, so the whole team gets it.

Every refusal says how to carry on, and the choice between a branch and unlocking goes back to you.
An agent is never left stuck. The rules only see what the **agent** runs; a person
committing in their own terminal is never touched.

**The first session after upgrading** does three things, once:

- It explains these changes in a few lines.
- If an agent left commits on a closed `main` that never reached the remote, it moves them to a
  `rescue/main-<date>` branch and puts `main` back to what the remote has. Nothing is lost.
- It moves worktrees older versions created next to the project into `.worktrees/`.

```bash
rsc main status        # open or closed for the agent, and the signals behind it
rsc main unlock        # this project is simple: the agent may work on main (saved in .rsc.json)
rsc main lock          # back to the default
rsc isolation status   # whether another session would send new work to a worktree
rsc isolation off      # never use worktrees for parallel sessions in this project
```

> **Limit, stated plainly.** The hook that refuses the commit or the branch switch runs in
> **Claude Code**, like the other rsc guards. In Codex, Gemini, Cursor and OpenCode the same rules
> are carried by the skills and by the session memory, which tells the agent that another session is
> active. They are followed, but no hook enforces them. Knowledge sync works in all five.

---

## 🤖 For agents: "install this harness"

If you're an AI coding agent (Claude Code, Cursor, Copilot, Codex, Gemini…) and your user
asked you to **install rsc / this harness / these skills**, run this in the **root of the
project they're equipping** — not inside a clone of this repo (see the note under *Install*):

```bash
npx @ericrisco/rsc@latest onboard
```

That launches the binding plain-language onboarding. It asks the user how technical to talk
(technical or with analogies), project kind and goal **before it writes anything**, reads only the selected project
root, and shows every selected or deferred skill, agent and hook with its reason. Relay those
questions to the user; never invent or default their answers. The first pass writes nothing and
prints a SHA-256 plan id. Only rerun with `--accept-plan <id>` after the user accepts that exact plan.
If the project already has a skill of its own with a catalog name, the plan lists it under
**Your own skills this plan replaces** — tell the user before accepting; renaming their folder and
regenerating the plan keeps theirs.

For a non-interactive agent, collect the answers and preview the same plan explicitly:

```bash
npx @ericrisco/rsc@latest onboard --technical-level technical \
  --project-kind software --goal "small compound-interest website" \
  --software-scope small --target codex
# After the user accepts the printed plan:
npx @ericrisco/rsc@latest onboard --technical-level technical \
  --project-kind software --goal "small compound-interest website" \
  --software-scope small --target codex --accept-plan PRINTED_SHA256_ID
```

- **Choose assistants non-interactively:** add `--target claude` (comma-separate for several) to `onboard`.
- **Two assistants already installed?** rsc asks instead of guessing. `--target` settles it in one word.
- **Already installed, just refreshing skills + hooks:** `rsc sync` (or re-run the command above).
- **Add one skill by id:** `rsc add <id>` · **browse the catalog:** `rsc consult "<what you want>"` or `rsc list`.

From then on it's self-driving: `rsc-suggest` proposes the next skill as tasks appear, and in
Claude Code a hook re-asserts the **lane decisor** on every turn — so every request is classified
before anything is written.

---

## 🛣️ Three lanes, and the agent picks the right one for you

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/lanes.svg" alt="The rsc lane decisor: the agent classifies each request into answer (read-only), FTD (simple change, one feature document) or SDD (the ten-phase chain for big or complex work, entered by the agent; you approve the spec)." width="960">

Every turn takes exactly one lane, and your agent names the one it took in a line.

1. **Answer.** The request asks for information — explain, compare, investigate, audit, review,
   propose. It is **read-only**: nothing is written, no artifact is created, no writer is delegated.
   Asking your agent to *think about* building something is still this lane. When intent is
   ambiguous it asks one question and stays here; ambiguity slows the lane down, it never raises it.
2. **FTD — Fast-Track Development.** The request authorises a change. This is the default for
   ordinary work and needs no ceremony. One feature document per feature holds intent, scope, a
   checklist, the evidence and the next step. Tasks are checked off against observed proof, never
   against intention. For the simple changes.
3. **SDD — the ten-phase chain.** For the big or complex: several decisions that affect each other,
   or doubts that change the result. **The agent enters it on its own** — you never have to decide
   which method to use. Inside, you still decide *what* gets built: you approve the spec and answer
   the clarifying questions, then choose to review every phase yourself or let it run on autopilot
   to verified code. Publishing always asks.

The agent says which lane it took and why, in one line. Ask for the other one and it switches.

**The review only brings you what is real.** In SDD, `review` sends three adversarial reviewers at
the diff (correctness, security, tests). They often find the same defect in different words, and a
reviewer hunting for problems can overstate one. So before anything reaches you,
`rsc review consolidate` merges the duplicates (same place, or the same quoted line), and every
serious finding left goes to a fresh `finding-verifier` agent whose starting position is that the
finding is false. It blocks the merge only if the verifier reproduces it or traces it. You get
"11 reported → 4 unique → 2 confirmed", and the refuted ones are listed with the reason.

**Isolation cleans itself up.** When a lane opens a branch or a worktree, you no longer have to
remember to retire it: a `post-merge` hook does it the moment the work lands on the trunk, on both
landing paths — a local merge and the pull after a forge merge. It removes only what is provably
landed and holds nothing unsaved; anything it refuses tells you why. The previous version asked an
agent to run the cleanup at the end of a long phase, and that step was skipped on both features that
reached it.

Earlier versions asked you to accept a proposal before entering the chain. People do not want to
choose a method; they want the work done right. Since 3.0 the agent chooses, and you keep the part
that is genuinely yours: deciding what is built.

---

## 🗣️ It talks so you understand

Agents assume you saw their reasoning, and they write too much. rsc fixes the voice, not the reader.

- **Short sentences, one idea each.** The style comes from ASD-STE100, the controlled writing of
  aircraft maintenance manuals, applied at about 80% and in your language.
- **Every answer stands alone.** No "that fix" or "the second commit": the answer names the thing,
  with the minimum context to understand it.
- **One question at install:** technical, or with analogies. That is the only setting.
- **A ladder when you do not follow.** Text first. Then one diagram. Then one HTML page. A video
  only if you ask for it.

Every turn still closes with the compass: where you are, and the next step as a question. The voice
lives in `orient`, which every harness installs. Text you send to other people (emails, posts,
READMEs) goes through `unslop` instead: it sounds like a person and carries no AI tells.

---

## Why this exists

An improvised harness tends to grow by accumulation: more files, more context and more rules, with
no method deciding whether each piece belongs. rsc-harness keeps that construction disciplined:

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
- **A new local session continues the old one.** Claude Code, Codex, Gemini CLI,
  OpenCode and DeepSeek Harness load a bounded checkpoint for the current branch and worktree at
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

- **Full:** Claude Code, Codex, Gemini CLI, OpenCode and DeepSeek Harness (through rsc's machine
  bridge, see [targets](#multi-target)). Codex asks you to inspect
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

The first run asks **one** question about conversation: technical, or with analogies. Then what the
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
  271 skills · one CLI · zero bloat

How should I talk to you?
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
That verdict is not just about the receipt: it also requires the harness floor to exist —
`01-TOOLS/_TEMPLATE/`, `02-DOCS/wiki/harness/`, and the constitution when the plan selects SDD.
If the floor is missing, the install applied but prints `RSC_ONBOARDING_INCOMPLETE` with each
missing path and the action that creates it, because a plan that promised little used to be able to
report success with three markdown files. When the plan selects SDD, onboarding writes the
constitution itself as a draft (`status: draft`, only the facts it knows, no principles), so a
non-interactive install still ends `RSC_ONBOARDING_READY`; the draft is listed as pending — under
READY and in `rsc doctor` — until the `constitution` phase completes it. An existing constitution is
never overwritten.

---

## The CLI

Fresh projects enter through `rsc onboard`. The direct `add` and `install` forms below
are maintenance controls for projects that already carry an `.rsc.json` declaration; they cannot
bypass onboarding in a new folder.

```bash
rsc onboard                         # binding plain-language onboarding (recommended)
rsc reassess                        # check persisted deferral triggers; never installs by itself
rsc add fastapi postgresdb           # install specific skills, by name
rsc add youtube-api remotion-video   # …grow a channel, edit with Remotion
rsc add fastapi --target claude,codex   # install into several assistants at once
rsc consult "I want to launch a SaaS"  # recommend only, no install
rsc registry refresh                 # write .rsc/skill-registry.{json,md}
rsc list                             # installed skills, agents and commands
rsc capabilities                    # installed/available surfaces + memory mode
rsc doctor                           # health, missing backing, hooks and local memory; exits 1 when unhealthy
rsc memory status                    # full / assisted / unsupported / degraded
rsc memory save --session handoff    # force a deterministic local checkpoint
rsc memory resume                    # print this branch/worktree continuation
rsc memory learn --text "…" --evidence "…" --confidence 0.8 --approve
rsc memory off                       # disable hooks, commands and injection project-wide
rsc sync --target claude,codex       # refresh managed skills/hooks from the current package version
rsc agent-model opencode openai/gpt-5   # pin the model the generated agents carry (saved in .rsc.json)
rsc agent-model opencode inherit     # back to the session's model (OpenCode's default)
rsc agents status                    # installed agents, and which ones you edited
rsc agents reset developer           # take rsc's version of an agent you edited (yours is backed up first)
rsc review consolidate c.md s.md t.md  # merge the review lenses' findings; serious ones go to finding-verifier
rsc backups                          # list project-local snapshots
rsc restore latest --dry-run         # preview restoring the newest snapshot
rsc restore <snapshot-id>            # restore a project-local snapshot
rsc upgrade --dry-run                # show npm upgrade + sync commands
rsc uninstall postgresdb --dry-run   # preview a removal
```

### `rsc doctor`: harness health vs onboarding readiness

`doctor` answers two different questions, and prints both first, on separate lines:

```text
Harness health: healthy
Onboarding readiness: pending
Pending: 02-DOCS/wiki/sdd/constitution.md (draft)
Next: Complete 02-DOCS/wiki/sdd/constitution.md with the `constitution` phase …
```

- **Harness health** (`healthy` in `--json`) says whether what is installed works: skills, agents,
  commands and hook scripts are on disk. It is the only thing the exit code follows (1 when
  unhealthy), so CI and editor extensions can rely on it.
- **Onboarding readiness** (`onboarding` in `--json`: `status`, `missing`, `pending`, `action`) says
  whether onboarding is finished. It checks the accepted plan's floor, the same check that prints
  `RSC_ONBOARDING_READY`, plus drafts. The status is `ready`; `pending` when a draft such as the
  onboarding constitution still has to be completed; `incomplete` when part of the floor is missing,
  for example a deleted constitution in an SDD plan, with the exact phase or command that fixes it;
  or `not onboarded` when there is no onboarding record, as in a manual `rsc add` install. Readiness
  never changes `healthy` or the exit code. `Missing:` and `Pending:` appear only when they have
  entries.

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

Three files carry the harness through git: `.rsc.json` (what the team decided),
`.claude/settings.json` (the wiring), and `.claude/rsc-bootstrap.mjs` — the small file that
notices, in a clone, that the rest is not there yet. **Commit all three.** If your project
ignores the assistant's directory wholesale, rsc adds the lines that keep those files versioned —
verified against git, not against the pattern.

**And say it plainly, because committing it is the point:** `.claude/rsc-bootstrap.mjs` is code that
runs on every session and every shell call, so a pull request that edits *that file* runs on the
machine of whoever reviews the branch. That is true of `.claude/settings.json` already, and of any
hook-based harness — but it is worth knowing before you agree to commit a third one. Review changes
to it the way you would review a CI workflow.

Whoever clones runs **one command** and ends up with the same harness — at the version the
project pinned, which is the `catalogVersion` in its `.rsc.json`:

```bash
npx @ericrisco/rsc@<catalogVersion> sync
```

**You do not have to know that, or find it.** Open the project and the assistant tells you, in
the first message: what is missing, what would be installed, and the exact command, naming the
pinned version. It asks; it does not install anything on its own and it does not hold up
whatever you sat down to do. Say no and it stops asking on that machine.

Not `@latest`, and the difference is the whole point of sharing: a teammate who clones in three
months gets what you had, not what shipped since. Once it is built, the same rules as any project
apply: releases in the same major install themselves (see [Update](#update)), and the new
`catalogVersion` in `.rsc.json` reaches everyone when somebody commits it.

When someone changes the harness and you `git pull`, `rsc doctor` tells you what no longer
matches. **Nothing is ever written to your machine by a pull** — you are told, and you decide.

**Own skills.** A skill your team wrote lives in the repo and already works for whoever clones,
with no command at all. rsc never installs, updates or overwrites it: its version is the commit.
Installing a catalog skill of the same name is refused rather than silently winning, and `doctor`
lists what is yours by reading the files themselves — no list to keep in `.rsc.json`, because a
list somebody has to remember to update is a list that goes quietly stale. Declaring a skill under
`ownSkills` still works and still reports when someone is missing it.


### Your wiki and tools stay in sync — on by default

`01-TOOLS/`, `02-DOCS/wiki/` and `02-DOCS/attachments/` are the team's knowledge, so rsc keeps them
the same on every machine without anybody thinking about git, **and without ever pushing to `main`**.
Exactly those three folders, minus rsc's own `01-TOOLS/_TEMPLATE/` and your personal
`02-DOCS/wiki/harness/user-profile.md`. Your `main` is
protected, or should be; rsc assumes it is.

The knowledge travels through one exchange branch, `rsc/knowledge`, that nobody works on by hand:

```text
ana    · feat/login     edits 02-DOCS/wiki/api.md ──► rsc/knowledge      (when her turn ends)
eric   · feat/payments  📥 1 change from Ana        ◄── rsc/knowledge      (before his next message)
main   · protected      untouched — gets it inside the next merged pull request
new    · clones main    has it all after the first message
```

- **When a turn ends**, your changes in those folders are committed on your branch as
  `📝 docs(auto): …` and sent to `rsc/knowledge` on `origin`, from whatever branch you are on. Only
  the copy on `rsc/knowledge` carries `[skip ci]`; the commit on your branch does not, so your next
  ordinary push still runs CI. Two cases commit nothing on your branch: a closed `main`, and code of
  yours still uncommitted (a docs commit would land ahead of the code it describes). Then the snapshot
  is built aside, only goes to `rsc/knowledge`, and the files stay modified for you to commit with
  your work. Knowledge that you or the agent already **committed** on the branch goes up too — only
  its knowledge part, under a `docs(auto) … [skip ci]` message. Commits that came in by merging
  `main` are your teammates', not yours, and are not sent again.
- **Before each message**, what teammates sent is brought into **the branch you are on** as a
  `📥 docs(auto): sync` commit, and you are told in one line. Only the knowledge folders are touched.
  A doc that `main` on `origin` already has, identical, is left for your ordinary merge of `main`. On
  a closed `main` nothing is written at all — an uncommitted file there would make your next
  `git pull` refuse to run — you are told what is waiting, and it arrives with that pull or in the
  next branch you open. When the last fetch is more than ten minutes old, the message fetches first
  (three seconds at most), so even a one-message session sees fresh docs.
  A branch you open later catches up on its first message: everything on `rsc/knowledge` since it
  left `main` comes down, including what you wrote yourself on another branch.
- **It reaches `main` the normal way.** Your feature branch now carries the team's knowledge, so it
  arrives in `main` inside the pull request you were going to open anyway. There is no extra pull
  request from `rsc/knowledge`, and nobody has to merge it.
- The first time, `rsc/knowledge` is created from the remote's default branch. If someone deletes it,
  it is created again.

What it will not do, by design:

| | |
| --- | --- |
| Push to `main` | Never. Only `rsc/knowledge` receives anything. |
| Push your code or your unpushed commits | Only the knowledge folders go up, even from a commit that also has code. Your code waits for you. |
| Trigger CI or a deploy | Every commit on `rsc/knowledge` says `[skip ci]`; the one on your branch does not, so it never skips the CI of your own push. |
| Bring in anybody else's code | Only knowledge paths come down. Code, config and `.claude/` are never pulled. |
| Sync `02-DOCS/wiki/harness/user-profile.md` | Those are one person's dials. |
| Overwrite a file you are editing | It tells you, and your version stays. |
| Run where it has no business | No `origin`, no knowledge folders, a rebase in progress, a cloud agent: it stays quiet. |

It is wired into the assistant's own turn hooks (end of turn, new message) in Claude Code, Codex,
Gemini, Cursor, OpenCode and DeepSeek Harness (tested end to end in Claude Code, Codex and OpenCode). The network part runs in the background, so a turn never waits for
it. It is kept apart from the [local session memory](#new-sessions-pick-up-the-latest-local-work),
which promises never to touch the network. The first turn says it is on. To turn it off for the
project:

```bash
rsc knowledge-sync off      # writes .rsc/.no-knowledge-sync and records it in .rsc.json — commit that
rsc knowledge-sync status   # active or not, and why
```

It is a **project** switch, not a personal one: if one person stopped sending, the rest of the team
would stop seeing their work. For the rest of the 3.0 team defaults, see
[New in 3.0](#️-new-in-30-safe-for-teams-by-default).

## 🩹 Something's off? One command

Recognise any of these? They are all the same fix.

| What you see | |
| --- | --- |
| `"target": "codex"` when you work in Claude Code | |
| `This target has no hook injection` and you did not expect that | |
| Skills appear that you never asked for | |
| A hook seems to run several times per turn | |
| Template lines showed up inside your hand-written `AGENTS.md` | |

(A *fresh* clone is not in this table any more: nothing is broken there, the harness was simply
never built on that machine, and the assistant now says so itself — see **sharing by git** above.)

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

**rsc updates itself.** When a session starts, rsc checks npm for a newer version:

- **Same major** (`2.1.0 → 2.1.1` or `2.2.0`): it installs that exact version in the background.
  It takes effect in the next session, and that session tells you it happened.
- **New major** (`2.x → 3.0.0`): it can change how the harness works, so the assistant asks first.
- **Failed:** the assistant asks instead, and rsc retries once a day. The output is in
  `.rsc/auto-update.log`.

A new install asks whether you want this (yes by default). To turn it off later, create
`.rsc/.no-auto-update`; every release then asks. It is a project decision: it travels in
`.rsc.json` like the other switches. The update can leave harness files changed in git; rsc never
commits them for you.

Where it runs on its own: **Claude Code, Codex, Gemini CLI, Cursor, OpenCode and DeepSeek Harness**, from a
session-start hook. Every other assistant has no such hook, so the always-on instructions ask the
agent to run `node .rsc/auto-update.mjs` on its first turn — same rules, but it depends on the agent
doing it (and some assistants ask your permission before running a command). Codex asks you to
trust new hooks once.

To update by hand, bump the package, then re-sync what's already wired into your project:

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

**From 2.0.x to 2.1.0:** `eli5` and `show-me` became part of `orient`, and `bro` became part of
`unslop`. The update removes the three old skills (only the copies rsc installed) and installs the
ones that replace them. An `accompaniment_level` line in your profile is ignored: the only setting
now is `technical_level`.

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

271 skills, grouped by what you're trying to do. Click any skill to read its
`SKILL.md`. It fires on its own when a task matches.

### 🧭 Core & control plane
The front door and the workspace brain.

[init](skills/init/) · [harness](skills/harness/) · [orient](skills/orient/) · [suggest](skills/suggest/) · [unslop](skills/unslop/) · [author-skill](skills/author-skill/) · [sdd-init](skills/sdd-init/)

> **harness** is the Karpathy *chaos→knowledge* engine — a `01-TOOLS/` layer (one
> folder per provider, each with a working `test_connection`) and a `02-DOCS/`
> self-improving wiki. It governs software *or* a whole company. **orient** is the
> always-on voice: short STE-style sentences, every answer understandable on its own,
> technical or with analogies, and a diagram or an HTML page when you do not follow.
> **unslop** is installed with every profile and makes text you send to others sound
> like a person, with no AI tells.

<img src="https://raw.githubusercontent.com/ericrisco/rsc-harness/main/site/company-brain.svg" alt="The rsc company brain as a 3D knowledge graph: loose material drifts in from the inbox on the left and is absorbed into the bright green wiki cluster, whose brightest hubs are its .base views; dim clusters behind are raw sources and the agent's own captured worklog; an amber cluster is gaps.md, what the wiki knows it is missing." width="960">

Anything you drop in goes to `inbox/` and is ingested; the wiki consolidates it as plain markdown you can open as an
Obsidian vault; and every skill reads it before acting, so the next session starts where the last one stopped. Raw
sources and the agent's own worklog stay underneath — present, never deleted, out of the way.

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
Two lanes for change: `ftd` for ordinary work — one feature document, evidence, done — and the ten-phase chain when durable artifacts would settle a real ambiguity. Both ship with the harness.

[ftd](skills/ftd/) · [sdd](skills/sdd/) · [constitution](skills/constitution/) · [idea-refinement](skills/idea-refinement/) · [specify](skills/specify/) · [clarify](skills/clarify/) · [plan](skills/plan/) · [tasks](skills/tasks/) · [analyze](skills/analyze/) · [decision-challenge](skills/decision-challenge/) · [implement](skills/implement/) · [source-grounded-development](skills/source-grounded-development/) · [verify](skills/verify/) · [review](skills/review/) · [simplify-code](skills/simplify-code/) · [ship](skills/ship/) · [debug](skills/debug/) · [worktrees](skills/worktrees/) · [parallel](skills/parallel/)

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

[connect-tool](skills/connect-tool/) · [stripe](skills/stripe/) · [email-connector](skills/email-connector/) · [google-workspace](skills/google-workspace/) · [notion-connector](skills/notion-connector/) · [whatsapp-telegram](skills/whatsapp-telegram/) · [automation-flows](skills/automation-flows/) · [api-connector-builder](skills/api-connector-builder/) · [webhooks](skills/webhooks/) · [data-scraper](skills/data-scraper/) · [spreadsheet-ops](skills/spreadsheet-ops/) · [calendar-scheduling](skills/calendar-scheduling/) · [document-processing](skills/document-processing/) · [e-signature](skills/e-signature/)

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

[knowledge-ops](skills/knowledge-ops/) · [codebase-onboarding](skills/codebase-onboarding/) · [research-ops](skills/research-ops/) · [decision-records](skills/decision-records/) · [continuous-learning](skills/continuous-learning/) · [skill-scout](skills/skill-scout/) · [context-budget](skills/context-budget/) · [roast-me](skills/roast-me/) · [fable-operator](skills/fable-operator/)

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
| `deepseek` | `.dsh/skills/<id>/` → symlink (DeepSeek Harness discovers it natively) | block in `AGENTS.md` |
| `jules` | `.jules/rsc/<id>/` → symlink | block in `AGENTS.md` |
| `junie` | `.junie/rsc/<id>/` → symlink | block in `.junie/guidelines.md` |
| `kiro` | `.kiro/rsc/<id>/` → symlink | doc in `.kiro/steering/rsc-suggest.md` |
| `aider` | `.aider/rsc/<id>/` → symlink | block in `CONVENTIONS.md` |

> `codex`, `zed`, `amp`, `opencode`, `deepseek` and `jules` all share the one root
> `AGENTS.md`; the block is idempotent, so picking several writes it once.

> **DeepSeek Harness** (`dsh`) has no project-level hook config: its plugins are per machine. So
> the `deepseek` target writes the project hooks to `.dsh/hooks.json` (Codex format, untracked) and,
> once per machine, adds one marked block to `~/.dsh/cordis.patch.yml` (or `$DSH_HOME`) that mounts
> dsh's Codex-hooks bridge on rsc's dispatcher in `~/.dsh/rsc/`. The dispatcher runs the hooks of
> whichever project the session is in, so `dsh web` serving several workspaces works too, and a
> project without rsc runs nothing. Restart dsh once after the first install. Delete the block to
> turn it off.

The richer surfaces are intentionally narrower than skill support:

| Targets | Stack agents | Native commands | Local session continuation |
| --- | --- | --- | --- |
| Claude Code | yes | agent + memory entries; skills already invoke natively | full |
| Codex | yes | no separate project-command surface | full after `/hooks` trust |
| Cursor desktop | yes | yes | assisted |
| Gemini CLI, OpenCode | yes | yes | full |
| DeepSeek Harness | unsupported | unsupported | full (through the machine bridge) |
| GitHub Copilot | yes | yes | unsupported |
| Junie, Kiro | yes | unsupported | unsupported |
| Windsurf, Cline, Roo | unsupported | yes | unsupported |
| Antigravity, Zed, Continue, Amp, Jules, Aider | unsupported | unsupported | unsupported |

`manifest.json` is the generated public inventory: 34 agents (5 base + 29
selective specialists) and 53 command entries (20 fixed + 33 stack aliases).
Unsupported means rsc writes nothing for that surface; it does not emulate a
provider feature with an unverified file.

**Generated agents follow your project, not rsc's defaults.** OpenCode agents carry no `model:`, so
they use whatever model the session runs (a local one, OpenAI, Anthropic). To pin one for the whole
team, run `rsc agent-model opencode <model>`: it is saved as `agentModels` in `.rsc.json` and works
for any target with agents (`inherit` drops the pin). OpenCode agents never grant a tool either: a
read-only reviewer only gets `edit`, `write`, `patch` and `bash` set to `false`, and an agent that may
edit or run commands gets no `tools` block, so your project's permission policy decides. If you edit
a generated agent, `rsc sync` keeps your file and says so. `rsc agents reset <name>` (or `--all`)
takes rsc's version back after a backup in `.rsc/backups/`.

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
