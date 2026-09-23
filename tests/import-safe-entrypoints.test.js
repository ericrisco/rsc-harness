import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TARGETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'targets');

// `if (import.meta.url === pathToFileURL(process.argv[1]).href)` is the idiom everyone writes and
// it is wrong twice. `clone-bootstrap.mjs` already carries both findings in prose; these are the
// same two claims as tests, on the two files that still had the naive version.
//
// The reproduction has to be a SUBPROCESS. Inside the test runner `process.argv[1]` is the runner's
// own path, so the bug is invisible here — which is exactly how it survived: every test imported
// these modules successfully, and the first person to hit it was someone importing them from
// somewhere else.
function importFrom(specifier, argv = []) {
  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(specifier)}); console.log('loaded');`, ...argv],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], input: '' },
  ).trim();
}

for (const file of ['gitmoji-guard.mjs', 'session-memory-adapter.mjs']) {
  test(`${file} can be imported where there is no argv[1]`, () => {
    const url = pathToFileURL(join(TARGETS, file)).href;
    assert.equal(importFrom(url), 'loaded', 'a module must not throw just because nobody ran it directly');
  });
}

// The other half, and the one with teeth: the guard must still know when it IS the script. A file
// that answers "no" to that question is a hook that loads, denies nothing and reports success —
// the failure mode `clone-bootstrap` calls a silent no-op, "including the danger guard".
test('gitmoji-guard still recognises itself when run directly, and still denies', () => {
  const out = execFileSync(
    process.execPath,
    [join(TARGETS, 'gitmoji-guard.mjs'), process.cwd()],
    {
      encoding: 'utf8',
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "arreglado el login"' } }),
    },
  );
  assert.match(out, /permissionDecision/, 'the main block ran');
  assert.match(out, /no gitmoji/i);
});

test('gitmoji-guard run directly still allows a compliant message', () => {
  const out = execFileSync(
    process.execPath,
    [join(TARGETS, 'gitmoji-guard.mjs'), process.cwd()],
    {
      encoding: 'utf8',
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "🐛 fix(x): y"' } }),
    },
  );
  assert.equal(out.trim(), '', 'allowing is silent, and silence must not come from a guard that did not run');
});
