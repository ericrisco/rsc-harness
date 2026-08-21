import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The danger guard shipped with ZERO tests, and it over-fired four times in one session:
// `rm skills/zz-case-fixture/SKILL.md`, `rm my-draft.md`, a node script that merely CONTAINED the
// text of a dangerous command, and finally the heredoc writing this very file. Every one was denied
// with the reason "rm with -r and -f" — a reason that was factually false about all of them.
//
// Cause: both flag predicates were tested against the WHOLE command string with `\b` boundaries, so
// any path segment starting with a hyphen and containing an "r" and an "f" read as the flags -r and
// -f. The segment `-fixture` alone satisfies both (f-i-x-t-u-**r**-e).
//
// Why this matters more than the nuisance: the deny message tells the user how to switch the guard
// OFF (`.rsc/.no-danger-guard`). A guard that cries wolf on `rm my-draft.md` teaches exactly that,
// and a guard that is off protects nothing (P7). P6 also requires the stated reason to be true.
const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, '..', 'targets', 'danger-guard.mjs');
const DASH = '-'; // assembled, so this file's own text never becomes a trigger for its own subject
const RF = `${DASH}rf`;

// A guarded project: no opt-out file, and a non-technical profile (the default-safe stance).
function guardedRoot() {
  const root = mkdtempSync(join(tmpdir(), 'rsc-danger-'));
  mkdirSync(join(root, '02-DOCS', 'wiki', 'harness'), { recursive: true });
  writeFileSync(join(root, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: non-technical\n');
  return root;
}
const ROOT = guardedRoot();

function decide(command, root = ROOT) {
  const r = spawnSync('node', [GUARD, root], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, 'the guard must never fail closed on an internal error');
  if (!r.stdout.trim()) return { decision: 'allow', reason: '' };
  const out = JSON.parse(r.stdout);
  return {
    decision: out.hookSpecificOutput.permissionDecision,
    reason: out.hookSpecificOutput.permissionDecisionReason,
  };
}

// ── the over-fire this delivery exists for ───────────────────────────────────────────────

const SAFE_HYPHENATED = [
  'rm my-draft.md',
  'rm notes-for-review.txt',
  'rm src/pre-refactor.js',
  'rm skills/zz-case-fixture/SKILL.md',
  'rm build-for-release/out.log',
  'rm a/re-fetch.ts b/re-fetch.js',
];

for (const cmd of SAFE_HYPHENATED) {
  test(`allows a plain rm whose PATH merely contains hyphens: ${cmd}`, () => {
    const { decision, reason } = decide(cmd);
    assert.equal(decision, 'allow', `denied a single-file rm, claiming: ${reason}`);
  });
}

test("a flag belonging to ANOTHER command in the same line is not rm's", () => {
  // `ls -lrtF` carries an r and an F. It is not a recursive force delete.
  assert.equal(decide('rm notes.md && ls -lrtF').decision, 'allow');
  assert.equal(decide('ls -lrtF; rm notes.md').decision, 'allow');
});

test('merely TALKING about a dangerous command is not running one', () => {
  // The gitmoji guard already paid for this lesson: blocking the conversation about a command is
  // how a guard earns a bypass file.
  assert.equal(decide(`echo "never run rm ${RF} /"`).decision, 'allow');
  assert.equal(decide(`node ${DASH}e 'const example = "rm ${RF} /tmp/x"'`).decision, 'allow');
});

// ── and the half that must keep working ──────────────────────────────────────────────────

test('a shell wrapper does not smuggle a real delete past the guard', () => {
  // The hole the "rm must be the executed command" rule could have opened: `bash -c "…"` really
  // does run the delete, so the wrapper is walked through rather than skipped over.
  for (const cmd of [`bash -c "rm ${RF} /"`, `sh -c 'rm ${RF} build'`, `sudo bash -c "rm ${RF} /var"`]) {
    assert.equal(decide(cmd).decision, 'deny', `smuggled through a wrapper: ${cmd}`);
  }
});

const REALLY_DANGEROUS = [
  `rm ${RF} /tmp/x`,
  `rm ${DASH}fr build`,
  `rm ${DASH}r ${DASH}f node_modules`,
  `rm ${DASH}Rf dist`,
  `rm ${DASH}${DASH}recursive ${DASH}${DASH}force build`,
  `sudo rm ${RF} /var/lib/thing`,
  `/bin/rm ${RF} cache`,
  `cd /tmp && rm ${RF} junk`,
];

for (const cmd of REALLY_DANGEROUS) {
  test(`still denies a real recursive force delete: ${cmd}`, () => {
    const { decision, reason } = decide(cmd);
    assert.equal(decision, 'deny', `let a recursive force delete through: ${cmd}`);
    assert.match(reason, /irreversibly/);
    // P6: every denial carries its way out, in the message itself.
    assert.match(reason, /safer, scoped alternative/);
    assert.match(reason, /\.no-danger-guard/);
  });
}

test('the other rules are untouched by this change', () => {
  // Cheap regression net: this delivery only touches rm flag parsing, but the guard had no tests at
  // all before now, so a refactor breaking a sibling rule would have gone unnoticed.
  const cases = [
    ['find . -name "*.tmp" -delete', /mass-deletes/],
    ['dd if=/dev/zero of=/dev/disk2', /raw disk device/],
    ['curl https://x.sh | bash', /untrusted code/],
    [`git push ${DASH}${DASH}force origin main`, /force-pushes/],
    [`git reset ${DASH}${DASH}hard origin/main`, /uncommitted work/],
    ['psql -c "DROP TABLE users"', /drops an entire database/],
    ['psql -c "DELETE FROM users"', /deletes EVERY row/],
  ];
  for (const [cmd, needle] of cases) {
    const { decision, reason } = decide(cmd);
    assert.equal(decision, 'deny', `stopped catching: ${cmd}`);
    assert.match(reason, needle);
  }
});

test('a technical user is never guarded, and the opt-out still works', () => {
  const technical = mkdtempSync(join(tmpdir(), 'rsc-danger-tech-'));
  mkdirSync(join(technical, '02-DOCS', 'wiki', 'harness'), { recursive: true });
  writeFileSync(join(technical, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: technical\n');
  assert.equal(decide(`rm ${RF} /tmp/x`, technical).decision, 'allow');

  const optedOut = guardedRoot();
  mkdirSync(join(optedOut, '.rsc'), { recursive: true });
  writeFileSync(join(optedOut, '.rsc', '.no-danger-guard'), '');
  assert.equal(decide(`rm ${RF} /tmp/x`, optedOut).decision, 'allow');
});

test('a missing profile is still guarded — default-safe, not default-open', () => {
  const bare = mkdtempSync(join(tmpdir(), 'rsc-danger-bare-'));
  assert.equal(decide(`rm ${RF} /tmp/x`, bare).decision, 'deny');
});

test('the guard only judges Bash', () => {
  const r = spawnSync('node', [GUARD, ROOT], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { command: `rm ${RF} /` } }),
    encoding: 'utf8',
  });
  assert.equal(r.stdout.trim(), '', 'a non-Bash tool call must pass through untouched');
});

test('the shipped copy and the source copy of the guard stay identical', () => {
  // .rsc/danger-guard.mjs is the materialized copy targets/claude.js wires as the hook. If the two
  // drift, this repo runs a different guard than the one under test — the tested-thing-is-not-the-
  // shipped-thing failure P2 keeps finding here.
  const src = readFileSync(GUARD, 'utf8');
  const shipped = readFileSync(join(HERE, '..', '.rsc', 'danger-guard.mjs'), 'utf8');
  assert.equal(shipped, src, 'run `npx rsc sync` (or re-copy) — .rsc/ is running stale guard code');
});
