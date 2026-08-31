import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { linkOrCopy } from './index.js';

// Shared adapter for every assistant whose "always-on" surface is a plain
// markdown instructions/rules file (AGENTS.md, copilot-instructions.md, a
// .windsurf/.roo/.continue rule, …). Skills are symlinked to the shared base;
// the suggest block is injected between idempotent markers so re-installs and
// multiple assistants sharing one file never duplicate it.
const MARK_START = '<!-- rsc-suggest:start -->';
const MARK_END = '<!-- rsc-suggest:end -->';
// The exact separator wireHook writes before an appended block, so unwireHook can take
// back precisely what it gave and leave the rest of the file untouched.
const SEAM = '\n\n';

export function writeSkill(id, fromDir, toPath) {
  return linkOrCopy(fromDir, toPath);
}

export function wireHook(paths, sourceMd) {
  const body = stripFrontmatter(readFileSync(sourceMd, 'utf8'));
  const block = `${MARK_START}\n${body}\n${MARK_END}`;
  let doc = existsSync(paths.hookTarget) ? readFileSync(paths.hookTarget, 'utf8') : '';
  if (doc.includes(MARK_START)) {
    doc = doc.replace(new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`), block);
  } else {
    // Append with a fixed seam, and record nothing else. unwireHook removes exactly this
    // seam and this block, which is what lets the file come back byte-identical.
    doc += `${SEAM}${block}\n`;
  }
  mkdirSync(dirname(paths.hookTarget), { recursive: true });
  writeFileSync(paths.hookTarget, doc);
  return [paths.hookTarget];
}

// Inverse of wireHook: remove the marked rsc-suggest block from the shared
// instructions file, leaving the user's own content intact. No-op when absent.
export function unwireHook(paths) {
  if (!existsSync(paths.hookTarget)) return [];
  const doc = readFileSync(paths.hookTarget, 'utf8');
  if (!doc.includes(MARK_START)) return [];
  // Remove the block and the seam that introduced it — nothing more.
  //
  // This used to end with a document-wide `\n{3,}` -> `\n\n` pass, which tidied blank
  // lines the author had put hundreds of lines away from anything of ours. In #249 that
  // file was the project's hand-written constitution: it had already received 95 lines it
  // never asked for, and giving it back reformatted is the second half of the same damage.
  // A slightly larger gap is cosmetic; rewriting someone's document is not.
  const cleaned = doc.replace(
    new RegExp(`${SEAM.replace(/\n/g, '\\n')}?${MARK_START}[\\s\\S]*?${MARK_END}\\n?`),
    '',
  );
  writeFileSync(paths.hookTarget, cleaned);
  return [paths.hookTarget];
}

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '');
}
