import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SKILL_FLOOR, withDefaultSkillFloor } from '../scripts/lib/default-skill-floor.js';

test('the default floor equips bro without making it runtime always-on', () => {
  assert.deepEqual(DEFAULT_SKILL_FLOOR, ['orient', 'suggest', 'bro']);
});

test('the default floor is stable, ordered and deduplicated for every install path', () => {
  assert.deepEqual(
    withDefaultSkillFloor(['bro', 'fastapi', 'orient', 'postgresdb']),
    ['orient', 'suggest', 'bro', 'fastapi', 'postgresdb'],
  );
});
