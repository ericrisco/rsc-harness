// Skills the catalog no longer ships, and the skill that took over their job.
//
// `eli5` and `show-me` folded into `orient`, which explains at the register `technical_level` asks
// for; `bro` folded into `unslop`, which rewrites text meant for other people. A harness built before
// that still names them — in `.rsc.json`, in per-target state, and inside the onboarding receipt,
// which is hash-checked against what the user accepted and therefore never rewritten. So every reader
// of a DECLARED skill list maps through here, instead of each one learning the history on its own.
//
// `targets/clone-bootstrap.mjs` is committed into user repos and cannot import this file; it carries
// an inline copy, and tests/retired-skills.test.js holds the two equal in behaviour.
//
// `design-loop`, `design-dna` and `motion-craft` folded into the rebuilt `design` in 3.3.0 (spec
// design-from-scratch): its engine deals the direction, measures the render and owns the motion layer.
//
// `ui-engineering` folded into `ux` in 3.4.0: the screen states and form behaviour it owned are
// `ux`'s state matrix now, and where component state lives is `react`'s.
export const RETIRED_SKILLS = Object.freeze({
  eli5: 'orient', 'show-me': 'orient', bro: 'unslop',
  'design-loop': 'design', 'design-dna': 'design', 'motion-craft': 'design',
  'ui-engineering': 'ux',
});

const retiredTo = (id) => (Object.hasOwn(RETIRED_SKILLS, id) ? RETIRED_SKILLS[id] : id);

/** Each retired id becomes its successor; order of first appearance kept, duplicates dropped. */
export function replaceRetired(ids = []) {
  return [...new Set((ids || []).map(retiredTo))];
}

export const isRetired = (id) => Object.hasOwn(RETIRED_SKILLS, id);
