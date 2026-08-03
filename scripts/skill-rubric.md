# skill-rubric — the objective test every rsc skill must pass before shipping

This is **the test, written before any skill is built.** A reviewer scores a finished skill
0–10 on seven weighted dimensions, then the deterministic gates run (pass/fail, not gradeable).
A skill **ships only at a weighted score ≥ 8.5 AND all deterministic gates green.** The reviewer
is adversarial and independent of the author; it must cite evidence (line counts, char counts,
quoted source dates), never vibes. No grade inflation — an honest 7.0 that drives a fix beats a
dishonest 9.

## Weighted dimensions (0–10 each)

| # | Dimension | Weight | What a 10 looks like |
|---|---|---|---|
| 1 | **Triggering & description** | 0.15 | Third-person, `Use when …` lead, an explicit `NOT … (that is <sibling>)` boundary, and nothing else it can do without. Judged on **discriminative power, not coverage**: could a reader pick this skill over its nearest sibling from the description alone? Aim ≤350 chars; ≤1024 is the hard limit. Parses as single-line quoted YAML. |
| 2 | **Scope & boundary** | 0.10 | One job. Body never drifts into a sibling's territory; it delegates by name. Near-miss prompts route to the correct existing sibling. |
| 3 | **Body craft & progressive disclosure** | 0.15 | **The smallest body that routes correctly** — ≤400 lines is a ceiling, not a target, and there is no minimum: a skill that does its job in 60 lines scores higher than the same skill padded to 200. Every `references/` file is pointed to inline from this body (an unlinked reference is never loaded, so it is dead weight). rsc voice, every fence language-tagged, a checklist/decision table only where the flow branches, an anti-patterns table present. |
| 4 | **Correctness, grounding & freshness** | **0.25** | Every load-bearing claim is accurate and **current (2025–2026)**: real library/API versions, no hallucinated flags/endpoints. The spec cites **authoritative sources with dates**; nothing rests on stale or invented facts. This is the heaviest dimension by design. |
| 5 | **Actionability** | 0.15 | Concrete and runnable: real numbers, paths, commands, decision rules — not adjectives. A practitioner could act from it without leaving the skill. |
| 6 | **Evals quality** | 0.10 | ≥5 `should_trigger` (incl. non-obvious), ≥4 `should_not_trigger` each with a `route_to` that resolves — a **real** catalog id, `none`, or `external:<name>` (enforced by `eval-lint`), ≥1 `capability` with a meaningful `must_include` rubric. The cases are genuine, not filler. |
| 7 | **Originality & safety** | 0.10 | rsc voice, not a clone of any external catalog (no borrowed urgency blocks / rationalization tables / `*-reviewer-prompt.md` conventions / verbatim flowcharts). `verify.sh` present iff there is a checkable artifact. No destructive or unsafe advice presented without guardrails. |

**Weighted score** = Σ(subscore × weight), rounded to 1 decimal. **Ship gate: ≥ 8.5.**

## Deterministic gates (pass/fail — not part of the 0–10, but block shipping)

1. `name` matches the directory id; `origin: risco` present.
2. Frontmatter validates against `schema/frontmatter.schema.json` (`node scripts/build-manifest.js --validate`).
3. Every `recommends` id is a **real** skill in the catalog (no dangling refs — `--validate` enforces).
4. `scripts/eval-lint.sh` reports PASS for the skill (≥5/≥4/≥1 and the keys are lists).
5. Every `../<sibling>/SKILL.md` link resolves to a skill that exists.
6. `description` is ≤ 1024 characters and parses as YAML.
7. If a `scripts/verify.sh` exists, it is executable, read-only by default, and exits 0 on a clean/empty target (no false failure).

## How the reviewer must work (anti-cheat)

- **Independent pass.** Review the artifact as written; do not assume the author's intent filled a gap.
- **Evidence, not vibes.** For dimension 1 quote the char count **and name the sibling the description distinguishes this skill from**; for 3 quote the SKILL.md line count **and name anything that could be cut without losing routing**; for 4 quote at least two source titles **with their dates** from the spec and name any claim you could not verify; for 6 count the entries.
- **Length is a cost, never a credit.** Do not reward a longer description or body for being thorough. Every line is paid for in context on every turn the skill is installed, whether or not it is invoked. If two versions route the same, the shorter one scores higher.
- **Freshness is mandatory.** If the skill names a version, API, or pricing that is plausibly out of date, dimension 4 is capped at 6 until a current source is cited. "Looks right" is not a source.
- **Fix loop.** Below 8.5, return a concrete `mustFix` list; the author applies it and re-scores. Up to two fix rounds. If still < 8.5, **record the real score and flag it** — never round up to pass.
