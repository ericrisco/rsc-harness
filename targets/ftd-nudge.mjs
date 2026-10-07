#!/usr/bin/env node
// rsc FTD nudge (claude). PostToolUse on Edit|Write|MultiEdit|NotebookEdit.
//   argv[2] = absolute project root   stdin = PostToolUse hook JSON
//
// The lane rule ("simple → FTD: one feature document before the first change") lived only in prose,
// and the E2E of 2026-10-07 measured what prose gets: five sessions of code changes, zero feature
// documents, zero skill calls. Prose asks; this decides the one observable thing — code is being
// changed and no feature document has been touched in this session — and says so ONCE per session,
// right after the first code edit, when it is still cheap to write the document.
//
// A session is "documented" the moment any edit touches 02-DOCS/wiki/ftd/ or 02-DOCS/wiki/sdd/.
// Docs, wiki, harness files and markdown are never "code". Never blocks: context only.
// Paths inside `.worktrees/<branch>/` are classified as that worktree sees them, and a branch whose
// own commits already touch a feature document counts as documented.
// Off for a project with .rsc/.no-ftd-nudge. Fail-open on every error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const STATE = ['.rsc', 'memory', 'ftd-nudge.json'];
const KEEP = 50;

export const NUDGE = 'rsc · lane: this session is changing code and has no feature document yet. ' +
  'Before going on, decide the lane and say it in one line: simple → write 02-DOCS/wiki/ftd/<slug>.md now ' +
  '(frontmatter author/branch/status: in-progress; Intent, Scope, Checklist with how each item is proven, Evidence, Next) — one document per feature, ' +
  'a box ticked only with its observed proof under Evidence, Next kept current; big or ' +
  'interlocking → SDD (spec first). A one-line, zero-risk change needs no document: say so instead.';

const posix = (p) => p.split(sep).join('/');

// `.worktrees/<branch>/rest` → { worktree: '.worktrees/<branch>', rest }. A branch may hold slashes
// (`feat/busqueda` lives two levels down), so the worktree is the deepest prefix with a `.git` entry
// on disk; with nothing on disk to ask, the first segment is the branch.
function splitWorktree(root, rel) {
  const parts = rel.split('/');
  if (parts[0] !== '.worktrees' || parts.length < 3) return null;
  for (let end = parts.length - 1; end >= 2; end -= 1) {
    if (existsSync(join(root, ...parts.slice(0, end), '.git'))) return { worktree: parts.slice(0, end).join('/'), rest: parts.slice(end).join('/') };
  }
  return { worktree: parts.slice(0, 2).join('/'), rest: parts.slice(2).join('/') };
}

export function classify(root, filePath) {
  if (!filePath || typeof filePath !== 'string') return 'other';
  let rel = posix(isAbsolute(filePath) ? relative(root, filePath) : filePath);
  if (rel.startsWith('..')) return 'other';
  // A session isolated in `.worktrees/<branch>/` edits the same project; classify what it edits as
  // that worktree sees it. Every path there used to read as "other", so the isolated sessions — the
  // whole team workflow — were never nudged (team simulation D11).
  const nested = splitWorktree(root, rel);
  if (nested) rel = nested.rest;
  if (/^02-DOCS\/wiki\/(ftd|sdd)\//.test(rel)) return 'document';
  if (/^(02-DOCS|01-TOOLS|\.rsc|\.claude|\.git|\.github|\.worktrees)\//.test(rel)) return 'other';
  if (/\.(md|mdx|txt|rst)$/i.test(rel)) return 'other';
  return 'code';
}

function readState(root) {
  try { return JSON.parse(readFileSync(join(root, ...STATE), 'utf8')); } catch { return {}; }
}

function writeState(root, state) {
  const entries = Object.entries(state).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, KEEP);
  mkdirSync(join(root, '.rsc', 'memory'), { recursive: true });
  writeFileSync(join(root, ...STATE), `${JSON.stringify(Object.fromEntries(entries))}\n`);
}

// The checkout the edited file belongs to: its worktree under `.worktrees/`, or the project itself.
function checkoutOf(root, filePath) {
  if (typeof filePath !== 'string') return root;
  const rel = posix(isAbsolute(filePath) ? relative(root, filePath) : filePath);
  const nested = rel.startsWith('..') ? null : splitWorktree(root, rel);
  return nested ? join(root, ...nested.worktree.split('/')) : root;
}

function gitOut(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  return r.status === 0 ? (r.stdout || '').trim() : null;
}

/**
 * Is this branch already documented — does a commit of its own, not on the default branch, touch a
 * feature document? Then the session is continuing documented work (resolving a merge conflict, a
 * fix-up after review) and the nudge would ask for a document that exists (team simulation D11).
 * Asked only at the moment of nudging, once per session. Any doubt answers "no": nudging once too
 * often is the cheap mistake.
 */
export function branchHasFeatureDoc(checkout) {
  try {
    const head = gitOut(checkout, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!head) return false;
    const remoteHead = gitOut(checkout, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
    const trunk = [remoteHead, 'origin/main', 'origin/master', 'main', 'master']
      .filter(Boolean)
      .find((ref) => ref !== head && gitOut(checkout, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null);
    if (!trunk) return false;
    const touched = gitOut(checkout, ['log', '--format=', '--name-only', `${trunk}..HEAD`, '--', '02-DOCS/wiki/ftd/']);
    return Boolean(touched && touched.split('\n').some((line) => /^02-DOCS\/wiki\/ftd\/[^/]+\.md$/.test(line.trim())));
  } catch { return false; }
}

/** The decision, pure enough to test: returns the context to inject, or ''. */
export function decide(root, input, now = Date.now()) {
  if (existsSync(join(root, '.rsc', '.no-ftd-nudge'))) return '';
  const session = String(input.session_id || input.sessionId || '');
  if (!session) return '';
  const tool = input.tool_input || input.toolInput || {};
  const file = tool.file_path || tool.notebook_path || tool.path;
  const kind = classify(root, file);
  if (kind === 'other') return '';
  const state = readState(root);
  const entry = state[session] || {};
  if (kind === 'document') {
    if (!entry.documented) { state[session] = { ...entry, documented: true, at: now }; writeState(root, state); }
    return '';
  }
  if (entry.documented || entry.nudged) return '';
  if (branchHasFeatureDoc(checkoutOf(root, file))) {
    state[session] = { ...entry, documented: true, at: now };
    writeState(root, state);
    return '';
  }
  state[session] = { ...entry, nudged: true, at: now };
  writeState(root, state);
  return NUDGE;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const root = process.argv[2] || process.cwd();
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const text = decide(root, input);
    if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
  } catch { /* fail open */ }
  process.exit(0);
}
