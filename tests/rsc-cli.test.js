import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('rsc registry refresh/status CLI writes project registry', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-'));
  const refresh = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'registry', 'refresh', '--target', 'codex'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(refresh.status, 0, refresh.stderr);
  assert.ok(refresh.stdout.includes('Registry updated'));
  assert.ok(existsSync(join(cwd, '.rsc', 'skill-registry.json')));
  assert.ok(existsSync(join(cwd, '.rsc', 'skill-registry.md')));

  const status = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'registry', 'status'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(status.status, 0, status.stderr);
  assert.ok(status.stdout.includes('"exists": true'));
});

test('rsc consult prioritizes explicit query over repo hints', () => {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'consult', 'ejecutar Python en GPU serverless'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.split('\n')[0].startsWith('modal\t'), result.stdout);
});

test('rsc consult recommends bootstrap and web skills for a new website intent', () => {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'consult', 'quiero montar una pagina web para vender cursos online'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const ids = result.stdout.trim().split('\n').map((line) => line.split('\t')[0]);
  assert.equal(ids[0], 'init', result.stdout);
  assert.ok(ids.includes('init'), result.stdout);
  assert.ok(ids.includes('harness'), result.stdout);
  assert.ok(ids.includes('nextjs'), result.stdout);
  assert.ok(!ids.includes('angular'), result.stdout);
  assert.ok(!ids.includes('solid-js'), result.stdout);
  assert.ok(!ids.includes('svelte'), result.stdout);
  assert.ok(!ids.includes('sdd-init'), result.stdout);
});


test('rsc catalog dumps the full catalog with install state and descriptions', () => {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'catalog'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.ok(lines.length >= 200, `expected the full catalog, got ${lines.length} lines`);
  assert.ok(lines.every((l) => /^\S+\t(installed|available)\t.+/.test(l)), 'each line is id<TAB>state<TAB>description');
  const nextjs = lines.find((l) => l.startsWith('nextjs\t'));
  assert.ok(nextjs && /next\.js/i.test(nextjs), `nextjs row carries its description: ${nextjs}`);
});

test('rsc catalog --available hides skills already installed', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-catalog-'));
  const install = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'fastapi', '--target', 'claude'], { cwd, encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr);
  const all = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'catalog', '--target', 'claude'], { cwd, encoding: 'utf8' });
  const avail = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'catalog', '--available', '--target', 'claude'], { cwd, encoding: 'utf8' });
  assert.ok(all.stdout.includes('fastapi\tinstalled\t'), 'full catalog marks fastapi installed');
  assert.ok(!avail.stdout.split('\n').some((l) => l.startsWith('fastapi\t')), '--available drops the installed fastapi');
});

test('rsc backups lists project-local snapshots', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-backups-'));
  const install = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'fastapi', '--target', 'claude'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(install.status, 0, install.stderr);

  const listed = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'backups'], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(listed.status, 0, listed.stderr);
  assert.ok(listed.stdout.includes('install'));
  assert.ok(listed.stdout.includes('claude'));
});

test('rsc restore latest --dry-run reports planned restore paths without mutating', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-restore-'));
  const install = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'fastapi', '--target', 'claude'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(install.status, 0, install.stderr);

  const preview = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'restore', 'latest', '--dry-run'], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(preview.status, 0, preview.stderr);
  assert.ok(preview.stdout.includes('Would restore'));
  assert.ok(existsSync(join(cwd, '.claude/skills/fastapi/SKILL.md')));
});

test('rsc sync --dry-run reports installed skills', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-sync-'));
  const install = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'fastapi', '--target', 'claude'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(install.status, 0, install.stderr);

  const sync = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'sync', '--target', 'claude', '--dry-run'], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(sync.status, 0, sync.stderr);
  assert.ok(sync.stdout.includes('Would sync claude'));
  assert.ok(sync.stdout.includes('fastapi'));
});

test('rsc install prints the agent handoff (reload → equipped → ready, no auto-task)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-handoff-'));
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'install', '--profile', 'minimal', '--target', 'claude'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const out = result.stdout;
  assert.ok(out.includes('AGENT HANDOFF'), `handoff banner present:\n${out}`);
  assert.ok(/reload|restart/i.test(out), 'tells the agent to reload/restart');
  assert.ok(out.includes('orient + suggest'), 'names the always-on floor as equipped');
  assert.ok(out.includes('bro is installed'), 'names the default human-language skill as equipped');
  assert.ok(existsSync(join(cwd, '.claude/skills/bro/SKILL.md')), 'minimal profile installs bro');
  assert.ok(/do not auto-start/i.test(out), 'forbids auto-starting a task');
});

test('rsc add nudges to reload so the new skill activates', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-add-reload-'));
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'fastapi', '--target', 'claude'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(/reload|restart/i.test(result.stdout), `add reminds to reload:\n${result.stdout}`);
  assert.ok(existsSync(join(cwd, '.claude/skills/bro/SKILL.md')), 'direct add also keeps bro in the default floor');
});

test('rsc add/uninstall accepts an agent id as a first-class unit', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-agent-'));
  const add = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'go-reviewer', '--target', 'claude'], {
    cwd, encoding: 'utf8',
  });
  assert.equal(add.status, 0, add.stderr);
  assert.ok(existsSync(join(cwd, '.claude/agents/go-reviewer.md')));
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.deepEqual(manifest.agents, ['go-reviewer']);

  const remove = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'uninstall', 'go-reviewer', '--target', 'claude'], {
    cwd, encoding: 'utf8',
  });
  assert.equal(remove.status, 0, remove.stderr);
  assert.ok(!existsSync(join(cwd, '.claude/agents/go-reviewer.md')));
});

test('rsc add suggests close agent ids instead of exposing a raw skill error', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-agent-typo-'));
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'add', 'go-reviwer', '--target', 'claude'], {
    cwd, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /go-reviewer/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /ENOENT|no such file/i);
});

test('rsc upgrade --dry-run prints npm upgrade command', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cli-upgrade-'));
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/rsc.js'), 'upgrade', '--target', 'claude', '--dry-run'], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('npm install -g @ericrisco/rsc@latest'));
  assert.ok(result.stdout.includes('rsc sync --target claude'));
});
