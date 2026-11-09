# Eval harness — `worktrees` skill

These evals are run by an **agent harness** (an LLM agent with the rsc-sdd + stack skill catalog
available), not a byte-exact shell script. `cases.yaml` is the fixture; this file is the procedure.
Grading is judgment-based — a human or a judge-agent scores against the rubrics.

`worktrees` is a process skill — an **on-demand** SDD step that runs right before `implement`. It is
judged on **routing accuracy** (does it fire only when the intent is *isolate a workspace before
code is touched*, and stay silent on the adjacent coding/cleanup/diagnosis steps) and **capability**
(does it run the pre-flight gate, pick branch-vs-worktree correctly, prefer the native tool, and
hand off without writing code).

## 1. Triggering accuracy

Goal: `worktrees` fires when the user wants an isolated workspace before implementing, and stays
silent on the neighbouring steps (the coding loop, the task breakdown, the branch cleanup/ship, the
debug protocol, the workspace bootstrap).

1. Load **only** the `worktrees` skill description into the agent, plus the bare names of the sibling
   skills for routing: the rsc-sdd phases (constitution, specify, clarify, plan, tasks, analyze,
   implement, verify, review, ship, debug, parallel) and the stack/other skills (fastapi, nextjs,
   go, postgresdb, flutter, design, marketing, presentations, course-storytelling, building-agents,
   security-audit, deployment, harness, init). Do **not** load any skill bodies.
2. For each prompt in `should_trigger` and `should_not_trigger`, ask the agent which skill (if any)
   it would invoke. Run **3–5 trials per prompt** at production temperature to catch flakiness.
3. Score:
   - `should_trigger` → PASS if `worktrees` is selected in the majority of trials.
   - `should_not_trigger` → PASS if `worktrees` is **not** selected; bonus-correct if it routes to
     the `route_to` sibling named in the case.
4. **Pass bar: ≥ 90% of prompts pass** (at most 1 miss across the 12 prompts), and no
   `should_not_trigger` prompt may fire `worktrees` in a majority of its trials. The two
   highest-value near-misses to get right are `implement` (the phase immediately after — coding on an
   already-isolated branch must NOT re-trigger isolation) and `ship` (the phase that *closes* the
   branch — merge/PR/cleanup is not this skill's open-isolation job).

### Routing note (which siblings exist on disk)

`route_to` is a conceptual label, not a link. All five near-miss targets — `implement`, `tasks`,
`ship`, `debug`, `harness` — exist as skill directories in this repo, so each route is to a real
sibling. The skill body links the resolvable cross-references it uses (`../implement/SKILL.md`,
`../tasks/SKILL.md`, `../ship/SKILL.md`) and names the on-demand `parallel` / `debug` patterns in
prose; verify links still resolve if the catalog is reorganized.

## 2. Capability uplift (with vs without)

Goal: the skill measurably improves the isolation step, not just gates it.

1. For the `capability` scenario, run the agent **twice**:
   - **WITHOUT**: base agent, no `worktrees` skill loaded.
   - **WITH**: same prompt, `worktrees` skill fully loaded.
2. Grade each output against the `must_include` checklist — count a point only if it is genuinely
   satisfied, not merely gestured at. The load-bearing points are: the pre-flight gate (repo +
   branch + `git status` before acting), the branch-vs-worktree decision justified by the live dev
   server, preferring the native tool with a git fallback, a slug-matched name, and handing off to
   `implement` without writing code.
3. Coverage = points satisfied / total points, per run.
4. **Pass bar:**
   - WITH-skill coverage **≥ 80%** of the rubric.
   - WITH clearly beats WITHOUT. The signature uplift to look for: the WITHOUT run tends to run a
     bare `git checkout -b` (or even start editing on `main`), skip the dirty-tree check, ignore the
     native tool, and blur straight into writing code; the WITH run runs the pre-flight gate, picks a
     *worktree* because a process is live on the current files, names it `feat/<slug>`, confirms the
     main checkout is untouched, and hands to `implement`.
5. Run 2–3 trials per condition and average; note any rubric point the skill never produces — that is
   a gap to fix in `SKILL.md`.

## Notes

- Prompts deliberately vary phrasing; several omit the word "worktree" (the live-dev-server case, the
  dirty-WIP case) so triggering rests on the signal "isolate a workspace before touching code", not
  keyword matching.
- Near-misses route to the genuinely correct sibling: already-isolated-now-code → implement,
  plan-to-checklist → tasks, merge/PR/cleanup → ship, failing-test-root-cause → debug,
  workspace-bootstrap → harness.
- The one unrecoverable failure mode for this skill is bulldozing a user's uncommitted WIP; the
  capability rubric and the SKILL.md red flags both gate on checking `git status` before acting.
- This is judgment-based, not byte-exact. Record trial counts and the judge (human or model)
  alongside results for reproducibility.
