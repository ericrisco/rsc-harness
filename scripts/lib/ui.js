import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function ask(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  const a = await rl.question(question);
  rl.close();
  return a.trim();
}

export function say(...lines) {
  console.log(...lines);
}

export function yes(s) {
  return /^(s|si|sí|y|yes|ok|sure|yeah)/i.test(s.trim());
}

// ---------------------------------------------------------------------------
// Interactive arrow-key / space TUI (zero dependencies).
// Falls back to a typed-number prompt when there is no interactive TTY
// (CI, pipes, dumb terminals) so scripts and tests never hang.
// ---------------------------------------------------------------------------

function interactive() {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

// The one criterion for "is a human here to answer". Exported so target resolution
// asks the same question the TUI already asks — two criteria for one question is how
// a terminal run and a CI run drift apart.
export const isInteractive = interactive;

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  cyan: (s) => `\x1b[36m${s}\x1b[39m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
};

// Big block RSC wordmark, built from per-letter grids so rows always align.
const _R = ['████████', '██    ██', '██    ██', '██    ██', '████████', '██  ██', '██   ██', '██    ██', '██    ██'];
const _S = [' ███████', '██', '██', '██', ' ██████', '      ██', '      ██', '      ██', '███████'];
const _C = [' ███████', '██    ██', '██', '██', '██', '██', '██', '██    ██', ' ███████'];
const _padW = 9;
const _pad = (s) => s + ' '.repeat(Math.max(0, _padW - [...s].length));
const ART = _R.map((_, i) => `  ${_pad(_R[i])}  ${_pad(_S[i])}  ${_pad(_C[i])}`);

// HSL → RGB (s=1, l=0.6) for a true rainbow.
function hsl(h, s = 1, l = 0.6) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// One frame: rainbow per character, diagonal phase, revealed up to `cols`.
const SPARK = ['✦', '✧', '⋆', '✺', '·', '*'];
const SPARK_C = ['\x1b[1;97m', '\x1b[1;93m', '\x1b[1;96m']; // bright white / yellow / cyan

// `n` random twinkles as a Map "r,c" -> pre-coloured glyph string.
function sparkles(n, rows, W) {
  const m = new Map();
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * W);
    const g = SPARK[Math.floor(Math.random() * SPARK.length)];
    m.set(`${r},${c}`, SPARK_C[Math.floor(Math.random() * SPARK_C.length)] + g);
  }
  return m;
}

// One frame: rainbow per character (or white), revealed up to `cols`, with
// sparkles overlaid on top wherever the map has a position.
function frame(phase, cols, sparks, white) {
  return ART.map((line, r) => {
    const chars = [...line];
    let out = '';
    for (let c = 0; c < chars.length && c < cols; c++) {
      const sp = sparks && sparks.get(`${r},${c}`);
      if (sp) { out += sp; continue; }
      const ch = chars[c];
      if (ch === ' ') { out += ' '; continue; }
      if (white) { out += `\x1b[1;97m${ch}`; continue; }
      const [rr, gg, bb] = hsl((c * 5 + r * 14 + phase * 20) % 360);
      out += `\x1b[1;38;2;${rr};${gg};${bb}m${ch}`;
    }
    return `\x1b[2K${out}\x1b[0m`;
  }).join('\n') + '\n';
}

// Animated ASCII wordmark — the exaggerated "WOW". Static plain text when not a TTY.
export async function banner(skillCount = 'all') {
  if (!stdout.isTTY) {
    say('');
    for (const l of ART) say(l);
    say(`  ${skillCount} skills · one CLI · zero bloat`);
    return;
  }
  const rows = ART.length;
  const W = Math.max(...ART.map((l) => [...l].length));
  stdout.write('\x1b[?25l'); // hide cursor
  say('');
  // 1) letters slide in left → right, a sparkle riding the drawing edge
  let first = true;
  for (let cols = 2; cols <= W; cols += 2) {
    if (!first) stdout.write(`\x1b[${rows}A`);
    first = false;
    const edge = new Map();
    const er = Math.floor(Math.random() * rows);
    edge.set(`${er},${Math.min(cols - 1, W - 1)}`, '\x1b[1;97m✦');
    if (Math.random() < 0.5) edge.set(`${Math.floor(Math.random() * rows)},${Math.min(cols, W - 1)}`, '\x1b[1;93m·');
    stdout.write(frame(0, cols, edge));
    await sleep(12);
  }
  // 2) flowing rainbow diagonal sweeps with twinkling sparkles
  for (let phase = 1; phase <= 30; phase++) {
    stdout.write(`\x1b[${rows}A`);
    stdout.write(frame(phase, W, sparkles(4, rows, W)));
    await sleep(26);
  }
  // 3) double white flash with a sparkle burst — the pop
  for (let f = 0; f < 2; f++) {
    stdout.write(`\x1b[${rows}A`);
    stdout.write(frame(0, W, sparkles(12, rows, W), true));
    await sleep(60);
    stdout.write(`\x1b[${rows}A`);
    stdout.write(frame(15, W, sparkles(3, rows, W)));
    await sleep(60);
  }
  // settle on a final rainbow snapshot
  stdout.write(`\x1b[${rows}A`);
  stdout.write(frame(15, W));
  say(C.dim(`  ${skillCount} skills · one CLI · zero bloat`));
  stdout.write('\x1b[?25h'); // show cursor
}

// Repaint a fixed block of lines in place (cursor ends just below the block).
function makePainter() {
  let height = 0;
  return (lines) => {
    if (height) stdout.write(`\x1b[${height}A`);
    stdout.write(lines.map((l) => `\x1b[2K${l}`).join('\n') + '\n');
    height = lines.length;
  };
}

function captureKeys(onKey) {
  emitKeypressEvents(stdin);
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  const handler = (str, key) => onKey(str, key || {});
  stdin.on('keypress', handler);
  return () => {
    stdin.off('keypress', handler);
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
  };
}

// Single choice: ↑↓ to move, Enter to pick. options: [{ key, label }].
function tuiSelect(question, options) {
  return new Promise((resolve) => {
    let i = 0;
    const paint = makePainter();
    const render = () => paint([
      C.bold(question),
      C.dim('  ↑↓ move · enter select · esc back'),
      ...options.map((o, idx) =>
        idx === i ? `${C.cyan('❯')} ${C.cyan(o.label)}` : `  ${o.label}`),
    ]);
    render();
    const stop = captureKeys((str, key) => {
      if (key.name === 'up' || key.name === 'k') { i = (i - 1 + options.length) % options.length; render(); }
      else if (key.name === 'down' || key.name === 'j') { i = (i + 1) % options.length; render(); }
      else if (key.name === 'return') { stop(); resolve(options[i].key); }
      else if (key.name === 'escape') { stop(); resolve(null); }              // back / cancel
      else if (key.ctrl && key.name === 'c') { stop(); stdout.write('\n'); process.exit(130); } // hard quit
    });
  });
}

// Multi-select: ↑↓ move, space toggle, a = all, enter confirm. Viewport scrolls.
function tuiChecklist(title, items) {
  return new Promise((resolve) => {
    const VISIBLE = Math.min(items.length, 12);
    const sel = new Set();
    let cur = 0; let top = 0;
    const paint = makePainter();
    const render = () => {
      if (cur < top) top = cur;
      if (cur >= top + VISIBLE) top = cur - VISIBLE + 1;
      const rows = [];
      for (let r = top; r < top + VISIBLE; r++) {
        const it = items[r];
        const box = sel.has(r) ? C.green('◉') : '◯';
        const line = `${box} ${it.label}`;
        rows.push(r === cur ? `${C.cyan('❯')} ${C.cyan(line)}` : `  ${line}`);
      }
      const more = items.length > VISIBLE ? C.dim(`  (${cur + 1}/${items.length})`) : '';
      paint([
        C.bold(title),
        C.dim('  ↑↓ move · space toggle · a all · enter confirm · esc back') + more,
        ...rows,
      ]);
    };
    render();
    const stop = captureKeys((str, key) => {
      if (key.name === 'up' || key.name === 'k') { cur = (cur - 1 + items.length) % items.length; render(); }
      else if (key.name === 'down' || key.name === 'j') { cur = (cur + 1) % items.length; render(); }
      else if (key.name === 'space') { sel.has(cur) ? sel.delete(cur) : sel.add(cur); render(); }
      else if (str === 'a') { if (sel.size === items.length) sel.clear(); else items.forEach((_, idx) => sel.add(idx)); render(); }
      else if (key.name === 'return') { stop(); resolve([...sel].sort((x, y) => x - y).map((idx) => items[idx].id)); }
      else if (key.name === 'escape') { stop(); resolve(null); }              // back without changing
      else if (key.ctrl && key.name === 'c') { stop(); stdout.write('\n'); process.exit(130); } // hard quit
    });
  });
}

// Public: single-choice menu. options: [{ key, label }]. Returns the chosen key.
export async function select(question, options) {
  if (interactive()) return tuiSelect(question, options);
  // Fallback: typed number.
  say(question);
  options.forEach((o, i) => say(`  ${i + 1}) ${o.label}`));
  const a = (await ask('> ')).toLowerCase();
  const n = parseInt(a, 10);
  if (n >= 1 && n <= options.length) return options[n - 1].key;
  const byKey = options.find((o) => o.key.toLowerCase() === a);
  return byKey ? byKey.key : null;
}

// Public: yes/no confirmation. Arrow TUI when interactive, typed prompt otherwise.
export async function confirm(question) {
  if (interactive()) {
    const k = await tuiSelect(question, [
      { key: 'yes', label: 'Yes, install it' },
      { key: 'no', label: 'No, cancel' },
    ]);
    return k === 'yes';
  }
  return yes(await ask(`${question} (yes / no) > `));
}

// Public: multi-select. items: array of strings or { id, label }. Returns ids.
export async function pickFrom(title, items) {
  const norm = items.map((it) => (typeof it === 'string' ? { id: it, label: it } : it));
  if (interactive()) return tuiChecklist(title, norm);
  // Fallback: comma-separated numbers.
  say(`\n${title}`);
  norm.forEach((it, i) => say(`  ${String(i + 1).padStart(2)}) ${it.label}`));
  say('   Comma-separated numbers (e.g. 1,3,4), "all", or Enter for none.');
  const a = (await ask('> ')).trim();
  if (!a) return [];
  if (/^(all|todo|todas)$/i.test(a)) return norm.map((it) => it.id);
  return [...new Set(
    a.split(',').map((s) => parseInt(s.trim(), 10)).filter((x) => x >= 1 && x <= norm.length).map((x) => norm[x - 1].id),
  )];
}
