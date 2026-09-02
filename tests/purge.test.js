import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall, purge } from '../scripts/install-apply.js';
import { agentPath } from '../targets/agents.js';
import { commandPath } from '../targets/commands.js';

test('purge removes installed skills, unwires rsc hooks, and deletes .rsc/', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  await applyInstall({ skillIds: ['suggest', 'fastapi'], target: 'claude', cwd });
  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')), 'precondition: skill installed');
  assert.ok(existsSync(join(cwd, '.rsc/skills/fastapi/SKILL.md')), 'precondition: base present');
  assert.ok(JSON.stringify(JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8')).hooks).includes('.rsc/'),
    'precondition: rsc hooks wired');
  assert.ok(readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8').includes('session-memory-adapter'),
    'precondition: local memory hooks wired');

  await purge({ cwd });

  assert.ok(!existsSync(join(cwd, '.claude/skills/fastapi')), 'installed skill removed');
  assert.ok(!existsSync(join(cwd, '.rsc')), '.rsc/ removed (base + hook scripts + version)');
  const after = existsSync(join(cwd, '.claude/settings.json'))
    ? JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'))
    : {};
  assert.ok(!JSON.stringify(after.hooks || {}).includes('.rsc/'), 'all rsc hooks unwired');
  const local = existsSync(join(cwd, '.claude/settings.local.json'))
    ? readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8')
    : '';
  assert.ok(!local.includes('session-memory-adapter'), 'local memory hooks unwired');
});

test('purge preserves the user own settings and non-rsc hooks', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude/settings.json'), JSON.stringify({
    model: 'opus',
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] },
  }, null, 2));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  await purge({ cwd });

  const s = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.equal(s.model, 'opus', 'unrelated user settings preserved');
  const cmds = (s.hooks?.SessionStart || []).map((e) => e.hooks[0].command);
  assert.ok(cmds.includes('echo mine'), 'user hook preserved');
  assert.ok(!JSON.stringify(s.hooks || {}).includes('.rsc/'), 'rsc hooks removed');
});

test('purge leaves colliding user-owned local memory files byte-identical', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  mkdirSync(join(cwd, '.cursor/rules'), { recursive: true });
  const localPath = join(cwd, '.claude/settings.local.json');
  const rulePath = join(cwd, '.cursor/rules/rsc-memory.mdc');
  const local = `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: 'echo mine' }] }] } }, null, 2)}\n`;
  const rule = '---\nalwaysApply: true\n---\nMy own rule.\n';
  writeFileSync(localPath, local);
  writeFileSync(rulePath, rule);

  await purge({ cwd });

  assert.equal(readFileSync(localPath, 'utf8'), local);
  assert.equal(readFileSync(rulePath, 'utf8'), rule);
});

test('install and purge preserve user-owned files whose names collide with catalog entries', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  const agent = agentPath('cursor', cwd, 'go-reviewer');
  const command = commandPath('cursor', cwd, 'go-review');
  mkdirSync(join(cwd, '.cursor', 'agents'), { recursive: true });
  mkdirSync(join(cwd, '.cursor', 'commands'), { recursive: true });
  writeFileSync(agent, 'my reviewer\n');
  writeFileSync(command, 'my command\n');

  await applyInstall({ skillIds: ['go'], target: 'cursor', home: cwd, cwd });
  assert.equal(readFileSync(agent, 'utf8'), 'my reviewer\n');
  assert.equal(readFileSync(command, 'utf8'), 'my command\n');

  await purge({ home: cwd, cwd });
  assert.equal(readFileSync(agent, 'utf8'), 'my reviewer\n');
  assert.equal(readFileSync(command, 'utf8'), 'my command\n');
});

test('purge strips the rsc block from AGENTS.md but keeps the rest (codex)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  writeFileSync(join(cwd, 'AGENTS.md'), '# My project\n\nMy own notes.\n');
  await applyInstall({ skillIds: ['suggest'], target: 'codex', cwd });
  assert.ok(readFileSync(join(cwd, 'AGENTS.md'), 'utf8').includes('rsc-suggest:start'), 'precondition: block added');

  await purge({ cwd });

  const doc = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.ok(!doc.includes('rsc-suggest'), 'rsc block stripped from AGENTS.md');
  assert.ok(doc.includes('My own notes.'), 'user content kept');
});

test('purge keeps 02-DOCS by default, removes it with withDocs', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  mkdirSync(join(cwd, '02-DOCS/wiki'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS/wiki/note.md'), 'keep me');

  await purge({ cwd });
  assert.ok(existsSync(join(cwd, '02-DOCS/wiki/note.md')), '02-DOCS preserved by default');

  await purge({ cwd, withDocs: true });
  assert.ok(!existsSync(join(cwd, '02-DOCS')), '02-DOCS removed with withDocs');
});

test('purge --dry-run reports without deleting', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const planned = await purge({ cwd, dryRun: true });
  assert.ok(planned.length > 0, 'reports paths it would remove');
  assert.ok(existsSync(join(cwd, '.rsc')), '.rsc/ still present after dry run');
  assert.ok(existsSync(join(cwd, '.claude/skills/suggest/SKILL.md')), 'skill still present after dry run');
});
