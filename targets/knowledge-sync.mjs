#!/usr/bin/env node
// Knowledge sync: `01-TOOLS/`, `02-DOCS/wiki/` and `02-DOCS/attachments/` (never `01-TOOLS/_TEMPLATE/`
// nor the personal profile) stay the same on every machine of a team without anybody thinking about
// git. What you change goes up when your turn ends; what others change comes down before your next
// message — into a working branch, never into a default branch closed for the agent.
//
// It never touches the default branch (team-safe-default D: assume it is protected). Knowledge travels
// between people through one exchange branch on the remote, `rsc/knowledge`: up to it, down from it,
// into whatever branch each person is on. It reaches the default branch inside everybody's ordinary
// pull requests — every working branch already carries it, so whichever merges first takes it there,
// and the next one carries the same content and does not conflict.
//
// On by default, and that is a decision with a price, so the price is kept small on purpose:
//   - it only ever touches KNOWLEDGE paths, and never the personal profile;
//   - it never pushes a commit that is not its own — your unpushed code stays unpushed;
//   - every commit it puts on `rsc/knowledge` says `[skip ci]`, so a wiki edit does not trigger a
//     deploy (the local copy on your branch does not: see `commitLocal`);
//   - the first turn says it is on and how to turn it off (`rsc knowledge-sync off`, or
//     `.rsc/.no-knowledge-sync`, a PROJECT switch that travels in `.rsc.json`).
//
// Wired on its own (`knowledge-wiring.js`), on the same two lifecycle events the session memory uses —
// prompt and end of turn — but never inside the memory: the memory promises it makes no network
// request, and this exists to talk to `origin`. `rsc memory off` does not turn this off, and the other
// way round.
//
// Two speeds, because a hook should answer in seconds and a push may not:
//   - what touches YOUR FILES — committing your changes, applying somebody else's — is local, fast,
//     and runs inside the hook, while nobody else is editing;
//   - what touches THE NETWORK — fetch, push — runs detached, and never touches the working tree or
//     the index: the push is replayed on a throwaway index on top of `rsc/knowledge` (`commit-tree`),
//     which is also what lets it go up from whatever branch you are on without carrying that branch.
// The cost: somebody else's change reaches you one message late — unless the last fetch is old, and
// then one short foreground fetch comes first (`onRequest`).
//
// Standalone on purpose: hooks are materialized file by file under `.rsc/`, so this imports nothing
// but Node. Never throws into a hook; whatever goes wrong is said on the next message.
import { execFileSync, spawn } from 'node:child_process';
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultBranchName, trunkClosed } from './trunk-policy.mjs';

/** What syncs on its own. Everything else is ordinary git, decided by a person. */
export const KNOWLEDGE = Object.freeze(['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']);
/** One person's dials (`init`, `orient`): never anybody else's business. */
export const PERSONAL = Object.freeze(['02-DOCS/wiki/harness/user-profile.md']);
export const OPT_OUT = '.no-knowledge-sync';
export const SKIP_CI = '[skip ci]';
/** The exchange branch on the remote. Fixed, in every project (spec, clarify P7). */
export const KNOWLEDGE_BRANCH = 'rsc/knowledge';
/** The subject of what `applyIncoming` commits: content that came FROM the exchange branch. */
const SYNC_SUBJECT = `📥 docs(auto): sync desde ${KNOWLEDGE_BRANCH}`;

const STATE = 'knowledge-sync.json';
const LOCK = 'knowledge-sync.lock';
const FETCH_EVERY_MS = 60_000;
/** Older than this, the next message fetches in the foreground first (D4, team sim 2026-10-07). */
// 3 min, not 10: at 10 a teammate's merge three minutes old was missed and a duplicate 📥 commit of a
// doc main already had went into a feature branch (second team simulation). Offline cost: ≤3 s per 3 min.
const STALE_FETCH_MS = 3 * 60_000;
/** …but never waits longer than this for it: fail-open, the background fetch still follows. */
const FOREGROUND_FETCH_MS = 3_000;
const NET_TIMEOUT_MS = 30_000;
const LOCAL_TIMEOUT_MS = 4_000;
const LOCK_STALE_MS = 120_000;
const MAX_FILES = 200;
const KEEP_OURS = 200;

/**
 * rsc's own scaffolding, identical in every project: it arrives with rsc, not with a teammate. Sent up,
 * it turned the first turn of a fresh install into a "docs" commit of CREDENTIALS.md and
 * test_connection.sh on the working branch (E2E 2026-10-07). A team that customises the template
 * still commits it like any file; it just does not travel on its own.
 */
export const SCAFFOLD = Object.freeze(['01-TOOLS/_TEMPLATE/']);
export const isKnowledge = (path) => KNOWLEDGE.some((k) => path.startsWith(k)) && !PERSONAL.includes(path)
  && !SCAFFOLD.some((k) => path.startsWith(k));

// ------------------------------------------------------------------ git

function run(root, args, { timeout = LOCAL_TIMEOUT_MS, input, env } = {}) {
  try {
    const out = execFileSync('git', args, {
      windowsHide: true,
      cwd: root, encoding: 'utf8', timeout, input, maxBuffer: 16 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', ...env },
    });
    return { ok: true, status: 0, out, err: '' };
  } catch (e) {
    return { ok: false, status: e.status ?? -1, out: String(e.stdout || ''), err: String(e.stderr || e.message || '') };
  }
}

function git(root, args, opts) {
  const r = run(root, args, opts);
  if (!r.ok) throw new Error(`git ${args.find((a) => !a.startsWith('-'))}: ${r.err.trim().split('\n')[0]}`);
  return r.out;
}

const line = (root, args, opts) => { const r = run(root, args, opts); return r.ok ? r.out.trim() : null; };
const zlist = (out) => out.split('\0').filter(Boolean);

// One answer to "which is the default branch", shared with the guard: a copy without the local
// main/master fallback once let this module commit on a closed main the remote had not seen yet.
const defaultBranch = (root) => defaultBranchName(root);

function busy(root) {
  for (const p of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    const path = line(root, ['rev-parse', '--git-path', p]);
    if (path && existsSync(isAbsolute(path) ? path : join(root, path))) return true; // absolute in a linked worktree
  }
  return false;
}

const blob = (root, rev, path) => line(root, ['rev-parse', '--verify', '--quiet', `${rev}:${path}`]);
const worktreeBlob = (root, path) => (existsSync(join(root, path)) ? line(root, ['hash-object', '--', path]) : null);

// ------------------------------------------------------------------ state

function readState(root) {
  let s = {};
  try { s = JSON.parse(readFileSync(join(root, '.rsc', STATE), 'utf8')); } catch { /* first run */ }
  return { announced: false, seenBy: {}, waiting: {}, queue: [], ours: [], notices: [], clashes: [], lastFetch: 0, snap: null, head: null, ...s };
}

function writeState(root, s) {
  const dir = join(root, '.rsc');
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `${STATE}.tmp`);
  s.ours = s.ours.slice(-KEEP_OURS);
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, join(dir, STATE));
}

function note(s, msg) { if (!s.notices.includes(msg)) s.notices.push(msg); }

function acquire(root) {
  const path = join(root, '.rsc', LOCK);
  mkdirSync(join(root, '.rsc'), { recursive: true });
  try { if (Date.now() - statSync(path).mtimeMs > LOCK_STALE_MS) unlinkSync(path); } catch { /* none */ }
  try { closeSync(openSync(path, 'wx')); return true; } catch { return false; }
}

function release(root) { try { unlinkSync(join(root, '.rsc', LOCK)); } catch { /* gone */ } }

/**
 * Commits handed over without the lock (the post-merge close runs inside somebody's `git pull` and
 * must not wait for a push in flight): one SHA per line, taken into the queue by the next locked body.
 * Renamed before it is read, so a line appended meanwhile lands in a new file and is never lost.
 */
const PENDING = 'knowledge-sync.pending';
function absorbPending(root, s) {
  const path = join(root, '.rsc', PENDING);
  const taking = `${path}.taking`;
  try { renameSync(path, taking); } catch { return; }
  try {
    for (const sha of readFileSync(taking, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean)) {
      if (!s.queue.includes(sha)) s.queue.push(sha);
    }
  } catch { /* unreadable: nothing to take */ }
  try { unlinkSync(taking); } catch { /* gone */ }
}

/** The lock and the state live together: a body that runs without the lock never runs. */
function locked(root, body) {
  if (!acquire(root)) return null;
  const s = readState(root);
  absorbPending(root, s);
  try { return body(s); } finally { writeState(root, s); release(root); }
}

// ------------------------------------------------------------------ text

const clean = (text, limit = 60) => {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length <= limit ? t : `${t.slice(0, limit - 1)}…`;
};

function listed(paths, max = 5) {
  const shown = paths.slice(0, max).map((p) => clean(p)).join(', ');
  return paths.length > max ? `${shown} y ${paths.length - max} más` : shown;
}

/**
 * Who each file is from: the author of the newest commit that changed it, and «ti» when that commit is
 * one of ours or carries your own git email. One name for the whole list told Bruno his own doc was
 * Ana's (second team simulation).
 */
function byAuthor(root, files, touchedBy, ours) {
  const me = line(root, ['config', 'user.email']) || '';
  const groups = new Map();
  for (const f of files) {
    const last = touchedBy(f)[0]; // rev-list lists newest first
    let who = 'ti, desde otra rama';
    if (last && !ours.includes(last)) {
      const [name, email] = (line(root, ['log', '-1', '--format=%an%x09%ae', last]) || '').split('\t');
      if (name && (!me || email !== me)) who = clean(name, 30);
    }
    groups.set(who, [...(groups.get(who) || []), f]);
  }
  return [...groups].map(([who, list]) => `de ${who}: ${listed(list)}`).join('; ');
}

const authorsOf = (root, revs) => [...new Set(revs.flatMap((c) => {
  const a = line(root, ['log', '-1', '--format=%an', c]);
  return a ? [clean(a, 30)] : [];
}))].join(', ') || 'alguien';

// ------------------------------------------------------------------ enabled

/**
 * Why sync is not running here, or null when it is. A reason and not a boolean, so `status` can say
 * which of the quiet conditions applies instead of making the person guess.
 */
export function inactiveReason(root) {
  if (!existsSync(join(root, '.rsc.json'))) return 'no-harness';
  if (existsSync(join(root, '.rsc', OPT_OUT))) return 'opted-out';
  const top = line(root, ['rev-parse', '--show-toplevel']);
  if (!top) return 'not-a-repo';
  try { if (realpathSync(top) !== realpathSync(root)) return 'harness-not-at-repo-root'; } catch { return 'not-a-repo'; }
  if (!line(root, ['remote', 'get-url', 'origin'])) return 'no-origin';
  if (!KNOWLEDGE.some((k) => existsSync(join(root, k)))) return 'no-knowledge-folders';
  return null;
}

// ------------------------------------------------------------------ local: your changes

function changedKnowledge(root) {
  const present = KNOWLEDGE.filter((k) => existsSync(join(root, k)) || line(root, ['ls-files', '--', k]));
  if (!present.length) return [];
  const out = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...present]);
  const entries = zlist(out);
  const files = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    files.push(e.slice(3));
    if (e[0] === 'R' || e[0] === 'C') files.push(entries[++i]); // the old name of a rename follows
  }
  return [...new Set(files)].filter(isKnowledge);
}

// The subject of an auto-commit. Counted by FILE and named by full path: it used to dedupe by
// basename-without-extension, so eight files read as "… y 4 más" and `01-TOOLS/.gitignore` was
// indistinguishable from `01-TOOLS/_TEMPLATE/.gitignore`.
export function commitSummary(files) {
  const paths = [...new Set(files)].sort();
  if (paths.length <= 1) return paths.map((p) => clean(p, 80)).join('');
  const max = 3;
  const shown = paths.slice(0, max).map((p) => clean(p, 80)).join(', ');
  return `${paths.length} ficheros: ${shown}${paths.length > max ? ` y ${paths.length - max} más` : ''}`;
}
const summary = commitSummary;

/**
 * Commit your knowledge changes so they can go up. Local and fast; returns the new SHA or null.
 *
 * On a default branch that is closed for the agent (trunk-policy), nothing is committed there: the
 * commit is built on a throwaway index from HEAD plus the knowledge files and left on no branch. It
 * goes up like any other; the files stay modified until the agent commits on a branch (regla A).
 * Repeating it while they stay modified is a no-op upstream — the content is already there.
 */
/**
 * Work of the agent's own still uncommitted outside the knowledge folders. While there is, a docs
 * commit of ours on the branch would land AHEAD of the code it describes — field test 3.0.8: an FTD
 * update saying «Fix … probado» committed and pushed while the fix itself was still uncommitted. The
 * harness's own files (`.claude/`, `.rsc.json`) do not count: they may stay untracked for good.
 */
function workPending(root) {
  const entries = zlist(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const path = e.slice(3);
    if (e[0] === 'R' || e[0] === 'C') i++;
    if (KNOWLEDGE.some((k) => path.startsWith(k)) || PERSONAL.includes(path)) continue;
    if (/^(\.claude\/|\.rsc\/|\.rsc\.json$|\.worktrees\/)/.test(path)) continue;
    return true;
  }
  return false;
}

export function commitLocal(root, s) {
  const branch = line(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === 'HEAD') return null; // detached
  const files = changedKnowledge(root).slice(0, MAX_FILES);
  if (!files.length) return null;
  // No [skip ci] HERE: this commit lands on the working branch, often as its newest commit, and the
  // next ordinary push of that branch would skip CI on main (E2E 2026-10-07). Only the copy on the
  // exchange branch carries it (see `ship`).
  const message = (names) => `📝 docs(auto): ${summary(names)}`;
  // Closed trunk, or code of the agent's still uncommitted: no commit of ours on the branch. The
  // snapshot goes up the same way and the files stay modified, to be committed WITH that work.
  if ((branch === defaultBranch(root) && trunkClosed(root)) || workPending(root)) {
    const env = { GIT_INDEX_FILE: join(root, '.rsc', 'knowledge-sync.snap.index') };
    try {
      if (!run(root, ['read-tree', 'HEAD'], { env }).ok) return null;
      git(root, ['--literal-pathspecs', 'add', '-A', '--', ...files], { env });
      const tree = line(root, ['write-tree'], { env });
      // Chained to the previous snapshot while HEAD has not moved, so each one carries only what
      // changed since: the files stay modified on a closed trunk, and a snapshot against HEAD would
      // re-offer the first version every turn and read the second as a clash (review H1).
      const head = line(root, ['rev-parse', 'HEAD']);
      const prev = s.snap && s.snap.head === head && line(root, ['rev-parse', '--verify', '--quiet', `${s.snap.commit}^{commit}`]) ? s.snap.commit : head;
      if (!tree || tree === line(root, ['rev-parse', `${prev}^{tree}`])) return null;
      const sha = git(root, ['commit-tree', tree, '-p', prev, '-F', '-'], { input: message(files) }).trim();
      s.snap = { head, commit: sha };
      s.queue.push(sha);
      return sha;
    } finally {
      try { unlinkSync(env.GIT_INDEX_FILE); } catch { /* never created */ }
    }
  }
  git(root, ['--literal-pathspecs', 'add', '-A', '--', ...files]);
  const staged = zlist(git(root, ['--literal-pathspecs', 'diff', '--cached', '--name-only', '-z', '--', ...files]));
  if (!staged.length) return null;
  git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only', '-m', message(staged), '--', ...staged]);
  const sha = line(root, ['rev-parse', 'HEAD']);
  s.queue.push(sha);
  return sha;
}

/**
 * Knowledge the agent (or the person) committed on the branch since the last turn goes up too. Without
 * this only what was still uncommitted when the turn ended travelled, and an agent that commits its
 * feature document with its code in one long turn left nothing to send (E2E 2026-10-04). The first
 * time, and after a branch switch, it starts where the branch left the remote default branch.
 */
export function queueCommitted(root, s) {
  const branch = line(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || branch === 'HEAD') return;
  const head = line(root, ['rev-parse', 'HEAD']);
  const def = defaultBranch(root);
  const remoteDef = def && line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${def}`]);
  const valid = s.head && line(root, ['rev-parse', '--verify', '--quiet', `${s.head}^{commit}`])
    && run(root, ['merge-base', '--is-ancestor', s.head, head]).ok;
  const from = valid ? s.head : (remoteDef && line(root, ['merge-base', 'HEAD', remoteDef]));
  if (!head || !from || from === head) return;
  // Only what was made HERE (team sim 2026-10-07, D3). `git merge origin/main` on a feature branch
  // brings teammates' commits into `from..head`; walked whole, they were re-sent as ours, clashed with
  // their own newer version on rsc/knowledge, and the person was told «No he podido subir …» about a
  // file they never wrote. So: the branch's own line (`--first-parent`: a merge's second side is not
  // ours), nothing the remote default branch or the exchange branch already has (a rebase onto main
  // puts teammates' commits on the first-parent line too), and never a 📥 sync commit, whose content
  // came FROM rsc/knowledge. Not excluded: other remote branches — your own pushed feature branch
  // holds exactly the commits that must still go up.
  const not = [def && `refs/remotes/origin/${def}`, `refs/remotes/origin/${KNOWLEDGE_BRANCH}`]
    .filter((r) => line(root, ['rev-parse', '--verify', '--quiet', r])).map((r) => `^${r}`);
  const commits = git(root, ['rev-list', '--reverse', '--no-merges', '--first-parent', `${from}..${head}`, ...not, '--', ...KNOWLEDGE]).split('\n').filter(Boolean);
  for (const c of commits) {
    if (s.queue.includes(c) || s.ours.includes(c)) continue;
    if (line(root, ['log', '-1', '--format=%s', c]) === SYNC_SUBJECT) continue;
    s.queue.push(c);
  }
}

// ------------------------------------------------------------------ network: up

/**
 * The tree of `base` with the change of commit `sha` applied, or null if it does not apply cleanly.
 * A throwaway index under `.rsc/` and `git apply --cached`: the real index and the working tree are
 * never read or written, and it works on any git (`merge-tree --merge-base` needs 2.40).
 */
function replay(root, base, sha, ours = []) {
  if (!line(root, ['rev-parse', '--verify', '--quiet', `${sha}^`])) return null;
  // Only the knowledge paths: a commit of the agent's own on a branch also carries code, and code never
  // travels this way.
  const patch = run(root, ['diff-tree', '-p', '--binary', '--full-index', `${sha}^`, sha, '--', ...KNOWLEDGE], { timeout: NET_TIMEOUT_MS });
  if (!patch.ok) return null;
  if (!patch.out.trim()) return line(root, ['rev-parse', `${base}^{tree}`]);
  const env = { GIT_INDEX_FILE: join(root, '.rsc', 'knowledge-sync.index') };
  try {
    if (!run(root, ['read-tree', base], { env }).ok) return null;
    // File by file: one that is already there as it should be is skipped, not read as a clash (a
    // teammate's change taken uncommitted on a closed trunk comes back up in the next snapshot), and
    // one real clash does not hold back the rest of the patch's reasoning.
    const files = zlist(git(root, ['diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', `${sha}^`, sha, '--', ...KNOWLEDGE])).filter(isKnowledge);
    for (const f of files) {
      const next = blob(root, sha, f);
      const there = blob(root, base, f);
      if (next === there) continue;
      // What is there is what this change started from, or what we ourselves put there last: ours
      // to replace whole. (A snapshot from a closed trunk can start from HEAD, behind our own last
      // upload — after an upgrade, or once the chain is lost.)
      const last = line(root, ['log', '-1', '--format=%H', base, '--', f]);
      const from = blob(root, `${sha}^`, f);
      if (there === from || (last && ours.includes(last)) || behindDefault(root, base, f, there, from, last)) {
        const entry = next && line(root, ['ls-tree', sha, '--', f]);
        const ok = next
          ? run(root, ['update-index', '--add', '--cacheinfo', `${entry.split(' ')[0]},${next},${f}`], { env }).ok
          : run(root, ['update-index', '--force-remove', '--', f], { env }).ok;
        if (!ok) return null;
        continue;
      }
      const one = run(root, ['diff-tree', '-p', '--binary', '--full-index', '--no-renames', `${sha}^`, sha, '--', f], { timeout: NET_TIMEOUT_MS });
      if (!one.ok || !run(root, ['apply', '--cached', '-'], { env, input: one.out, timeout: NET_TIMEOUT_MS }).ok) return null;
    }
    return line(root, ['write-tree'], { env });
  } finally {
    try { unlinkSync(env.GIT_INDEX_FILE); } catch { /* never created */ }
  }
}

/**
 * The exchange branch holds this file only in a version the remote default branch has already gone
 * past — or never held it — and the change starts from the default branch's version: replacing it
 * whole is a fast-forward of the file, not a clash. rsc/knowledge is born from main and never merges
 * it back, so a document merged through a pull request it never carried, then closed on merge
 * (`closeLanded`), met it as a clash. A file the exchange branch once had and then lost is not this
 * case: somebody deleted it there, and that is not ours to undo.
 */
function behindDefault(root, base, f, there, from, last) {
  const def = defaultBranch(root);
  const remoteDef = def && line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${def}`]);
  if (!remoteDef || !from || blob(root, remoteDef, f) !== from) return false;
  if (!there) return !last;
  const revs = (line(root, ['rev-list', '-n', '50', remoteDef, '--', f]) || '').split('\n').filter(Boolean);
  return revs.some((c) => blob(root, c, f) === there);
}

const clashText = (files) => `No he podido subir ${listed(files)}: choca con un cambio que ya está en ${KNOWLEDGE_BRANCH}. ` +
  'Tu versión sigue aquí; hay que juntarlas a mano.';

/**
 * The notices, with every clash checked again first (D3). A clash is noted when the push runs and said
 * on a later message; in between the person may have taken the other version, or the two may have
 * converged. A file whose version here — in the working tree, or in the commit that clashed — is now
 * the one on rsc/knowledge is no clash any more, and a notice left with no files is not said.
 */
function openNotices(root, s) {
  const tip = line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${KNOWLEDGE_BRANCH}`]);
  const out = [];
  for (const text of s.notices) {
    const c = (s.clashes || []).find((x) => x.text === text);
    if (!c || !tip) { out.push(text); continue; }
    const open = c.files.filter((f) => {
      const there = blob(root, tip, f);
      return worktreeBlob(root, f) !== there && blob(root, c.sha, f) !== there;
    });
    if (open.length) out.push(open.length === c.files.length ? text : clashText(open));
  }
  return out;
}

/**
 * Put the queued commits on `rsc/knowledge`. Never the default branch; never the working tree or the
 * index. Each queued commit is replayed on top of the exchange branch (`replay`), which is how a
 * commit made on `feat/x` goes up without `feat/x`, and how your unpushed code never leaves the
 * machine. The exchange branch is born from the remote default branch the first time, and reborn the
 * same way if somebody deletes it.
 */
export function ship(root, s) {
  const def = defaultBranch(root);
  if (!def) return;
  const fetched = run(root, ['fetch', '--quiet', 'origin', def], { timeout: NET_TIMEOUT_MS });
  if (!fetched.ok) return; // offline: the queue goes up on a later turn
  if (!s.queue.length) return;
  const ref = `refs/remotes/origin/${KNOWLEDGE_BRANCH}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const k = run(root, ['fetch', '--quiet', 'origin', `+refs/heads/${KNOWLEDGE_BRANCH}:${ref}`], { timeout: NET_TIMEOUT_MS });
    if (!k.ok && !/couldn't find remote ref/i.test(k.err)) return;
    if (!k.ok) run(root, ['update-ref', '-d', ref]); // deleted upstream: reborn from the default branch
    const tip = line(root, ['rev-parse', '--verify', '--quiet', ref]) || line(root, ['rev-parse', `refs/remotes/origin/${def}`]);
    if (!tip) return;
    let base = tip;
    const built = [];
    const kept = [];
    for (const sha of s.queue) {
      if (!line(root, ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`])) continue; // rewritten away
      const tree = replay(root, base, sha, s.ours);
      if (tree === null) {
        const files = zlist(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', sha, '--', ...KNOWLEDGE])).filter(isKnowledge);
        const text = clashText(files);
        note(s, text);
        // Kept with what it is about, so it can be checked again before it is said (`openClashes`).
        if (!s.clashes.some((c) => c.text === text)) s.clashes.push({ text, sha, files });
        continue;
      }
      if (tree === line(root, ['rev-parse', `${base}^{tree}`])) { kept.push(sha); continue; } // already there
      const [name, email, date, ...rest] = git(root, ['log', '-1', '--format=%an%n%ae%n%aI%n%B', sha]).split('\n');
      // A commit of somebody's own (code + docs) goes up as its knowledge part, under a message that
      // says so and carries [skip ci]: its own message would describe code that is not there, and
      // would run CI on the exchange branch.
      const ownAuto = /^📝 docs\(auto\):/.test(rest[0] || '');
      const body = ownAuto ? [`${rest[0].replace(SKIP_CI, '').trim()} ${SKIP_CI}`, ...rest.slice(1)]
        : rest.join('\n').includes(SKIP_CI) ? rest : [
        `📝 docs(auto): ${summary(zlist(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', sha, '--', ...KNOWLEDGE])).filter(isKnowledge))} ${SKIP_CI}`,
        '', `Desde: ${rest[0] || sha.slice(0, 7)}`];
      base = git(root, ['commit-tree', tree, '-p', base, '-F', '-'], {
        input: body.join('\n'),
        env: { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date },
      }).trim();
      built.push(base);
    }
    if (base === tip && line(root, ['rev-parse', '--verify', '--quiet', ref])) { s.ours.push(...kept); s.queue = []; return; }
    const r = run(root, ['push', '--quiet', 'origin', `${base}:refs/heads/${KNOWLEDGE_BRANCH}`], { timeout: NET_TIMEOUT_MS });
    if (r.ok) {
      run(root, ['update-ref', ref, base]);
      s.ours.push(...built, ...kept);
      s.queue = [];
      return;
    }
    // Somebody pushed to the exchange branch in between: look again once, then say so.
  }
  note(s, `No he podido subir los cambios de conocimiento a ${KNOWLEDGE_BRANCH}. ` +
    'Siguen comiteados aquí; se reintenta en el próximo turno.');
}

// ------------------------------------------------------------------ local: their changes

/**
 * Apply what others put on `rsc/knowledge`, from the last fetch, into the branch you are on — except a
 * default branch closed for the agent, which is only told what is waiting (D1, below). Only knowledge paths are looked at: the exchange branch is born from the default
 * branch, so it also carries code, and code reaches you the ordinary way. Only files you have not
 * touched since; a clash is said, never forced. Never a fast-forward: that would move your local
 * default branch onto a commit the remote default branch does not have.
 */
export function applyIncoming(root, s) {
  const said = [];
  if (busy(root)) return said;
  const branch = line(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || branch === 'HEAD') return said;
  const tip = line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${KNOWLEDGE_BRANCH}`]);
  if (!tip) return said;
  // Per branch, not per repo: a branch opened from main after the last sync starts behind what
  // rsc/knowledge already has, and a single "last seen" made it look up to date (2026-10-06). A branch
  // seen for the first time catches up from where it left rsc/knowledge.
  s.seenBy = s.seenBy && typeof s.seenBy === 'object' ? s.seenBy : {};
  let seen = s.seenBy[branch];
  if (!seen || !line(root, ['rev-parse', '--verify', '--quiet', `${seen}^{commit}`])) {
    seen = line(root, ['merge-base', 'HEAD', tip]) || tip;
  }
  if (seen === tip) { s.seenBy[branch] = tip; return said; }
  const paths = [...KNOWLEDGE];
  const commits = git(root, ['rev-list', `${seen}..${tip}`, '--', ...paths]).split('\n').filter(Boolean);
  if (!commits.length) { s.seenBy[branch] = tip; return said; }

  const def = defaultBranch(root);
  const remoteDef = def && line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${def}`]);
  // Already on the remote default branch exactly as on rsc/knowledge (D3b): the branch gets it from
  // the ordinary merge of main. Brought in here it would only be a duplicate 📥 commit — and on a
  // default branch that is behind, it would turn the next fast-forward pull into a merge.
  //
  // What this does NOT remove (written down so nobody believes it does): a doc brought into a feature
  // branch while it was only on rsc/knowledge, and later merged into main in a DIFFERENT version
  // through another PR, still meets main's version add/add when that branch merges main. Avoiding it
  // means not bringing docs into branches at all, which is the whole point of the sync; usually the
  // newer version reaches the branch through rsc/knowledge first and the adds are identical (clean).
  const onDefault = (f, incoming) => incoming && remoteDef && blob(root, remoteDef, f) === incoming;
  const know = zlist(git(root, ['diff', '--name-only', '--no-renames', '-z', seen, tip, '--', ...paths]))
    .filter(isKnowledge).filter((f) => !onDefault(f, blob(root, tip, f))).slice(0, MAX_FILES);
  const closed = branch === def && trunkClosed(root);
  const touchedBy = (f) => git(root, ['rev-list', `${seen}..${tip}`, '--', f]).split('\n').filter(Boolean);
  const superseded = (f, mine) => touchedBy(f).some((c) => blob(root, c, f) === mine)
    || touchedBy(f).some((c) => (line(root, ['log', '-1', '--format=%B', c]) || '').includes(`${CLOSES} ${mine} ${f}`));

  // A default branch closed for the agent is left exactly as the remote has it (team sim 2026-10-07,
  // D1). Nothing can be committed there, and anything written uncommitted blocks the person's next
  // `git pull`: these same docs reach main inside merged PRs, and git refuses to merge over an
  // untracked file ("untracked working tree files would be overwritten") AND over a modified tracked
  // one, even when the contents are identical (checked by hand on git 2.4x). Writing only new files,
  // or only tracked ones, still leaves one of the two. So: say what is waiting, once per new tip, and
  // leave `seenBy` where it is — the first message on a branch opened from here catches up and
  // commits it there, where a merge of main meets it as an ordinary change.
  if (closed) {
    s.waiting = s.waiting && typeof s.waiting === 'object' ? s.waiting : {};
    if (s.waiting[branch] === tip) return said;
    s.waiting[branch] = tip;
    const pending = know.filter((f) => worktreeBlob(root, f) !== blob(root, tip, f));
    if (!pending.length) return said;
    said.push(`📥 Hay cambios de conocimiento en ${KNOWLEDGE_BRANCH} (${byAuthor(root, pending, touchedBy, s.ours)}). ` +
      `En ${branch} (cerrada) no los escribo, porque bloquearían tu próximo git pull: llegan con el pull ` +
      'cuando se fusionen, o a la rama que abras en su primer mensaje. ' +
      `Para leer uno ya: git show origin/${KNOWLEDGE_BRANCH}:<fichero>.`);
    return said;
  }

  const take = [];
  const clash = [];
  for (const f of know) {
    const incoming = blob(root, tip, f);
    const mine = worktreeBlob(root, f);
    if (mine === incoming) continue;
    const base = blob(root, seen, f);
    const committed = blob(root, 'HEAD', f);
    if (mine === base && committed === base) take.push(f);
    // Untouched here, and a version the exchange branch itself went past — it passed through it, or a
    // close on merge says it replaces it (`CLOSES`). The branch has the merged document as main has it;
    // the close is its newer version, not somebody else's competing edit (field test 3.0.8).
    else if (mine && mine === committed && superseded(f, mine)) take.push(f);
    // Touched here and changed only by your own uploads: your newer version, not a clash.
    else if (touchedBy(f).some((c) => !s.ours.includes(c))) clash.push(f);
  }

  if (take.length) {
    const gone = take.filter((f) => !blob(root, tip, f));
    const present = take.filter((f) => blob(root, tip, f));
    if (present.length) git(root, ['--literal-pathspecs', 'checkout', tip, '--', ...present]);
    if (gone.length) git(root, ['--literal-pathspecs', 'rm', '--quiet', '--', ...gone]);
    git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only', '-m', SYNC_SUBJECT, '--', ...take]);
    said.push(`📥 Traídos ${take.length} fichero(s) de conocimiento (${byAuthor(root, take, touchedBy, s.ours)}).`);
  }
  if (clash.length) {
    const who = authorsOf(root, [...new Set(clash.flatMap(touchedBy))].filter((c) => !s.ours.includes(c)));
    said.push(`${who} cambió ${listed(clash)}, que tú también has tocado. No lo traigo solo: tu versión sigue intacta.`);
  }
  s.seenBy[branch] = tip;
  return said;
}

// ------------------------------------------------------------------ close on merge (FTD)

// Field test 3.0.8: a feature document written on a feature branch kept saying «pendiente: abrir PR»
// after its pull request was merged, and carried no author — «¿qué ha hecho cada uno?» got every
// feature reported as pending and nobody's name, and the session memory kept injecting the stale Next.
// So the close is not left to the agent remembering: when a branch LANDS on the default branch (the
// post-merge hook, `worktree-reaper.mjs`), the feature documents that branch wrote are marked done.
//
// Where the edit goes is the whole design. Open default branch: a local `📝 docs(auto)` commit, like
// any other doc commit there. Closed default branch: never on main — neither the agent nor rsc commits
// there — so it is built on a throwaway index and handed to `ship`, which replays it onto rsc/knowledge
// like any knowledge change. The team gets it from there, and it reaches main inside the next PR that
// carries docs. The checkout is not touched, so the closed main stays clean and the next pull works.

export const FTD_CLOSE_OPT_OUT = '.no-ftd-close';
const CLOSE_SUBJECT = '📝 docs(auto): cierre FTD';
/** Trailer of a close: `Cierra: <blob it replaces> <path>`, so a teammate's branch takes it (applyIncoming). */
const CLOSES = 'Cierra:';
const isFtdDoc = (p) => /^02-DOCS\/wiki\/ftd\/[^/]+\.md$/.test(p);
const MAX_BRANCHES = 50;

function splitFrontmatter(text) {
  const t = String(text).replace(/\r\n/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  return m ? { lines: m[1].split('\n'), body: t.slice(m[0].length) } : { lines: null, body: t };
}

function fmValue(lines, key) {
  for (const l of lines || []) {
    const m = l.match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/);
    if (m && m[1] === key) return m[2].trim();
  }
  return null;
}

/** The frontmatter of a feature document as plain fields (`author`, `branch`, `status`, …). */
export function frontmatter(text) {
  const { lines } = splitFrontmatter(text);
  const out = {};
  for (const l of lines || []) {
    const m = l.match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const isDoneText = (text) => /^done$/i.test(frontmatter(text).status || '');

/**
 * The closed version of a feature document, or null when it is already done (idempotent). Sets
 * `status: done`, `merged`, and `merged_by`/`pr` when known; fills `author`/`branch` only when missing;
 * replaces the Next section with one line saying where and when it landed. Nothing else is rewritten:
 * the evidence is the record.
 */
export function closeDoc(text, { trunk, date, sha, author, branch, mergedBy, pr } = {}) {
  const { lines, body } = splitFrontmatter(text);
  const fm = lines ? [...lines] : [];
  if (/^done$/i.test(fmValue(fm, 'status') || '')) return null;
  const set = (key, value, onlyIfMissing = false) => {
    if (value == null || value === '') return;
    const i = fm.findIndex((l) => l.startsWith(`${key}:`));
    if (i < 0) fm.push(`${key}: ${value}`);
    else if (!onlyIfMissing || !fmValue([fm[i]], key)) fm[i] = `${key}: ${value}`;
  };
  set('author', author, true);
  set('branch', branch, true);
  set('status', 'done');
  set('merged', date);
  set('merged_by', mergedBy);
  set('pr', pr ? `#${String(pr).replace(/^#/, '')}` : null);
  const landed = `Fusionado en ${trunk} el ${date} (${sha}).`;
  const next = /^(##[ \t]*(?:Next|Siguiente|Próximo)[^\n]*\n)([\s\S]*?)(?=^##\s|(?![\s\S]))/mu;
  const rest = next.test(body)
    ? body.replace(next, (_, heading) => `${heading}${landed}\n\n`)
    : `${body.replace(/\n*$/, '\n')}\n## Next\n${landed}\n`;
  return `---\n${fm.join('\n')}\n---\n${lines ? '' : '\n'}${rest.replace(/\n+$/, '\n')}`;
}

const isAncestor = (root, a, b) => run(root, ['merge-base', '--is-ancestor', a, b]).ok;

/** Would merging `tip` into `into` change nothing? (squash/rebase merges rewrite identities.) */
function contains(root, into, tip) {
  const merged = run(root, ['merge-tree', '--write-tree', into, tip]);
  return merged.ok && merged.out.split('\n')[0].trim() === line(root, ['rev-parse', `${into}^{tree}`]);
}

/**
 * The branches that landed between `orig` and `head`: in head and not before, by identity (merge,
 * fast-forward) or by content (squash, rebase). Local branches and the remote-tracking ones, the most
 * recent first and bounded — this runs inside somebody's `git pull`.
 */
function landedBranches(root, orig, head, def) {
  const refs = (line(root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']) || '')
    .split('\n').filter(Boolean).slice(0, MAX_BRANCHES * 2);
  const out = [];
  const seen = new Set();
  for (const ref of refs) {
    const name = ref.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/origin\//, '');
    if (!name || name === 'HEAD' || name === def || name === KNOWLEDGE_BRANCH || seen.has(name)) continue;
    const tip = line(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (!tip || isAncestor(root, tip, orig)) continue; // in before, or nothing of its own
    if (isAncestor(root, tip, head) || (contains(root, head, tip) && !contains(root, orig, tip))) {
      seen.add(name);
      out.push({ name, tip });
    }
    if (out.length >= MAX_BRANCHES) break;
  }
  return out;
}

/** Where and how a branch landed: the first commit of the default branch's own line that has it. */
function landingOf(root, orig, head, tip) {
  const line1 = (line(root, ['rev-list', '--first-parent', '--reverse', `${orig}..${head}`]) || '').split('\n').filter(Boolean).slice(0, 20);
  const at = line1.find((c) => isAncestor(root, tip, c)) || line1.find((c) => contains(root, c, tip)) || head;
  const [parents = '', committer = '', date = '', subject = ''] = (line(root, ['log', '-1', '--format=%P%x00%cn%x00%cs%x00%s', at]) || '').split('\0');
  const pr = subject.match(/Merge pull request #(\d+)/)?.[1] || subject.match(/\(#(\d+)\)\s*$/)?.[1] || null;
  let mergedBy = null;
  if (parents.trim().split(/\s+/).length > 1 || pr) mergedBy = committer && committer !== 'GitHub' ? committer : null;
  else if (/^merge /.test(line(root, ['reflog', '-1', '--format=%gs', 'HEAD']) || '')) mergedBy = line(root, ['config', 'user.name']);
  return { sha: line(root, ['rev-parse', '--short', at]) || at.slice(0, 7), date: date || new Date().toISOString().slice(0, 10), mergedBy, pr };
}

/**
 * The documents a landed branch wrote, closed. A document says whose it is with `branch:`; one of
 * another branch — brought along by a 📥 sync — is not this branch's to close. A document with no
 * frontmatter (written before it existed) counts when a commit of the branch's own, not a sync,
 * touched it; its author is then the git author of the commit that created it.
 */
function closuresFor(root, orig, head, def, read) {
  const out = new Map();
  for (const { name, tip } of landedBranches(root, orig, head, def)) {
    const base = line(root, ['merge-base', orig, tip]);
    if (!base) continue;
    const files = zlist(run(root, ['diff', '--name-only', '--no-renames', '-z', base, tip, '--', '02-DOCS/wiki/ftd/']).out)
      .filter(isFtdDoc).filter((f) => !out.has(f) && blob(root, head, f));
    if (!files.length) continue;
    let landing = null;
    for (const f of files) {
      const text = read(f);
      if (text == null || isDoneText(text)) continue;
      const owner = frontmatter(text).branch;
      if (owner && owner !== name) continue;
      if (!owner) {
        const own = (line(root, ['log', '--no-merges', '--format=%s', `${base}..${tip}`, '--', f]) || '').split('\n').filter(Boolean);
        if (!own.some((s) => s !== SYNC_SUBJECT)) continue;
      }
      landing ||= landingOf(root, orig, head, tip);
      const created = (line(root, ['log', '--diff-filter=A', '--format=%an', tip, '--', f]) || '').split('\n').filter(Boolean).pop();
      const closed = closeDoc(text, { trunk: def, ...landing, author: created, branch: name });
      if (closed) out.set(f, closed);
    }
  }
  return out;
}

/**
 * The post-merge entry point: close what just landed. Returns `{ closed, via }` — via `local` (open
 * default branch, committed here) or `knowledge` (closed default branch, queued for rsc/knowledge).
 * Never throws: it runs inside git, mid-pull, and a failed close must never become a failed merge.
 */
export function closeLanded(root, { spawnShip = true } = {}) {
  const res = { closed: [], via: null };
  try {
    if (existsSync(join(root, '.rsc', FTD_CLOSE_OPT_OUT)) || !existsSync(join(root, '.rsc.json'))) return res;
    // Not `busy()`: git runs post-merge with MERGE_HEAD still on disk, so that check refused every
    // landing (found end to end, through the real hook). A rebase or a pick in progress is no landing.
    for (const p of ['rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
      const path = line(root, ['rev-parse', '--git-path', p]);
      if (path && existsSync(isAbsolute(path) ? path : join(root, path))) return res;
    }
    const def = defaultBranch(root);
    const branch = line(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!def || branch !== def) return res; // a landing is a landing on the default branch
    const head = line(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
    const orig = line(root, ['rev-parse', '--verify', '--quiet', 'ORIG_HEAD^{commit}']);
    if (!head || !orig || orig === head || !isAncestor(root, orig, head)) return res;
    const open = !trunkClosed(root);
    if (!open && inactiveReason(root)) return res; // closed and no rsc/knowledge: nowhere to write

    let read;
    if (open) {
      // The checkout's own copy, and only when nobody is editing it.
      read = (f) => (worktreeBlob(root, f) === blob(root, 'HEAD', f) ? readFileSync(join(root, f), 'utf8') : null);
    } else {
      // Already closed on rsc/knowledge, or waiting in the queue to go there: not again.
      const s = readState(root);
      let pending = [];
      try { pending = readFileSync(join(root, '.rsc', PENDING), 'utf8').split('\n').filter(Boolean); } catch { /* none */ }
      const elsewhere = [`refs/remotes/origin/${KNOWLEDGE_BRANCH}`, ...s.queue, ...pending];
      const closedElsewhere = (f) => elsewhere.some((rev) => {
        const b = blob(root, rev, f);
        return b && isDoneText(git(root, ['cat-file', 'blob', b]));
      });
      read = (f) => (closedElsewhere(f) ? null : git(root, ['show', `HEAD:${f}`]));
    }
    const docs = closuresFor(root, orig, head, def, read);
    if (!docs.size) return res;
    const files = [...docs.keys()];

    // One commit on top of HEAD, built on a throwaway index: plumbing, because git runs this hook
    // with the merge state still present and refuses a porcelain commit then.
    const env = { GIT_INDEX_FILE: join(root, '.rsc', 'knowledge-sync.close.index') };
    let sha;
    try {
      mkdirSync(join(root, '.rsc'), { recursive: true });
      git(root, ['read-tree', 'HEAD'], { env });
      const trailers = [];
      for (const [f, text] of docs) {
        const b = git(root, ['hash-object', '-w', '--stdin'], { input: text }).trim();
        const mode = (line(root, ['ls-tree', 'HEAD', '--', f]) || '100644').split(' ')[0];
        git(root, ['update-index', '--cacheinfo', `${mode},${b},${f}`], { env });
        trailers.push(`${CLOSES} ${blob(root, 'HEAD', f)} ${f}`);
      }
      const tree = line(root, ['write-tree'], { env });
      sha = git(root, ['commit-tree', tree, '-p', head, '-F', '-'], { input: `${CLOSE_SUBJECT}: ${summary(files)}\n\n${trailers.join('\n')}\n` }).trim();
    } finally {
      try { unlinkSync(env.GIT_INDEX_FILE); } catch { /* never created */ }
    }

    if (open) {
      // Open: it lands here like any docs(auto) commit — HEAD moves only if nobody moved it meanwhile,
      // then the index and the files follow, for these paths only.
      git(root, ['update-ref', '-m', `rsc: ${CLOSE_SUBJECT}`, 'HEAD', sha, head]);
      for (const [f, text] of docs) writeFileSync(join(root, f), text);
      git(root, ['--literal-pathspecs', 'update-index', '--', ...files]);
      return { closed: files, via: 'local' };
    }
    // Closed: nothing here. Handed to `ship` without the lock, so a push in flight never makes the
    // pull wait (`absorbPending`); it goes up to rsc/knowledge and reaches main in the next PR.
    appendFileSync(join(root, '.rsc', PENDING), `${sha}\n`);
    if (spawnShip) background(root, 'ship');
    return { closed: files, via: 'knowledge' };
  } catch {
    return res;
  }
}

// ------------------------------------------------------------------ hook entry points

// `RSC_KNOWLEDGE_SYNC_FOREGROUND=1` runs the network half inline: for tests, which would otherwise race
// a detached process for the lock, and for anybody debugging what the background did.
/**
 * Which program runs the detached worker. Not always `process.execPath`: OpenCode loads plugins in its
 * own Bun-based binary, so there `execPath` is `opencode` — which does not run scripts — and the push
 * silently never happened (found end to end, not by the unit tests). Anything that is not Node gets
 * `node` from the PATH, which every assistant here already needs to run the hooks.
 */
export function workerRuntime(execPath = process.execPath, versions = process.versions) {
  return !versions.bun && /^node(?:\.exe)?$/i.test(execPath.split(/[\\/]/).pop()) ? execPath : 'node';
}

function background(root, op) {
  if (process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND === '1') return work(root, op);
  try {
    const self = fileURLToPath(import.meta.url);
    spawn(workerRuntime(), [self, op, root], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* the next turn tries again */ }
}

/** Refresh what comes down: the exchange branch, and the default branch it is compared against (D3b). */
function fetchDown(root, timeout) {
  const def = defaultBranch(root);
  const refspecs = [`+refs/heads/${KNOWLEDGE_BRANCH}:refs/remotes/origin/${KNOWLEDGE_BRANCH}`,
    ...(def ? [`+refs/heads/${def}:refs/remotes/origin/${def}`] : [])];
  // One round trip; absent upstream (no exchange branch yet) fails it, so the default goes alone.
  if (run(root, ['fetch', '--quiet', 'origin', ...refspecs], { timeout }).ok) return true;
  if (def) run(root, ['fetch', '--quiet', 'origin', refspecs[1]], { timeout });
  return false;
}

const ANNOUNCE = '🔄 La sincronización del conocimiento está activa: lo que cambies en 01-TOOLS/, 02-DOCS/wiki/ ' +
  `y 02-DOCS/attachments/ viaja a tu equipo por la rama ${KNOWLEDGE_BRANCH} (nunca a la principal; allí con ` +
  '[skip ci]) y lo de los demás te llega a tu rama de trabajo. Llega a la principal dentro de vuestras PRs. ' +
  'Para apagarla en este proyecto: `rsc knowledge-sync off`.';

/** UserPromptSubmit: apply what was fetched, say what happened, fetch again in the background. */
export function onRequest(root, { spawnFetch = true } = {}) {
  try {
    if (inactiveReason(root)) return '';
    let fetchDue = false;
    // The background fetch lands AFTER the message that started it, so what comes down is one message
    // late; a session of one message saw nothing (D4). When the last fetch is old, one bounded fetch
    // first — outside the lock, fail-open. Otherwise no network here, so a turn stays cheap.
    const fresh = Date.now() - readState(root).lastFetch > STALE_FETCH_MS
      && fetchDown(root, FOREGROUND_FETCH_MS);
    const said = locked(root, (s) => {
      const out = [];
      if (fresh) s.lastFetch = Date.now();
      if (!s.announced) { out.push(ANNOUNCE); s.announced = true; }
      try { out.push(...applyIncoming(root, s)); } catch (e) { out.push(`La sincronización del conocimiento falló al traer cambios: ${clean(e.message, 160)}`); }
      try { out.push(...openNotices(root, s)); } catch { out.push(...s.notices); }
      s.notices = [];
      s.clashes = [];
      if (Date.now() - s.lastFetch > FETCH_EVERY_MS) { s.lastFetch = Date.now(); fetchDue = true; }
      return out;
    });
    if (fetchDue && spawnFetch) background(root, 'fetch'); // after the lock is released, or it would find it taken
    return (said || []).join('\n');
  } catch {
    return '';
  }
}

/** Stop: commit your knowledge changes here, then push them in the background. */
export function onTurn(root, { spawnShip = true } = {}) {
  try {
    if (inactiveReason(root) || busy(root)) return;
    const pending = locked(root, (s) => {
      try { queueCommitted(root, s); } catch { /* the next turn looks again */ }
      try { commitLocal(root, s); } catch (e) { note(s, `La sincronización del conocimiento no pudo comitear: ${clean(e.message, 160)}`); }
      s.head = line(root, ['rev-parse', '--verify', '--quiet', 'HEAD']) || s.head;
      return s.queue.length;
    });
    if (pending && spawnShip) background(root, 'ship');
  } catch { /* a hook never takes the turn down */ }
}

/** For `rsc knowledge-sync status`. */
export function knowledgeStatus(root) {
  const reason = inactiveReason(root);
  const s = readState(root);
  return {
    active: !reason,
    reason,
    branch: line(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    defaultBranch: defaultBranch(root),
    exchangeBranch: KNOWLEDGE_BRANCH,
    queued: s.queue.length,
    pendingNotices: s.notices.length,
    lastFetch: s.lastFetch ? new Date(s.lastFetch).toISOString() : null,
    paths: [...KNOWLEDGE],
    neverSynced: [...PERSONAL],
  };
}

// ------------------------------------------------------------------ detached worker

function isMainModule(metaUrl) {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const self = fileURLToPath(metaUrl);
  try { return realpathSync(self) === realpathSync(invoked); } catch { return self === invoked; }
}

/** What the detached process does: `ship` pushes the queue, `fetch` refreshes and retries the queue. */
export function work(root, op) {
  if (!root || inactiveReason(root)) return;
  locked(root, (s) => {
    try {
      if (op === 'ship') ship(root, s);
      else if (op === 'fetch') {
        // What comes down comes from the exchange branch; absent upstream is not an error.
        fetchDown(root, NET_TIMEOUT_MS);
        if (s.queue.length) ship(root, s);
      }
    } catch (e) {
      note(s, `La sincronización del conocimiento falló: ${clean(e.message, 160)}`);
    }
  });
}

// ------------------------------------------------------------------ the hook

/** The project is the nearest ancestor holding `.rsc.json`, as for the session memory. */
function nearestHarness(dir) {
  for (let current = dir; ; current = dirname(current)) {
    if (existsSync(join(current, '.rsc.json'))) return current;
    if (dirname(current) === current) return dir;
  }
}

const isRemote = (target, native) => (target === 'cursor' && (native?.is_background_agent === true || native?.isBackgroundAgent === true))
  || process.env.RSC_REMOTE_AGENT === '1' || process.env.CURSOR_CLOUD_AGENT === '1' || process.env.CODEX_CLOUD_AGENT === '1';

/**
 * One lifecycle event from an assistant. `request` = the person sent a message; `turn` = the agent
 * finished. What is said goes to the PERSON (`systemMessage`, which every event accepts; Cursor's
 * `user_message`), never into the model's context.
 */
export function hook(target, event, native = {}) {
  try {
    if (isRemote(target, native)) return {};
    const root = nearestHarness(resolve(native.cwd || process.env.RSC_PROJECT_CWD || process.cwd()));
    if (event === 'request') {
      const said = onRequest(root);
      if (!said) return {};
      if (target === 'cursor') return { user_message: said };
      // The person sees it (`systemMessage`), and now the model knows it too: shown only to the person,
      // a «📥 llegó un cambio» was news the agent could not explain when asked «¿qué cambió?» a turn
      // later (field test 3.0.4). Same text, so what they each know is the same thing.
      const context = { hookEventName: target === 'gemini' ? 'BeforeAgent' : 'UserPromptSubmit', additionalContext: `rsc knowledge-sync (already shown to the person):\n${said}` };
      // DeepSeek Harness drops systemMessage and rsc's bridge turns it into context: one copy is enough.
      if (target === 'deepseek') return { hookSpecificOutput: { ...context, additionalContext: `rsc knowledge-sync — tell the person in one line:\n${said}` } };
      return { systemMessage: said, hookSpecificOutput: context };
    }
    // `stop_hook_active`: this turn exists because a stop hook asked for it. Nothing new to commit.
    if (event === 'turn' && !native?.stop_hook_active) onTurn(root);
  } catch { /* a hook never takes the turn down */ }
  return {};
}

function stdinJson() {
  try { const raw = readFileSync(0, 'utf8'); return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; }
}

if (isMainModule(import.meta.url)) {
  const [op, a, b] = process.argv.slice(2);
  if (op === 'hook') process.stdout.write(`${JSON.stringify(hook(a, b, stdinJson()))}\n`);
  else if (op === 'close') { // the post-merge hook: `close <root>`
    const r = closeLanded(resolve(a || process.cwd()));
    for (const f of r.closed) process.stdout.write(`rsc: FTD cerrado ${f}${r.via === 'knowledge' ? ` (vía ${KNOWLEDGE_BRANCH})` : ''}\n`);
  } else work(a, op); // detached: `ship <root>` or `fetch <root>`
}
