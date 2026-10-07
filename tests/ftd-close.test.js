import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FTD_CLOSE_OPT_OUT, closeDoc, closeLanded, onRequest, onTurn, work } from '../targets/knowledge-sync.mjs';
import { installMergeHook } from '../targets/worktree-reaper.mjs';

process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND = '1';

// Field test 3.0.8: a feature document written on a feature branch kept saying «pendiente: abrir PR»
// long after its PR was merged, and carried no author — «¿qué ha hecho cada uno?» got every feature
// reported as pending and nobody's name. The close is deterministic now: when a branch lands on the
// default branch (the post-merge hook), the documents THAT branch wrote are marked done. Where the
// edit is committed depends on the default branch: open → a local docs(auto) commit; closed → never
// on main, it travels by rsc/knowledge like any other knowledge change.

const HERE = dirname(fileURLToPath(import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function write(repo, rel, body) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), body);
}
const read = (repo, rel) => readFileSync(join(repo, rel), 'utf8');
const K = 'rsc/knowledge';

function ident(repo, who) {
  git(repo, 'config', 'user.name', who);
  git(repo, 'config', 'user.email', `${who.toLowerCase()}@x`);
}

function team({ closed = false } = {}) {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-ftdclose-')));
  const remote = join(tmp, 'remote.git');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  const seed = join(tmp, 'seed');
  git(tmp, 'clone', '-q', remote, seed);
  ident(seed, 'Seed');
  write(seed, '.gitignore', '.rsc/\n');
  write(seed, '.rsc.json', JSON.stringify({ version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [], optOuts: [] }));
  write(seed, '02-DOCS/wiki/index.md', 'uno\n');
  write(seed, 'src/app.js', 'code\n');
  if (closed) write(seed, '.github/workflows/ci.yml', 'on: push\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const clone = (name, who) => {
    const dir = join(tmp, name);
    git(tmp, 'clone', '-q', remote, dir);
    ident(dir, who);
    // Open main for the tests that want it: two authors would otherwise close it (trunk-policy).
    if (!closed) write(dir, '.rsc/.no-trunk-guard', '');
    return dir;
  };
  return { tmp, remote, clone, eric: clone('eric', 'Eric'), ana: clone('ana', 'Ana') };
}

const doc = (branch, author = 'Ana') => [
  '---', `author: ${author}`, `branch: ${branch}`, 'status: in-progress', '---', '',
  '# filtro', '', '## Intent', 'filtrar', '', '## Checklist', '- [x] filtro — test verde', '',
  '## Evidence', '- npm test: 3 pass', '', '## Next', '- pendiente: abrir PR', '',
].join('\n');

const legacyDoc = ['# viejo', '', '## Checklist', '- [x] hecho', '', '## Next', '- pendiente: abrir PR', ''].join('\n');

const field = (text, key) => (text.match(new RegExp(`^${key}: (.*)$`, 'm')) || [])[1];
const nextOf = (text) => text.split(/^## Next[^\n]*\n/m)[1] || '';

function turn(repo) { onTurn(repo, { spawnShip: false }); work(repo, 'ship'); }
function message(repo) { work(repo, 'fetch'); return onRequest(repo, { spawnFetch: false }); }
const quiet = (repo) => { onRequest(repo, { spawnFetch: false }); };

/** The lead's merge button: a --no-ff merge of the PR branch, pushed to main by hand. */
function mergePR(t, branch) {
  const lead = existsSync(join(t.tmp, 'lead')) ? join(t.tmp, 'lead') : t.clone('lead', 'Lead');
  git(lead, 'fetch', '-q', 'origin');
  git(lead, 'switch', '-q', 'main'); git(lead, 'merge', '-q', '--ff-only', 'origin/main');
  git(lead, 'merge', '-q', '--no-ff', '--no-edit', `origin/${branch}`);
  git(lead, 'push', '-q', 'origin', 'main');
  return git(lead, 'rev-parse', 'HEAD');
}

// ------------------------------------------------------------------ the edit itself

test('fc01 · closeDoc: status done, merged date, Next replaced, nothing else touched; a done doc is left alone', () => {
  const out = closeDoc(doc('feat/filtro'), { trunk: 'main', date: '2026-10-07', sha: 'abc1234', mergedBy: 'Lead', pr: '12' });
  assert.equal(field(out, 'status'), 'done');
  assert.equal(field(out, 'merged'), '2026-10-07');
  assert.equal(field(out, 'merged_by'), 'Lead');
  assert.equal(field(out, 'pr'), '#12');
  assert.equal(field(out, 'author'), 'Ana', 'the author it already had is kept');
  assert.equal(nextOf(out).trim(), 'Fusionado en main el 2026-10-07 (abc1234).');
  assert.doesNotMatch(out, /pendiente: abrir PR/);
  assert.match(out, /## Evidence\n- npm test: 3 pass/, 'the evidence is the record, never rewritten');
  assert.equal(closeDoc(out, { trunk: 'main', date: '2026-10-08', sha: 'fff0000' }), null, 'idempotent: done stays as it was');
});

test('fc02 · closeDoc on a document with no frontmatter: one is added, with the author it is given', () => {
  const out = closeDoc(legacyDoc, { trunk: 'main', date: '2026-10-07', sha: 'abc1234', author: 'Ana', branch: 'feat/viejo' });
  assert.match(out, /^---\nauthor: Ana\nbranch: feat\/viejo\nstatus: done\nmerged: 2026-10-07\n---\n\n# viejo/);
  assert.equal(nextOf(out).trim(), 'Fusionado en main el 2026-10-07 (abc1234).');
});

// ------------------------------------------------------------------ open default branch: local commit

test('fc03 · open main, local `git merge --no-ff`: the branch\'s doc is closed in a local docs(auto) commit', () => {
  const { eric } = team();
  git(eric, 'switch', '-q', '-c', 'feat/filtro');
  write(eric, '02-DOCS/wiki/ftd/filtro.md', doc('feat/filtro', 'Eric'));
  write(eric, 'src/app.js', 'filtro\n');
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', '✨ feat: filtro');
  git(eric, 'switch', '-q', 'main');
  git(eric, 'merge', '-q', '--no-ff', '--no-edit', 'feat/filtro');
  const merge = git(eric, 'rev-parse', 'HEAD');
  const r = closeLanded(eric, { spawnShip: false });
  assert.deepEqual(r.closed, ['02-DOCS/wiki/ftd/filtro.md']);
  assert.equal(r.via, 'local');
  const subject = git(eric, 'log', '-1', '--format=%s');
  assert.match(subject, /^📝 docs\(auto\): cierre FTD/);
  assert.ok(!subject.includes('skip ci'), 'a local commit on the branch never skips CI');
  assert.equal(git(eric, 'rev-parse', 'HEAD~1'), merge, 'exactly one commit, on top of the merge');
  const text = read(eric, '02-DOCS/wiki/ftd/filtro.md');
  assert.equal(field(text, 'status'), 'done');
  assert.equal(field(text, 'merged'), git(eric, 'log', '-1', '--format=%cs', merge));
  assert.equal(field(text, 'merged_by'), 'Eric');
  assert.match(nextOf(text), new RegExp(`^Fusionado en main el \\d{4}-\\d{2}-\\d{2} \\(${merge.slice(0, 7)}\\)\\.`));
  assert.equal(git(eric, 'status', '--porcelain', '--', '02-DOCS'), '', 'nothing left uncommitted');
  // Idempotent: the hook running again (another pull, the same ORIG_HEAD) changes nothing.
  const head = git(eric, 'rev-parse', 'HEAD');
  assert.deepEqual(closeLanded(eric, { spawnShip: false }).closed, []);
  assert.equal(git(eric, 'rev-parse', 'HEAD'), head);
});

test('fc04 · a legacy doc without frontmatter, landed by fast-forward: author filled from the commit that created it', () => {
  const { eric } = team();
  git(eric, 'switch', '-q', '-c', 'fix/viejo');
  write(eric, '02-DOCS/wiki/ftd/viejo.md', legacyDoc);
  git(eric, 'add', '-A');
  git(eric, 'commit', '-q', '--author', 'Ana <ana@x>', '-m', '📝 docs: viejo');
  git(eric, 'switch', '-q', 'main');
  git(eric, 'merge', '-q', '--ff-only', 'fix/viejo');
  const r = closeLanded(eric, { spawnShip: false });
  assert.deepEqual(r.closed, ['02-DOCS/wiki/ftd/viejo.md']);
  const text = read(eric, '02-DOCS/wiki/ftd/viejo.md');
  assert.equal(field(text, 'author'), 'Ana', 'the git author of the commit that created the doc');
  assert.equal(field(text, 'branch'), 'fix/viejo');
  assert.equal(field(text, 'status'), 'done');
});

test('fc05 · nothing closes off the default branch, nor a doc of another branch, nor with the switch off', () => {
  const { eric } = team();
  // A doc of ANOTHER branch carried by this one (what a 📥 sync does) is not this branch's to close.
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, '02-DOCS/wiki/ftd/ajeno.md', doc('feat/otra'));
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', '📥 docs(auto): sync desde rsc/knowledge');
  write(eric, 'src/app.js', 'x\n'); git(eric, 'commit', '-qam', '✨ feat: x');
  git(eric, 'switch', '-q', 'main');
  git(eric, 'merge', '-q', '--no-ff', '--no-edit', 'feat/x');
  assert.deepEqual(closeLanded(eric, { spawnShip: false }).closed, []);
  assert.equal(field(read(eric, '02-DOCS/wiki/ftd/ajeno.md'), 'status'), 'in-progress');

  // Merging main INTO a feature branch is not a landing.
  git(eric, 'switch', '-q', '-c', 'feat/y', 'HEAD~1');
  git(eric, 'switch', '-q', '-c', 'feat/z', 'main');
  write(eric, '02-DOCS/wiki/ftd/z.md', doc('feat/z')); git(eric, 'add', '-A'); git(eric, 'commit', '-qm', 'z');
  git(eric, 'switch', '-q', 'feat/y');
  git(eric, 'merge', '-q', '--no-ff', '--no-edit', 'feat/z');
  assert.deepEqual(closeLanded(eric, { spawnShip: false }).closed, [], 'not on the default branch');

  // The switch.
  git(eric, 'switch', '-q', 'main');
  write(eric, `.rsc/${FTD_CLOSE_OPT_OUT}`, '');
  git(eric, 'merge', '-q', '--no-ff', '--no-edit', 'feat/z');
  assert.deepEqual(closeLanded(eric, { spawnShip: false }).closed, []);
  assert.equal(field(read(eric, '02-DOCS/wiki/ftd/z.md'), 'status'), 'in-progress');
});

// ------------------------------------------------------------------ closed default branch: via rsc/knowledge

test('fc06 · closed main, `git pull` of a merged PR: closed on rsc/knowledge, main untouched and clean; teammates get it', () => {
  const t = team({ closed: true });
  const { eric, ana, remote } = t;
  quiet(eric); quiet(ana);
  git(ana, 'switch', '-q', '-c', 'feat/filtro');
  write(ana, '02-DOCS/wiki/ftd/filtro.md', doc('feat/filtro'));
  write(ana, 'src/app.js', 'filtro\n');
  git(ana, 'add', '-A'); git(ana, 'commit', '-q', '-m', '✨ feat: filtro');
  turn(ana); // the doc goes up to rsc/knowledge as work proceeds
  git(ana, 'push', '-q', 'origin', 'feat/filtro');
  const merge = mergePR(t, 'feat/filtro');
  const mainBefore = git(remote, 'rev-parse', 'main');

  git(eric, 'pull', '-q', '--no-rebase');
  const head = git(eric, 'rev-parse', 'HEAD');
  const r = closeLanded(eric); // the hook: queues and ships (foreground in tests)
  assert.deepEqual(r.closed, ['02-DOCS/wiki/ftd/filtro.md']);
  assert.equal(r.via, 'knowledge');
  assert.equal(git(eric, 'rev-parse', 'HEAD'), head, 'nothing committed on the closed main');
  assert.equal(git(eric, 'status', '--porcelain', '-uall', '--', '02-DOCS'), '', 'the closed main is left clean');
  assert.equal(git(remote, 'rev-parse', 'main'), mainBefore, 'the remote main is never touched');
  const up = git(remote, 'show', `${K}:02-DOCS/wiki/ftd/filtro.md`);
  assert.equal(field(up, 'status'), 'done');
  assert.equal(field(up, 'merged_by'), 'Lead');
  assert.match(nextOf(up), new RegExp(`Fusionado en main el .* \\(${merge.slice(0, 7)}\\)`));
  assert.match(git(remote, 'log', '-1', '--format=%s', K), /^📝 docs\(auto\): cierre FTD.*\[skip ci\]$/);

  // Idempotent: the hook again changes nothing on rsc/knowledge.
  const tip = git(remote, 'rev-parse', K);
  closeLanded(eric);
  assert.equal(git(remote, 'rev-parse', K), tip);

  // A teammate who opens a branch from the merged main gets the closed doc, not a clash.
  const bea = t.clone('bea', 'Bea');
  quiet(bea);
  git(bea, 'switch', '-q', '-c', 'feat/b');
  const said = message(bea);
  assert.doesNotMatch(said, /también has tocado/, said);
  assert.equal(field(read(bea, '02-DOCS/wiki/ftd/filtro.md'), 'status'), 'done');
  // …and so does the author of the doc, on her next branch.
  git(ana, 'switch', '-q', 'main'); git(ana, 'pull', '-q', '--no-rebase');
  git(ana, 'switch', '-q', '-c', 'feat/a2');
  message(ana);
  assert.equal(field(read(ana, '02-DOCS/wiki/ftd/filtro.md'), 'status'), 'done');
});

test('fc07 · closed main, a doc rsc/knowledge never had: the close still goes up, and reaches a teammate', () => {
  const t = team({ closed: true });
  const { eric, ana, remote } = t;
  quiet(eric); quiet(ana);
  // rsc/knowledge exists from before, born from a main that did not have the doc yet.
  write(ana, '02-DOCS/wiki/nota.md', 'nota\n');
  turn(ana);
  assert.ok(git(remote, 'rev-parse', '--verify', K), 'fixture: the exchange branch exists before the merge');
  const lead = t.clone('lead', 'Lead');
  git(lead, 'switch', '-q', '-c', 'feat/sin');
  write(lead, '02-DOCS/wiki/ftd/sin.md', doc('feat/sin', 'Lead'));
  git(lead, 'add', '-A'); git(lead, 'commit', '-q', '-m', '✨ feat: sin sync');
  git(lead, 'push', '-q', 'origin', 'feat/sin');
  mergePR(t, 'feat/sin');
  git(eric, 'pull', '-q', '--no-rebase');
  assert.deepEqual(closeLanded(eric).closed, ['02-DOCS/wiki/ftd/sin.md']);
  assert.equal(field(git(remote, 'show', `${K}:02-DOCS/wiki/ftd/sin.md`), 'status'), 'done');
  const bea = t.clone('bea', 'Bea');
  quiet(bea);
  git(bea, 'switch', '-q', '-c', 'feat/b');
  const said = message(bea);
  assert.doesNotMatch(said, /también has tocado/, said);
  assert.equal(field(read(bea, '02-DOCS/wiki/ftd/sin.md'), 'status'), 'done');
});

// ------------------------------------------------------------------ the trigger

test('fc08 · the post-merge hook rsc installs runs the close (end to end, real `git merge`)', () => {
  const { eric } = team();
  for (const f of ['knowledge-sync.mjs', 'trunk-policy.mjs', 'worktree-reaper.mjs']) {
    copyFileSync(join(HERE, '..', 'targets', f), join(eric, '.rsc', f));
  }
  assert.equal(installMergeHook(eric).installed, true);
  chmodSync(join(eric, '.git', 'hooks', 'post-merge'), 0o755);
  git(eric, 'switch', '-q', '-c', 'feat/hook');
  write(eric, '02-DOCS/wiki/ftd/hook.md', doc('feat/hook', 'Eric'));
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', '✨ feat: hook');
  git(eric, 'switch', '-q', 'main');
  git(eric, 'merge', '-q', '--no-ff', '--no-edit', 'feat/hook');
  assert.equal(field(read(eric, '02-DOCS/wiki/ftd/hook.md'), 'status'), 'done');
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📝 docs\(auto\): cierre FTD/);
  assert.equal(git(eric, 'log', '-1', '--format=%P').split(' ').length, 1, 'an ordinary commit, not a second merge');
  assert.equal(git(eric, 'status', '--porcelain'), '', 'index and files follow the commit');
  assert.equal(existsSync(join(eric, '.git', 'MERGE_HEAD')), false, 'and git finished its merge');
});
