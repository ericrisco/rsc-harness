import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleLifecycle } from '../targets/session-memory-adapter.mjs';

// `editCount` used to add one per Edit/Write tool event and nothing else. Whatever was edited through
// the shell — a heredoc, `sed -i`, a script, a formatter — did not exist for it. The session that
// found this had touched dozens of files and its record said editCount=1, so the compaction hint
// never reached the people who most need it: long sessions with a lot of change.

function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cnt-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [] }));
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], { cwd });
  return cwd;
}
const fire = (cwd, id, event) => handleLifecycle({ target: 'claude', event, native: { session_id: id, cwd }, cwd });
function count(cwd) {
  const dir = join(cwd, '.rsc', 'memory', 'sessions');
  const f = readdirSync(dir).find((n) => n.endsWith('.json'));
  return JSON.parse(readFileSync(join(dir, f), 'utf8')).editCount;
}

test('files changed through the shell are counted', () => {
  const cwd = project();
  fire(cwd, 'B1', 'start');
  for (const name of ['a.md', 'b.md', 'c.md']) writeFileSync(join(cwd, name), `${name}\n`);
  fire(cwd, 'B1', 'boundary'); // PostToolUse on Bash
  assert.equal(count(cwd), 3);
});

test('the same file changed again through the shell counts again', () => {
  const cwd = project();
  fire(cwd, 'B2', 'start');
  writeFileSync(join(cwd, 'a.md'), 'one\n');
  fire(cwd, 'B2', 'boundary');
  writeFileSync(join(cwd, 'a.md'), 'two\n');
  fire(cwd, 'B2', 'boundary');
  assert.equal(count(cwd), 2);
});

test('a shell command that changes nothing adds nothing', () => {
  const cwd = project();
  fire(cwd, 'B3', 'start');
  writeFileSync(join(cwd, 'a.md'), 'one\n');
  fire(cwd, 'B3', 'boundary');
  fire(cwd, 'B3', 'boundary'); // `ls`, `git status`…
  fire(cwd, 'B3', 'turn');
  assert.equal(count(cwd), 1);
});

// The Edit tool fires its own +1, and the change it made is ALSO visible in the fingerprints. It must
// count once, not twice.
test('an Edit that changes a file still counts exactly one', () => {
  const cwd = project();
  fire(cwd, 'B4', 'start');
  writeFileSync(join(cwd, 'a.md'), 'edited by the Edit tool\n');
  fire(cwd, 'B4', 'edit');
  assert.equal(count(cwd), 1);
});

// What the fix is for: the hint finally reaches a session that works through the terminal.
test('a terminal-only session crosses the threshold and gets the hint once', () => {
  const cwd = project();
  fire(cwd, 'B5', 'start');
  let hints = 0;
  for (let i = 0; i < 25; i++) {
    writeFileSync(join(cwd, `f${i}.md`), `${i}\n`);
    if (/compact/i.test(fire(cwd, 'B5', 'boundary').output.systemMessage || '')) hints += 1;
  }
  assert.ok(count(cwd) >= 20, `editCount=${count(cwd)} after 25 shell edits`);
  assert.equal(hints, 1);
});
