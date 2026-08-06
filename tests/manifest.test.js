import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest } from '../scripts/build-manifest.js';
import { skillsForProfile } from '../scripts/lib/manifest.js';

test('manifest lists all skills with required fields', () => {
  const m = buildManifest();
  assert.ok(m.skills.length >= 29);
  const fastapi = m.skills.find((s) => s.id === 'fastapi');
  assert.ok(fastapi.tags.includes('python'));
  assert.equal(m.counts.skills, m.skills.length);
});

test('every recommends id references a real skill', () => {
  const m = buildManifest();
  const ids = new Set(m.skills.map((s) => s.id));
  for (const s of m.skills) {
    for (const r of s.recommends || []) {
      assert.ok(ids.has(r), `${s.id} recommends unknown ${r}`);
    }
  }
});

test('bro is present in every default profile', () => {
  const m = buildManifest();
  for (const profile of ['minimal', 'core', 'full']) {
    assert.ok(skillsForProfile(m, profile).includes('bro'), `${profile} profile must install bro`);
  }
});
