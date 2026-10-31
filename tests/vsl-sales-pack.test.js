import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hasOutcome } from '../scripts/lib/recommend.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const additions = ['customer-research', 'offer-design', 'sales-funnel', 'vsl-script'];
const pack = [...additions, 'landing-copy', 'design', 'analytics', 'ab-testing'];

test('VSL pack installs through existing multi-add and stays discoverable after refresh', () => {
  const project = mkdtempSync(join(tmpdir(), 'rsc-vsl-pack-'));
  try {
    writeFileSync(join(project, '.rsc.json'), JSON.stringify({
      version: 1, targets: ['codex'], skills: ['orient'], agents: [], ownSkills: [], optOuts: [],
    }));
    mkdirSync(join(project, '.codex', 'rsc'), { recursive: true });
    writeFileSync(join(project, '.codex', 'rsc', '.rsc-state.json'), JSON.stringify({
      skills: { orient: { files: [] } }, agents: [],
    }));
    const run = (...args) => spawnSync(process.execPath, [join(root, 'scripts/rsc.js'), ...args], {
      cwd: project, encoding: 'utf8', timeout: 60000,
    });
    const installed = run('add', ...pack, '--target', 'codex');
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    const config = JSON.parse(readFileSync(join(project, '.rsc.json'), 'utf8'));
    for (const id of pack) {
      assert.ok(config.skills.includes(id), `missing selected skill ${id}`);
      assert.match(readFileSync(join(project, '.rsc', 'skills', id, 'SKILL.md'), 'utf8'), new RegExp(`name: ${id}\\b`));
    }
    assert.ok(!config.skills.includes('stripe'), 'recommendations must not silently install payments');
    const refreshed = run('registry', 'refresh');
    assert.equal(refreshed.status, 0, refreshed.stdout + refreshed.stderr);
    const catalog = run('catalog');
    assert.equal(catalog.status, 0, catalog.stderr);
    for (const id of additions) {
      assert.match(catalog.stdout, new RegExp(`^${id}\\tinstalled\\t`, 'm'));
      assert.ok(hasOutcome(id), `${id} needs a readable picker outcome`);
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
