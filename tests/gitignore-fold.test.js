import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { ignoreLocalState, foldIgnoreBlocks } from '../scripts/install-apply.js';

// Every append opened a new block with its own header: a project synced across versions carried
// 13 copies of "# rsc local state …" (executive-proyectos, 2026-10-09). Adjacent rsc blocks are one.
const H = '# rsc local state (hooks, seals, logs) and managed skill links — machine-local';
const headers = (t) => t.split('\n').filter((l) => l === H).length;
const entries = (t) => t.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
const repo = () => { const d = mkdtempSync(join(tmpdir(), 'gi-')); execFileSync('git', ['init', '-q'], { cwd: d }); return d; };

test('adjacent rsc blocks fold into one, every entry kept in order', () => {
  const t = `node_modules/\n\n${H}\n.rsc/\n\n${H}\n.claude/skills/ftd\n\n${H}\n.worktrees/\n`;
  const f = foldIgnoreBlocks(t);
  assert.equal(headers(f), 1);
  assert.deepEqual(entries(f), entries(t));
  assert.equal(foldIgnoreBlocks(f), f, 'idempotent');
});

test('a block of the user between two of ours is never absorbed or moved', () => {
  const t = `${H}\n.rsc/\n\n# mine\nsecret.txt\n\n${H}\n.worktrees/\n`;
  assert.equal(foldIgnoreBlocks(t), t, 'nothing to fold: their block separates ours');
});

test('a new entry joins the rsc block that ends the file instead of opening another', () => {
  const d = repo();
  writeFileSync(join(d, '.gitignore'), `node_modules/\n\n${H}\n.rsc/\n`);
  ignoreLocalState(d);
  const t = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.equal(headers(t), 1);
  assert.match(t, /\.rsc\/\n\.worktrees\/\n$/);
});

test('an existing file full of repeated headers is cleaned even when nothing new is added', () => {
  const d = repo();
  const dirty = `${H}\n.rsc/\n\n${H}\n.worktrees/\n`;
  writeFileSync(join(d, '.gitignore'), dirty);
  ignoreLocalState(d);
  const t = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.equal(headers(t), 1);
  assert.deepEqual(entries(t), ['.rsc/', '.worktrees/']);
  assert.equal(ignoreLocalState(d), null, 'clean and complete: nothing written');
});

test('a fresh repo still gets exactly one block', () => {
  const d = repo();
  ignoreLocalState(d);
  const t = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.equal(t, `${H}\n.rsc/\n.worktrees/\n`);
});
