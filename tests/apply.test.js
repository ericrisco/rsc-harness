import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, lstatSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyInstall, listInstalled, uninstall, syncInstalled, purge } from '../scripts/install-apply.js';
import { listBackups, restoreBackup } from '../scripts/lib/backups.js';
import { doctor } from '../scripts/doctor.js';
import { targetPaths } from '../targets/index.js';

const SESSION_START = join(dirname(fileURLToPath(import.meta.url)), '..', 'targets', 'session-start.mjs');
const CLI_VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

function runSessionStart(root, env = {}, input = undefined) {
  const suggest = join(root, 'suggest-SKILL.md');
  writeFileSync(suggest, '# rsc-suggest — detect & install\nalways-on body\n');
  // Default: skip the update check so unrelated tests never hit the network.
  // Update tests opt in by passing RSC_NO_UPDATE_CHECK:'' + RSC_LATEST:'<v>'.
  const merged = { ...process.env, RSC_NO_UPDATE_CHECK: '1', ...env };
  // `input` is the hook payload Claude Code writes to stdin; omitted → no stdin, fail-open.
  const opts = { encoding: 'utf8', env: merged, ...(input === undefined ? {} : { input }) };
  return spawnSync('node', [SESSION_START, suggest, root], opts).stdout;
}

test('session-start: emits suggest body + banner when no profile and no opt-out', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  const out = runSessionStart(root);
  assert.ok(out.includes('detect & install'), 'always cats suggest body');
  assert.ok(out.includes('rsc onboarding'), 'banner present on fresh install');
});

test('session-start: no banner once user-profile.md exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '02-DOCS/wiki/harness'), { recursive: true });
  writeFileSync(join(root, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: technical\n');
  const out = runSessionStart(root);
  assert.ok(out.includes('detect & install'), 'still cats suggest body');
  assert.ok(!out.includes('rsc onboarding'), 'no banner when profile exists');
});

test('session-start: no banner when .rsc/.no-harness opt-out exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.no-harness'), '');
  const out = runSessionStart(root);
  assert.ok(!out.includes('rsc onboarding'), 'opt-out silences the banner');
});

test('session-start: nudges when CLAUDE.md exceeds the line budget', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  writeFileSync(join(root, 'CLAUDE.md'), `# CLAUDE\n${'x\n'.repeat(250)}`);
  const out = runSessionStart(root);
  assert.ok(out.includes('CLAUDE.md hygiene'), 'over-budget CLAUDE.md triggers the nudge');
  assert.ok(out.includes('02-DOCS/wiki/index.md'), 'nudge names the offload target');
});

test('session-start: no CLAUDE.md nudge under budget or with opt-out', () => {
  const lean = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  writeFileSync(join(lean, 'CLAUDE.md'), `# CLAUDE\n${'x\n'.repeat(50)}`);
  assert.ok(!runSessionStart(lean).includes('CLAUDE.md hygiene'), 'lean CLAUDE.md → no nudge');

  const big = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  writeFileSync(join(big, 'CLAUDE.md'), `# CLAUDE\n${'x\n'.repeat(250)}`);
  mkdirSync(join(big, '.rsc'), { recursive: true });
  writeFileSync(join(big, '.rsc/.no-claudemd-check'), '');
  assert.ok(!runSessionStart(big).includes('CLAUDE.md hygiene'), 'opt-out silences the nudge');
});

test('session-start: auto-ingest nudge when wiki exists and inbox has a real file', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '02-DOCS/wiki'), { recursive: true });
  mkdirSync(join(root, '02-DOCS/inbox'), { recursive: true });
  writeFileSync(join(root, '02-DOCS/inbox/invoice.pdf'), '%PDF-1.4');
  const out = runSessionStart(root);
  assert.ok(out.includes('rsc auto-ingest'), 'nudges the Auto-Ingest Sweep');
});

test('session-start: no auto-ingest nudge when inbox holds only README', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '02-DOCS/wiki'), { recursive: true });
  mkdirSync(join(root, '02-DOCS/inbox'), { recursive: true });
  writeFileSync(join(root, '02-DOCS/inbox/README.md'), 'drop zone');
  const out = runSessionStart(root);
  assert.ok(!out.includes('rsc auto-ingest'), 'README alone is not un-ingested material');
});

test('session-start: no auto-ingest nudge without a harness wiki', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '02-DOCS/inbox'), { recursive: true });
  writeFileSync(join(root, '02-DOCS/inbox/invoice.pdf'), '%PDF-1.4');
  const out = runSessionStart(root);
  assert.ok(!out.includes('rsc auto-ingest'), 'no wiki → nothing to ingest into yet');
});

test('session-start: update banner when a newer version is available', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-upd-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.version'), '0.1.0\n');
  const out = runSessionStart(root, { RSC_NO_UPDATE_CHECK: '', RSC_LATEST: '0.2.0' });
  assert.ok(out.includes('rsc update available'), 'notifies when a newer version exists');
  assert.ok(out.includes('0.2.0') && out.includes('0.1.0'), 'shows latest and installed versions');
  assert.ok(out.includes('npx @ericrisco/rsc@latest'), 'gives the update command');
});

test('session-start: no update banner when installed is current', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-upd-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.version'), '0.2.0\n');
  const out = runSessionStart(root, { RSC_NO_UPDATE_CHECK: '', RSC_LATEST: '0.2.0' });
  assert.ok(!out.includes('rsc update available'), 'no banner when up to date');
});

test('session-start: RSC_NO_UPDATE_CHECK silences the update check', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-upd-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.version'), '0.1.0\n');
  const out = runSessionStart(root, { RSC_NO_UPDATE_CHECK: '1', RSC_LATEST: '9.9.9' });
  assert.ok(!out.includes('rsc update available'), 'opt-out disables the check');
});

test('session-start: no update banner without a .rsc/.version baseline', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-upd-'));
  const out = runSessionStart(root, { RSC_NO_UPDATE_CHECK: '', RSC_LATEST: '9.9.9' });
  assert.ok(!out.includes('rsc update available'), 'no baseline → no banner (stay silent)');
});

test('targetPaths exposes the project root', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  const paths = targetPaths('claude', undefined, cwd);
  assert.equal(paths.projectRoot, cwd);
});

test('claude: skills install at the discoverable flat path .claude/skills/<id>/ (not nested under rsc/)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-flat-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  // Claude Code discovers project skills at .claude/skills/<name>/SKILL.md — one level.
  // A skill nested at .claude/skills/rsc/<id>/ is NOT discovered (that was the Windows bug).
  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')),
    'skill must sit one level under .claude/skills/ so Claude Code discovers it');
  assert.ok(!existsSync(join(cwd, '.claude/skills/rsc/fastapi/SKILL.md')),
    'must NOT be nested under an rsc/ subfolder');
});

test('install records the CLI version in .rsc/.version', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ver-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  assert.equal(readFileSync(join(cwd, '.rsc/.version'), 'utf8').trim(), CLI_VERSION);
});

test('reinstall after a version change refreshes the base content (reinstall == update)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ref-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  // simulate an older install whose base drifted from the current bundled version
  writeFileSync(join(cwd, '.rsc/.base-versions.json'), JSON.stringify({ fastapi: '0.0.1' }) + '\n');
  writeFileSync(join(cwd, '.rsc/.version'), '0.0.1\n');
  writeFileSync(join(cwd, '.rsc/skills/fastapi/STALE.txt'), 'old content');
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  assert.ok(!existsSync(join(cwd, '.rsc/skills/fastapi/STALE.txt')), 'stale base file removed on refresh');
  assert.equal(readFileSync(join(cwd, '.rsc/.version'), 'utf8').trim(), CLI_VERSION, 'version bumped to current');
});

test('same-version reinstall does not refresh the base', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-same-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  writeFileSync(join(cwd, '.rsc/skills/fastapi/KEEP.txt'), 'mine');
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd }); // same CLI version
  assert.ok(existsSync(join(cwd, '.rsc/skills/fastapi/KEEP.txt')), 'base untouched when version unchanged');
});

test('multi-target sync refreshes bases for the second target\'s exclusive skills', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-multi-'));
  // fastapi via claude, nextjs only via codex — both share one .rsc/skills base.
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  await applyInstall({ skillIds: ['nextjs'], target: 'codex', cwd });
  // Simulate the real upgrade: both bases (and the global marker) at an older version.
  writeFileSync(join(cwd, '.rsc/.version'), '0.0.1\n');
  writeFileSync(join(cwd, '.rsc/.base-versions.json'), JSON.stringify({ fastapi: '0.0.1', nextjs: '0.0.1' }) + '\n');
  writeFileSync(join(cwd, '.rsc/skills/fastapi/STALE.txt'), 'x');
  writeFileSync(join(cwd, '.rsc/skills/nextjs/STALE.txt'), 'x');
  // Re-apply claude first (its pass bumps .rsc/.version to current), then codex.
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  await applyInstall({ skillIds: ['nextjs'], target: 'codex', cwd });
  assert.ok(!existsSync(join(cwd, '.rsc/skills/fastapi/STALE.txt')), 'first-target base refreshed');
  // Regression: with the old single global marker, claude's pass bumped it to current so
  // codex's pass saw "unchanged" and skipped refreshing nextjs's base, leaving it stale.
  assert.ok(!existsSync(join(cwd, '.rsc/skills/nextjs/STALE.txt')), 'second-target exclusive base refreshed');
});

test('claude: install writes the developer subagent (Sonnet); purge removes it', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-devagent-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const agent = join(cwd, '.claude/agents/developer.md');
  assert.ok(existsSync(agent), 'developer agent installed');
  assert.match(readFileSync(agent, 'utf8'), /model: sonnet/, 'balanced tier → Sonnet by default');
  await purge({ cwd });
  assert.ok(!existsSync(agent), 'developer agent removed on purge');
});

test('claude: install migrates away the legacy nested .claude/skills/rsc/ layout', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-mig-'));
  // Simulate an old (broken) install that wrote skills under the nested rsc/ folder.
  mkdirSync(join(cwd, '.claude/skills/rsc/oldskill'), { recursive: true });
  writeFileSync(join(cwd, '.claude/skills/rsc/oldskill/SKILL.md'), 'stale');
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  assert.ok(!existsSync(join(cwd, '.claude/skills/rsc')), 'legacy rsc/ folder removed on install');
  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')), 'new flat skill present');
});

test('claude: project-local install links to .rsc base, wires hook, list/uninstall work', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest', 'fastapi'], target: 'claude', cwd });

  // Real files live once in the shared base; the assistant folder is a link to it.
  assert.ok(existsSync(join(cwd, '.rsc/skills/fastapi/SKILL.md')), 'base holds the real file');
  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')), 'claude link resolves');
  assert.ok(existsSync(join(cwd, '.claude/skills/suggest/SKILL.md')));
  assert.equal(lstatSync(join(cwd, '.claude/skills/fastapi')).isSymbolicLink(), true, 'is a symlink, not a copy');

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.ok(JSON.stringify(settings.hooks.SessionStart).includes('skills/suggest'));

  assert.ok(listInstalled({ target: 'claude', cwd }).includes('fastapi'));

  const health = doctor({ target: 'claude', cwd });
  assert.equal(health.missing.length, 0);
  assert.ok(health.hookWired);

  const preview = await uninstall({ skillIds: ['fastapi'], target: 'claude', cwd, dryRun: true });
  assert.ok(preview.length > 0);
  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')), 'dry-run keeps files');

  await uninstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  assert.ok(!existsSync(join(cwd, '.claude/skills/fastapi')), 'link removed');
  assert.ok(existsSync(join(cwd, '.rsc/skills/fastapi/SKILL.md')), 'shared base survives uninstall');
  assert.ok(!listInstalled({ target: 'claude', cwd }).includes('fastapi'));
});

test('claude: install wires the UserPromptSubmit new-feature gate (idempotent, opt-out honored)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-fg-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.ok(JSON.stringify(settings.hooks.UserPromptSubmit || []).includes('userprompt-gate.mjs'),
    'UserPromptSubmit hook wired');
  assert.ok(existsSync(join(cwd, '.rsc/userprompt-gate.mjs')), 'gate script materialized');

  // Re-install must not duplicate the rsc entry.
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const after = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  const count = (after.hooks.UserPromptSubmit || [])
    .filter((e) => JSON.stringify(e).includes('userprompt-gate')).length;
  assert.equal(count, 1, 'exactly one rsc UserPromptSubmit entry after re-install');

  // The materialized script emits the gate; the opt-out marker silences it.
  const emit = spawnSync('node', [join(cwd, '.rsc/userprompt-gate.mjs'), cwd], { encoding: 'utf8' });
  assert.ok(emit.stdout.includes('new-feature gate'), 'script emits the gate reminder');
  writeFileSync(join(cwd, '.rsc/.no-feature-gate'), '');
  const silenced = spawnSync('node', [join(cwd, '.rsc/userprompt-gate.mjs'), cwd], { encoding: 'utf8' });
  assert.equal(silenced.stdout.trim(), '', 'opt-out marker silences the gate');
});

// --- cross-scope de-duplication (spec: context-budget) --------------------------------
// rsc wired in both user and project scope runs two copies of every hook, so the always-on
// body and the SDD gate each land twice. Both copies see the same session_id / prompt_id.

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

test('session-start: two scopes in one session emit the always-on body exactly once', () => {
  const markers = mkdtempSync(join(tmpdir(), 'rsc-markers-'));
  const rootA = mkdtempSync(join(tmpdir(), 'rsc-scopeA-'));
  const rootB = mkdtempSync(join(tmpdir(), 'rsc-scopeB-'));
  const payload = JSON.stringify({ session_id: 'sess-1', hook_event_name: 'SessionStart', source: 'startup' });

  const first = runSessionStart(rootA, { RSC_HOOK_MARKER_DIR: markers }, payload);
  const second = runSessionStart(rootB, { RSC_HOOK_MARKER_DIR: markers }, payload);

  assert.equal(countOf(first, 'detect & install'), 1, 'the first scope emits the body');
  assert.equal(countOf(second, 'detect & install'), 0, 'the second scope stays silent');
});

test('session-start: a later compaction in the same session re-emits the body', () => {
  const markers = mkdtempSync(join(tmpdir(), 'rsc-markers-'));
  const root = mkdtempSync(join(tmpdir(), 'rsc-scope-'));
  const startup = JSON.stringify({ session_id: 'sess-2', source: 'startup' });
  const compact = JSON.stringify({ session_id: 'sess-2', source: 'compact' });

  assert.equal(countOf(runSessionStart(root, { RSC_HOOK_MARKER_DIR: markers }, startup), 'detect & install'), 1);
  // Re-injection after a compaction is the whole point of the always-on layer — never suppress it.
  assert.equal(countOf(runSessionStart(root, { RSC_HOOK_MARKER_DIR: markers }, compact), 'detect & install'), 1);
});

test('session-start: without a session id it fails open and still emits', () => {
  const markers = mkdtempSync(join(tmpdir(), 'rsc-markers-'));
  const root = mkdtempSync(join(tmpdir(), 'rsc-scope-'));

  // No stdin at all (older Claude Code, or a non-hook invocation): duplicated context is a cost,
  // a missing always-on layer is a behaviour change. Always choose the cost.
  assert.equal(countOf(runSessionStart(root, { RSC_HOOK_MARKER_DIR: markers }), 'detect & install'), 1);
  assert.equal(countOf(runSessionStart(root, { RSC_HOOK_MARKER_DIR: markers }), 'detect & install'), 1);
});

test('userprompt-gate: two scopes in one turn emit the gate exactly once', async () => {
  const markers = mkdtempSync(join(tmpdir(), 'rsc-markers-'));
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gate-dedup-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const gate = join(cwd, '.rsc/userprompt-gate.mjs');
  const env = { ...process.env, RSC_HOOK_MARKER_DIR: markers };
  const turn = JSON.stringify({ session_id: 'sess-3', prompt_id: 'turn-1', prompt: 'añade login' });

  const first = spawnSync('node', [gate, cwd], { encoding: 'utf8', env, input: turn });
  const second = spawnSync('node', [gate, cwd], { encoding: 'utf8', env, input: turn });

  assert.equal(countOf(first.stdout, 'new-feature gate'), 1, 'first scope emits the gate');
  assert.equal(countOf(second.stdout, 'new-feature gate'), 0, 'second scope stays silent');
});

test('userprompt-gate: the next turn emits the gate again', async () => {
  const markers = mkdtempSync(join(tmpdir(), 'rsc-markers-'));
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gate-turns-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const gate = join(cwd, '.rsc/userprompt-gate.mjs');
  const env = { ...process.env, RSC_HOOK_MARKER_DIR: markers };

  const t1 = spawnSync('node', [gate, cwd], {
    encoding: 'utf8', env, input: JSON.stringify({ session_id: 'sess-4', prompt_id: 'turn-1' }),
  });
  const t2 = spawnSync('node', [gate, cwd], {
    encoding: 'utf8', env, input: JSON.stringify({ session_id: 'sess-4', prompt_id: 'turn-2' }),
  });

  assert.equal(countOf(t1.stdout, 'new-feature gate'), 1);
  assert.equal(countOf(t2.stdout, 'new-feature gate'), 1, 'a new prompt_id is a new turn');
});

// De-dup only works when BOTH scopes run an updated hook. A scope left on an older version keeps
// printing its own copy and cannot be silenced from here — so say so, with the fix.
function wireStubScope(root, version) {
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude/settings.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `node "${root}/.rsc/session-start.mjs"` }] }] },
  }));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.version'), `${version}\n`);
}

test('session-start: warns when another wired scope is on an older version', () => {
  const home = mkdtempSync(join(tmpdir(), 'rsc-home-'));
  const project = mkdtempSync(join(tmpdir(), 'rsc-proj-'));
  wireStubScope(home, '0.1.40');
  wireStubScope(project, '0.2.0');

  const out = runSessionStart(project, { HOME: home, RSC_HOOK_MARKER_DIR: mkdtempSync(join(tmpdir(), 'm-')) },
    JSON.stringify({ session_id: 's', source: 'startup', cwd: project }));

  assert.ok(out.includes('duplicate rsc scope'), 'names the problem');
  assert.ok(out.includes('0.1.40'), 'names the lagging version');
  assert.ok(out.includes(home), 'names which scope to update');
});

test('session-start: no warning when both scopes are on the same version', () => {
  const home = mkdtempSync(join(tmpdir(), 'rsc-home-'));
  const project = mkdtempSync(join(tmpdir(), 'rsc-proj-'));
  wireStubScope(home, '0.2.0');
  wireStubScope(project, '0.2.0');

  const out = runSessionStart(project, { HOME: home, RSC_HOOK_MARKER_DIR: mkdtempSync(join(tmpdir(), 'm-')) },
    JSON.stringify({ session_id: 's', source: 'startup', cwd: project }));

  assert.ok(!out.includes('duplicate rsc scope'), 'de-dup already handles it silently');
});

test('session-start: the scope warning honors its opt-out and its cadence', () => {
  const home = mkdtempSync(join(tmpdir(), 'rsc-home-'));
  const project = mkdtempSync(join(tmpdir(), 'rsc-proj-'));
  wireStubScope(home, '0.1.40');
  wireStubScope(project, '0.2.0');
  const payload = JSON.stringify({ session_id: 's', source: 'startup', cwd: project });
  const env = () => ({ HOME: home, RSC_HOOK_MARKER_DIR: mkdtempSync(join(tmpdir(), 'm-')) });

  assert.ok(runSessionStart(project, env(), payload).includes('duplicate rsc scope'), 'first run warns');
  assert.ok(!runSessionStart(project, env(), payload).includes('duplicate rsc scope'),
    'cadence suppresses the repeat');

  writeFileSync(join(project, '.rsc/.no-scope-check'), '');
  rmSync(join(project, '.rsc/dup-scope.json'), { force: true });
  assert.ok(!runSessionStart(project, env(), payload).includes('duplicate rsc scope'),
    'opt-out silences it outright');
});

test('install creates a backup before overwriting managed hook files', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-install-backup-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude/settings.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] },
  }, null, 2));

  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const backups = listBackups({ cwd });
  assert.equal(backups[0].operation, 'install');
  assert.equal(backups[0].target, 'claude');
  assert.ok(backups[0].entries.some((e) => e.path === '.claude/settings.json' && e.existed));
});

test('uninstall creates a backup that restoreBackup can use to recover target wiring', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-uninstall-backup-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });

  await uninstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  assert.equal(existsSync(join(cwd, '.claude/skills/fastapi')), false);

  restoreBackup({ cwd, id: 'latest' });

  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')));
});

test('uninstall of a skill that is not installed is a no-op', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-uninstall-missing-'));

  const removed = await uninstall({ skillIds: ['fastapi'], target: 'claude', cwd });

  assert.deepEqual(removed, []);
  assert.deepEqual(listBackups({ cwd }), []);
  assert.equal(existsSync(join(cwd, '.claude/skills/.rsc-state.json')), false);
});

test('syncInstalled dry-run reports managed paths without mutating stale base files', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-sync-dry-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  writeFileSync(join(cwd, '.rsc/.version'), '0.0.1\n');
  writeFileSync(join(cwd, '.rsc/skills/fastapi/STALE.txt'), 'old');

  const preview = await syncInstalled({ target: 'claude', cwd, dryRun: true });

  assert.ok(preview.paths.some((p) => p.includes('.claude/skills/fastapi')));
  assert.ok(existsSync(join(cwd, '.rsc/skills/fastapi/STALE.txt')));
});

test('every wired hook script is a managed path, so a backup can restore it', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-hookpaths-'));
  // `suggest` is what plans the hook step (install-plan.js) — without it nothing is wired.
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  // wireHook() materializes these; managedPathsForInstall() must cover all of them or
  // the pre-write snapshot silently misses one and `rsc restore` cannot bring it back.
  const preview = await syncInstalled({ target: 'claude', cwd, dryRun: true });
  for (const script of [
    'session-start.mjs',
    'worklog-checkpoint.mjs',
    'ship-guard.mjs',
    'danger-guard.mjs',
    'userprompt-gate.mjs',
    'hook-once.mjs',
  ]) {
    assert.ok(existsSync(join(cwd, '.rsc', script)), `${script} is written by wireHook`);
    assert.ok(
      preview.paths.some((p) => p.endsWith(join('.rsc', script))),
      `${script} is reported as a managed path`,
    );
  }
});

test('syncInstalled refreshes installed skills and creates a sync backup', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-sync-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });
  writeFileSync(join(cwd, '.rsc/.base-versions.json'), JSON.stringify({ fastapi: '0.0.1' }) + '\n');
  writeFileSync(join(cwd, '.rsc/.version'), '0.0.1\n');
  writeFileSync(join(cwd, '.rsc/skills/fastapi/STALE.txt'), 'old');

  const result = await syncInstalled({ target: 'claude', cwd });

  assert.deepEqual(result.synced, ['fastapi']);
  assert.ok(!existsSync(join(cwd, '.rsc/skills/fastapi/STALE.txt')));
  assert.equal(listBackups({ cwd })[0].operation, 'sync');
});

test('doctor reports backup readiness and latest snapshot', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-doctor-backups-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', cwd });

  const health = doctor({ target: 'claude', cwd });

  assert.equal(health.backups.exists, true);
  assert.equal(health.backups.count, 1);
  assert.ok(health.backups.latest.includes('install-claude'));
});

test('claude: SessionStart runs session-start.mjs via node (Windows-safe), materialized', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  const cmd = settings.hooks.SessionStart[0].hooks[0].command;
  assert.ok(cmd.startsWith('node '), 'invoked via node, not bash, so it runs on Windows');
  assert.ok(cmd.includes('.rsc/session-start.mjs'), 'hook runs the node script');
  assert.ok(cmd.includes('skills/suggest'), 'passes suggest SKILL.md as arg');

  const script = join(cwd, '.rsc/session-start.mjs');
  assert.ok(existsSync(script), 'script materialized into .rsc/');
});

test('claude: wires worklog checkpoint on PreCompact + SessionEnd, materialized + idempotent', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd }); // re-install → no dupes

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  for (const event of ['PreCompact', 'SessionEnd']) {
    assert.equal(settings.hooks[event].length, 1, `exactly one ${event} entry`);
    const cmd = settings.hooks[event][0].hooks[0].command;
    assert.ok(cmd.startsWith('node '), `${event} invoked via node (Windows-safe)`);
    assert.ok(cmd.includes('.rsc/worklog-checkpoint.mjs'), `${event} runs the worklog checkpoint script`);
  }

  const script = join(cwd, '.rsc/worklog-checkpoint.mjs');
  assert.ok(existsSync(script), 'worklog-checkpoint.mjs materialized into .rsc/');
});

test('claude: re-install migrates a legacy cat-style SessionStart in place (no dupes)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude/settings.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'cat "/x/.claude/skills/rsc/suggest/SKILL.md"' }] }] },
  }, null, 2));

  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.hooks.SessionStart.length, 1, 'exactly one SessionStart entry');
  assert.ok(settings.hooks.SessionStart[0].hooks[0].command.includes('.rsc/session-start.mjs'), 'migrated to node script form');
});

test('claude: re-install migrates bash-era .sh hooks to node .mjs (no dupes)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude/settings.json'), JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'bash "/x/.rsc/session-start.sh" "/x/s" "/x"' }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'bash "/x/.rsc/worklog-checkpoint.sh" "/x"' }] }],
      SessionEnd: [{ hooks: [{ type: 'command', command: 'bash "/x/.rsc/worklog-checkpoint.sh" "/x"' }] }],
    },
  }, null, 2));

  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.hooks.SessionStart.length, 1, 'no dupe SessionStart');
  assert.ok(settings.hooks.SessionStart[0].hooks[0].command.includes('session-start.mjs'), 'SessionStart migrated to node');
  assert.ok(!JSON.stringify(settings.hooks).includes('session-start.sh'), 'old bash session-start entry gone');
  assert.equal(settings.hooks.PreCompact.length, 1, 'no dupe PreCompact');
  assert.ok(settings.hooks.PreCompact[0].hooks[0].command.includes('worklog-checkpoint.mjs'), 'worklog migrated to node');
  assert.ok(!JSON.stringify(settings.hooks).includes('worklog-checkpoint.sh'), 'old bash worklog entries gone');
});

test('claude: a user SessionStart hook is preserved through wiring', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude/settings.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] },
  }, null, 2));

  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  const cmds = settings.hooks.SessionStart.map((e) => e.hooks[0].command);
  assert.ok(cmds.some((c) => c === 'echo mine'), 'user hook untouched');
  assert.ok(cmds.some((c) => c.includes('.rsc/session-start.mjs')), 'rsc hook added');
});

test('codex: appends always-on block to AGENTS.md and links the base', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest', 'go'], target: 'codex', cwd });
  const agents = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('rsc-suggest:start'));
  assert.ok(existsSync(join(cwd, '.codex/rsc/go/SKILL.md')));
  assert.ok(existsSync(join(cwd, '.rsc/skills/go/SKILL.md')));
});

test('antigravity: links base and wires suggest into .antigravity/AGENTS.md', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest', 'go'], target: 'antigravity', cwd });
  assert.ok(existsSync(join(cwd, '.antigravity/rsc/go/SKILL.md')));
  assert.ok(readFileSync(join(cwd, '.antigravity/AGENTS.md'), 'utf8').includes('rsc-suggest:start'));
});

test('two assistants share a single base copy (no duplication)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest', 'go'], target: 'claude', cwd });
  const before = statSync(join(cwd, '.rsc/skills/go/SKILL.md')).ino;
  await applyInstall({ skillIds: ['suggest', 'go'], target: 'codex', cwd });
  const after = statSync(join(cwd, '.rsc/skills/go/SKILL.md')).ino;
  assert.equal(before, after, 'base file reused, not recreated, across assistants');
  assert.ok(existsSync(join(cwd, '.claude/skills/go/SKILL.md')));
  assert.ok(existsSync(join(cwd, '.codex/rsc/go/SKILL.md')));
});

test('copilot: links base under .github/rsc and wires copilot-instructions.md', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest', 'go'], target: 'copilot', cwd });
  assert.ok(existsSync(join(cwd, '.github/rsc/go/SKILL.md')));
  assert.ok(readFileSync(join(cwd, '.github/copilot-instructions.md'), 'utf8').includes('rsc-suggest:start'));
});

test('windsurf: links base and wires an always-on rule file', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest', 'go'], target: 'windsurf', cwd });
  assert.ok(existsSync(join(cwd, '.windsurf/rsc/go/SKILL.md')));
  assert.ok(readFileSync(join(cwd, '.windsurf/rules/rsc-suggest.md'), 'utf8').includes('rsc-suggest:start'));
});

// Every AGENTS.md-family assistant injects the same idempotent block into the
// one shared AGENTS.md — selecting several must not duplicate it.
test('AGENTS.md family (codex/zed/opencode/amp/jules) shares one idempotent block', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  for (const target of ['codex', 'zed', 'opencode', 'amp', 'jules']) {
    await applyInstall({ skillIds: ['suggest', 'go'], target, cwd });
    assert.ok(existsSync(join(cwd, `.${target}/rsc/go/SKILL.md`)));
  }
  const agents = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.equal(agents.match(/rsc-suggest:start/g).length, 1, 'block appears exactly once');
});

test('cross-target: onboarding gate text rides suggest into a non-claude target', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest'], target: 'codex', cwd });
  const agents = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('Onboarding gate'), 'gate section injected cross-target');
  assert.ok(agents.includes('.no-harness'), 'opt-out marker documented in the injected block');
  assert.ok(agents.includes('Mid-task capability intent'), 'capability-intent detector injected cross-target');
  assert.ok(agents.includes('quiero montar una pagina web'), 'plain-language startup trigger documented in the injected block');
  assert.ok(agents.includes('automatiza este flujo'), 'technology/automation trigger documented in the injected block');
  assert.ok(agents.includes('write a cold email sequence'), 'creation/marketing trigger documented in the injected block');
});

test('unknown target throws', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await assert.rejects(() => applyInstall({ skillIds: ['suggest'], target: 'nope', cwd }), /unknown target/);
});

// ---- ship guard (PreToolUse) -------------------------------------------------

test('claude: wires ship-guard on PreToolUse(Bash), materialized + idempotent', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd }); // re-install → no dupes

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  const guards = settings.hooks.PreToolUse.filter((e) => JSON.stringify(e).includes('ship-guard'));
  assert.equal(guards.length, 1, 'exactly one ship-guard PreToolUse entry');
  assert.equal(guards[0].matcher, 'Bash', 'matches Bash tool calls');
  const cmd = guards[0].hooks[0].command;
  assert.ok(cmd.startsWith('node '), 'invoked via node (Windows-safe)');
  assert.ok(cmd.includes('.rsc/ship-guard.mjs'), 'runs the ship-guard script');
  assert.ok(existsSync(join(cwd, '.rsc/ship-guard.mjs')), 'ship-guard.mjs materialized into .rsc/');
});

// ---- session-start: git-required banner --------------------------------------

test('session-start: git-required banner when no .git and no opt-out', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  assert.ok(runSessionStart(root).includes('rsc git required'), 'nudges git init');
});

test('session-start: no git banner once the project is under git', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  assert.ok(!runSessionStart(root).includes('rsc git required'));
});

test('session-start: .rsc/.no-git silences the git banner', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.no-git'), '');
  assert.ok(!runSessionStart(root).includes('rsc git required'));
});

// ---- session-start: context7 MCP banner (active rsc projects only) -----------

function withProfile(root) {
  mkdirSync(join(root, '02-DOCS/wiki/harness'), { recursive: true });
  writeFileSync(join(root, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: technical\n');
}

test('session-start: context7 banner when a profile exists and no MCP is wired', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  assert.ok(runSessionStart(root).includes('rsc context7 MCP'));
});

test('session-start: no context7 banner before there is a profile', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  assert.ok(!runSessionStart(root).includes('rsc context7 MCP'), 'gated on an active rsc project');
});

test('session-start: no context7 banner once .mcp.json wires context7', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  writeFileSync(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { context7: { url: 'x' } } }));
  assert.ok(!runSessionStart(root).includes('rsc context7 MCP'));
});

test('session-start: .rsc/.no-context7 silences the context7 banner', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.no-context7'), '');
  assert.ok(!runSessionStart(root).includes('rsc context7 MCP'));
});

// ---- session-start: periodic skill-audit nudge -------------------------------

test('session-start: skill-audit nudge when a profile exists and no audit has run', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  assert.ok(runSessionStart(root).includes('rsc skill audit'));
});

test('session-start: a fresh audit stamp silences the skill-audit nudge', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/audit.json'), JSON.stringify({ lastRun: new Date().toISOString() }));
  assert.ok(!runSessionStart(root).includes('rsc skill audit'));
});

test('session-start: a stale audit stamp re-fires the nudge', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  mkdirSync(join(root, '.rsc'), { recursive: true });
  const old = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 days ago > 14-day cadence
  writeFileSync(join(root, '.rsc/audit.json'), JSON.stringify({ lastRun: old }));
  assert.ok(runSessionStart(root).includes('rsc skill audit'));
});

test('session-start: .rsc/.no-audit silences the skill-audit nudge', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ss-'));
  withProfile(root);
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.no-audit'), '');
  assert.ok(!runSessionStart(root).includes('rsc skill audit'));
});

// ---- danger guard (PreToolUse, non-technical users) --------------------------

const DANGER_GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'targets', 'danger-guard.mjs');

// Run danger-guard with a Bash command and return true if it DENIED.
function denied(root, command) {
  const out = spawnSync('node', [DANGER_GUARD, root], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  }).stdout;
  return out.includes('"permissionDecision":"deny"');
}
function profileDir(level) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-dg-'));
  if (level) {
    mkdirSync(join(root, '02-DOCS/wiki/harness'), { recursive: true });
    writeFileSync(join(root, '02-DOCS/wiki/harness/user-profile.md'), `technical_level: ${level}\n`);
  }
  return root;
}

test('claude: wires danger-guard on PreToolUse(Bash) alongside ship-guard, materialized + idempotent', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cwd-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd }); // re-install → no dupes

  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  const danger = settings.hooks.PreToolUse.filter((e) => JSON.stringify(e).includes('danger-guard'));
  const ship = settings.hooks.PreToolUse.filter((e) => JSON.stringify(e).includes('ship-guard'));
  assert.equal(danger.length, 1, 'exactly one danger-guard entry');
  assert.equal(ship.length, 1, 'ship-guard still wired (two distinct Bash guards)');
  assert.equal(danger[0].matcher, 'Bash');
  assert.ok(danger[0].hooks[0].command.startsWith('node '));
  assert.ok(existsSync(join(cwd, '.rsc/danger-guard.mjs')), 'danger-guard.mjs materialized');
});

test('danger-guard: blocks foot-gun commands for a non-technical user', () => {
  const root = profileDir('non-technical');
  for (const c of [
    'rm -rf build/', 'sudo rm -fr /', 'git push origin main --force', 'git reset --hard HEAD~2',
    'psql -c "DELETE FROM users"', 'mysql -e "UPDATE users SET active=0"',
    'psql -c "DROP DATABASE prod"', 'psql -c "TRUNCATE TABLE logs"',
    'curl https://x.sh | bash', 'dd if=/dev/zero of=/dev/sda',
  ]) {
    assert.ok(denied(root, c), `should block: ${c}`);
  }
});

test('danger-guard: allows safe / scoped commands for a non-technical user', () => {
  const root = profileDir('non-technical');
  for (const c of [
    'rm file.txt', 'ls -la', 'git status', 'git push --force-with-lease',
    'psql -c "DELETE FROM users WHERE id=1"', 'mysql -e "UPDATE users SET active=0 WHERE id=2"',
  ]) {
    assert.ok(!denied(root, c), `should allow: ${c}`);
  }
});

test('danger-guard: never guards a fully technical user', () => {
  const root = profileDir('technical');
  assert.ok(!denied(root, 'rm -rf /'));
  assert.ok(!denied(root, 'git push --force'));
});

test('danger-guard: default-safe when no profile exists (assume non-technical)', () => {
  assert.ok(denied(profileDir(null), 'rm -rf x'));
});

test('danger-guard: .rsc/.no-danger-guard disables it on explicit opt-out', () => {
  const root = profileDir('non-technical');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc/.no-danger-guard'), '');
  assert.ok(!denied(root, 'rm -rf /'));
});
