// Copy guard — a Claude Code Stop hook that refuses to let a final answer carry a phrase the project
// has forbidden (rules: targets/copy-rules.mjs).
//
// Why a hook and not another instruction: the instruction already existed, and the model read it,
// quoted it, and still wrote "no es una red de captación" because it decided a negation was allowed.
// The Stop hook runs after the model has finished, on the text the reader is about to get, so the
// decision is no longer the model's. It blocks once per turn with the exact phrases and where the
// rule lives; the model rewrites. A second stop in the same turn is let through (stop_hook_active),
// so a rule that cannot be satisfied never traps the session in a loop.
//
// Silent and free when the project declares no banned phrases, which is almost every project.
// Fails open on any error. Opt out with .rsc/.no-copy-guard.
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules, findViolations, proseOnly } from './copy-rules.mjs';

const TAIL_BYTES = 2_000_000;

/** The text of the last assistant turn, read from the end of the transcript. */
export function lastAssistantText(transcriptPath) {
  let raw = '';
  try {
    const size = statSync(transcriptPath).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const fd = openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    raw = buf.toString('utf8');
  } catch { return ''; }
  const entries = raw.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const texts = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const msg = e.message || {};
    const content = msg.content;
    if (e.type === 'user' || msg.role === 'user') {
      // A tool result belongs to the assistant's own turn; a real prompt ends the search.
      const isToolResult = Array.isArray(content) && content.length && content.every((c) => c && c.type === 'tool_result');
      if (!isToolResult) break;
      continue;
    }
    if (e.type === 'assistant' || msg.role === 'assistant') {
      if (typeof content === 'string') texts.unshift(content);
      else if (Array.isArray(content)) texts.unshift(content.filter((c) => c && c.type === 'text').map((c) => c.text).join('\n'));
    }
  }
  return texts.join('\n');
}

/** The hook's decision, pure enough to test: a block object, or null. */
export function decide(root, input) {
  if (existsSync(join(root, '.rsc', '.no-copy-guard'))) return null;
  if (input.stop_hook_active) return null;
  const rules = loadRules(root);
  if (!rules.length) return null;
  const text = typeof input.last_assistant_message === 'string' && input.last_assistant_message
    ? input.last_assistant_message
    : input.transcript_path ? lastAssistantText(input.transcript_path) : '';
  if (!text) return null;
  const hits = findViolations(proseOnly(text), rules);
  if (!hits.length) return null;
  const seen = new Set();
  const list = hits.filter((h) => !seen.has(h.phrase) && seen.add(h.phrase))
    .map((h) => `- "${h.phrase}" (found as "${h.match}", line ${h.line}; rule in ${h.source})`).join('\n');
  return {
    decision: 'block',
    reason: `rsc copy guard: your answer uses phrases this project forbids in what it publishes:\n${list}\n`
      + 'Rewrite the answer without them. A negation still counts ("this is not X" uses X): say what it is instead. '
      + 'Reply in the person\'s language. If you need to name a banned phrase when talking about the rule, put it inside `backticks`; '
      + 'text in backticks is not checked. If the person explicitly asked for the phrase, say so in one line and keep it.',
  };
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  try {
    const root = process.argv[2] || process.cwd();
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const out = decide(root, input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch { /* fail open */ }
  process.exit(0);
}
