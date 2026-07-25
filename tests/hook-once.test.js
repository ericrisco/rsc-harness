import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync, readdirSync, utimesSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep, resolve, dirname } from 'node:path';
import { claimOnce, readHookInput, markerDir } from '../targets/hook-once.mjs';

const freshDir = () => mkdtempSync(join(tmpdir(), 'rsc-once-'));

test('claimOnce: the first caller wins and the second is silenced', () => {
  const dir = freshDir();
  assert.equal(claimOnce('ss:abc:startup', { dir }), true, 'first caller prints');
  assert.equal(claimOnce('ss:abc:startup', { dir }), false, 'second caller stays silent');
});

test('claimOnce: distinct keys never collide', () => {
  const dir = freshDir();
  assert.equal(claimOnce('ss:abc:startup', { dir }), true);
  assert.equal(claimOnce('ss:abc:compact', { dir }), true, 'a later compact is a new event');
  assert.equal(claimOnce('ss:other:startup', { dir }), true, 'another session is independent');
});

test('claimOnce: a marker older than the window is a new event, not a duplicate', () => {
  const dir = freshDir();
  assert.equal(claimOnce('ss:abc:compact', { dir, windowMs: 30_000 }), true);
  assert.equal(claimOnce('ss:abc:compact', { dir, windowMs: 30_000 }), false);
  // Two real compactions are minutes apart: the same key must win again.
  const later = Date.now() + 120_000;
  assert.equal(claimOnce('ss:abc:compact', { dir, windowMs: 30_000, now: later }), true);
});

test('claimOnce: keys with path separators cannot escape the marker directory', () => {
  const dir = freshDir();
  assert.equal(claimOnce('../../escape', { dir }), true);
  const written = readdirSync(dir);
  assert.equal(written.length, 1, 'exactly one marker written');
  // The invariant is containment, not the absence of dots: a flattened name cannot traverse.
  assert.ok(!written[0].includes(sep), `no path separator: ${written[0]}`);
  assert.equal(dirname(resolve(dir, written[0])), resolve(dir), 'marker stays inside the dir');
});

test('claimOnce: fails open — an unusable marker directory still lets the hook print', () => {
  const dir = join(freshDir(), 'nested');
  writeFileSync(dir, 'not a directory');
  assert.equal(claimOnce('ss:abc:startup', { dir }), true, 'never swallow the always-on layer');
});

test('claimOnce: prunes markers older than a day', () => {
  const dir = freshDir();
  claimOnce('ss:old:startup', { dir });
  const [stale] = readdirSync(dir);
  const ancient = new Date(Date.now() - 48 * 3600 * 1000);
  utimesSync(join(dir, stale), ancient, ancient);

  claimOnce('ss:new:startup', { dir });

  assert.equal(existsSync(join(dir, stale)), false, 'day-old marker pruned');
  assert.equal(readdirSync(dir).length, 1, 'only the fresh marker remains');
});

test('markerDir: shared across scopes, private to the user', () => {
  const d = markerDir();
  assert.ok(d.startsWith(tmpdir()), 'lives outside any project root so both scopes see it');
  chmodSync(d, 0o700); // must exist and be ours
});

test('readHookInput: tolerates absent, empty and malformed stdin', () => {
  // No stdin available in this process context → must degrade to {}, never throw.
  assert.deepEqual(readHookInput('') , {});
  assert.deepEqual(readHookInput('not json'), {});
  assert.deepEqual(readHookInput('{"session_id":"abc","source":"startup"}'), {
    session_id: 'abc',
    source: 'startup',
  });
});
