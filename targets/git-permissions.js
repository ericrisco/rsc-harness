// Git permissions: on a harness installed from scratch, the agent may `git commit`, `git push` and
// `gh pr create` without asking — the three steps that close every lane (branch → commit → push →
// PR). A force-push still asks wherever the assistant can say so. In Claude Code the guards are
// untouched: a commit on a closed default branch is still denied by branch-guard, whatever the
// permission says. No other assistant runs rsc's guards, and `on|off|status` says so (#298).
//
// A PROJECT decision, recorded as `gitPermissions` in `.rsc.json`: true on a brand-new project, absent
// on one adopted before this existed (nothing changes there until `rsc git-permissions on`), false
// after `rsc git-permissions off`. Only rsc's own entries are ever added or removed; whatever the
// person allowed or denied stays exactly as it was.
//
// Cursor is left out on purpose: its CLI matches only the first word (`Shell(git)`), so allowing a
// push there would allow every git and gh command, `reset --hard` and `repo delete` included.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const GIT_PERMISSION_TARGETS = Object.freeze(['claude', 'codex', 'gemini', 'opencode']);

const CLAUDE_ALLOW = ['Bash(git commit *)', 'Bash(git push *)', 'Bash(gh pr create *)'];
// `ask` beats `allow` in Claude Code, and applies to any subcommand of a chain.
const CLAUDE_ASK = ['Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git push * --force*)', 'Bash(git push * -f*)'];
const GEMINI_ALLOW = ['run_shell_command(git commit)', 'run_shell_command(git push)', 'run_shell_command(gh pr create)'];
// OpenCode: the last matching rule wins, so the force-push asks come after the allows.
const OPENCODE_BASH = [
  ['git commit', 'allow'], ['git commit *', 'allow'], ['git push', 'allow'], ['git push *', 'allow'], ['gh pr create *', 'allow'],
  ['git push --force*', 'ask'], ['git push -f*', 'ask'], ['git push * --force*', 'ask'], ['git push * -f*', 'ask'],
];
// OpenCode 2 reads an ordered top-level `permissions` array (bash → `shell`); same rules, same order.
const OPENCODE_V2 = OPENCODE_BASH.map(([resource, effect]) => ({ action: 'shell', resource, effect }));
const FORCE_PATTERNS = OPENCODE_BASH.filter(([, a]) => a === 'ask').map(([p]) => p);
const CODEX_RULES = `# rsc-git-permissions:managed — written by rsc; \`rsc git-permissions off\` removes it.
# Commit, push and open a PR without asking; a force-push still asks (the strictest match wins).
prefix_rule(pattern = ["git", "commit"], decision = "allow", justification = "rsc: close the lane — commit")
prefix_rule(pattern = ["git", "push"], decision = "allow", justification = "rsc: close the lane — push the branch")
prefix_rule(pattern = ["gh", "pr", "create"], decision = "allow", justification = "rsc: close the lane — open the PR")
prefix_rule(pattern = ["git", "push", ["--force", "-f", "--force-with-lease"]], decision = "prompt", justification = "rsc: a force-push rewrites the remote")
`;

const FILES = Object.freeze({
  claude: '.claude/settings.json',
  codex: '.codex/rules/rsc-git.rules',
  gemini: '.gemini/settings.json',
  opencode: 'opencode.json',
});

const git = (cwd, args) => {
  try { return execFileSync('git', args, { windowsHide: true, cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};
const rel = (cwd, path) => relative(cwd, path).split(sep).join('/');

/** A file rsc created is kept out of git with the local exclude; one the project tracks is merged into, never hidden. */
function excludeIfNew(cwd, path) {
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return;
  if (git(cwd, ['ls-files', '--', rel(cwd, path)])) return;
  const value = git(cwd, ['rev-parse', '--git-path', 'info/exclude']);
  if (!value) return;
  const file = isAbsolute(value) ? value : resolve(cwd, value);
  const pattern = `/${rel(cwd, path)}`;
  mkdirSync(dirname(file), { recursive: true });
  const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!body.split('\n').includes(pattern)) appendFileSync(file, `${body && !body.endsWith('\n') ? '\n' : ''}${pattern}\n`);
}

function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

/** JSONC → JSON, for READING only: drops comments and trailing commas outside strings. */
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1); i = j;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
    } else out += ch;
  }
  // Trailing commas: only outside strings matter, and strings were copied verbatim — so strip them
  // with a pass that also skips strings.
  return JSON.parse(out.replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (m, str, close) => str ?? close));
}

const writeJson = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };
const addAll = (list, items) => [...(Array.isArray(list) ? list : []), ...items.filter((i) => !(list || []).includes(i))];
const dropAll = (list, items) => (Array.isArray(list) ? list.filter((i) => !items.includes(i)) : list);

export function gitPermissionsPath(target, cwd = process.cwd()) {
  return FILES[target] ? join(cwd, ...FILES[target].split('/')) : null;
}

// ── OpenCode: V1 (`permission.bash` map) or V2 (`permissions` array) ────────────────────────────
// OpenCode 2 still reads the V1 map; OpenCode 1.x does not know `permissions`. So V2 is written only
// when OpenCode 2 is seen on this machine (or the file is already V2); otherwise the V1 map, which
// both read. `RSC_OPENCODE_MAJOR` pins the version (tests, or a machine where the probe cannot run).

/** Installed OpenCode major version, or null when it cannot be told. */
export function opencodeMajor() {
  const pinned = process.env.RSC_OPENCODE_MAJOR;
  if (pinned !== undefined) return /^\d+$/.test(pinned.trim()) ? Number(pinned.trim()) : null;
  try {
    // `opencode` is an npm .cmd shim on Windows, which only a shell resolves.
    const win = process.platform === 'win32';
    const out = execFileSync(win ? 'opencode --version' : 'opencode', win ? [] : ['--version'], {
      windowsHide: true, timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: win,
    });
    const m = /(\d+)\.\d+/.exec(out);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

const sameRule = (a, b) => a && typeof a === 'object' && a.action === b.action && a.resource === b.resource && a.effect === b.effect;
const isRscV2 = (rule) => OPENCODE_V2.some((r) => sameRule(rule, r));
const hasV1 = (config) => OPENCODE_BASH.every(([p, a]) => config?.permission?.bash?.[p] === a);
const hasV2 = (config) => Array.isArray(config?.permissions) && OPENCODE_V2.every((r) => config.permissions.some((x) => sameRule(x, r)));
const jsoncOnly = (cwd) => !existsSync(join(cwd, 'opencode.json')) && existsSync(join(cwd, 'opencode.jsonc'));

function opencodeFormat(config) {
  const major = opencodeMajor();
  if (major !== null) return major >= 2 ? 'v2' : 'v1';
  return Array.isArray(config?.permissions) ? 'v2' : 'v1';
}

function dropV1(config) {
  const bash = config.permission?.bash;
  if (!bash || typeof bash !== 'object') return;
  for (const [pattern, action] of OPENCODE_BASH) if (bash[pattern] === action) delete bash[pattern];
  if (!Object.keys(bash).length) delete config.permission.bash;
  if (!Object.keys(config.permission).length) delete config.permission;
}

function dropV2(config) {
  if (!Array.isArray(config.permissions)) return;
  config.permissions = config.permissions.filter((r) => !isRscV2(r));
  if (!config.permissions.length) delete config.permissions;
}

// Where rsc's V2 block goes. The last matching rule wins, so a rule placed AFTER rsc's beats it. rsc
// must never loosen what the person decided, so its block goes BEFORE their rules: any rule of theirs
// that matches the same command later (a `deny` on `git push *`, an `ask` on `git *`) still wins.
// The one exception is a leading catch-all baseline (`resource: "*"` with `allow` or `ask`, the usual
// "ask for everything" default): rsc goes after it, or that default would make rsc's allows dead —
// what the V1 map has always done too. A catch-all `deny` is never stepped over.
function v2InsertAt(list) {
  let i = 0;
  while (i < list.length && list[i]?.resource === '*' && ['*', 'shell'].includes(list[i]?.action) && list[i]?.effect !== 'deny') i++;
  return i;
}

function wireOpencode(config, format) {
  if (format === 'v2') {
    if (config.permissions !== undefined && !Array.isArray(config.permissions)) return false;
    dropV1(config); // migrating: rsc's old V1 entries go, the person's stay
    const list = (config.permissions || []).filter((r) => !isRscV2(r));
    const at = v2InsertAt(list);
    config.permissions = [...list.slice(0, at), ...OPENCODE_V2.map((r) => ({ ...r })), ...list.slice(at)];
  } else {
    if (config.permission !== undefined && (typeof config.permission !== 'object' || config.permission === null)) return false;
    config.permission ||= {};
    if (typeof config.permission.bash === 'string') return false; // a blanket rule is the person's call
    dropV2(config); // back on 1.x (or unknown on a V1 file): one block, the one this OpenCode reads
    const bash = config.permission.bash && typeof config.permission.bash === 'object' ? config.permission.bash : {};
    // Re-inserted so the asks stay after the allows (OpenCode: the last matching rule wins).
    for (const [pattern] of OPENCODE_BASH) delete bash[pattern];
    for (const [pattern, action] of OPENCODE_BASH) bash[pattern] = action;
    config.permission.bash = bash;
  }
  config.$schema ||= 'https://opencode.ai/config.json';
  return true;
}

// One rule per line: short enough to read in a terminal, valid JSON to paste.
function snippet(format, pairs) {
  if (format === 'v2') {
    const rows = pairs.map(([resource, effect]) => `  ${JSON.stringify({ action: 'shell', resource, effect })}`);
    return `"permissions": [\n${rows.join(',\n')}\n]`;
  }
  const rows = pairs.map(([p, a]) => `    ${JSON.stringify(p)}: ${JSON.stringify(a)}`);
  return `"permission": {\n  "bash": {\n${rows.join(',\n')}\n  }\n}`;
}

/** The exact rules rsc would write, to paste into an OpenCode config. */
export const opencodeRulesSnippet = (format) => snippet(format, OPENCODE_BASH);

/** A stricter policy only OpenCode itself can enforce: refuse every force-push (`ask` also works). */
export const opencodeForcePushSnippet = (format) => snippet(format, FORCE_PATTERNS.map((p) => [p, 'deny']));

function readJsonc(path) {
  try {
    const value = parseJsonc(readFileSync(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

/**
 * Add rsc's entries. `{ mode: 'wired' | 'manual' | 'unsupported' | 'config-invalid', path }`; OpenCode
 * adds `format` ('v1' | 'v2'), and on 'manual' (an opencode.jsonc rsc will not rewrite) the `snippet`.
 */
export function wireGitPermissions(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path) return { mode: 'unsupported', path: null };
  if (target === 'opencode' && jsoncOnly(cwd)) {
    // Rewriting a JSONC file would drop the person's comments: read it, never write it.
    const jsonc = join(cwd, 'opencode.jsonc');
    const config = readJsonc(jsonc);
    if (config && hasV2(config)) return { mode: 'wired', path: jsonc, format: 'v2' };
    if (config && hasV1(config)) return { mode: 'wired', path: jsonc, format: 'v1' };
    const format = opencodeFormat(config);
    return { mode: 'manual', path: jsonc, format, snippet: opencodeRulesSnippet(format) };
  }
  if (target === 'codex') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, CODEX_RULES);
    excludeIfNew(cwd, path);
    return { mode: 'wired', path };
  }
  const existed = existsSync(path);
  const config = readJson(path);
  if (!config) return { mode: 'config-invalid', path }; // never overwrite a file we cannot read
  if (target === 'claude') {
    config.permissions ||= {};
    config.permissions.allow = addAll(config.permissions.allow, CLAUDE_ALLOW);
    config.permissions.ask = addAll(config.permissions.ask, CLAUDE_ASK);
  } else if (target === 'gemini') {
    config.tools ||= {};
    config.tools.allowed = addAll(config.tools.allowed, GEMINI_ALLOW);
  } else if (target === 'opencode') {
    const format = opencodeFormat(config);
    if (!wireOpencode(config, format)) return { mode: 'config-invalid', path, format };
    writeJson(path, config);
    if (!existed) excludeIfNew(cwd, path);
    return { mode: 'wired', path, format };
  }
  writeJson(path, config);
  if (!existed && target !== 'claude') excludeIfNew(cwd, path);
  return { mode: 'wired', path };
}

/** Remove rsc's entries, and nothing else. Returns the paths it touched. */
export function unwireGitPermissions(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path || !existsSync(path)) return [];
  if (target === 'codex') {
    if (!readFileSync(path, 'utf8').includes('rsc-git-permissions:managed')) return [];
    rmSync(path, { force: true });
    return [path];
  }
  const config = readJson(path);
  if (!config) return [];
  if (target === 'claude' && config.permissions) {
    config.permissions.allow = dropAll(config.permissions.allow, CLAUDE_ALLOW);
    config.permissions.ask = dropAll(config.permissions.ask, CLAUDE_ASK);
    for (const k of ['allow', 'ask']) if (Array.isArray(config.permissions[k]) && !config.permissions[k].length) delete config.permissions[k];
    if (!Object.keys(config.permissions).length) delete config.permissions;
  } else if (target === 'gemini' && config.tools) {
    config.tools.allowed = dropAll(config.tools.allowed, GEMINI_ALLOW);
    if (Array.isArray(config.tools.allowed) && !config.tools.allowed.length) delete config.tools.allowed;
    if (!Object.keys(config.tools).length) delete config.tools;
  } else if (target === 'opencode') {
    const before = JSON.stringify(config);
    dropV1(config); // both formats: machines on OpenCode 1.x and 2 may share this file
    dropV2(config);
    if (JSON.stringify(config) === before) return [];
  } else return [];
  writeJson(path, config);
  return [path];
}

/** Whether rsc's entries are all there, for `status` and `doctor`. */
export function gitPermissionsWired(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path || !existsSync(path)) return false;
  if (target === 'codex') return readFileSync(path, 'utf8').includes('rsc-git-permissions:managed');
  const config = readJson(path) || {};
  if (target === 'claude') return CLAUDE_ALLOW.every((r) => config.permissions?.allow?.includes(r));
  if (target === 'gemini') return GEMINI_ALLOW.every((r) => config.tools?.allowed?.includes(r));
  if (target === 'opencode') return gitPermissionsState(target, cwd).wired;
  return false;
}

/**
 * `{ wired, format, path }` for `status`. format: Claude/Codex/Gemini → 'native'; OpenCode → 'v1' or
 * 'v2' (where rsc's rules are, or where they would go) or 'manual' (opencode.jsonc, rules not pasted).
 */
export function gitPermissionsState(target, cwd = process.cwd()) {
  const path = gitPermissionsPath(target, cwd);
  if (!path) return { wired: false, format: null, path: null };
  if (target !== 'opencode') return { wired: gitPermissionsWired(target, cwd), format: 'native', path };
  if (jsoncOnly(cwd)) {
    const jsonc = join(cwd, 'opencode.jsonc');
    const config = readJsonc(jsonc);
    if (config && hasV2(config)) return { wired: true, format: 'v2', path: jsonc };
    if (config && hasV1(config)) return { wired: true, format: 'v1', path: jsonc };
    return { wired: false, format: 'manual', path: jsonc };
  }
  const config = (existsSync(path) && readJson(path)) || {};
  if (hasV2(config)) return { wired: true, format: 'v2', path };
  if (hasV1(config)) return { wired: true, format: 'v1', path };
  return { wired: false, format: opencodeFormat(config), path };
}

// ── What `rsc git-permissions on|off|status` says, per assistant (#298) ─────────────────────────
// Three things, always: what rsc controls there, what stops when it is off, and what is left to the
// assistant itself. The guards are named only where they exist: rsc's PreToolUse guards
// (branch-guard, danger-guard) run in Claude Code alone; no other assistant runs them.

const LABEL = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', opencode: 'OpenCode', cursor: 'Cursor', deepseek: 'DeepSeek Harness' };
const RULES = 'allow git commit, git push and gh pr create without asking, and ask before a force-push';

const WHEN_OFF = {
  claude: 'rsc removes its rules; Claude Code asks again for commit, push and PR, unless your own permissions allow them.',
  codex: 'rsc deletes its rules file; Codex applies its own approval policy and any rules of yours in .codex/rules.',
  gemini: 'rsc removes its entries; Gemini CLI asks before those commands unless your own tools.allowed lists them.',
  opencode: 'rsc removes its rules; only your own OpenCode rules apply. With no rule matching, OpenCode 2 asks and OpenCode 1.x runs the command.',
};

const indent = (text, pad = '    ') => text.split('\n').map((l) => pad + l).join('\n');

function claudeGuards(cwd) {
  const rsc = join(cwd, '.rsc');
  const out = [];
  if (existsSync(join(rsc, 'branch-guard.mjs'))) out.push('branch-guard (refuses a commit on a closed main)');
  if (existsSync(join(rsc, 'danger-guard.mjs')) && !existsSync(join(rsc, '.no-danger-guard'))) out.push('danger-guard (stops a force-push, reset --hard and similar)');
  return out;
}

// The OpenCode format the snippets should use: where rsc's rules are, or where they would go.
function opencodeSnippetFormat(state) {
  return state.format === 'manual' ? opencodeFormat(readJsonc(state.path)) : state.format;
}

function stateLine(target, cwd, s) {
  const where = s.path ? rel(cwd, s.path) : '';
  if (s.format === 'manual') return `  Now: not written. ${where} has comments rsc will not rewrite; paste these rules into it:\n${indent(opencodeRulesSnippet(opencodeSnippetFormat(s)))}`;
  const fmt = target === 'opencode' ? ` (${s.format === 'v2' ? 'OpenCode 2 `permissions`' : 'OpenCode 1.x `permission.bash`, read by 2 too'})` : '';
  return `  Now: ${s.wired ? 'on' : 'off'} in ${where}${fmt}.`;
}

function block(target, cwd) {
  const label = LABEL[target] || target;
  const path = gitPermissionsPath(target, cwd);
  if (!path) {
    return `${label}\n  rsc controls: nothing here. ${target === 'cursor'
      ? 'Its CLI matches only the first word, so allowing a push would allow every git command.'
      : 'It has no per-command allow list.'}\n  ${label}'s job: every git permission.`;
  }
  const state = gitPermissionsState(target, cwd);
  const lines = [label, stateLine(target, cwd, state), `  rsc controls: rules in ${rel(cwd, state.path)} that ${RULES}.`];
  if (target === 'claude') {
    const guards = claudeGuards(cwd);
    lines.push(guards.length
      ? `  Also rsc, whatever this switch says: ${guards.join('; ')}.`
      : '  rsc\'s guards (branch-guard, danger-guard) are not installed in this project.');
  }
  lines.push(`  When off: ${state.path.endsWith('.jsonc')
    ? 'rsc never edits opencode.jsonc, so remove the pasted rules yourself; then only your own OpenCode rules apply.'
    : WHEN_OFF[target]}`);
  if (target === 'claude') lines.push(`  ${label}'s job: anything its own permissions decide beyond rsc's rules and guards.`);
  else {
    lines.push(`  ${label}'s job: there is no rsc guard in ${label}, so nothing from rsc stops a commit on main or a force-push there. A stricter policy (refuse a force-push, a human approval) goes in ${label}'s own configuration.`);
    if (target === 'opencode') {
      const fmt = opencodeSnippetFormat(state);
      lines.push(`  To refuse every force-push in OpenCode ${fmt === 'v2' ? '2' : '1.x'} (use "ask" for a human approval), add at the END of ${fmt === 'v2' ? '`permissions`' : '`permission.bash`'} (the last matching rule wins):`);
      lines.push(indent(opencodeForcePushSnippet(fmt)));
    }
  }
  return lines.join('\n');
}

/** The human explanation for `on`, `off` and `status`, one block per assistant in `targets`. */
export function explainGitPermissions({ targets, cwd = process.cwd(), mode = 'status', declared } = {}) {
  const head = {
    on: 'rsc git-permissions on. Saved in .rsc.json: commit it so the team gets the same decision.',
    off: 'rsc git-permissions off. Saved in .rsc.json: commit it so the team gets the same decision.',
    status: `rsc git-permissions: ${declared === undefined ? 'undecided (this project was adopted before; nothing is changed until `rsc git-permissions on`)' : declared ? 'on' : 'off'}.`,
  }[mode];
  return [head, ...targets.map((t) => block(t, cwd))].join('\n\n');
}
