// eval-integrity.js — is a behavioral eval run measuring anything at all?
//
// skill-behavior-eval promises to run each capability scenario "with and without the skill". The
// "without" arm runs with full filesystem access inside this repo, where the skill under test IS a
// file, and nothing stopped it reading that file. Measured in the 2026-08-18 run: the `verify`
// baseline read skills/verify/SKILL.md 7 times AND skills/verify/evals/cases.yaml 4 times — the
// very must_include list it was being graded against. It then produced "SUSTITUIDA", a word that
// exists nowhere but the skill written the day before.
//
// A lift measured against a control that read the answer key is a lower bound of unknown size.
// Publishing it as a number is the claim-without-evidence this repo keeps paying for (P2), and it
// feeds skill-harden's --holdout, which decides what enters a 264-skill catalog.
//
// This module answers the question deterministically, from the transcripts themselves — never from
// what an agent says about its own behaviour, which is the way this fails open.
//
// Design note: the pure functions take text, the reader touches disk. That split is what makes the
// interesting logic testable without fixtures on disk.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Prompt markers the workflow actually emits. tests/eval-integrity.test.js asserts each of these
// still appears verbatim in scripts/skill-behavior-eval.workflow.js — without that tie, rewording a
// prompt silently retires the classifier and every run starts reporting "clean".
export const ROLE_MARKERS = {
  grader: 'adversarial, independent grader',
  treatment: '=== END SKILL ===',
  loader: 'return its full text as',
};

// Write verbs that indicate a transcript actually WROTE a path rather than merely naming it. A
// mention is not a mutation: the grader quotes repo paths constantly and is not violating anything.
const WRITE_SIGNALS = [
  'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
  'cat >', 'tee ', '>>', 'mv ', 'cp ', 'rm ',
];

// Paths an eval arm may never write. 02-DOCS is the project's brain and is untracked (P9), so a
// stray write there has no undo.
export const PROTECTED_PATHS = ['02-DOCS/wiki/'];

/**
 * Which arm produced this transcript. Order matters: a grader transcript quotes the skill body, so
 * it would otherwise look like a treatment.
 */
export function classifyAgent(transcriptText) {
  const t = String(transcriptText || '');
  if (t.includes(ROLE_MARKERS.grader)) return 'grader';
  if (t.includes(ROLE_MARKERS.treatment)) return 'treatment';
  if (t.includes(ROLE_MARKERS.loader)) return 'loader';
  return 'baseline';
}

const countOf = (text, needle) => {
  let n = 0;
  let i = text.indexOf(needle);
  while (i !== -1) { n++; i = text.indexOf(needle, i + needle.length); }
  return n;
};

/**
 * findViolations({skillId, agents}) — agents: [{name, role, text}]
 * Returns {ok, violations:[{kind, agent, pattern, count}]}.
 *
 * Only the baseline is judged on reads: the treatment is SUPPOSED to have the skill, and the loader
 * reads both files by design. Every arm is judged on writes.
 */
export function findViolations({ skillId, agents }) {
  if (!skillId) throw new Error('findViolations: skillId is required');
  const violations = [];
  const skillPath = `skills/${skillId}/SKILL.md`;
  const rubricPath = `skills/${skillId}/evals/cases.yaml`;

  for (const a of agents || []) {
    const text = String(a.text || '');
    if (a.role === 'baseline') {
      // Graded separately: reading the skill removes the control; reading the rubric is reading the
      // answer key, which also inflates the baseline's own score.
      const skillHits = countOf(text, skillPath);
      if (skillHits > 0) {
        violations.push({ kind: 'baseline-read-skill', agent: a.name, pattern: skillPath, count: skillHits });
      }
      const rubricHits = countOf(text, rubricPath);
      if (rubricHits > 0) {
        violations.push({ kind: 'baseline-read-rubric', agent: a.name, pattern: rubricPath, count: rubricHits });
      }
    }
    if (a.role === 'baseline' || a.role === 'treatment') {
      for (const p of PROTECTED_PATHS) {
        if (!text.includes(p)) continue;
        // Require a write verb near the path, or a mention becomes a violation and the grader's
        // quotations would block every run.
        const wrote = WRITE_SIGNALS.some((verb) => {
          let i = text.indexOf(p);
          while (i !== -1) {
            const window = text.slice(Math.max(0, i - 400), i + 400);
            if (window.includes(verb)) return true;
            i = text.indexOf(p, i + p.length);
          }
          return false;
        });
        if (wrote) {
          violations.push({ kind: 'wrote-protected-path', agent: a.name, pattern: p, count: countOf(text, p) });
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/** Read a workflow transcript directory into [{name, role, text}]. Throws if unreadable. */
export function readAgents(dir) {
  if (!dir) throw new Error('readAgents: transcripts dir is required');
  const st = statSync(dir); // throws ENOENT — deliberately not caught here
  if (!st.isDirectory()) throw new Error(`readAgents: not a directory: ${dir}`);
  return readdirSync(dir)
    .filter((f) => /^agent-.*\.jsonl$/.test(f))
    .map((f) => {
      const text = readFileSync(join(dir, f), 'utf8');
      return { name: f, role: classifyAgent(text), text };
    });
}

/**
 * checkIntegrity({skillId, transcriptsDir}) → {ok, blocked, reason, violations, counts}
 *
 * FAILS CLOSED. A missing dir, an unreadable dir, or zero baseline transcripts all return
 * blocked — never a silent pass. "We could not look" must never render as "we looked and it was
 * fine", which is the single failure mode this whole file exists for.
 */
export function checkIntegrity({ skillId, transcriptsDir }) {
  let agents;
  try {
    agents = readAgents(transcriptsDir);
  } catch (e) {
    return { ok: false, blocked: true, reason: `integrity not verifiable: ${e.message}`, violations: [], counts: {} };
  }
  const counts = agents.reduce((acc, a) => { acc[a.role] = (acc[a.role] || 0) + 1; return acc; }, {});
  if (!counts.baseline) {
    return {
      ok: false, blocked: true,
      reason: `integrity not verifiable: no baseline transcript found in ${transcriptsDir}`,
      violations: [], counts,
    };
  }
  const { ok, violations } = findViolations({ skillId, agents });
  if (ok) return { ok: true, blocked: false, reason: 'integrity verified', violations: [], counts };
  return {
    ok: false, blocked: true,
    reason: `${violations.length} integrity violation(s) — this run measures nothing`,
    violations, counts,
  };
}
