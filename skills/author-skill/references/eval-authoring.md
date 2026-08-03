# Authoring the evals

A skill without evals is unverifiable, and unverifiable means it does not ship. Evals test two separate things, and you must cover both:

- **Triggering** — does the skill fire on the right prompts and stay quiet on near-misses?
- **Capability** — once it fires, does the agent measurably do better than without it?

Everything lives in `evals/cases.yaml` (the cases) and `evals/README.md` (how to run them, honestly).

## The minimums

- `should_trigger` — **≥ 5** prompts that MUST load the skill. Include at least one **non-obvious** phrasing (a symptom, not the skill's name) and ideally a non-English one.
- `should_not_trigger` — **≥ 4** near-miss prompts that must NOT load it. **Each needs a `route_to`** naming the real sibling that *should* own it (or `none` if no sibling does, with a why).
- `capability` — **≥ 1** scenario with a `must_include` rubric of concrete points the answer must cover.

### What `scripts/eval-lint.sh` actually checks (and what it doesn't)

`scripts/eval-lint.sh` parses every `cases.yaml` and fails the build only on the **structural minimums**: that `evals/cases.yaml` exists, that `should_trigger`, `should_not_trigger`, and `capability` are present as lists, and that their item counts meet **≥ 5 / ≥ 4 / ≥ 1**. (Without python3+PyYAML it degrades to a presence-only key check.) Run it before shipping to catch a missing or undersized section.

It also resolves every `route_to`: each value must be a real catalog skill id, `none`, or `external:<name>` for a skill that deliberately lives outside this catalog — a stale route now fails the build. What it still does **not** read: whether each `should_not_trigger` actually carries a `route_to`, whether your `should_trigger` set includes a genuinely non-obvious or non-English phrasing, and whether each `capability` scenario has a real `must_include` rubric of gradeable points. Those are **author and review responsibilities**: verify them by hand (and in the self-audit / code-review pass) before shipping. A green eval-lint means the shape is right, not that the cases are good.

## cases.yaml structure

```yaml
skill: <id>

# A comment block stating what the skill IS and ISN'T helps the grader stay honest.

should_trigger:
  - prompt: "A verbatim prompt a real user would type."
    why: "Why this MUST route here, and which differentiator of the skill it exercises."
  # … ≥ 5 total, with one non-obvious symptom phrasing and one non-English

should_not_trigger:
  - prompt: "A near-miss that looks close but belongs elsewhere."
    route_to: "sibling-id"   # a real catalog id, "none", or "external:<name>" — checked by eval-lint
    why: "Why it is NOT this skill and why the sibling owns it."
  # … ≥ 4 total

capability:
  - scenario: "A concrete situation; describe what the agent is asked to do."
    must_include:
      - "A specific behavior the WITH-skill answer must show."
      - "Another concrete, gradeable point — name files/paths/rules, not vibes."
      # … enough points to distinguish a skilled answer from a baseline one
```

## Writing good `should_trigger` cases

- Use **verbatim user prompts**, not descriptions of prompts. The eval pastes them as-is.
- Spread across the skill's real surface: the obvious ask, an edit/fix ask, a symptom ("X never works"), a non-English phrasing.
- The **non-obvious** case is the important one — it proves the description matches symptoms, not just the skill's own name. If every trigger contains the skill's name, the description is too literal.

## Writing good `should_not_trigger` cases

These are where descriptions get sharpened. Each near-miss should be genuinely tempting — adjacent in topic but owned by a sibling. The `route_to` must name a skill that **exists in this repo** — `eval-lint` fails the build otherwise. If the right owner genuinely ships outside this catalog, say so with `external:<name>` rather than inventing an id: the prefix makes the claim visible instead of indistinguishable from drift. Pick the siblings most likely to be confused with this one and write a case that disambiguates each.

For `author-skill`, the natural confusables are `specify`/`plan` (building a feature, not a skill), `building-agents` (agent loops), `harness` (generic docs/wiki), and `init` (bootstrapping). Route each near-miss to whichever it truly belongs to.

## Writing good `capability` cases

The `must_include` points are the differentiators — the specific things a *good* answer shows that a baseline answer misses. Make them **gradeable**: name the rule, the file path, the structural choice. "Writes a good skill" is not gradeable; "produces a third-person description under ~350 chars with a `Use when` lead and a `NOT … (sibling)` boundary naming a sibling that exists" is.

For a process skill (no `verify.sh`), the capability scenario is the *primary* rigor — it is how you prove the safety rails actually change behavior. Make it count.

## README.md — run it honestly

`evals/README.md` documents the two-axis run procedure and is candid about limits:

- **Triggering eval:** load *only* this skill so routing is honest; for each prompt run 3–5 fresh-session trials; a `should_trigger` passes if the skill fires in the majority of trials, a `should_not_trigger` passes if it does NOT fire (and, where a `route_to` sibling exists, sanity-check that the prompt truly belongs there). State a pass bar (e.g. ≥90% accuracy across all trigger cases).
- **Capability eval:** A/B — same prompt WITHOUT the skill (baseline) vs WITH it; grade each output against `must_include`; average over 3 trials; require the WITH condition to clear a bar (e.g. ≥80% of points) AND beat the baseline by a real margin.
- **Honest caveats:** this is LLM-as-judge / human-in-the-loop, not deterministic. Use one consistent grader across A/B. Re-run after any edit to the body or the description, since both axes are wording-sensitive.

A README that pretends the evals are deterministic CI is dishonest. Say what they really are.
