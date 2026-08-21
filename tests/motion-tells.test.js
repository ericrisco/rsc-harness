import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The source repo (emilkowalski/skills, MIT) ships its "Never Ship" bar as PROSE — a markdown
// table an agent may or may not honor. P2 says a rule declared binding is born with the mechanism
// that checks it and the test that checks the mechanism. So the bar becomes a registry here, on
// the design-tells pattern: every row is iterated from this file, and a row without a fixture
// fails the suite. That is the only way "we check six motion tells" stops being a claim.
//
// Coverage, said honestly: 6 generically-iterated table rows + 1 counter that cannot be a row
// (absence of a guard is not a pattern match) + 2 end-to-end runs (clean exits 0, dirty exits
// non-zero). They are NOT covered by the same mechanism, and pretending otherwise would be the
// decorative-gate pattern this repo has already paid for.
//
// Spec: 02-DOCS/wiki/sdd/specs/motion-craft-skills.md · Plan: motion-craft-skills.plan.md
const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY = join(HERE, '..', 'skills', 'review-animations', 'scripts', 'verify.sh');
const FIXTURES = join(HERE, 'fixtures', 'motion-tells');

// The counter is named here so the registry test can refuse to count it as a row.
const COUNTER_ID = 'reduced-motion-missing';

function runVerify(cwd, args = [], extraEnv = {}) {
  try {
    const stdout = execFileSync('bash', [VERIFY, ...args], {
      cwd, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb', ...extraEnv },
    });
    return { stdout, status: 0 };
  } catch (err) {
    // A non-zero exit is the expected outcome for the dirty fixtures; the output is the assertion
    // surface either way. Anything without stdout is a real crash and must not be swallowed.
    if (err.stdout != null) return { stdout: err.stdout, status: err.status ?? 1 };
    throw err;
  }
}

// ------------------------------------------------------------------ the registry itself

// A parser that returned [] when the table is gone would turn "delete every row" into a green
// suite. It throws instead — the M9 lesson from refuter-agent, and the same contract design-tells
// put on its own parser.
function parseTellTable(src) {
  const m = src.match(/motion_tell_table\(\)\s*\{\s*cat <<'TELLS'\n([\s\S]*?)\nTELLS/);
  if (!m) throw new Error('MOTION_TELL_TABLE not found in verify.sh — the registry is gone, not empty');
  const rows = m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const [id, sev, globs, pattern, message] = line.split('%%');
      return { id, sev, globs, pattern, message, line };
    });
  if (rows.length === 0) throw new Error('MOTION_TELL_TABLE parsed to zero rows — a registry with no rows checks nothing');
  return rows;
}

const rows = parseTellTable(readFileSync(VERIFY, 'utf8'));

test('the motion tell registry exists, parses, and every field is filled', () => {
  for (const r of rows) {
    for (const field of ['id', 'sev', 'globs', 'pattern', 'message']) {
      assert.ok(r[field] && r[field].trim(), `row "${r.line}" has an empty ${field}`);
    }
    assert.match(r.id, /^[a-z0-9-]+$/, `row id is not a slug: ${r.id}`);
    assert.ok(['warn', 'fail'].includes(r.sev), `row ${r.id} has severity "${r.sev}", expected warn|fail`);
    assert.notEqual(r.id, COUNTER_ID, 'the counter must not be smuggled in as a table row');
    // The message is what the user acts on. A row that only names the defect, with no way out, is
    // the abandonment P6 forbids — so every message must carry its remedy.
    assert.ok(r.message.length > 30, `row ${r.id} has no actionable remedy in its message`);
  }
});

test('the registry carries the five tells the spec names as binding, plus what it adds', () => {
  const ids = rows.map((r) => r.id);
  for (const required of ['transition-all', 'scale-zero-entrance', 'ease-in-ui', 'origin-center-popover']) {
    assert.ok(ids.includes(required), `the spec names ${required} as binding; the registry does not carry it`);
  }
  // The fifth binding tell is the counter, checked in its own test below.
  assert.ok(rows.length >= 4, 'registry shrank below the bindings the spec names');
});

// ------------------------------------------------------------------ every row, generically

// This is the loop that makes the registry a registry: add a row without a fixture and the suite
// goes red. No per-row `if` blocks, so a row can never be silently untested.
for (const row of rows) {
  test(`row ${row.id} fires on its own fixture`, () => {
    const dir = join(FIXTURES, row.id);
    assert.ok(
      existsSync(dir) && statSync(dir).isDirectory(),
      `row ${row.id} has no fixture at tests/fixtures/motion-tells/${row.id}/ — every row must be provable`,
    );
    const { stdout, status } = runVerify(dir, ['--strict']);
    assert.match(stdout, new RegExp(row.id), `row ${row.id} did not fire on its fixture:\n${stdout}`);
    // --strict makes warn rows fail too, so severity does not change the exit contract here.
    assert.notEqual(status, 0, `row ${row.id} fired but the run still exited 0`);
  });

  test(`row ${row.id} does not fire on the clean fixture`, () => {
    // The other half of a real gate: a row that fires on everything is as useless as one that
    // fires on nothing. This is what catches an over-broad pattern (the defect design-tells
    // found twice only by running for real).
    const { stdout } = runVerify(join(FIXTURES, 'clean'), ['--strict']);
    assert.doesNotMatch(stdout, new RegExp(`${row.id}:`), `row ${row.id} over-fires on clean motion code:\n${stdout}`);
  });
}

// ------------------------------------------------------------------ the counter

test('motion with no reduced-motion guard is reported, and the guard silences it', () => {
  // Absence of a guard cannot be a pattern row: there is no line to match. It gets its own named
  // test rather than riding the generic mechanism, and this comment is why.
  //
  // The assertions match on the VERDICT, not just on the id: this counter names itself on every
  // run — fail, ok or skip — because a gate that goes silent when it passes cannot be told apart
  // from a gate that never ran (P2). So `doesNotMatch(id)` would be the wrong contract here.
  const dirty = runVerify(join(FIXTURES, COUNTER_ID), ['--strict']);
  assert.match(dirty.stdout, new RegExp(`fail\\s+${COUNTER_ID}`), `the counter did not fire:\n${dirty.stdout}`);
  assert.notEqual(dirty.status, 0);

  const clean = runVerify(join(FIXTURES, 'clean'), ['--strict']);
  assert.match(clean.stdout, new RegExp(`ok\\s+${COUNTER_ID}`), `the counter did not report passing:\n${clean.stdout}`);
  assert.doesNotMatch(clean.stdout, new RegExp(`fail\\s+${COUNTER_ID}`), `the counter over-fires:\n${clean.stdout}`);
});

test('a project with no motion at all is not told to add a reduced-motion guard', () => {
  // The over-fire that would make this counter noise: a backend-only repo has no animation, so it
  // has nothing to guard. Warning there is how a gate earns a `.no-verify`.
  const { stdout, status } = runVerify(join(FIXTURES, 'no-motion'), ['--strict']);
  assert.match(stdout, new RegExp(`skip\\s+${COUNTER_ID}`), `the counter should skip, not judge:\n${stdout}`);
  assert.doesNotMatch(stdout, new RegExp(`(fail|warn)\\s+${COUNTER_ID}`));
  assert.equal(status, 0, `a repo with no motion should pass cleanly:\n${stdout}`);
});

// ------------------------------------------------------------------ end to end

test('the dirty fixture exits non-zero WITHOUT --strict, on fail-severity rows alone', () => {
  // The spec's acceptance criterion: the five binding tells are flagged and the run fails. Without
  // --strict, only `fail` rows can do that — so this proves the severity column is load-bearing
  // and not decoration.
  const { stdout, status } = runVerify(join(FIXTURES, 'dirty'));
  assert.notEqual(status, 0, `dirty fixture exited 0:\n${stdout}`);
  for (const id of ['transition-all', 'scale-zero-entrance', 'ease-in-ui', 'origin-center-popover', COUNTER_ID]) {
    assert.match(stdout, new RegExp(id), `dirty fixture did not report ${id}:\n${stdout}`);
  }
});

test('the clean fixture exits 0, even under --strict', () => {
  const { stdout, status } = runVerify(join(FIXTURES, 'clean'), ['--strict']);
  assert.equal(status, 0, `clean fixture did not pass:\n${stdout}`);
});

test('both search engines agree: the grep branch finds the same tells as rg', () => {
  // The patterns are POSIX ERE precisely so rg and grep -E behave identically. Without this, the
  // suite only ever exercises whichever engine the machine happens to have, and a pattern using an
  // rg-only feature would ship broken to every user without ripgrep installed.
  const withRg = runVerify(join(FIXTURES, 'dirty'));
  const withGrep = runVerify(join(FIXTURES, 'dirty'), [], { VERIFY_FORCE_GREP: '1' });
  assert.equal(withRg.status, withGrep.status, 'the two engines disagree on the exit code');
  for (const id of ['transition-all', 'scale-zero-entrance', 'ease-in-ui', 'origin-center-popover']) {
    assert.match(withGrep.stdout, new RegExp(id), `the grep branch missed ${id}:\n${withGrep.stdout}`);
  }
  // And the near-misses must stay near-misses under grep too (release-info, ease-in-out).
  const cleanGrep = runVerify(join(FIXTURES, 'clean'), ['--strict'], { VERIFY_FORCE_GREP: '1' });
  assert.equal(cleanGrep.status, 0, `the grep branch over-fires on clean code:\n${cleanGrep.stdout}`);
});

test('severity is honest: at least one row is fail and at least one is warn', () => {
  // A table where everything fails gets switched off (P7); a table where nothing fails cannot
  // satisfy the spec's exit-code criterion. Both halves must exist.
  const sevs = new Set(rows.map((r) => r.sev));
  assert.ok(sevs.has('fail'), 'no row can fail the build — the gate cannot enforce anything');
  assert.ok(sevs.has('warn'), 'every row fails — friction is not proportional to risk (P7)');
});

test('every fixture directory belongs to a row, the counter, or the two end-to-end cases', () => {
  // Catches the reverse drift: a fixture left behind after its row was deleted looks like
  // coverage and checks nothing.
  const known = new Set([...rows.map((r) => r.id), COUNTER_ID, 'clean', 'dirty', 'no-motion']);
  const orphans = readdirSync(FIXTURES).filter((d) => !known.has(d));
  assert.deepEqual(orphans, [], `fixtures with no owner: ${orphans.join(', ')}`);
});
