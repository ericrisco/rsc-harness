// rsc shell unwrap — what a Bash command RUNS, as opposed to what it says.
//
// Shared by the PreToolUse guards (branch-guard, gitmoji-guard, danger-guard, and the sello that
// ship-guard loads). Hooks are materialized file by file under `.rsc/`, so this travels as their
// SIBLING (targets/claude.js copies it with the lifecycle files) and each guard imports it
// dynamically: without it a guard falls back to what it read before, never to a crash.
//
// E2E defect 15 (2026-10-07): `bash -c "git commit -m x"` hid a commit inside a quoted string, and
// every guard blanks quoted text so that `grep "git commit"` is not mistaken for a commit. Both are
// right, and they meet here: quoted text stays text EXCEPT where a wrapper hands it to a shell —
// `bash|sh|zsh|dash|ksh -c <string>` and `eval …` — which is unwrapped recursively. Leading
// `VAR=x`, `env`, `command`, `exec`, `sudo`, `nohup`, `nice`, `time`, `xargs` are peeled off so
// the segment starts at the real command. Not a shell parser: `$(…)`, functions, aliases and
// subshell scoping of `cd` are not modelled.

/** Heredoc bodies are text being written, not commands: `cat > notes.md <<EOF … git commit … EOF`. */
export const withoutHeredocs = (command) => command.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, '');

/** The command split where the shell would run one thing after another, never inside quotes. */
export function segments(command) {
  const out = [];
  let cur = '';
  let q = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (q) { cur += c; if (c === '\\' && q === '"') cur += command[++i] ?? ''; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ';' || c === '\n' || c === '|' || c === '&') {
      if ((c === '&' || c === '|') && command[i + 1] === c) i++;
      out.push(cur); cur = ''; continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.filter((s) => s.trim());
}

/** Shell words of one segment, quotes removed, each with where it starts in the segment. */
export function words(segment) {
  const out = [];
  let i = 0;
  const n = segment.length;
  while (i < n) {
    while (i < n && /\s/.test(segment[i])) i++;
    if (i >= n) break;
    const start = i;
    let text = '';
    while (i < n && !/\s/.test(segment[i])) {
      const c = segment[i];
      if (c === "'") { const e = segment.indexOf("'", i + 1); const end = e < 0 ? n : e; text += segment.slice(i + 1, end); i = end + 1; continue; }
      if (c === '"') {
        i++;
        while (i < n && segment[i] !== '"') {
          if (segment[i] === '\\' && /["\\$`]/.test(segment[i + 1] ?? '')) { text += segment[i + 1]; i += 2; continue; }
          text += segment[i++];
        }
        i++; continue;
      }
      if (c === '\\') { text += segment[i + 1] ?? ''; i += 2; continue; }
      text += c; i++;
    }
    out.push({ text, start });
  }
  return out;
}

const base = (w) => w.replace(/^.*\//, '');
const ASSIGN = /^[A-Za-z_]\w*=/;
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
// Wrapper → the options of it that take a separate argument.
const WRAPPERS = {
  env: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']),
  command: new Set(),
  exec: new Set(['-a']),
  sudo: new Set(['-u', '-g', '-C', '-h', '-p', '-U', '-r', '-t', '-D']),
  doas: new Set(['-u', '-C']),
  nohup: new Set(),
  nice: new Set(['-n']),
  time: new Set(['-f', '-o']),
  xargs: new Set(['-I', '-n', '-L', '-P', '-d', '-E', '-s', '-a']),
};

/**
 * One segment, its wrappers peeled: `{ inner }` when it hands a string to a shell (`bash -c`,
 * `eval`), else `{ rest }` — the segment from the real command on. `null` for nothing to run.
 */
export function unwrap(segment) {
  const w = words(segment);
  let i = 0;
  while (i < w.length) {
    const t = w[i].text;
    if (ASSIGN.test(t)) { i++; continue; }
    const b = base(t);
    if (b === 'command' && /^-[vV]$/.test(w[i + 1]?.text ?? '')) break; // a lookup, not a run
    if (Object.hasOwn(WRAPPERS, b)) {
      const takesArg = WRAPPERS[b];
      i++;
      while (i < w.length && w[i].text.startsWith('-') && w[i].text !== '-') {
        const opt = w[i].text;
        i += takesArg.has(opt) ? 2 : 1;
        if (opt === '--') break;
      }
      continue;
    }
    if (b === 'eval') {
      const inner = w.slice(i + 1).map((x) => x.text).join(' ');
      return inner.trim() ? { inner } : null;
    }
    if (SHELLS.has(b)) {
      for (let j = i + 1; j < w.length; j++) {
        const o = w[j].text;
        if (!o.startsWith('-') && !o.startsWith('+')) break; // a script file: run as is
        if (o === '-o' || o === '+o') { j++; continue; }
        if (/^-[A-Za-z]*c[A-Za-z]*$/.test(o)) return w[j + 1] ? { inner: w[j + 1].text } : null;
      }
    }
    break;
  }
  if (i >= w.length) return null;
  return { rest: segment.slice(w[i].start).trim() };
}

const MAX_DEPTH = 8;

/** Every segment the shell would really run, wrappers peeled and shell strings unwrapped. */
export function expand(command, depth = 0) {
  const out = [];
  for (const seg of segments(withoutHeredocs(String(command ?? '')))) {
    const u = unwrap(seg);
    if (!u) continue;
    if (u.inner !== undefined && depth < MAX_DEPTH) out.push(...expand(u.inner, depth + 1));
    else out.push(u.rest ?? seg.trim());
  }
  return out;
}

/** The strings this command hands to a shell (`bash -c "<this>"`, `eval <this>`), one level deep. */
export function innerScripts(command) {
  const out = [];
  for (const seg of segments(withoutHeredocs(String(command ?? '')))) {
    const u = unwrap(seg);
    if (u?.inner !== undefined) out.push(u.inner);
  }
  return out;
}
