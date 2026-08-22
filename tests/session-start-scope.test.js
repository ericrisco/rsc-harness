import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// `isWiredScope` decides whether the COMPLEMENTARY scope (home when you are in a project, and vice
// versa) is also wired, so session-start can warn that a lagging scope keeps emitting its own copy
// of the always-on body. It decided that by looking for `.rsc/` in settings.json.
//
// On Windows the wired command is stored with backslashes, so the check always answered "not wired"
// — which means the detector for a DUPLICATED always-on body was blind on the exact platform where
// the body was being injected four times. Found by sweeping the hook scripts after fixing the
// wiring itself (PR #241 / 1.0.31); the wiring fix did not reach this file.
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'targets', 'session-start.mjs');
const SUGGEST = join(HERE, '..', 'skills', 'suggest', 'SKILL.md');

// A scope whose settings.json was written by an install on the given platform.
function scope(style) {
  const root = mkdtempSync(join(tmpdir(), `rsc-scope-${style}-`));
  mkdirSync(join(root, '.claude'), { recursive: true });
  mkdirSync(join(root, '.rsc'), { recursive: true });
  const command = style === 'windows'
    ? 'node "C:\\proj\\.rsc\\session-start.mjs" "C:\\proj\\.claude\\skills\\suggest\\SKILL.md" "C:\\proj"'
    : `node "${join(root, '.rsc', 'session-start.mjs')}" "x" "${root}"`;
  writeFileSync(
    join(root, '.claude', 'settings.json'),
    JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command }] }] } }, null, 2) + '\n',
  );
  return root;
}

// Run the hook with HOME pointed at a wired complementary scope, and report whether the
// lagging-scope warning fired.
function runWith({ projectVersion, homeStyle, homeVersion }) {
  const project = scope('posix');
  mkdirSync(join(project, '.rsc'), { recursive: true });
  writeFileSync(join(project, '.rsc', '.version'), `${projectVersion}\n`);

  const home = scope(homeStyle);
  writeFileSync(join(home, '.rsc', '.version'), `${homeVersion}\n`);

  const r = spawnSync('node', [SCRIPT, SUGGEST, project], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  return r.stdout + r.stderr;
}

test('a lagging POSIX-wired complementary scope is reported', () => {
  // Control: this is the case that already worked, and it must keep working.
  const out = runWith({ projectVersion: '1.0.31', homeStyle: 'posix', homeVersion: '1.0.20' });
  assert.match(out, /scope/i, `the lagging-scope notice did not fire at all:\n${out}`);
});

test('a lagging WINDOWS-wired complementary scope is reported too', () => {
  // The bug: the same lagging scope, wired by a Windows install, was invisible.
  const out = runWith({ projectVersion: '1.0.31', homeStyle: 'windows', homeVersion: '1.0.20' });
  assert.match(out, /scope/i, `a Windows-wired lagging scope was not detected:\n${out}`);
});

test('an up-to-date complementary scope is not reported, on either separator style', () => {
  // The other half: a detector that always fires is noise, and noise gets opted out of.
  for (const style of ['posix', 'windows']) {
    const out = runWith({ projectVersion: '1.0.31', homeStyle: style, homeVersion: '1.0.31' });
    assert.doesNotMatch(out, /lagging|older/i, `false alarm for an up-to-date ${style} scope:\n${out}`);
  }
});
