#!/usr/bin/env node
// Knowledge sync: `01-TOOLS/` and `02-DOCS/` stay the same on every machine of a team without anybody
// thinking about git. What you change goes up when your turn ends; what others change comes down
// before your next message.
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
//     the index: the push is replayed on a throwaway index on top of the remote branch (`commit-tree`),
//     which is also what lets it reach the default branch from whatever branch you are on.
// The cost: somebody else's change reaches you one message late.
//
// Standalone on purpose: hooks are materialized file by file under `.rsc/`, so this imports nothing
// but Node. Never throws into a hook; whatever goes wrong is said on the next message.
import { execFileSync, spawn } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What syncs on its own. Everything else is ordinary git, decided by a person. */
export const KNOWLEDGE = Object.freeze(['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']);
/** One person's dials (`init`, `orient`): never anybody else's business. */
export const PERSONAL = Object.freeze(['02-DOCS/wiki/harness/user-profile.md']);
export const OPT_OUT = '.no-knowledge-sync';
export const SKIP_CI = '[skip ci]';

const STATE = 'knowledge-sync.json';
const LOCK = 'knowledge-sync.lock';
const FETCH_EVERY_MS = 60_000;
const NET_TIMEOUT_MS = 30_000;
const LOCAL_TIMEOUT_MS = 4_000;
const LOCK_STALE_MS = 120_000;
const MAX_FILES = 200;
const KEEP_OURS = 200;

export const isKnowledge = (path) => KNOWLEDGE.some((k) => path.startsWith(k)) && !PERSONAL.includes(path);

// ------------------------------------------------------------------ git

function run(root, args, { timeout = LOCAL_TIMEOUT_MS, input, env } = {}) {
  try {
    const out = execFileSync('git', args, {
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

function defaultBranch(root) {
  const head = line(root, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace(/^refs\/remotes\/origin\//, '');
  for (const b of ['main', 'master']) if (line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${b}`])) return b;
  return null;
}

function busy(root) {
  for (const p of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    const path = line(root, ['rev-parse', '--git-path', p]);
    if (path && existsSync(join(root, path))) return true;
  }
  return false;
}

const isAncestor = (root, a, b) => run(root, ['merge-base', '--is-ancestor', a, b]).ok;
const blob = (root, rev, path) => line(root, ['rev-parse', '--verify', '--quiet', `${rev}:${path}`]);
const worktreeBlob = (root, path) => (existsSync(join(root, path)) ? line(root, ['hash-object', '--', path]) : null);

// ------------------------------------------------------------------ state

function readState(root) {
  let s = {};
  try { s = JSON.parse(readFileSync(join(root, '.rsc', STATE), 'utf8')); } catch { /* first run */ }
  return { announced: false, seen: null, queue: [], ours: [], notices: [], lastFetch: 0, notifiedTip: null, ...s };
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

function summary(files) {
  const names = [...new Set(files.map((f) => basename(f, extname(f))))].sort();
  return listed(names, 3);
}

/** Commit your knowledge changes on the current branch. Local and fast; returns the new SHA or null. */
export function commitLocal(root, s) {
  if (line(root, ['rev-parse', '--abbrev-ref', 'HEAD']) === 'HEAD') return null; // detached
  const files = changedKnowledge(root).slice(0, MAX_FILES);
  if (!files.length) return null;
  git(root, ['--literal-pathspecs', 'add', '-A', '--', ...files]);
  const staged = zlist(git(root, ['--literal-pathspecs', 'diff', '--cached', '--name-only', '-z', '--', ...files]));
  if (!staged.length) return null;
  git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only',
    '-m', `📝 docs(auto): ${summary(staged)} ${SKIP_CI}`, '--', ...staged]);
  const sha = line(root, ['rev-parse', 'HEAD']);
  s.queue.push(sha);
  return sha;
}

// ------------------------------------------------------------------ network: up

/**
 * The tree of `base` with the change of commit `sha` applied, or null if it does not apply cleanly.
 * A throwaway index under `.rsc/` and `git apply --cached`: the real index and the working tree are
 * never read or written, and it works on any git (`merge-tree --merge-base` needs 2.40).
 */
function replay(root, base, sha) {
  if (!line(root, ['rev-parse', '--verify', '--quiet', `${sha}^`])) return null;
  const patch = run(root, ['diff-tree', '-p', '--binary', '--full-index', `${sha}^`, sha], { timeout: NET_TIMEOUT_MS });
  if (!patch.ok) return null;
  if (!patch.out.trim()) return line(root, ['rev-parse', `${base}^{tree}`]);
  const env = { GIT_INDEX_FILE: join(root, '.rsc', 'knowledge-sync.index') };
  try {
    if (!run(root, ['read-tree', base], { env }).ok) return null;
    if (!run(root, ['apply', '--cached', '-'], { env, input: patch.out, timeout: NET_TIMEOUT_MS }).ok) return null;
    return line(root, ['write-tree'], { env });
  } finally {
    try { unlinkSync(env.GIT_INDEX_FILE); } catch { /* never created */ }
  }
}

/**
 * Put the queued commits on the remote default branch. Never touches the working tree or the index.
 *
 * Fast path: on the default branch, with nothing but our own commits ahead of the remote, push HEAD
 * as it is — same SHAs, clean history. Otherwise each queued commit is replayed on top of the remote
 * tip (`replay`), which is how a commit made on `feat/x` reaches `main` without carrying
 * `feat/x` along, and how your unpushed code never leaves the machine.
 */
export function ship(root, s) {
  const def = defaultBranch(root) || line(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!def || def === 'HEAD') return;
  const fetched = run(root, ['fetch', '--quiet', 'origin', def], { timeout: NET_TIMEOUT_MS });
  if (!s.queue.length) return;
  const remoteRef = `refs/remotes/origin/${def}`;
  const remoteTip = line(root, ['rev-parse', '--verify', '--quiet', remoteRef]);

  if (!remoteTip) { // a remote with no branch yet: the first push creates it
    if (!fetched.ok && !/couldn't find remote ref/i.test(fetched.err)) return;
    if (line(root, ['rev-parse', '--abbrev-ref', 'HEAD']) !== def) return;
    const r = run(root, ['push', '--quiet', 'origin', `HEAD:refs/heads/${def}`], { timeout: NET_TIMEOUT_MS });
    if (r.ok) { s.ours.push(...s.queue); s.queue = []; }
    return;
  }
  if (!fetched.ok) return; // offline: the queue goes up on a later turn

  for (let attempt = 0; attempt < 2; attempt++) {
    const tip = line(root, ['rev-parse', remoteRef]);
    const ahead = git(root, ['rev-list', `${tip}..HEAD`]).split('\n').filter(Boolean);
    const onDefault = line(root, ['rev-parse', '--abbrev-ref', 'HEAD']) === def;
    if (onDefault && ahead.length && ahead.every((c) => s.queue.includes(c)) && isAncestor(root, tip, 'HEAD')) {
      const r = run(root, ['push', '--quiet', 'origin', `HEAD:refs/heads/${def}`], { timeout: NET_TIMEOUT_MS });
      if (r.ok) { s.ours.push(...ahead); s.queue = []; return; }
    } else {
      let base = tip;
      const built = [];
      const kept = [];
      for (const sha of s.queue) {
        if (!line(root, ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`])) continue; // rewritten away
        const tree = replay(root, base, sha);
        if (tree === null) {
          const files = zlist(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', sha]));
          note(s, `No he podido subir ${listed(files)}: choca con un cambio que ya está en ${def}. ` +
            'Tu versión sigue aquí; hay que juntarlas a mano.');
          continue;
        }
        if (tree === line(root, ['rev-parse', `${base}^{tree}`])) { kept.push(sha); continue; } // already there
        const [name, email, date, ...body] = git(root, ['log', '-1', '--format=%an%n%ae%n%aI%n%B', sha]).split('\n');
        base = git(root, ['commit-tree', tree, '-p', base, '-F', '-'], {
          input: body.join('\n'),
          env: { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date },
        }).trim();
        built.push(base);
      }
      if (base === tip) { s.ours.push(...kept); s.queue = []; return; }
      const r = run(root, ['push', '--quiet', 'origin', `${base}:refs/heads/${def}`], { timeout: NET_TIMEOUT_MS });
      if (r.ok) {
        run(root, ['update-ref', remoteRef, base]);
        s.ours.push(...built, ...kept);
        s.queue = [];
        return;
      }
    }
    // Somebody pushed in between, or the branch is protected: look again once, then say so.
    if (!run(root, ['fetch', '--quiet', 'origin', def], { timeout: NET_TIMEOUT_MS }).ok) return;
  }
  note(s, `No he podido subir los cambios de conocimiento a ${def} (¿rama protegida?). ` +
    'Siguen comiteados aquí; se reintenta en el próximo turno.');
}

// ------------------------------------------------------------------ local: their changes

/**
 * Apply what others pushed, from the last fetch — no network here. Only knowledge, only files you
 * have not touched since; anything else is said, never done.
 */
export function applyIncoming(root, s) {
  const said = [];
  const def = defaultBranch(root);
  if (!def || busy(root)) return said;
  const tip = line(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${def}`]);
  if (!tip) return said;
  if (!s.seen) s.seen = line(root, ['merge-base', 'HEAD', tip]) || tip;
  if (s.seen === tip) return said;
  if (!line(root, ['rev-parse', '--verify', '--quiet', `${s.seen}^{commit}`])) s.seen = line(root, ['merge-base', 'HEAD', tip]) || tip;

  const commits = git(root, ['rev-list', `${s.seen}..${tip}`]).split('\n').filter(Boolean);
  const theirs = commits.filter((c) => !s.ours.includes(c));
  if (!theirs.length) { s.seen = tip; return said; }

  const files = zlist(git(root, ['diff', '--name-only', '--no-renames', '-z', s.seen, tip]));
  const foreign = files.filter((f) => !isKnowledge(f));
  const know = files.filter(isKnowledge).slice(0, MAX_FILES);
  const who = authorsOf(root, theirs);
  const branch = line(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const onDefault = branch === def;

  if (onDefault && foreign.length && s.notifiedTip !== tip) {
    s.notifiedTip = tip;
    said.push(`${who} subió cambios que no son solo conocimiento (${listed(foreign)}). No los traigo solo: revisa y haz \`git pull\`.`);
  }

  const dirty = new Set(changedKnowledge(root));
  if (onDefault && !foreign.length && !know.some((f) => dirty.has(f)) && isAncestor(root, 'HEAD', tip)) {
    if (run(root, ['merge', '--ff-only', '--quiet', tip]).ok) {
      s.seen = tip;
      if (know.length) said.push(`📥 Traídos ${theirs.length} cambio(s) de conocimiento de ${who}: ${listed(know)}.`);
      return said;
    }
  }
  if (branch === 'HEAD') return said;

  const take = [];
  const clash = [];
  for (const f of know) {
    const incoming = blob(root, tip, f);
    const mine = worktreeBlob(root, f);
    if (mine === incoming) continue;
    const base = blob(root, s.seen, f);
    if (blob(root, 'HEAD', f) === base && mine === base) take.push(f);
    else clash.push(f);
  }

  if (take.length) {
    const gone = take.filter((f) => !blob(root, tip, f));
    const present = take.filter((f) => blob(root, tip, f));
    if (present.length) git(root, ['--literal-pathspecs', 'checkout', tip, '--', ...present]);
    if (gone.length) git(root, ['--literal-pathspecs', 'rm', '--quiet', '--', ...gone]);
    git(root, ['--literal-pathspecs', 'commit', '--quiet', '--no-verify', '--only',
      '-m', `📥 docs(auto): sync desde ${def} ${SKIP_CI}`, '--', ...take]);
    said.push(`📥 Traídos ${theirs.length} cambio(s) de conocimiento de ${who}: ${listed(take)}.`);
  }
  if (clash.length) {
    said.push(`${who} cambió ${listed(clash)}, que tú también has tocado. No lo traigo solo: tu versión sigue intacta.`);
  }
  s.seen = tip;
  return said;
}

// ------------------------------------------------------------------ hook entry points

// `RSC_KNOWLEDGE_SYNC_FOREGROUND=1` runs the network half inline: for tests, which would otherwise race
// a detached process for the lock, and for anybody debugging what the background did.
function background(root, op) {
  if (process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND === '1') return work(root, op);
  try {
    const self = fileURLToPath(import.meta.url);
    spawn(process.execPath, [self, op, root], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* the next turn tries again */ }
}

const ANNOUNCE = '🔄 La sincronización del conocimiento está activa: lo que cambies en 01-TOOLS/ y 02-DOCS/ ' +
  'se sube solo a origin (con [skip ci]) y lo de los demás te llega solo. Para apagarla en este proyecto: ' +
  '`rsc knowledge-sync off`.';

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
      try { commitLocal(root, s); } catch (e) { note(s, `La sincronización del conocimiento no pudo comitear: ${clean(e.message, 160)}`); }
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
        const def = defaultBranch(root);
        if (def) run(root, ['fetch', '--quiet', 'origin', def], { timeout: NET_TIMEOUT_MS });
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
      return target === 'cursor' ? { user_message: said } : { systemMessage: said };
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
