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
  ['\u2705', 'ok:'], ['\u2714', 'ok:'], ['\u2713', 'ok:'],
  ['\u26A0', 'warning:'],
  ['\u26D4', 'blocked:'], ['\u274C', 'failed:'], ['\u2717', 'failed:'], ['\u2716', 'failed:'],
  ['\u2192', '->'], ['\u27A1', '->'], ['\u2190', '<-'], ['\u2B05', '<-'], ['\u2194', '<->'],
]);

// THE definition of a symbol that does not go in a project with emoji off, used by `plain`, by the
// commit guard and by whoever else needs it: pictographs except (c), (r) and (tm), which are text;
// regional indicators (flags); arrows; check and cross marks; stars and sparkles. A symbol is the
// glyph with what clings to it: variation selector, skin tone, keycap, and a ZWJ chain. A joiner, a
// selector or a keycap mark alone is not one: they are part of other scripts' text.
const BASE = '(?:(?![\\u00A9\\u00AE\\u2122])\\p{Extended_Pictographic}|\\p{Regional_Indicator}'
  + '|[\\u2190-\\u21FF\\u27F0-\\u27FF\\u2900-\\u297F\\u2B00-\\u2BFF\\u2794-\\u27BF\\u2713\\u2717\\u2718\\u2605\\u2606\\u2726\\u2727\\u22C6\\u273A])';
const CLUSTER = `(?:[0-9#*]\\uFE0F?\\u20E3|${BASE}(?:[\\uFE0F\\u20E3]|\\p{Emoji_Modifier}|\\u200D${BASE})*)`;
const SYMBOL = new RegExp(CLUSTER, 'u');
const DROPPED = new RegExp(`${CLUSTER}[ \\t]?`, 'gu');
const WORD_GLYPH = /([\u2705\u2714\u2713\u26A0\u26D4\u274C\u2717\u2716\u2192\u27A1\u2190\u2B05\u2194])\uFE0F?([ \t]*)/gu;

/** Does this text carry a symbol that emoji off does not allow? */
export const hasSymbol = (text) => SYMBOL.test(String(text));
/** The text without those symbols (and the one space after each). */
export const stripSymbols = (text) => String(text).replace(DROPPED, '');

/**
 * Output for a project with emoji off: the glyphs that mean something as words, any other symbol
 * dropped. Only the space right after a replaced glyph is normalized; text that is not a symbol,
 * padding included, is untouched.
 */
export function plain(text) {
  return stripSymbols(String(text).replace(WORD_GLYPH, (_, glyph, space) => WORDS.get(glyph) + (space ? ' ' : '')));
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
