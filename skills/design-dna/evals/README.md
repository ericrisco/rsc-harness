# Eval harness — `design-dna` skill

Agent-run eval, not a shell script. The cases in `cases.yaml` are fed to a Claude Code agent and
graded by inspection. Unlike most skills here, part of this one **is** mechanically checkable —
see §C.

## What's under test

1. **Triggering** — does it fire when a winner exists and its look must survive, and stay quiet when
   there is no winner yet (`design`), when the winner is still being found (`design-loop`), or when
   the user is exploring variants (`prototype`)?
2. **Capability** — does it hold the rules that are the method, especially the two it is cheapest to
   drop: Step 5, and the separation of record from payload?
3. **Its own gate** — does the emitted skill's checker actually check?

## A. Triggering accuracy

The boundary that costs the most is `design-loop` ↔ `design-dna`, because both involve a reference
image and both are about a look. The split is whether a winner exists: finding it is upstream,
keeping it is here.

## B. Capability

Three scenarios, chosen because each targets a rule that a plausible-looking run will quietly skip:

1. **CAPTURE.** The long list is deliberate — every line is a rule the method names as load-bearing.
   The two that a good-looking run drops first are **Step 5** (rebuild the reference from the record
   alone and diff) and **coverage percentages**. Step 5 is the only honest completeness test that
   exists: a spec that has never been used to rebuild its own source has never been tested.
2. **REUSE.** The failure is re-deriving a style that already has a record, which produces a second,
   slightly different identity under the same name.
3. **Still generic.** The correct answer is a ban, not a rule. This case exists because the instinct
   is always to add a positive instruction, and a positive instruction is one weak vote against the
   average of everything the model has seen.

## C. The mechanical part — check both directions

Most of this eval is judgement. The emitted checker is not, and it must be verified the way the
constitution's P2 demands: prove it can fail **and** prove it can pass.

    python3 scripts/emit.py <slug> --validate     # the capture is finished, or it is not
    python3 <slug>/scripts/check.py <output>      # the output obeys the style, or it does not

Both directions, on a real captured style:

- **Can pass** — run the checker over the style's own worked example. Zero failures, with the
  manual tests reported as manual rather than silently passing.
- **Can fail** — run it over an output that breaks a known ban. It must exit non-zero and name
  which test failed and what the failure looks like.
- **Cannot lie either way** — run it over an artefact a probe cannot read (a PNG for a probe that
  reads declarations). Every such probe must report SKIP with its reason. This is the regression
  that was found and fixed at port time: the declaration-reading probes used to run against empty
  text, which produced spurious failures on one probe kind and, worse, **vacuous passes** on
  another — five greens on an image-only run without having checked anything.
- **Fails readably when unfinished** — a scaffolded style with no record must exit non-zero with a
  message naming the fix, not a traceback.

## Known limits of this eval

- The CAPTURE scenario can check that the agent *runs* Step 5 and reports gaps; it cannot check that
  the reconstruction was honest. A rebuild done with the reference still on screen looks identical to
  one done from the record alone.
- The 2KB payload cap and the two-ends attention ordering are asserted by the method, not measured
  here. They are plausible and cheap to honour; they are not proven by this eval.
