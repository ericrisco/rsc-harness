// emoji-policy.mjs — what rsc says when `.rsc/.no-emoji` exists: the one place that knows how.
//
// `emoji: off` is chosen at install (`--emoji off`) or later (`rsc emoji off`). The decision is the
// marker file; this module reads it and turns glyphs into words. Every producer of text asks here
// instead of keeping its own `if`: the CLI (`scripts/lib/ui.js`) and the session-start hook. The
// guards that need less read only `emojiOff`.
//
// A sibling under `.rsc/` (hooks are materialized file by file): standalone, node builtins only.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Is this project set to no emoji? The marker, and nothing else. */
export const emojiOff = (root) => existsSync(join(root || process.cwd(), '.rsc', '.no-emoji'));

// What a glyph says in the output of a command. A table, so nothing hides in an `if`.
const WORDS = new Map([
  ['✅', 'ok:'], ['✔', 'ok:'], ['✓', 'ok:'],
  ['⚠', 'warning:'],
  ['⛔', 'blocked:'], ['❌', 'failed:'], ['✗', 'failed:'], ['✖', 'failed:'],
  ['→', '->'], ['➡', '->'], ['←', '<-'], ['⬅', '<-'], ['↔', '<->'],
]);
// A glyph, its variation selector, and the one space after it when it is only dropped.
const GLYPH = /([✅✔✓⚠⛔❌✗✖→➡←⬅↔])️?/gu;
const DROPPED = /(?:\p{Extended_Pictographic}|[↻✦✧✶✺])️?[ \t]?/gu;

/** Output for a project with emoji off: glyphs as words, any other pictograph dropped. Plain text is untouched. */
export function plain(text) {
  return String(text)
    .replace(GLYPH, (_, glyph) => WORDS.get(glyph))
    .replace(/(ok:|warning:|blocked:|failed:)[ \t]+/g, '$1 ')
    .replace(DROPPED, '');
}

// The closing block of `orient`, in words: the same lines, the same meaning.
const COMPASS = [['\u{1F4CD}', 'Dónde estás:'], ['➡️', 'Siguiente:'], ['✅', 'Hecho:'], ['\u{1F9ED}', 'Decidido:']];

export const NO_EMOJI_RULE = [
  '## Emoji are off in this project (.rsc/.no-emoji)',
  '',
  'No reply, commit, pull request or document carries an emoji, an arrow or a check mark symbol in this project, even when a skill or a template shows one: write the word instead.',
  'Close every turn with the brújula in words: «Dónde estás:», «Siguiente:», and «Hecho:» or «Decidido:» when they carry something.',
  '',
].join('\n');

/**
 * The always-on body for a project with emoji off. Deterministic: the compass sentence of `suggest`
 * is written with its words, any other glyph goes through `plain`, and the rule is appended. Applied
 * twice it gives the same text.
 */
export function noEmojiBody(body) {
  const text = String(body);
  if (text.includes(NO_EMOJI_RULE)) return text;
  let out = text.replace(/\(\u{1F4CD}[^)]*\)/u, '(«Dónde estás:» · «Siguiente:», terminando en pregunta; «Hecho:» y «Decidido:» cuando hay algo hecho o decidido)');
  for (const [glyph, word] of COMPASS) out = out.split(glyph).join(word);
  return `${plain(out).replace(/\n*$/, '\n')}\n${NO_EMOJI_RULE}`;
}
