import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { trunkPolicy, trunkSignals, defaultBranchName, UNLOCK } from '../targets/trunk-policy.mjs';
import { evaluate, effectiveDir, unquoted, COMMITS_HERE, MOVES_BRANCH } from '../targets/branch-guard.mjs';
import { capture, otherActiveSessions, ACTIVE_WINDOW_MS } from '../targets/session-memory-core.mjs';
import { isolationContext } from '../targets/session-memory-adapter.mjs';

// team-safe-default, parts A and B: the default branch closed for the agent where the project shows it
// is complex, and no branch switching under another session working in the same checkout. Every
// denial must carry its way out (constitution P6) — asserted on the message itself, not assumed.

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (root, rel, body = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };

function repo({ authors = ['Eric'] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-tsd-')));
  git(root, 'init', '-q', '-b', 'main');
  write(root, '.rsc.json', '{"version":1}');
  write(root, '.gitignore', '.rsc/\n');
  for (const [i, who] of authors.entries()) {
    git(root, 'config', 'user.name', who);
    git(root, 'config', 'user.email', `${who.toLowerCase()}@x`);
    write(root, `f${i}.txt`, `${i}\n`);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', `c${i}`);
  }
  return root;
}

// ------------------------------------------------------------------ trunk-policy (A)

test('tsd01 · a simple project leaves the default branch open; CI, a deployment or a team close it', () => {
  const simple = repo();
  assert.deepEqual(trunkPolicy(simple), { closed: false, reason: 'simple', signals: [] });
  const ci = repo(); write(ci, '.github/workflows/ci.yml');
  assert.equal(trunkPolicy(ci).closed, true);
  assert.match(trunkSignals(ci)[0], /CI/);
  const deploy = repo(); write(deploy, 'Dockerfile');
  assert.match(trunkSignals(deploy).join(), /despliegue/);
  const team = repo({ authors: ['Eric', 'Ana'] });
  assert.match(trunkSignals(team).join(), /equipo \(2 personas/);
});

test('tsd02 · an empty .github/workflows is not CI, and «desbloquea main» opens a complex project', () => {
  const r = repo(); mkdirSync(join(r, '.github', 'workflows'), { recursive: true });
  assert.equal(trunkPolicy(r).closed, false);
  write(r, '.github/workflows/ci.yml');
  write(r, `.rsc/${UNLOCK}`, '');
  assert.deepEqual(trunkPolicy(r), { closed: false, reason: 'unlocked', signals: [] });
});

test('tsd03 · the default branch name comes from the repo, with main/master as fallbacks', () => {
  assert.equal(defaultBranchName(repo()), 'main');
});

// ------------------------------------------------------------------ branch-guard: rule A

test('tsd10 · on a closed default branch a commit is denied, and the message says how to carry on', async () => {
  const r = repo(); write(r, 'Dockerfile');
  const reason = await evaluate({ root: r, command: 'git commit -m "✨ feat: x"', cwd: r });
  assert.match(reason, /closed for the agent/);
  assert.match(reason, /git switch -c feat\//, 'P6: the way out is in the message');
  assert.match(reason, /rsc main unlock/, 'P6: and the unlock, for a project that is really simple');
  assert.match(await evaluate({ root: r, command: 'git -C . merge feat/x', cwd: r }), /closed for the agent/);
});

test('tsd14 · a search for the words "git commit" on a closed default branch is not denied', async () => {
  const r = repo(); write(r, 'Dockerfile');
  assert.equal(await evaluate({ root: r, command: 'grep -rn "git commit" docs/', cwd: r }), null);
});

test('tsd16 · a chain is judged the way the shell runs it (review M2/M3)', async () => {
  const r = repo(); write(r, 'Dockerfile');
  // The way out it recommends, chained, is allowed.
  assert.equal(await evaluate({ root: r, command: 'git switch -c feat/x && git add -A && git commit -m x', cwd: r }), null);
  assert.equal(await evaluate({ root: r, command: 'git commit -m "a; b && c" ; true', cwd: r }) !== null, true, 'quotes with separators do not split');
  // On a branch, moving to the trunk inside the chain and landing there is denied.
  git(r, 'switch', '-q', '-c', 'feat/y');
  assert.match(await evaluate({ root: r, command: 'git switch main && git merge feat/y', cwd: r }), /closed for the agent/);
  assert.match(await evaluate({ root: r, command: 'git checkout main; git commit -am x', cwd: r }), /closed for the agent/);
  git(r, 'switch', '-q', 'main');
  assert.match(await evaluate({ root: r, command: 'git --work-tree . commit -m x', cwd: r }), /closed for the agent/);
  // A worktree opened and entered in the same chain is its own branch.
  git(r, 'worktree', 'add', '-q', '.worktrees/z', '-b', 'feat/z');
  assert.equal(await evaluate({ root: r, command: 'git status && cd .worktrees/z && git commit -m x', cwd: r }), null);
});

test('tsd17 · heredoc bodies and path checkouts are not what they look like (review L1/L2)', async () => {
  const r = repo(); write(r, 'Dockerfile');
  assert.equal(await evaluate({ root: r, command: 'cat > notes.md <<EOF\nrun git commit later\nEOF', cwd: r }), null);
  session(r, 'other', 'codex');
  assert.equal(await evaluate({ root: r, command: 'git checkout .', cwd: r, sessionId: 'me' }), null);
  assert.equal(await evaluate({ root: r, command: 'git checkout f0.txt', cwd: r, sessionId: 'me' }), null);
  assert.match(await evaluate({ root: r, command: 'git checkout -b feat/q', cwd: r, sessionId: 'me' }), /Another session/);
});

test('tsd15 · the way out of a closed default branch: alone → a branch in this folder; with company → .worktrees/', async () => {
  // E2E 2026-10-04: told only "a branch", an agent alone reached for its assistant's own worktree tool.
  const r = repo(); write(r, 'Dockerfile');
  const alone = await evaluate({ root: r, command: 'git commit -m x', cwd: r, sessionId: 'me' });
  assert.match(alone, /git switch -c feat\/<what>` in this same folder, no worktree/);
  assert.doesNotMatch(alone, /worktree add/);
  // 2026-10-06, Eric: the agent never branches on its own; the denial hands the choice back.
  assert.match(alone, /Do not choose for the person: ask them in one line whether to open a branch for this change or to unlock "main"/);
  assert.match(alone, /only on their explicit answer, `npx @ericrisco\/rsc main unlock`/);
  session(r, 'other', 'codex');
  const shared = await evaluate({ root: r, command: 'git commit -m x', cwd: r, sessionId: 'me' });
  assert.match(shared, /git worktree add \.worktrees\/<branch> -b feat\/<what>/);
});

test('tsd11 · commits are allowed on a branch, in a simple project, and once unlocked', async () => {
  const r = repo(); write(r, 'Dockerfile');
  git(r, 'switch', '-q', '-c', 'feat/x');
  assert.equal(await evaluate({ root: r, command: 'git commit -m x', cwd: r }), null);
  const s = repo();
  assert.equal(await evaluate({ root: s, command: 'git commit -m x', cwd: s }), null);
  const u = repo(); write(u, 'Dockerfile'); write(u, `.rsc/${UNLOCK}`, '');
  assert.equal(await evaluate({ root: u, command: 'git commit -m x', cwd: u }), null);
});

test('tsd12 · it judges the folder the command runs in, so a worktree on its own branch is fine', async () => {
  const r = repo(); write(r, 'Dockerfile');
  git(r, 'worktree', 'add', '-q', '.worktrees/feat-x', '-b', 'feat/x');
  assert.equal(await evaluate({ root: r, command: 'git -C .worktrees/feat-x commit -m x', cwd: r }), null);
  assert.equal(await evaluate({ root: r, command: 'cd .worktrees/feat-x && git commit -m x', cwd: r }), null);
  assert.equal(effectiveDir('git -C "/a b" commit', '/r'), '/a b');
});

test('tsd13 · only git commands that land work are seen; words inside other commands are not', () => {
  for (const c of ['git commit -m x', 'git -C x commit', 'git merge y', 'git cherry-pick abc']) assert.ok(COMMITS_HERE.test(c), c);
  for (const c of ['grep -rn "git commit" docs/', "echo 'git merge x'", 'git commit-tree abc', 'git log']) assert.ok(!COMMITS_HERE.test(unquoted(c)), c);
  assert.ok(COMMITS_HERE.test(unquoted('git commit -m "fix: a \\"quoted\\" word"')), 'a real commit with a quoted message is still a commit');
  for (const c of ['git switch feat/x', 'git checkout feat/x', 'git checkout -b feat/y']) assert.ok(MOVES_BRANCH.test(c), c);
  for (const c of ['git checkout -- file.txt', 'git checkout HEAD -- a.js', 'git switchx']) assert.ok(!MOVES_BRANCH.test(c), c);
});

// ------------------------------------------------------------------ sessions + rule B

function session(root, id, target = 'codex', at = new Date().toISOString(), extra = {}) {
  write(root, `work-${id}.txt`, id); // the journal only records sessions that did work
  return capture({ cwd: root, sessionId: id, target, event: 'edit', editDelta: 1, now: at, ...extra });
}

test('tsd20 · another session with work in the last 30 minutes counts; old, closed and self do not', () => {
  const r = repo();
  session(r, 'other', 'codex');
  // The spec fixes the window at 30 minutes; a literal, so widening the constant cannot pass.
  session(r, 'old', 'gemini', new Date(Date.now() - 31 * 60 * 1000).toISOString());
  session(r, 'recent', 'opencode', new Date(Date.now() - 29 * 60 * 1000).toISOString());
  session(r, 'closed', 'cursor');
  capture({ cwd: r, sessionId: 'closed', target: 'cursor', event: 'sessionEnd' });
  session(r, 'me', 'claude');
  const others = otherActiveSessions({ cwd: r, sessionId: 'me', target: 'claude' });
  assert.deepEqual(others.map((o) => o.sessionId).sort(), ['other', 'recent']);
  assert.equal(ACTIVE_WINDOW_MS, 30 * 60 * 1000);
});

test('tsd21 · with another active session, switching branches here is denied, with the worktree way out', async () => {
  const r = repo();
  session(r, 'other', 'codex');
  const reason = await evaluate({ root: r, command: 'git switch -c feat/y', cwd: r, sessionId: 'me' });
  assert.match(reason, /Another session is working in this same folder \(codex/);
  assert.match(reason, /git worktree add \.worktrees\//, 'P6: the way out is in the message');
  assert.match(reason, /rsc isolation off/);
});

test('tsd22 · alone, or with isolation turned off, switching branches is allowed', async () => {
  const r = repo();
  assert.equal(await evaluate({ root: r, command: 'git switch -c feat/y', cwd: r, sessionId: 'me' }), null);
  session(r, 'other', 'codex');
  write(r, '.rsc/.no-worktree-isolation', '');
  assert.equal(await evaluate({ root: r, command: 'git switch -c feat/y', cwd: r, sessionId: 'me' }), null);
});

test('tsd23 · the model is told to use a worktree while another session is active, and only then', () => {
  const r = repo();
  assert.equal(isolationContext({ project: r, here: r, sessionId: 'me', target: 'claude' }), '');
  session(r, 'other', 'codex');
  assert.match(isolationContext({ project: r, here: r, sessionId: 'me', target: 'claude' }), /\.worktrees\/<rama>/);
  write(r, '.rsc/.no-worktree-isolation', '');
  assert.equal(isolationContext({ project: r, here: r, sessionId: 'me', target: 'claude' }), '');
});

test('tsd24 · the guard runs as the hook process Claude Code calls, and denies in its JSON', () => {
  const r = repo(); write(r, 'Dockerfile');
  const script = join(import.meta.dirname, '..', 'targets', 'branch-guard.mjs');
  const out = spawnSync(process.execPath, [script, r], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, cwd: r }), encoding: 'utf8',
  });
  assert.equal(out.status, 0);
  assert.equal(JSON.parse(out.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const ok = spawnSync(process.execPath, [script, r], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }), encoding: 'utf8' });
  assert.equal(ok.stdout, '', 'an unrelated command is allowed silently');
});

// ------------------------------------------------------------------ session start (3.0 duties)

function withRemote(root) {
  const bare = `${root}-remote.git`;
  git(root, 'init', '-q', '--bare', '-b', 'main', bare);
  git(root, 'remote', 'add', 'origin', bare);
  git(root, 'push', '-q', '-u', 'origin', 'main');
  git(root, 'fetch', '-q', 'origin');
  return bare;
}

test('tsd30 · commits stranded on a closed default branch move to a rescue branch, and main matches the remote', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); write(r, 'Dockerfile'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'docker');
  withRemote(r);
  write(r, 'a.txt', 'agent 1\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'agent 1');
  write(r, 'b.txt', 'agent 2\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'agent 2');
  const said = await rescueTrunkCommits(r);
  assert.match(said, /2 commit\(s\)/);
  assert.equal(git(r, 'rev-parse', 'HEAD'), git(r, 'rev-parse', 'origin/main'));
  const rescue = git(r, 'branch', '--list', 'rescue/*').replace(/^[*\s]+/, '');
  assert.equal(git(r, 'log', '-1', '--format=%s', rescue), 'agent 2', 'the work is on the rescue branch');
  assert.equal(await rescueTrunkCommits(r), '', 'idempotent: nothing left to rescue');
});

test('tsd31 · a change in progress the reset would touch stops it: copied, not reset, and said how to finish', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); write(r, 'Dockerfile'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'docker');
  withRemote(r);
  write(r, 'a.txt', 'agent\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'agent');
  write(r, 'a.txt', 'in progress\n');
  const said = await rescueTrunkCommits(r);
  assert.match(said, /no he podido dejar/);
  assert.match(said, /git reset --keep origin\/main/, 'P6: how to finish is in the message');
  assert.equal(readFileSync(join(r, 'a.txt'), 'utf8'), 'in progress\n', 'the change in progress was lost');
});

test('tsd32 · a simple project keeps its commits on main', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); withRemote(r);
  write(r, 'a.txt', 'x\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'mine');
  assert.equal(await rescueTrunkCommits(r), '');
});

test('tsd33 · an old sibling worktree made by rsc moves into .worktrees/, keeping unsaved work', async () => {
  const { relocateOldWorktrees } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  const sibling = `${r}-feat-x`;
  git(r, 'worktree', 'add', '-q', sibling, '-b', 'feat/x');
  write(sibling, 'unsaved.txt', 'not committed\n');
  const said = await relocateOldWorktrees(r);
  assert.match(said, /movidos dentro del proyecto/);
  const dest = join(r, '.worktrees', 'feat-x');
  assert.equal(readFileSync(join(dest, 'unsaved.txt'), 'utf8'), 'not committed\n');
  assert.ok(git(r, 'worktree', 'list').includes(dest), 'git still knows it as a worktree');
});

test('tsd34 · a worktree made by hand, or one a session is working in, is not moved', async () => {
  const { relocateOldWorktrees } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  const mine = join(realpathSync(mkdtempSync(join(tmpdir(), 'rsc-hand-'))), 'scratch');
  git(r, 'worktree', 'add', '-q', mine, '-b', 'experiment');
  const busy = `${r}-feat-busy`;
  git(r, 'worktree', 'add', '-q', busy, '-b', 'feat/busy');
  write(busy, 'w.txt', 'w');
  capture({ cwd: r, worktreeCwd: busy, sessionId: 'other', target: 'codex', event: 'edit', editDelta: 1 });
  const said = await relocateOldWorktrees(r);
  assert.ok(existsSync(mine), 'a hand-made worktree was moved');
  assert.ok(existsSync(busy), 'a worktree with an active session was moved');
  assert.match(said, /una sesión trabaja en él/);
});

test('tsd36 · a session journaled in the old worktree\'s own store also keeps it in place (review H3)', async () => {
  const { relocateOldWorktrees } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  const sibling = `${r}-feat-s`;
  git(r, 'worktree', 'add', '-q', sibling, '-b', 'feat/s');
  write(sibling, 'w.txt', 'editing\n');
  // The sibling carries its own .rsc.json, so its session writes to the sibling's store, not r's.
  capture({ cwd: sibling, worktreeCwd: sibling, sessionId: 'S1', target: 'claude', event: 'edit', editDelta: 1 });
  assert.equal(otherActiveSessions({ cwd: r, worktreeCwd: sibling }).length, 0, 'precondition: invisible from r');
  const said = await relocateOldWorktrees(r);
  assert.ok(existsSync(sibling), 'a worktree in use was moved');
  assert.match(said, /una sesión trabaja en él/);
});

test('tsd37 · the rescue runs once: a commit the person makes on main later is theirs (review M1, P3)', async () => {
  const { rescueTrunkCommits } = await import('../targets/team-safe-start.mjs');
  const r = repo(); write(r, 'Dockerfile'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'docker');
  withRemote(r);
  assert.equal(await rescueTrunkCommits(r), '', 'first 3.0 session: nothing stranded');
  write(r, 'hotfix.txt', 'person\n'); git(r, 'add', '-A'); git(r, 'commit', '-q', '-m', 'person hotfix');
  assert.equal(await rescueTrunkCommits(r), '');
  assert.equal(git(r, 'log', '-1', '--format=%s'), 'person hotfix');
  assert.equal(git(r, 'branch', '--list', 'rescue/*'), '');
});

test('tsd35 · the 3.0 announcement is said once per project and machine, with every way to turn it off', async () => {
  const { teamSafeAnnouncement } = await import('../targets/team-safe-start.mjs');
  const r = repo();
  write(r, '02-DOCS/wiki/harness/user-profile.md', '---\ntechnical_level: technical\nlanguage: es\n---\n# Perfil\n');
  const first = teamSafeAnnouncement(r, {});
  for (const off of ['desbloquea main', 'no uses worktrees', 'pedir el otro', 'rsc knowledge-sync off']) assert.match(first, new RegExp(off));
  assert.equal(teamSafeAnnouncement(r, {}), '');
});

// E2E defect 12: the banner was Spanish-only, shown to everyone. The language comes from the
// profile's `language:` field, then the locale, and is English when neither says.
test('tsd35b · the 3.0 announcement is English unless the profile or the locale says otherwise', async () => {
  const { teamSafeAnnouncement } = await import('../targets/team-safe-start.mjs');
  const english = teamSafeAnnouncement(repo(), {});
  assert.match(english, /rsc 3\.0 · team-safe by default/);
  for (const off of ['unlock main', 'rsc isolation off', 'ask for the other', 'rsc knowledge-sync off']) assert.match(english, new RegExp(off));
  assert.doesNotMatch(english, /díselo|desbloquea/);

  assert.match(teamSafeAnnouncement(repo(), { LANG: 'es_ES.UTF-8' }), /equipo seguro por defecto/, 'Spanish locale');
  assert.match(teamSafeAnnouncement(repo(), { LANG: 'C.UTF-8' }), /team-safe by default/, 'neutral locale → English');

  const profiled = repo();
  write(profiled, '02-DOCS/wiki/harness/user-profile.md', '---\nlanguage: English\n---\n');
  assert.match(teamSafeAnnouncement(profiled, { LANG: 'es_ES.UTF-8' }), /team-safe by default/, 'the profile wins over the locale');
});

// ------------------------------------------------------------------ the switches a person asks for

test('tsd40 · «desbloquea main» and «no uses worktrees» become project decisions in .rsc.json, and back', async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const { readManifest } = await import('../scripts/lib/manifest-file.js');
  const r = repo(); write(r, 'Dockerfile');
  await applyInstall({ skillIds: ['suggest', 'orient'], target: 'claude', home: r, cwd: r });
  for (const f of ['branch-guard.mjs', 'trunk-policy.mjs', 'team-safe-start.mjs']) assert.ok(existsSync(join(r, '.rsc', f)), `${f} installed`);
  const cli = (...a) => execFileSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'rsc.js'), ...a], { cwd: r, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(JSON.parse(cli('main', 'status')).closed, true);
  cli('main', 'unlock');
  cli('isolation', 'off');
  assert.deepEqual(readManifest(r).optOuts, ['trunk-guard', 'worktree-isolation']);
  assert.equal(JSON.parse(cli('main', 'status')).reason, 'unlocked');
  cli('main', 'lock');
  cli('isolation', 'on');
  // 2026-10-06: lock is the «ramas y PR» answer — a decision recorded for the team, not a return to guessing.
  assert.deepEqual(readManifest(r).optOuts, ['trunk-open']);
  assert.equal(JSON.parse(cli('main', 'status')).reason, 'locked');
  const settings = readFileSync(join(r, '.claude', 'settings.json'), 'utf8');
  assert.match(settings, /branch-guard\.mjs/, 'the guard is wired');
});

test('tsd18 · every text the agent reads: open default branch → no question; closed → ask each change (2026-10-06)', async () => {
  const { SDD_GATE_TEXT } = await import('../targets/hook-once.mjs');
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(SDD_GATE_TEXT, /Never open\s+a branch on your own/);
  const suggest = read('skills/suggest/SKILL.md');
  assert.match(suggest, /open \(chosen at install, or nothing complex\) → work on it, no branch\s+question/);
  assert.match(suggest, /before each code change ask: this branch, a new one, or\s+`rsc main unlock`\? Never branch alone/);
  const ftd = read('skills/ftd/SKILL.md');
  assert.match(ftd, /Do not\s+ask about branches/);
  assert.match(ftd, /esta rama \(`<current>`\), en una nueva, o desbloqueo/);
  assert.match(ftd, /Already on another branch\s+is no exception/);
  assert.match(read('skills/worktrees/SKILL.md'), /Never open a branch on your own; follow the project's decision/);
  assert.match(read('skills/implement/SKILL.md'), /Never branch on your\s+own/);
});

test('tsd19 · the per-turn rule names the state of THIS project, and the branch you are on', async () => {
  const { branchRuleLine } = await import('../targets/trunk-policy.mjs');
  const open = repo();
  assert.match(branchRuleLine(open), /"main" is OPEN: code changes go straight on it\. Do not ask about branches/);
  const closed = repo(); write(closed, '.rsc/.no-trunk-open', '');
  assert.match(branchRuleLine(closed), /"main" is CLOSED \(ramas y PR, decidido para este proyecto\): before EACH code change ask: a new branch, or unlock "main"\?/);
  git(closed, 'switch', '-q', '-c', 'feat/x');
  assert.match(branchRuleLine(closed), /this branch \("feat\/x"\), a new branch, or unlock "main"/);
  const ci = repo(); write(ci, '.github/workflows/ci.yml');
  assert.match(branchRuleLine(ci), /CLOSED \(CI/);
  write(ci, '.rsc/.no-trunk-guard', '');
  assert.match(branchRuleLine(ci), /OPEN/, '«main» chosen at install wins over the signals');
});
