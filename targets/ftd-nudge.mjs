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
// Off for a project with .rsc/.no-ftd-nudge. Fail-open on every error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE = ['.rsc', 'memory', 'ftd-nudge.json'];
const KEEP = 50;

export const NUDGE = 'rsc · lane: this session is changing code and has no feature document yet. ' +
  'Before going on, decide the lane and say it in one line: simple → write 02-DOCS/wiki/ftd/<slug>.md now ' +
  '(Intent, Scope, Checklist with how each item is proven, Evidence, Next) and keep it updated; big or ' +
  'interlocking → SDD (spec first). A one-line, zero-risk change needs no document: say so instead.';

const posix = (p) => p.split(sep).join('/');

export function classify(root, filePath) {
  if (!filePath || typeof filePath !== 'string') return 'other';
  const rel = posix(isAbsolute(filePath) ? relative(root, filePath) : filePath);
  if (rel.startsWith('..')) return 'other';
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

/** The decision, pure enough to test: returns the context to inject, or ''. */
export function decide(root, input, now = Date.now()) {
  if (existsSync(join(root, '.rsc', '.no-ftd-nudge'))) return '';
  const session = String(input.session_id || input.sessionId || '');
  if (!session) return '';
  const tool = input.tool_input || input.toolInput || {};
  const kind = classify(root, tool.file_path || tool.notebook_path || tool.path);
  if (kind === 'other') return '';
  const state = readState(root);
  const entry = state[session] || {};
  if (kind === 'document') {
    if (!entry.documented) { state[session] = { ...entry, documented: true, at: now }; writeState(root, state); }
    return '';
  }
  if (entry.documented || entry.nudged) return '';
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
