// The deterministic half of a prompt audit, as a gate.
//
// The catalog is prompt text: every skill, reference, generated agent and hook string is read by a
// model in every project that installs rsc. Most prompt cruft needs judgment to spot (a script for a
// judgment task, pressure without a reason) and stays with the human sweep. Four classes do not, and
// those are what this checks — each with a fixture that fails and one that passes
// (tests/prompt-audit.test.js), because a gate that cannot be seen failing checks nothing.
//
//   retired-model   a Claude model id older than the current generation, offered as if current
//   generator-id    an internal generator id presented as something to invoke ("Invoke memory:learn")
//   history-phrase  a short list of phrases that narrate the text's own past instead of the rule
//   dead-skill-link `../<id>/SKILL.md` naming a skill that is not in the catalog
//
// A line can opt out with a reason, on the same line or the line above:
//   prompt-audit: allow <rule> — <reason>
// An allow without a reason is itself a finding: the reason is what lets the next reader judge it.

/**
 * The current Claude generation per family. The one volatile fact in this file: when a new generation
 * ships, change it here and the gate lists every id the catalog still has to move.
 */
export const CURRENT_CLAUDE = { opus: [5, 5], sonnet: [5, 5], haiku: [5, 5] };

// The minor version is one or two digits; an 8-digit group is a date suffix, never a version.
const FAMILY_ID = /\bclaude-(opus|sonnet|haiku)-(\d+)(?:[-.](\d{1,2})(?!\d))?(?:-\d{8})?\b/g;
const LEGACY_ID = /\bclaude-(?:[23](?:[-.]\d+)*-(?:opus|sonnet|haiku)|instant|2(?:\.\d)?)\b[-\w.]*/g;

const GENERATOR_ID = /\bInvoke\s+(?:memory|sello):[a-z-]+\b|\bthe\s+sello\s+backing\b/i;

// Narrow on purpose: a phrase belongs here only when it cannot be a statement about the world
// ("X no longer supports Y" is a fact about a framework; "this used to be an instruction" is the
// prompt talking about itself).
export const HISTORY_PHRASES = [
  /\bthis used to be an instruction\b/i,
  /\byou no longer (?:run|need to|have to)\b/i,
  /\bused to end with a request\b/i,
  /\bthis (?:panel|lens|gate|skill) ever found\b/i,
  /\bshipped twice in one day\b/i,
  /\bthat is how this lens found\b/i,
];

const ALLOW = /prompt-audit:\s*allow\s+([a-z-]+)(?:\s*[—–-]+\s*(.*))?/i;

export const RULES = {
  'retired-model': 'use the current generation (claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5) or resolve the id from config',
  'generator-id': 'name the command or skill the agent should actually run; generator ids are internal to targets/',
  'history-phrase': 'state the rule as it is now; the history behind it belongs in decisions.md or the commit',
  'dead-skill-link': 'point at a skill that exists under skills/, or remove the link',
  'allow-without-reason': 'write why the exception holds after the dash: `prompt-audit: allow <rule> — <reason>`',
  'allow-unknown-rule': 'name one of the rules this gate checks, or remove the allow',
};

const older = ([a, b], [c, d]) => a < c || (a === c && b < d);

/** Claude model ids on one line that are older than the current generation. */
export function retiredModels(line) {
  const out = [];
  for (const m of line.matchAll(FAMILY_ID)) {
    const version = [Number(m[2]), m[3] === undefined ? 0 : Number(m[3])];
    if (older(version, CURRENT_CLAUDE[m[1]])) out.push(m[0]);
  }
  for (const m of line.matchAll(LEGACY_ID)) out.push(m[0]);
  return out;
}

function allowed(lines, i) {
  const found = [];
  [lines[i], i > 0 ? lines[i - 1] : ''].forEach((l, k) => {
    // Close an HTML comment first: otherwise the `--` of `-->` reads as the dash and `>` as a reason.
    const m = ALLOW.exec((l || '').replace(/\s*-->\s*$/, ''));
    if (m) found.push({ rule: m[1].toLowerCase(), reason: (m[2] || '').trim(), own: k === 0 });
  });
  return found;
}

/**
 * Audit one file's text. Pure: the caller supplies the catalog's skill ids.
 * @param {string} text
 * @param {{ skillIds?: Set<string> }} [ctx]
 * @returns {Array<{line: number, rule: string, match: string, fix: string}>}
 */
export function auditText(text, { skillIds } = {}) {
  const lines = String(text).split('\n');
  const findings = [];
  lines.forEach((line, i) => {
    const hits = [];
    for (const id of retiredModels(line)) hits.push(['retired-model', id]);
    const gen = GENERATOR_ID.exec(line);
    if (gen) hits.push(['generator-id', gen[0]]);
    for (const re of HISTORY_PHRASES) {
      const m = re.exec(line);
      if (m) hits.push(['history-phrase', m[0]]);
    }
    if (skillIds) {
      for (const m of line.matchAll(/(?:\.\.\/)+([a-z0-9-]+)\/SKILL\.md/g)) {
        if (!skillIds.has(m[1])) hits.push(['dead-skill-link', m[0]]);
      }
    }
    const allows = allowed(lines, i);
    for (const a of allows) {
      if (a.own && !a.reason) findings.push({ line: i + 1, rule: 'allow-without-reason', match: `allow ${a.rule}`, fix: RULES['allow-without-reason'] });
      if (a.own && !(a.rule in RULES)) findings.push({ line: i + 1, rule: 'allow-unknown-rule', match: `allow ${a.rule}`, fix: RULES['allow-unknown-rule'] });
    }
    for (const [rule, match] of hits) {
      if (allows.some((a) => a.rule === rule && a.reason)) continue;
      findings.push({ line: i + 1, rule, match, fix: RULES[rule] });
    }
  });
  return findings;
}
