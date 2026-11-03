// The exit gate of the `specify` phase, as a binary instead of a feeling.
//
// "Stop when the WHAT and WHY are complete enough to plan against" cannot tell done from not-done,
// so the phase closed whenever the agent felt closed — with the write/review/approve steps visible
// the whole time, pulling attention toward being finished. This checks the artifact instead: every
// template section carries content or an explicit open point.
//
// What it does NOT check is returned in `unchecked`, on purpose. Detecting an unmarked assumption is
// the problem `specify` exists to solve, not something a parser can do, and a gate that implies
// otherwise is worse than one that admits its edge.


export { NEW_FAMILIES_SINCE, ASDD_FAMILIES_SINCE, OPEN_POINT_TYPES, specCompleteness } from '../../targets/spec-completeness.mjs';


// ─────────────────────────────────────────────────────────────────────────────
// Does the status still match the repository?
//
// The section check above asks whether a spec is COMPLETE. This asks whether it is still TRUE — and
// nothing asked that before, which is how seven of twenty-five statuses came to contradict the repo:
// one claiming "sin push ni PR" over work that had been in main for weeks, four sitting in
// `awaiting-approval` over work already published. Spec: 02-DOCS/wiki/sdd/specs/spec-status-drift.md
//
// The vocabulary below was extracted from the 25 real statuses, not imagined. That matters: an
// invented recognizer reaches for the bare word `implementada`, and the bare word is not checkable —
// it names nothing to go and look for. Only a commit, a PR or a released version do.

/** The claim shapes this recognizer knows. Anything else is silence, not a finding. */
export const CLAIM_KINDS = ['sha', 'pr', 'version', 'not-landed'];

// Deliberately absent: the bare words `implementada`, `desplegada`, `descartada`, and the phrase
// `no aprobada`. The first two name nothing to check. The last two look like landing claims and are
// not — `descartada` is a spec closed on purpose after being measured, `no aprobada` describes HOW
// approval happened (in autopilot, not item by item), not whether code shipped. Treating either as a
// landing claim would invent drift in the two best-closed specs of the set.
const SHA = /\b[0-9a-f]{7,40}\b/g;
const PR = /\bPR\s*#(\d+)/gi;
const VERSION = /\bpublicada en (\d+\.\d+\.\d+)/gi;
const NOT_LANDED = /\bsin push\b|\bsin PR\b|\bawaiting-approval\b/i;

/**
 * Pull the checkable claims out of a status string. Pure: no git, no I/O.
 * @param {string} statusText
 * @returns {Array<{kind: string, value: string, raw: string}>}
 */
export function statusClaims(statusText) {
  const text = typeof statusText === 'string' ? statusText : '';
  const claims = [];
  for (const m of text.matchAll(PR)) claims.push({ kind: 'pr', value: m[1], raw: m[0] });
  for (const m of text.matchAll(VERSION)) claims.push({ kind: 'version', value: m[1], raw: m[0] });
  for (const m of text.matchAll(SHA)) claims.push({ kind: 'sha', value: m[0], raw: m[0] });
  const neg = NOT_LANDED.exec(text);
  if (neg) claims.push({ kind: 'not-landed', value: neg[0], raw: neg[0] });
  return claims;
}

/**
 * Judge each claim against the repository.
 *
 * Four verdicts and none of them collapse into another. `unverifiable` is the one that keeps this
 * honest — a claim we could not check is not a claim that passed, and it is not drift either.
 *
 * `not-landed` is always handed to a human, and that is a deliberate retreat from what the spec
 * first promised. No query distinguishes "never landed" from "landed by another route": the case
 * that started this work names a commit that genuinely is not in main, while its deliverable has
 * been there for weeks. Checking the named commit would bless the misleading status; inferring the
 * other from anything else would be a heuristic inside a gate. So the deterministic part narrows,
 * and only what it narrowed goes to judgement — principle 1, and the shape `knowledge-drift` already
 * uses.
 *
 * @param {Array<object>} claims from `statusClaims`
 * @param {?{hasCommit: Function, isAncestor: Function, hasPr: Function, hasTag: Function}} probe
 *        null when there is no repository to ask — every claim then reports unverifiable.
 * @returns {Array<{kind: string, value: string, verdict: string, reason: string}>}
 */
export function checkClaims(claims, probe) {
  return (claims || []).map((c) => {
    if (c.kind === 'not-landed') {
      return {
        ...c,
        verdict: 'needs-human',
        reason: 'git cannot tell "never landed" from "landed by another route" — look at whether the deliverable is in main, not at the branch',
      };
    }
    if (!probe) return { ...c, verdict: 'unverifiable', reason: 'no repository to ask' };
    try {
      if (c.kind === 'sha') {
        if (!probe.hasCommit(c.value)) {
          return { ...c, verdict: 'unverifiable', reason: `commit ${c.value} is not in this repository` };
        }
        return probe.isAncestor(c.value)
          ? { ...c, verdict: 'holds', reason: `${c.value} is in main` }
          : { ...c, verdict: 'stale', reason: `${c.value} is NOT in main` };
      }
      if (c.kind === 'pr') {
        return probe.hasPr(c.value)
          ? { ...c, verdict: 'holds', reason: `PR #${c.value} is merged into main` }
          : { ...c, verdict: 'stale', reason: `no merge of PR #${c.value} in main` };
      }
      return probe.hasTag(c.value)
        ? { ...c, verdict: 'holds', reason: `v${c.value} is tagged` }
        : { ...c, verdict: 'stale', reason: `no v${c.value} tag in this repository` };
    } catch (e) {
      // Could not look. Saying `stale` here would invent a finding out of our own failure.
      return { ...c, verdict: 'unverifiable', reason: e.message };
    }
  });
}
