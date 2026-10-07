import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expand, innerScripts, segments, withoutHeredocs } from '../targets/shell-unwrap.mjs';

// E2E defect 15 (2026-10-07): the guards read the command the agent TYPED, not the one the shell
// RUNS. `bash -c "git commit -m x"` hid the commit inside a quoted string, so branch-guard (rule A),
// gitmoji-guard and the sello all let it through. One shared unwrapper, so every guard sees the same.

test('su01 · a shell -c string, eval and leading wrappers are unwrapped to what really runs', () => {
  assert.deepEqual(expand('bash -c "git commit -m x"'), ['git commit -m x']);
  assert.deepEqual(expand("sh -c 'git commit -m x'"), ['git commit -m x']);
  assert.deepEqual(expand('zsh -lc "cd a && git commit -m x"'), ['cd a', 'git commit -m x']);
  assert.deepEqual(expand('/bin/bash -e -c "git push"'), ['git push']);
  assert.deepEqual(expand('eval "git commit -m x"'), ['git commit -m x']);
  assert.deepEqual(expand('eval git commit -m x'), ['git commit -m x']);
  assert.deepEqual(expand('FOO=1 BAR="a b" git commit -m x'), ['git commit -m x']);
  assert.deepEqual(expand('env -u X FOO=1 git commit'), ['git commit']);
  assert.deepEqual(expand('command git commit'), ['git commit']);
  assert.deepEqual(expand('exec git commit'), ['git commit']);
  assert.deepEqual(expand('sudo -u me git commit'), ['git commit']);
  assert.deepEqual(expand('nohup nice -n 5 git commit'), ['git commit']);
});

test('su02 · nested wrappers are followed, quotes respected, depth bounded', () => {
  assert.deepEqual(expand(`bash -c "sh -c 'git commit -m \\"a; b\\"'"`), ['git commit -m "a; b"']);
  assert.deepEqual(expand(`env A=1 bash -c 'eval "git merge x"'`), ['git merge x']);
  assert.deepEqual(expand('ls && bash -c "git commit -m x" ; echo done'), ['ls', 'git commit -m x', 'echo done']);
  // A pathological self-nesting never loops.
  let deep = 'git commit';
  for (let i = 0; i < 20; i++) deep = `eval ${JSON.stringify(deep)}`;
  assert.ok(Array.isArray(expand(deep)));
});

test('su03 · text that merely mentions a command is not unwrapped into one', () => {
  assert.deepEqual(expand(`echo "bash -c 'git commit'"`), [`echo "bash -c 'git commit'"`]);
  assert.deepEqual(expand(`git commit -m "run bash -c 'git commit' later"`), [`git commit -m "run bash -c 'git commit' later"`]);
  assert.deepEqual(expand('bash script.sh'), ['bash script.sh'], 'a shell running a file is left as is');
  assert.deepEqual(expand('command -v git'), ['command -v git'], 'a lookup is not an execution');
});

test('su04 · innerScripts lists only the strings a wrapper hands to a shell', () => {
  assert.deepEqual(innerScripts('bash -c "git commit -m \'feat: x\'"'), ["git commit -m 'feat: x'"]);
  assert.deepEqual(innerScripts('git commit -m "bash -c x"'), []);
});

test('su05 · the quote-aware split and the heredoc strip are the shared ones', () => {
  assert.deepEqual(segments('a "b;c" && d'), ['a "b;c" ', ' d']);
  assert.equal(withoutHeredocs('cat > n <<EOF\ngit commit\nEOF').includes('git commit'), false);
});
