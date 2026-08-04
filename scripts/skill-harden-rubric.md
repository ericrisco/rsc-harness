# skill-harden-rubric — how the fix-loop diagnoses and guards a fix

The `skill-harden` workflow turns a FAILING behavioral score into edits, without gaming the eval.
These are the rules its agents follow.

The three guards below — **diff judge**, **hold-out**, **Generalization gate** — are mandatory *and*
mechanised: `tests/harden-generalization-gate.test.js` asserts, for each of those three, that the
loop implements what this file promises. **Adding a fourth guard here means adding its pair to that
test**; a guard documented but unchecked gives the safety without the protection, which is the
failure mode this repo has now hit ten times (constitution P2).

## Diagnosis (skill-fault vs eval-fault vs capability)

Given the failing `mustFix`, both A/B outputs, and the grader's per-item evidence, decide the FAULT:

- **skill** — the treatment output genuinely misses real capability (weak method, missing depth,
  no concrete output). Fix the SKILL.md body and/or references/.
- **eval** — the failure is the eval's, not the skill's. Two known biases:
  1. **Self-describing scenario** — the `scenario` text enumerates its own `must_include`, so a
     bare agent gets the same guidance the skill would give and the lift collapses artificially.
  2. **Phantom-context must_include** — an item demands workspace artifacts the isolated eval
     agent cannot have (e.g. `user-profile.md`, a real sibling skill to delegate to), capping the
     absolute unfairly.
- **capability** — the gap cannot be closed by words in a skill body. It needs an **executable
  capability**: something that fires on a real execution event and returns to the agent information
  it cannot obtain on its own — a hook, a script, a tool, a sub-agent. Advice that merely tells the
  agent to remember something is **not** a capability: it is not anchored to any observable event, so
  it can fire when it should not and stay silent when it should not.

This loop can only ever write **guidance** (SKILL.md, references/). So `capability` is not a fix
route, it is the honest exit: the loop edits nothing, names the missing capability and the surface it
would live on, and stops. Writing a paragraph that pretends to cover a missing capability raises the
score without the capability existing — the worst outcome available.

A `capability` verdict **must name** the capability and its surface. One that cannot is an excuse,
not a diagnosis → choose `skill`.

Default to **skill** when unsure: blaming the eval or the surface area is the easier, less honest path.

## The Generalization gate (ex-ante — it binds before the edit is written)

This gate governs the **content** of every line the fixer writes, and it travels **in the fixer's own
instruction**, not in a review afterwards. Writing freely and reverting later burns the round, and the
loop only has two.

Everything added to a skill is global context that will apply to cases the skill has never seen. So:

- **Allowed:** a reusable criterion that carries its own **applicability condition** — something the
  agent can evaluate on a case it has never encountered.
- **Banned outright:** identifiers or titles from the eval scenario; names of its files, symbols or
  fixtures; rules that branch on its specific data; and reciting the finding as if it were a rule
  ("the last round showed X needs Y" — that is an answer, not a criterion).

**Litmus test, before every line:** *would this still help on a case in this domain I have never
seen?* If no → rewrite it as a criterion, or drop it. Not knowledge → not in the skill.

Why ex-ante and not only as review: moving this constraint from after-the-edit to
before-the-edit is what buys generalization cheaply. The measured version of this result — plus the
warning that richer feedback **without** this gate makes held-out performance *worse* — is in
[HarnessCompass](https://arxiv.org/abs/2608.01918); the reasoning it drove is recorded in
`02-DOCS/wiki/sdd/specs/generalization-gate.md`.

## Eval-fix guard (independent judge)

An eval edit ships ONLY if a judge certifies it corrects one of the two biases above and does NOT
lower the bar — i.e. it makes the scenario less self-describing or removes a phantom-context item,
but never deletes a legitimate quality criterion to make a weak skill pass. Rejected → treat as a
skill-fault this round.

## Skill-fix guards (both required)

1. **Diff judge.** Read the SKILL.md/references diff and check BOTH: does it add genuine capability
   (method, decision rules, concrete guidance) rather than echoing the `must_include` wording into
   the body? *and* does every added line survive the Generalization gate above? Fail either → revert
   the edit; it is not a fix.
2. **Hold-out.** Re-score the EDITED skill on a FRESH scenario from its domain that the fixer never
   saw. A real improvement generalizes; a memorized one does not.
   - The eval engine runs every scenario with **and** without the skill, so the fresh scenario
     already carries its own lift. No pre-fix baseline is needed.
   - The verdict is computed by `node scripts/skill-behavior-eval.js --holdout <raw.json>` — a
     comparison of numbers, deterministic and reproducible, never an agent's opinion (P1). Exit 0
     passes, exit 1 blocks.
   - **Blocks on `lift <= 0`** (`regression`): on unseen work the edited skill does not beat the bare
     agent, so the edit did not transfer. Also blocks when the fresh scenario could not be run or
     graded (`indeterminate`) — failing closed, because an unverified edit is not a verified one.
   - The bar is deliberately **not** the main gate's `lift >= 1.0`: one fresh scenario graded once is
     noisy, so only the unambiguous signal acts. Upgrade path if it proves too noisy in practice:
     N=3 fresh scenarios, majority.
   - **A block reverts the edit.** The round produced nothing and is recorded with its reason.

## Stopping & honesty

- Max 2 rounds. On give-up, report the honest final score and a recommendation — never a faked pass.
- **A main-gate pass whose last surviving edit failed the hold-out does not commit.** It is a fix
  tuned to the cases it was measured against; the loop reverts it and reports why. Conservative on
  purpose: a lost commit costs one re-run, a certified overfit costs the catalog.
- A `capability` verdict never commits either: it returns the missing capability and its surface, and
  routes the work to `specify`.
- Every non-commit says which condition failed, in the returned result. A denial without its exit is
  abandonment (P6).
- Persistent lift-fail at a high absolute → recommend deprecate/merge: the skill does not justify
  its own existence.
