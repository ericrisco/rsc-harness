# Eval harness — `presentations`

These evals are run by an **agent harness** (an LLM agent with the skill catalog
available), not a pure shell script. There is no automated grader; a human or a
judge-agent scores against the rubrics in `cases.yaml`. Two things are measured:
**triggering** (does the right skill fire?) and **capability** (does the skill make
the answer measurably better?).

## Setup

- One agent, the full skill catalog discoverable by description only (`fastapi`,
  `nextjs`, `go`, `postgresdb`, `flutter`, `design`, `marketing`, `presentations`,
  `course-storytelling`, `building-agents`, `security-audit`, `deployment`, `harness`,
  `init`). The agent must choose which skill(s) to load — do not pre-load any.
- Run each prompt in a fresh session (no memory carryover between trials).

## 1. Triggering

For every prompt in `should_trigger` and `should_not_trigger`:

1. Start a clean session with only skill **descriptions** visible.
2. Paste the prompt verbatim. Observe which skill the agent loads/invokes first.
3. Run **3–5 trials** per prompt (phrasing is fuzzy; repetition catches flakiness).

Scoring per prompt:

- `should_trigger` → **pass** if `presentations` is invoked in a strong majority of
  trials (>= 4/5).
- `should_not_trigger` → **pass** if `presentations` is **not** invoked, AND ideally
  the agent routes to the `route_to` sibling (or asks/declines when `route_to: none`).
  Loading `presentations` here is a **fail** (false positive).

**Pass bar:** >= 90% trigger accuracy across all cases (false positives are weighted
heavily — a near-miss that fires is worse than a true-positive that misses once).

## 2. Capability (with vs without the skill)

For each `capability` scenario, run the same prompt twice:

- **WITHOUT** — agent answers with the skill **not** loaded (baseline).
- **WITH** — agent answers with `presentations` loaded.

Grade both outputs against that scenario's `must_include` checklist (one point per
item covered substantively, not just name-dropped). Run 2–3 trials each side and
average to reduce variance.

**Pass bar:**

- WITH covers **>= 80%** of `must_include` points.
- WITH beats WITHOUT by a clear margin (the brand-grounding gate, assertion-evidence
  discipline, token-driven theming, legibility floors, `[[NEEDS PROOF]]`, and
  export verification should be largely absent or vague WITHOUT the skill).
- If WITHOUT already satisfies the rubric, the case is too generic — tighten it.

## Notes

- Judge on substance, not keywords: "grounds copy in the brand study" must show as
  an actual gate (locate → check → interview/cite), not a passing mention.
- Keep prompts verbatim; edits to wording invalidate a trial.
- Log per-trial which skill fired and which rubric points were hit, so failures are
  diagnosable (mis-route vs. weak capability).
