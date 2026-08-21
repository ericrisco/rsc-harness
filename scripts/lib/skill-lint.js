// Structural lint of a skill body. Pure: give it the text, get a verdict.
//
// Scope is deliberately one defect class. A stray closing delimiter inverts every block boundary
// after it, so a skill can render half its body as one code block while every other gate stays
// green: the frontmatter validates, the description fits, the prose reads fine in the source. It is
// a purely deterministic defect, so it belongs to a binary, not to a reader's attention.

const FENCE = /^(?:```|~~~)/;

/**
 * @param {string} body raw skill markdown
 * @returns {{balanced: boolean, fences: number, opened: number|null}}
 *   `fences` counts column-0 delimiters; `opened` is the 1-indexed line of the unpaired one.
 */
export function fenceBalance(body) {
  const lines = String(body ?? '').split('\n');
  let open = null; // line number of the delimiter that opened the current block
  let fences = 0;

  for (let i = 0; i < lines.length; i += 1) {
    // Only a column-0 delimiter is a block boundary. Indented ones are content: a fenced sample
    // inside a fenced block. Counting those would flag correct documents.
    if (!FENCE.test(lines[i])) continue;
    fences += 1;
    open = open === null ? i + 1 : null;
  }

  return { balanced: open === null, fences, opened: open };
}
