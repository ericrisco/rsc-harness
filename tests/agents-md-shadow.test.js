import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  ensureShadowClaudeMd, removeShadowClaudeMd, SHADOW_BODY, SHADOW_MARK,
} from '../targets/agents-md-shadow.js';

// The defect: rsc delivers its always-on body to Claude Code through a SessionStart hook AND
// writes the same body into the root AGENTS.md for the codex/opencode/amp/jules/zed family.
// Wiring both is an ordinary install. From Claude Code 2.1.277 a project with no CLAUDE.md is
// read through AGENTS.md directly, so the same ~7 KB lands twice per session.
//
// The hook cannot fix this by staying silent: its payload carries no Claude Code version, and
// guessing wrong swallows the always-on layer on every older client. The fix is structural — a
// CLAUDE.md at the root, which every version of Claude Code prefers over AGENTS.md.
const HERE = dirname(fileURLToPath(import.meta.url));
const SUGGEST_BLOCK = '<!-- rsc-suggest:start -->\nbody\n<!-- rsc-suggest:end -->\n';

// A project in a given configuration. `claude` wires settings.json the way the installer does;
// `agentsMd` decides whether the root AGENTS.md carries rsc's block, the user's own prose, or
// nothing at all.
function project({ claude = true, agentsMd = 'rsc', claudeMd = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-shadow-'));
  if (claude) {
    mkdirSync(join(root, '.claude'), { recursive: true });
    const command = `node "${join(root, '.rsc', 'session-start.mjs')}" "x" "${root}"`;
    writeFileSync(
      join(root, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command }] }] } }, null, 2) + '\n',
    );
  }
  if (agentsMd === 'rsc') writeFileSync(join(root, 'AGENTS.md'), `# mine\n\n${SUGGEST_BLOCK}`);
  if (agentsMd === 'user') writeFileSync(join(root, 'AGENTS.md'), '# my own instructions\n');
  if (claudeMd) {
    mkdirSync(dirname(join(root, claudeMd)), { recursive: true });
    writeFileSync(join(root, claudeMd), '# mine\n');
  }
  return root;
}

test('the duplicating configuration gets a shadow CLAUDE.md', () => {
  // Claude Code wired + rsc's block in the root AGENTS.md + no CLAUDE.md = the body arrives twice
  // on 2.1.277+. This is the one case the shadow exists for.
  const root = project();
  const written = ensureShadowClaudeMd(root);
  assert.equal(written, join(root, 'CLAUDE.md'));
  assert.ok(existsSync(join(root, 'CLAUDE.md')), 'no CLAUDE.md was written');
});

test('the shadow never imports AGENTS.md', () => {
  // An `@AGENTS.md` import would expand the always-on block into context and recreate exactly the
  // duplication this file prevents. This is the single most load-bearing property of the content.
  const root = project();
  ensureShadowClaudeMd(root);
  const body = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  assert.doesNotMatch(
    body.replace(/<!--[\s\S]*?-->/g, ''),
    /(^|\s)@AGENTS\.md/,
    'the shadow imports AGENTS.md, which brings the duplicate back',
  );
});

test('a project that cannot duplicate is left untouched', () => {
  for (const [label, opts] of [
    ['Claude Code not wired', { claude: false }],
    ['AGENTS.md is the user\'s own prose, not rsc\'s block', { agentsMd: 'user' }],
    ['no AGENTS.md at all', { agentsMd: null }],
  ]) {
    const root = project(opts);
    assert.equal(ensureShadowClaudeMd(root), null, `planted a CLAUDE.md when ${label}`);
    assert.ok(!existsSync(join(root, 'CLAUDE.md')), `planted a CLAUDE.md when ${label}`);
  }
});

test('an existing CLAUDE.md of any form is never overwritten', () => {
  // All three forms stop Claude Code reading AGENTS.md, so all three make the shadow unnecessary —
  // and overwriting someone's project instructions to fix a context leak would be a far worse bug.
  for (const form of ['CLAUDE.md', join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md']) {
    const root = project({ claudeMd: form });
    assert.equal(ensureShadowClaudeMd(root), null, `did not respect an existing ${form}`);
    assert.equal(readFileSync(join(root, form), 'utf8'), '# mine\n', `overwrote an existing ${form}`);
  }
});

test('a CLAUDE.md in a parent directory also suppresses the shadow', () => {
  // Claude Code resolves CLAUDE.md from the working directory AND every directory above it, so a
  // parent's file already does the shadow's job. Planting one anyway is a file nobody asked for.
  const parent = mkdtempSync(join(tmpdir(), 'rsc-shadow-parent-'));
  writeFileSync(join(parent, 'CLAUDE.md'), '# the parent owns this\n');
  const root = join(parent, 'child');
  mkdirSync(root);
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node ".rsc/session-start.mjs"' }] }] } }));
  writeFileSync(join(root, 'AGENTS.md'), SUGGEST_BLOCK);
  assert.equal(ensureShadowClaudeMd(root), null, 'ignored a CLAUDE.md in the parent directory');
});

test('a Windows-wired project is recognised as wired', () => {
  // The needle that decides "is Claude Code wired here" reads settings.json, where a Windows
  // install stores separators that JSON escapes as pairs. Reading only for `.rsc/` answered "not
  // wired" on Windows — the same blindness that once let the body be injected four times there.
  const root = mkdtempSync(join(tmpdir(), 'rsc-shadow-win-'));
  mkdirSync(join(root, '.claude'));
  writeFileSync(
    join(root, '.claude', 'settings.json'),
    JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "C:\\proj\\.rsc\\session-start.mjs"' }] }] } }, null, 2),
  );
  writeFileSync(join(root, 'AGENTS.md'), SUGGEST_BLOCK);
  assert.equal(ensureShadowClaudeMd(root), join(root, 'CLAUDE.md'), 'a Windows-wired project was read as unwired');
});

test('ensure is idempotent', () => {
  const root = project();
  ensureShadowClaudeMd(root);
  const first = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  ensureShadowClaudeMd(root);
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), first, 'a second install changed the shadow');
});

test('uninstall takes back an untouched shadow, and only that', () => {
  const root = project();
  ensureShadowClaudeMd(root);
  assert.equal(removeShadowClaudeMd(root), join(root, 'CLAUDE.md'));
  assert.ok(!existsSync(join(root, 'CLAUDE.md')), 'the shadow survived uninstall');
});

test('uninstall never deletes a shadow the user has edited', () => {
  // The moment someone writes their own instructions into it, it is their file. Deleting it on
  // uninstall would destroy project instructions to clean up after ourselves.
  const root = project();
  ensureShadowClaudeMd(root);
  writeFileSync(join(root, 'CLAUDE.md'), SHADOW_BODY + '\n- always run npm test\n');
  assert.equal(removeShadowClaudeMd(root), null, 'deleted an edited CLAUDE.md');
  assert.ok(existsSync(join(root, 'CLAUDE.md')), 'deleted an edited CLAUDE.md');
});

test('uninstall never deletes a CLAUDE.md rsc did not write', () => {
  const root = project({ claudeMd: 'CLAUDE.md' });
  assert.equal(removeShadowClaudeMd(root), null, "deleted the user's own CLAUDE.md");
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), '# mine\n');
});

test('the shadow body carries its marker', () => {
  assert.ok(SHADOW_BODY.startsWith(SHADOW_MARK), 'the marker must lead, so the file is identifiable at a glance');
});

// --- the hygiene notice, which had to learn the same lesson -------------------------------------

const SCRIPT = join(HERE, '..', 'targets', 'session-start.mjs');
const SUGGEST = join(HERE, '..', 'skills', 'suggest', 'SKILL.md');

function runHook(root) {
  const r = spawnSync('node', [SCRIPT, SUGGEST, root], {
    encoding: 'utf8',
    env: { ...process.env, RSC_HOOK_MARKER_DIR: mkdtempSync(join(tmpdir(), 'rsc-mark-')) },
  });
  return r.stdout + r.stderr;
}

test('an overgrown AGENTS.md is reported when it is the file being loaded', () => {
  // Before 2.1.277 only CLAUDE.md was ever loaded, so the budget notice only ever measured that.
  // A project whose instructions live in AGENTS.md now pays the same per-turn cost unmeasured.
  const root = mkdtempSync(join(tmpdir(), 'rsc-hygiene-'));
  writeFileSync(join(root, 'AGENTS.md'), 'line\n'.repeat(400));
  assert.match(runHook(root), /AGENTS\.md is 40[01] lines/, 'an overgrown AGENTS.md went unmeasured');
});

test('AGENTS.md is not measured when a CLAUDE.md is what loads', () => {
  // With a CLAUDE.md present, Claude Code never reads AGENTS.md — warning about its size would be
  // a false alarm, and the notice that always fires is the notice that gets opted out of.
  const root = mkdtempSync(join(tmpdir(), 'rsc-hygiene-2-'));
  writeFileSync(join(root, 'AGENTS.md'), 'line\n'.repeat(400));
  writeFileSync(join(root, 'CLAUDE.md'), '# short\n');
  assert.doesNotMatch(runHook(root), /AGENTS\.md is \d+ lines/, 'measured AGENTS.md while a CLAUDE.md was loading');
});

test('an overgrown CLAUDE.md is still reported', () => {
  // The case that already worked, and must keep working.
  const root = mkdtempSync(join(tmpdir(), 'rsc-hygiene-3-'));
  writeFileSync(join(root, 'CLAUDE.md'), 'line\n'.repeat(400));
  assert.match(runHook(root), /CLAUDE\.md is 40[01] lines/, 'the original CLAUDE.md budget notice stopped firing');
});
