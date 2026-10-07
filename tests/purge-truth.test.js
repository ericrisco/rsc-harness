import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';

// E2E defect 5: `purge` said it "Removed" settings files it left behind as `{}` stubs, left empty
// skill/command directories, `.rsc.json`, its own `.gitignore` block and the `01-TOOLS/` scaffolding
// it wrote, and never mentioned any of them. The contract tested here is that the report is TRUE:
// what it lists as removed is gone, what it lists as kept is still there, and nothing rsc created and
// nobody touched survives silently.

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'scripts/rsc.js');
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
const ONBOARD = ['onboard', '--technical-level', 'technical', '--project-kind', 'software', '--goal', 'mini web de tareas',
  '--software-scope', 'small', '--workflow', 'main', '--target', 'claude'];

function onboardedRepo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-purge-truth-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '--no-verify', '-m', '🔧 init']);
  const preview = run(cwd, ONBOARD);
  const id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.ok(id, preview.stderr + preview.stdout);
  const accepted = run(cwd, [...ONBOARD, '--accept-plan', id]);
  assert.equal(accepted.status, 0, accepted.stderr + accepted.stdout);
  return cwd;
}

// Parse the purge report into its three sections. Each line is `  - <path>` optionally followed by
// ` — <reason>`.
function sections(stdout) {
  const out = { removed: [], cleaned: [], kept: [] };
  let current = null;
  for (const line of stdout.split('\n')) {
    if (/^(Removed|Would remove)\b/.test(line)) current = 'removed';
    else if (/^(Cleaned|Would clean)\b/.test(line)) current = 'cleaned';
    else if (/^Kept\b/.test(line)) current = 'kept';
    else if (current && /^ {2}- /.test(line)) out[current].push(line.slice(4).split(' — ')[0].trim());
  }
  return out;
}
const abs = (cwd, p) => (isAbsolute(p) ? p : join(cwd, p));

test('purge on a fresh onboard leaves no rsc residue and its report matches the disk', () => {
  const cwd = onboardedRepo();
  const result = run(cwd, ['purge']);
  assert.equal(result.status, 0, result.stderr);
  const report = sections(result.stdout);

  for (const left of ['.claude', '.rsc', '.rsc.json', '.gitignore', '01-TOOLS']) {
    assert.ok(!existsSync(join(cwd, left)), `${left} must be gone after purge on an untouched install:\n${result.stdout}`);
  }
  assert.ok(existsSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md')), '02-DOCS is kept by default');

  for (const p of report.removed) assert.ok(!existsSync(abs(cwd, p)), `reported removed but still on disk: ${p}`);
  for (const p of report.cleaned) assert.ok(existsSync(abs(cwd, p)), `reported cleaned but missing: ${p}`);
  assert.ok(report.removed.some((p) => p.includes('settings.json')), 'the deleted settings file is reported as removed');
  assert.ok(report.removed.includes('.rsc.json'), '.rsc.json is reported');
  assert.ok(report.kept.some((p) => p.startsWith('02-DOCS')), `02-DOCS listed as kept:\n${result.stdout}`);
  // Every top-level thing still in the project must be accounted for: only git and 02-DOCS remain.
  assert.deepEqual(readdirSync(cwd).sort(), ['.git', '02-DOCS']);
});

test('purge keeps and reports user content: settings, .gitignore lines, edited template, remote branch', () => {
  const cwd = onboardedRepo();
  const settingsPath = join(cwd, '.claude/settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  settings.model = 'opus';
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  writeFileSync(join(cwd, '.gitignore'), `node_modules/\n${readFileSync(join(cwd, '.gitignore'), 'utf8')}`);
  writeFileSync(join(cwd, '01-TOOLS/_TEMPLATE/README.md'), '# my own tool notes\n');
  // A remote that already carries the knowledge exchange branch.
  const remote = mkdtempSync(join(tmpdir(), 'rsc-purge-remote-'));
  git(remote, ['init', '-q', '--bare']);
  git(cwd, ['remote', 'add', 'origin', remote]);
  git(cwd, ['push', '-q', '--no-verify', 'origin', 'HEAD:refs/heads/rsc/knowledge']);
  git(cwd, ['fetch', '-q', 'origin']);

  const result = run(cwd, ['purge']);
  assert.equal(result.status, 0, result.stderr);
  const report = sections(result.stdout);

  const kept = JSON.parse(readFileSync(settingsPath, 'utf8'));
  assert.equal(kept.model, 'opus');
  assert.ok(!JSON.stringify(kept).includes('.rsc/'), 'rsc entries stripped');
  assert.ok(report.cleaned.includes('.claude/settings.json'), `settings with user content is "cleaned", not "removed":\n${result.stdout}`);
  assert.ok(!report.removed.includes('.claude/settings.json'));

  const gi = readFileSync(join(cwd, '.gitignore'), 'utf8');
  assert.match(gi, /node_modules\//);
  assert.doesNotMatch(gi, /rsc local state|\.rsc\/|\.claude\/skills/, 'rsc block removed from .gitignore');

  assert.equal(readFileSync(join(cwd, '01-TOOLS/_TEMPLATE/README.md'), 'utf8'), '# my own tool notes\n');
  assert.ok(!existsSync(join(cwd, '01-TOOLS/_TEMPLATE/CREDENTIALS.md')), 'untouched template files go');
  assert.ok(report.kept.includes('01-TOOLS/_TEMPLATE/README.md'), `edited template file reported as kept:\n${result.stdout}`);

  assert.match(result.stdout, /git push origin --delete rsc\/knowledge/, 'prints the command for the remote branch');
  assert.equal(git(remote, ['rev-parse', '--verify', '--quiet', 'refs/heads/rsc/knowledge']).status, 0, 'remote branch NOT deleted');

  for (const p of report.removed) assert.ok(!existsSync(abs(cwd, p)), `reported removed but still on disk: ${p}`);
  for (const p of [...report.cleaned, ...report.kept.filter((k) => !k.includes(' '))]) {
    if (!p.startsWith('origin/')) assert.ok(existsSync(abs(cwd, p.replace(/\/$/, ''))), `reported present but missing: ${p}`);
  }
});

test('purge --dry-run reports the same sections and touches nothing', () => {
  const cwd = onboardedRepo();
  const before = readFileSync(join(cwd, '.claude/settings.json'), 'utf8');
  const result = run(cwd, ['purge', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Would remove/);
  assert.match(result.stdout, /\.rsc\.json/);
  assert.equal(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'), before);
  assert.ok(existsSync(join(cwd, '.rsc.json')) && existsSync(join(cwd, '01-TOOLS/_TEMPLATE/README.md')));
});

// Field test 3.0.8: purge deleted 01-TOOLS/.gitignore although knowledge-sync had already committed it,
// leaving the tree dirty and the file one push away from vanishing for the whole team.
test('purge never deletes a scaffold file that is committed, and says why it stays', () => {
  const cwd = onboardedRepo();
  git(cwd, ['add', '01-TOOLS/.gitignore']);
  git(cwd, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-verify', '-m', '📝 docs: tools']);
  const result = run(cwd, ['purge']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(cwd, '01-TOOLS', '.gitignore')), 'committed: it stays');
  assert.equal(git(cwd, ['status', '--porcelain', '--', '01-TOOLS/.gitignore']).stdout.trim(), '', 'and the tree is not left dirty');
  assert.ok(sections(result.stdout).kept.includes('01-TOOLS/.gitignore'), result.stdout);
});

// Team simulation D15 (G5): purge on a teammate's clone. Three things went unsaid: the post-merge hook
// rsc installed in .git/hooks (left behind, still calling a reaper that no longer exists), the
// project's CLAUDE.md / AGENTS.md (kept, but not listed — the report claimed to account for
// everything), and the fact that most of what it deleted is COMMITTED: committing those deletions
// uninstalls rsc for the whole team.
test('purge on a clone reports the post-merge hook, the instruction files, and the team-wide effect of committing', () => {
  const cwd = onboardedRepo();
  writeFileSync(join(cwd, 'CLAUDE.md'), '# project\n');
  writeFileSync(join(cwd, 'AGENTS.md'), '# agents\n');
  git(cwd, ['add', '-A']);
  git(cwd, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-verify', '-m', '🔧 chore: harness']);
  const hook = join(cwd, '.git', 'hooks', 'post-merge');
  writeFileSync(hook, '#!/bin/sh\n# rsc-managed worktree cleanup (post-merge) v1\nexit 0\n');

  const dry = run(cwd, ['purge', '--dry-run']);
  assert.match(dry.stdout, /\.git\/hooks\/post-merge/, `dry run names the hook:\n${dry.stdout}`);
  assert.match(dry.stdout, /whole team/, 'and warns before anything is deleted');
  assert.ok(existsSync(hook), 'a dry run touches nothing');

  const result = run(cwd, ['purge']);
  assert.equal(result.status, 0, result.stderr);
  const report = sections(result.stdout);
  assert.ok(report.removed.includes('.git/hooks/post-merge'), `the rsc hook is reported removed:\n${result.stdout}`);
  assert.ok(!existsSync(hook), 'and it is gone');
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    assert.ok(report.kept.includes(f), `${f} listed under Kept:\n${result.stdout}`);
    assert.ok(existsSync(join(cwd, f)));
  }
  assert.match(result.stdout, /committed in git/);
  assert.match(result.stdout, /\.rsc\.json/);
  assert.match(result.stdout, /uninstalls rsc for the whole team/);
  assert.match(result.stdout, /\.claude\/settings\.json/, "a committed config purge only cleaned is part of the warning too");
  assert.match(result.stdout, /git restore/);
  // The undo it prints must work.
  const restore = result.stdout.match(/git restore -- (.+)/)?.[1];
  assert.ok(restore, result.stdout);
  assert.equal(spawnSync('sh', ['-c', `git restore -- ${restore}`], { cwd, encoding: 'utf8' }).status, 0);
  assert.ok(existsSync(join(cwd, '.rsc.json')) && existsSync(join(cwd, '.claude', 'settings.json')));
});

test('purge leaves a post-merge hook that is not rsc\'s, and restores one rsc had chained', () => {
  const cwd = onboardedRepo();
  const dir = join(cwd, '.git', 'hooks');
  writeFileSync(join(dir, 'post-merge'), '#!/bin/sh\n# rsc-managed worktree cleanup (post-merge) v1\n');
  writeFileSync(join(dir, 'post-merge.rsc-local'), '#!/bin/sh\necho mine\n');
  const result = run(cwd, ['purge']);
  assert.equal(readFileSync(join(dir, 'post-merge'), 'utf8'), '#!/bin/sh\necho mine\n', 'the person\'s own hook is back in place');
  assert.ok(!existsSync(join(dir, 'post-merge.rsc-local')));
  assert.match(result.stdout, /post-merge/);

  const other = onboardedRepo();
  writeFileSync(join(other, '.git', 'hooks', 'post-merge'), '#!/bin/sh\necho husky\n');
  run(other, ['purge']);
  assert.equal(readFileSync(join(other, '.git', 'hooks', 'post-merge'), 'utf8'), '#!/bin/sh\necho husky\n', 'never touches a foreign hook');
});
