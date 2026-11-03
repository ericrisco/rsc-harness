import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { evaluate } from '../targets/branch-guard.mjs';

// What the finished 4.0.1 re-run left open: the guard's denial still said only "ask them", which an
// autopilot run cannot do, and task-brief dropped the `**T004 — Interfaces**` block an isolated worker
// needs. Spec: 02-DOCS/wiki/sdd/specs/asdd-401.md (follow-up).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRIEF = join(ROOT, 'skills', 'implement', 'scripts', 'task-brief');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const write = (root, rel, body = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };

function closedRepo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-402-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'T'); git(root, 'config', 'user.email', 't@x');
  write(root, '.rsc.json', '{"version":1}');
  write(root, '.gitignore', '.rsc/\n');
  write(root, '.github/workflows/ci.yml'); // CI closes the default branch
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'c0');
  return root;
}

test('guard: a denied merge on a closed trunk names the autopilot landing — PR with a remote, park without', async () => {
  const r = closedRepo();
  const denial = await evaluate({ root: r, command: 'git merge --no-ff feat/x', cwd: r, sessionId: 'me' });
  assert.ok(denial, 'the merge is denied');
  assert.match(denial, /In autopilot \(nobody to ask\)/);
  assert.match(denial, /do not merge another way/);
  assert.match(denial, /open a pull request/);
  assert.match(denial, /park it: write the exact merge command/);
  assert.match(denial, /progress\/<slug>\.md/);
  // The interactive path is unchanged: with a person present, the agent still asks.
  assert.match(denial, /Do not choose for the person: ask them in one line/);
  assert.match(denial, /this change was not made/);
});

test('guard: the autopilot landing is not added where nothing is denied', async () => {
  const r = closedRepo();
  git(r, 'switch', '-q', '-c', 'feat/x');
  assert.equal(await evaluate({ root: r, command: 'git commit -m x', cwd: r, sessionId: 'me' }), null);
});

const PLAN = `| ID | Task |
|---|---|
| T003 | a |
| T004 | b |

**T003 — Interfaces**
- Produces: x

**T004 — Interfaces**
- Consumes: \`f(a) -> b\` (from T003)
- Produces: \`POST /login\`

Trailing prose.
`;

test('task-brief: the **T004 — Interfaces** block travels with the row, and only its own', () => {
  const d = mkdtempSync(join(tmpdir(), 'rsc-402-brief-'));
  writeFileSync(join(d, 'p.md'), PLAN);
  const r = spawnSync('sh', [BRIEF, join(d, 'p.md'), '4'], { encoding: 'utf8', env: { ...process.env, TMPDIR: d } });
  assert.equal(r.status, 0, r.stderr);
  const text = readFileSync(r.stdout.trim(), 'utf8');
  assert.match(text, /\| T004 \| b \|/);
  assert.match(text, /\*\*T004 — Interfaces\*\*/);
  assert.match(text, /Consumes: `f\(a\) -> b`/);
  assert.match(text, /Produces: `POST \/login`/);
  assert.doesNotMatch(text, /T003 — Interfaces|Produces: x|Trailing prose/);
});
