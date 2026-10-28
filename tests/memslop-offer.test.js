import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { memslopNotice } from '../targets/memslop-offer.mjs';
import { MACHINE_OPT_OUTS, PROJECT_OPT_OUTS } from '../targets/opt-outs.js';

// The optional MemSlop offer: macOS 14+ only, one offer a week, three at most, a permanent no per
// machine. Everything runs against a disposable home (RSC_MEMSLOP_HOME), never the real one.
const HERE = dirname(fileURLToPath(import.meta.url));
const TARGETS = join(HERE, '..', 'targets');
const SUGGEST = join(HERE, '..', 'skills', 'suggest', 'SKILL.md');
const DAY = 86400000;
const MAC = { platform: 'darwin', release: '24.1.0' };

// realpath: on macOS tmpdir() is a /var symlink, and auto-update.mjs only runs as a script from its real path.
const tmp = (tag) => realpathSync(mkdtempSync(join(tmpdir(), `rsc-memslop-${tag}-`)));
const statePath = (home) => join(home, '.rsc', 'memslop-offer.json');
const readState = (home) => JSON.parse(readFileSync(statePath(home), 'utf8'));
function stamp(home, offers, daysAgo, now = Date.now()) {
  mkdirSync(join(home, '.rsc'), { recursive: true });
  writeFileSync(statePath(home), JSON.stringify({ offers, last: new Date(now - daysAgo * DAY).toISOString() }));
}
// MemSlop.app under the home's Applications; `cli` adds the 1.2+ command line tool.
function installApp(home, { cli = true } = {}) {
  const app = join(home, 'Applications', 'MemSlop.app', 'Contents');
  mkdirSync(join(app, 'Helpers'), { recursive: true });
  if (cli) writeFileSync(join(app, 'Helpers', 'memslop'), '#!/bin/sh\n');
}
const sessionEnd = (command) => JSON.stringify({ hooks: { SessionEnd: [{ hooks: [{ type: 'command', command }] }] } });

test('off darwin: nothing printed and no state file written', () => {
  for (const platform of ['linux', 'win32']) {
    const home = tmp(platform);
    assert.equal(memslopNotice({ platform, release: '24.0.0', home }), '');
    assert.equal(existsSync(statePath(home)), false);
    assert.equal(existsSync(join(home, '.rsc')), false);
  }
});

test('macOS 13 (Darwin 22) stays silent', () => {
  const home = tmp('ventura');
  assert.equal(memslopNotice({ platform: 'darwin', release: '22.6.0', home }), '');
  assert.equal(existsSync(statePath(home)), false);
});

test('macOS 14+, no MemSlop, no marker: the offer is printed once and counted', () => {
  const home = tmp('offer');
  const out = memslopNotice({ ...MAC, home });
  assert.match(out, /===== rsc mem-slop \(optional, macOS\) =====/);
  assert.match(out, /install\.sh \| bash/);
  assert.match(out, /Never install it without that yes/);
  assert.equal(readState(home).offers, 1);
  // Same session, second scope: the cadence already holds it back.
  assert.equal(memslopNotice({ ...MAC, home }), '');
  assert.equal(readState(home).offers, 1);
});

test('weekly cadence: 3 days ago is silent, 8 days ago offers again', () => {
  const recent = tmp('recent');
  stamp(recent, 1, 3);
  assert.equal(memslopNotice({ ...MAC, home: recent }), '');

  const old = tmp('old');
  stamp(old, 2, 8);
  assert.match(memslopNotice({ ...MAC, home: old }), /rsc mem-slop/);
  assert.equal(readState(old).offers, 3);
});

test('cap: after 3 offers nothing is printed, ever, and no .no-memslop is written', () => {
  const home = tmp('cap');
  stamp(home, 3, 365);
  assert.equal(memslopNotice({ ...MAC, home }), '');
  assert.equal(existsSync(join(home, '.rsc', '.no-memslop')), false);
});

test('a permanent no in ~/.rsc/.no-memslop silences it', () => {
  const home = tmp('no');
  mkdirSync(join(home, '.rsc'), { recursive: true });
  writeFileSync(join(home, '.rsc', '.no-memslop'), '');
  assert.equal(memslopNotice({ ...MAC, home }), '');
});

test('MemSlop older than 1.2 (no command line tool) stays silent', () => {
  const home = tmp('legacy');
  installApp(home, { cli: false });
  mkdirSync(join(home, '.claude'), { recursive: true });
  assert.equal(memslopNotice({ ...MAC, home }), '');
});

test('installed, Claude Code hook missing: the connect block is printed', () => {
  const home = tmp('connect');
  installApp(home);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ hooks: {} }));
  const out = memslopNotice({ ...MAC, home });
  assert.match(out, /memslop hooks install/);
  assert.match(out, /memslop hooks uninstall/);
  assert.match(out, /\.no-memslop/);
});

test('installed, Codex hook missing while Claude is connected: still the connect block', () => {
  const home = tmp('codex-missing');
  installApp(home);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), sessionEnd('/Applications/MemSlop.app/Contents/Helpers/memslop hook session-end'));
  mkdirSync(join(home, '.codex'), { recursive: true });
  assert.match(memslopNotice({ ...MAC, home }), /memslop hooks install/);
});

test('all set: every present agent folder has the hook, nothing is printed', () => {
  const home = tmp('done');
  installApp(home);
  const cmd = '"/Applications/MemSlop.app/Contents/Helpers/memslop" hook session-end';
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), sessionEnd(cmd));
  mkdirSync(join(home, '.codex'), { recursive: true });
  writeFileSync(join(home, '.codex', 'hooks.json'), sessionEnd(cmd));
  assert.equal(memslopNotice({ ...MAC, home }), '');
  assert.equal(existsSync(statePath(home)), false);
});

test('malformed settings.json: nothing printed, no throw', () => {
  const home = tmp('malformed');
  installApp(home);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), '{ not json');
  assert.equal(memslopNotice({ ...MAC, home }), '');
});

test('memslop is a machine opt-out, never a project one', () => {
  assert.ok(MACHINE_OPT_OUTS.includes('memslop'));
  assert.ok(!PROJECT_OPT_OUTS.includes('memslop'));
});

test('speed: a full detection pass stays well under 10 ms', () => {
  const home = tmp('speed');
  installApp(home);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), sessionEnd('memslop hook session-end'));
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) memslopNotice({ ...MAC, home });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  assert.ok(ms < 10, `took ${ms} ms per call`);
});

// --- the real hooks -------------------------------------------------------------------------------

// A materialized rsc project: the hook scripts copied into .rsc/ as siblings, and a profile.
function project({ withModule = true } = {}) {
  const root = tmp('project');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '02-DOCS', 'wiki', 'harness'), { recursive: true });
  writeFileSync(join(root, '02-DOCS', 'wiki', 'harness', 'user-profile.md'), 'technical_level: technical\n');
  writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { context7: {} } }));
  const files = ['session-start.mjs', 'auto-update.mjs', 'hook-once.mjs', 'worktree-reaper.mjs', 'team-safe-start.mjs', 'trunk-policy.mjs', 'shell-unwrap.mjs'];
  if (withModule) files.push('memslop-offer.mjs');
  for (const f of files) copyFileSync(join(TARGETS, f), join(root, '.rsc', f));
  return root;
}
function runSessionStart(root, home, env = {}, sessionId = randomUUID()) {
  const r = spawnSync('node', [join(root, '.rsc', 'session-start.mjs'), SUGGEST, root], {
    input: JSON.stringify({ session_id: sessionId, source: 'startup' }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, RSC_MEMSLOP_HOME: home, RSC_NO_UPDATE_CHECK: '1', RSC_HOOK_MARKER_DIR: join(home, 'once'), ...env },
  });
  return r;
}

test('session-start on Linux/Windows: byte-identical to a build without the offer, no state file', () => {
  for (const platform of ['linux', 'win32']) {
    const home = tmp(`ss-${platform}`);
    const withIt = runSessionStart(project(), home, { RSC_MEMSLOP_PLATFORM: platform });
    const without = runSessionStart(project({ withModule: false }), home, { RSC_MEMSLOP_PLATFORM: platform });
    assert.equal(withIt.status, 0);
    assert.equal(withIt.stdout.replaceAll(/rsc-memslop-project-\w+/g, 'P'), without.stdout.replaceAll(/rsc-memslop-project-\w+/g, 'P'));
    assert.doesNotMatch(withIt.stdout, /mem-slop/);
    assert.equal(existsSync(statePath(home)), false);
  }
});

test('session-start on macOS 14+: the offer once per session, even with both scopes wired', () => {
  const home = tmp('ss-mac');
  const root = project();
  const env = { RSC_MEMSLOP_PLATFORM: 'darwin', RSC_MEMSLOP_RELEASE: '24.1.0' };
  const sid = randomUUID();
  const first = runSessionStart(root, home, env, sid);
  const second = runSessionStart(root, home, env, sid);
  const all = first.stdout + second.stdout;
  assert.equal(all.match(/===== rsc mem-slop/g)?.length, 1, all);
  assert.equal(readState(home).offers, 1);
});

test('session-start without a profile: no offer', () => {
  const home = tmp('ss-noprofile');
  const root = project();
  rmSync(join(root, '02-DOCS', 'wiki', 'harness', 'user-profile.md'));
  const r = runSessionStart(root, home, { RSC_MEMSLOP_PLATFORM: 'darwin', RSC_MEMSLOP_RELEASE: '24.1.0' });
  assert.doesNotMatch(r.stdout, /mem-slop/);
});

test('session-start with a malformed settings.json exits 0 and keeps the body', () => {
  const home = tmp('ss-malformed');
  installApp(home);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), '{ nope');
  const r = runSessionStart(project(), home, { RSC_MEMSLOP_PLATFORM: 'darwin', RSC_MEMSLOP_RELEASE: '24.1.0' });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /mem-slop/);
  assert.match(r.stdout, /rsc-suggest/);
});

test('Codex SessionStart hook carries the offer as additionalContext', () => {
  const home = tmp('codex');
  const root = project();
  const r = spawnSync('node', [join(root, '.rsc', 'auto-update.mjs'), 'hook', 'codex', root], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, RSC_MEMSLOP_HOME: home, RSC_NO_UPDATE_CHECK: '1', RSC_MEMSLOP_PLATFORM: 'darwin', RSC_MEMSLOP_RELEASE: '24.1.0' },
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /rsc mem-slop/);
});

test('Codex hook off darwin: unchanged empty output', () => {
  const home = tmp('codex-linux');
  const root = project();
  const r = spawnSync('node', [join(root, '.rsc', 'auto-update.mjs'), 'hook', 'codex', root], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, RSC_MEMSLOP_HOME: home, RSC_NO_UPDATE_CHECK: '1', RSC_MEMSLOP_PLATFORM: 'linux' },
  });
  assert.equal(r.stdout, '{}\n');
  assert.equal(existsSync(statePath(home)), false);
});
