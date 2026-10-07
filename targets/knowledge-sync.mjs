#!/usr/bin/env node
// Knowledge sync: `01-TOOLS/` and `02-DOCS/` stay the same on every machine of a team without anybody
// thinking about git. What you change goes up when your turn ends; what others change comes down
// before your next message.
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
//   - every commit it makes says `[skip ci]`, so a wiki edit does not trigger a deploy;
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
// The cost: somebody else's change reaches you one message late.
//
// Standalone on purpose: hooks are materialized file by file under `.rsc/`, so this imports nothing
// but Node. Never throws into a hook; whatever goes wrong is said on the next message.
import { execFileSync, spawn } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync,
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

const STATE = 'knowledge-sync.json';
const LOCK = 'knowledge-sync.lock';
const FETCH_EVERY_MS = 60_000;
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
  return { announced: false, seenBy: {}, queue: [], ours: [], notices: [], lastFetch: 0, snap: null, head: null, ...s };
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

/** The lock and the state live together: a body that runs without the lock never runs. */
function locked(root, body) {
  if (!acquire(root)) return null;
  const s = readState(root);
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
  const commits = git(root, ['rev-list', '--reverse', '--no-merges', `${from}..${head}`, '--', ...KNOWLEDGE]).split('\n').filter(Boolean);
  for (const c of commits) if (!s.queue.includes(c) && !s.ours.includes(c)) s.queue.push(c);
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
      if (there === blob(root, `${sha}^`, f) || (last && ours.includes(last))) {
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
        note(s, `No he podido subir ${listed(files)}: choca con un cambio que ya está en ${KNOWLEDGE_BRANCH}. ` +
          'Tu versión sigue aquí; hay que juntarlas a mano.');
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
 * Apply what others put on `rsc/knowledge`, from the last fetch — no network here — into whatever
 * branch you are on. Only knowledge paths are looked at: the exchange branch is born from the default
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

  const know = zlist(git(root, ['diff', '--name-only', '--no-renames', '-z', seen, tip, '--', ...paths]))
    .filter(isKnowledge).slice(0, MAX_FILES);
  const closed = branch === defaultBranch(root) && trunkClosed(root);
  const touchedBy = (f) => git(root, ['rev-list', `${seen}..${tip}`, '--', f]).split('\n').filter(Boolean);
  const take = [];
  const clash = [];
  for (const f of know) {
    const incoming = blob(root, tip, f);
    const mine = worktreeBlob(root, f);
    if (mine === incoming) continue;
    const base = blob(root, seen, f);
    // On a closed trunk HEAD lags behind on purpose (what came in was not committed), so only the
    // working tree says whether you touched it (review H2).
    if (mine === base && (closed || blob(root, 'HEAD', f) === base)) take.push(f);
    // Touched here and changed only by your own uploads: your newer version, not a clash.
    else if (touchedBy(f).some((c) => !s.ours.includes(c))) clash.push(f);
  }

  if (take.length) {
    const gone = take.filter((f) => !blob(root, tip, f));
    const present = take.filter((f) => blob(root, tip, f));
    if (present.length) git(root, ['--literal-pathspecs', 'checkout', tip, '--', ...present]);
    if (gone.length) git(root, ['--literal-pathspecs', 'rm', '--quiet', '--', ...gone]);
    // On a default branch closed for the agent nothing is committed there: the files are updated
    // and travel into the next branch the agent opens (regla A).
    if (!closed) {
      git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only',
        '-m', `📥 docs(auto): sync desde ${KNOWLEDGE_BRANCH}`, '--', ...take]);
    } else {
      git(root, ['--literal-pathspecs', 'reset', '--quiet', '--', ...take]); // updated, not staged
    }
    const from = [...new Set(take.flatMap(touchedBy))];
    const theirs = from.filter((c) => !s.ours.includes(c));
    const who = theirs.length ? authorsOf(root, theirs) : 'ti, desde otra rama';
    said.push(`📥 Traídos ${from.length} cambio(s) de conocimiento de ${who}: ${listed(take)}.`);
  }
  if (clash.length) {
    const who = authorsOf(root, [...new Set(clash.flatMap(touchedBy))].filter((c) => !s.ours.includes(c)));
    said.push(`${who} cambió ${listed(clash)}, que tú también has tocado. No lo traigo solo: tu versión sigue intacta.`);
  }
  s.seenBy[branch] = tip;
  return said;
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

const ANNOUNCE = '🔄 La sincronización del conocimiento está activa: lo que cambies en 01-TOOLS/ y 02-DOCS/ ' +
  `viaja a tu equipo por la rama ${KNOWLEDGE_BRANCH} (nunca a la principal, con [skip ci]) y lo de los demás ` +
  'te llega a la rama en la que estés. Llega a la principal dentro de vuestras PRs. Para apagarla en este ' +
  'proyecto: `rsc knowledge-sync off`.';

/** UserPromptSubmit: apply what was fetched, say what happened, fetch again in the background. */
export function onRequest(root, { spawnFetch = true } = {}) {
  try {
    if (inactiveReason(root)) return '';
    let fetchDue = false;
    const said = locked(root, (s) => {
      const out = [];
      if (!s.announced) { out.push(ANNOUNCE); s.announced = true; }
      try { out.push(...applyIncoming(root, s)); } catch (e) { out.push(`La sincronización del conocimiento falló al traer cambios: ${clean(e.message, 160)}`); }
      out.push(...s.notices);
      s.notices = [];
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
        run(root, ['fetch', '--quiet', 'origin', `+refs/heads/${KNOWLEDGE_BRANCH}:refs/remotes/origin/${KNOWLEDGE_BRANCH}`],
          { timeout: NET_TIMEOUT_MS });
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
  else work(a, op); // detached: `ship <root>` or `fetch <root>`
}
