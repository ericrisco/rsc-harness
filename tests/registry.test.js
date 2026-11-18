import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join } from 'node:path';
import { refreshRegistry, registryStatus } from '../scripts/lib/registry.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-registry-')); }

function skill(root, id) {
  mkdirSync(join(root, 'skills', id), { recursive: true });
  writeFileSync(join(root, 'skills', id, 'SKILL.md'), `---\nname: ${id}\ndescription: "Use when ${id} is needed"\ntags: [test]\n---\n# ${id}\n`);
}

test('registry refresh writes deterministic json and markdown for project skills', () => {
  const project = tmp();
  const catalog = tmp();
  skill(catalog, 'fastapi');
  skill(catalog, 'sdd-init');
  mkdirSync(join(project, '.codex', 'rsc'), { recursive: true });
  writeFileSync(join(project, '.codex', 'rsc', '.rsc-state.json'), JSON.stringify({
    skills: { fastapi: { files: [] } }
  }));
  const manifest = {
    version: '0.1.0',
    skills: [
      { id: 'sdd-init', description: 'Use when calibrating SDD', tags: ['sdd'] },
      { id: 'fastapi', description: 'Use when building APIs', tags: ['python'] }
    ]
  };

  const first = refreshRegistry({ cwd: project, target: 'codex', manifest, catalogRoot: catalog });
  const second = refreshRegistry({ cwd: project, target: 'codex', manifest, catalogRoot: catalog });

  assert.deepEqual(second, first);
  assert.equal(first.counts.skills, 2);
  assert.deepEqual(first.skills.map((s) => s.id), ['fastapi', 'sdd-init']);
  assert.equal(first.skills[0].installed, true);
  assert.equal(first.skills[1].installed, false);
  assert.equal(first.skills[0].available, true);
  assert.match(first.skills[0].hash, /^[a-f0-9]{12}$/);
  assert.ok(existsSync(join(project, '.rsc', 'skill-registry.json')));
  assert.ok(readFileSync(join(project, '.rsc', 'skill-registry.md'), 'utf8').includes('| fastapi |'));
});

test('registry status reports missing and stale registries', () => {
  const project = tmp();
  const missing = registryStatus({ cwd: project });
  assert.equal(missing.exists, false);

  mkdirSync(join(project, '.rsc'), { recursive: true });
  writeFileSync(join(project, '.rsc', 'skill-registry.json'), JSON.stringify({ version: 1, skills: [] }));

  const present = registryStatus({ cwd: project });
  assert.equal(present.exists, true);
  assert.equal(present.counts.skills, 0);
});
