import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, cpSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import * as claudeAdapter from './claude.js';
import * as cursorAdapter from './cursor.js';
import * as mdAdapter from './_md-block.js';

// Project-local single source of truth. Real skill files live here exactly once;
// every assistant gets a lightweight pointer (symlink) back to it — no duplication.
export function baseDir(id, cwd = process.cwd()) {
  return join(cwd, '.rsc', 'skills', id);
}

// Point an assistant's skill folder at the shared base. On macOS/Linux a relative
// symlink avoids duplication. On Windows we copy real files: relative `dir`
// symlinks require Developer Mode/admin and are not reliably followed by skill
// discovery, so correctness wins over de-duplication. Idempotent: replaces any
// existing link/dir at toPath.
export function linkOrCopy(fromDir, toPath) {
  mkdirSync(dirname(toPath), { recursive: true });
  try { lstatSync(toPath); rmSync(toPath, { recursive: true, force: true }); } catch { /* nothing there */ }
  if (process.platform === 'win32') {
    cpSync(fromDir, toPath, { recursive: true });
  } else {
    try {
      symlinkSync(relative(dirname(toPath), fromDir), toPath, 'dir');
    } catch {
      cpSync(fromDir, toPath, { recursive: true });
    }
  }
  return [toPath];
}

// One row per assistant. `root` is where its skill folder lives (relative to the
// project), `hook` is the file that gets the always-on suggest block, `adapter`
// picks how skills + hook are written. `skillExt` (cursor only) means each skill
// is a single converted file, not a linked directory.
const SPEC = {
  // JSON-hook + linked skill dirs
  claude: { root: '.claude/skills', hook: '.claude/settings.json', adapter: 'claude' },
  // Converted .mdc rules
  cursor: { root: '.cursor/rules', hook: '.cursor/rules/rsc-suggest.mdc', adapter: 'cursor', skillExt: '.mdc' },
  // AGENTS.md family — all read the same root AGENTS.md
  codex: { root: '.codex/rsc', hook: 'AGENTS.md', adapter: 'md' },
  opencode: { root: '.opencode/rsc', hook: 'AGENTS.md', adapter: 'md' },
  amp: { root: '.amp/rsc', hook: 'AGENTS.md', adapter: 'md' },
  jules: { root: '.jules/rsc', hook: 'AGENTS.md', adapter: 'md' },
  zed: { root: '.zed/rsc', hook: 'AGENTS.md', adapter: 'md' },
  // Own markdown instructions/rules file
  gemini: { root: '.gemini/rsc', hook: 'GEMINI.md', adapter: 'md' },
  antigravity: { root: '.antigravity/rsc', hook: '.antigravity/AGENTS.md', adapter: 'md' },
  copilot: { root: '.github/rsc', hook: '.github/copilot-instructions.md', adapter: 'md' },
  windsurf: { root: '.windsurf/rsc', hook: '.windsurf/rules/rsc-suggest.md', adapter: 'md' },
  cline: { root: '.clinerules/rsc', hook: '.clinerules/rsc-suggest.md', adapter: 'md' },
  roo: { root: '.roo/rsc', hook: '.roo/rules/rsc-suggest.md', adapter: 'md' },
  continue: { root: '.continue/rsc', hook: '.continue/rules/rsc-suggest.md', adapter: 'md' },
  junie: { root: '.junie/rsc', hook: '.junie/guidelines.md', adapter: 'md' },
  kiro: { root: '.kiro/rsc', hook: '.kiro/steering/rsc-suggest.md', adapter: 'md' },
  aider: { root: '.aider/rsc', hook: 'CONVENTIONS.md', adapter: 'md' },
};

const ADAPTER = { claude: claudeAdapter, cursor: cursorAdapter, md: mdAdapter };

// Wizard multi-select list, in "most famous first" order. label/hint are display
// only; detectTarget just pre-marks the one found in the folder.
export const TARGETS = [
  { id: 'claude', label: 'Claude Code', hint: '.claude/skills/' },
  { id: 'codex', label: 'Codex CLI', hint: 'AGENTS.md' },
  { id: 'copilot', label: 'GitHub Copilot', hint: '.github/copilot-instructions.md' },
  { id: 'cursor', label: 'Cursor', hint: '.cursor/rules/' },
  { id: 'gemini', label: 'Gemini CLI', hint: 'GEMINI.md' },
  { id: 'windsurf', label: 'Windsurf', hint: '.windsurf/rules/' },
  { id: 'cline', label: 'Cline', hint: '.clinerules/' },
  { id: 'antigravity', label: 'Antigravity', hint: '.antigravity/' },
  { id: 'zed', label: 'Zed', hint: 'AGENTS.md' },
  { id: 'continue', label: 'Continue', hint: '.continue/rules/' },
  { id: 'roo', label: 'Roo Code', hint: '.roo/rules/' },
  { id: 'amp', label: 'Amp', hint: 'AGENTS.md' },
  { id: 'opencode', label: 'opencode', hint: 'AGENTS.md' },
  { id: 'jules', label: 'Jules', hint: 'AGENTS.md' },
  { id: 'junie', label: 'JetBrains Junie', hint: '.junie/guidelines.md' },
  { id: 'kiro', label: 'Kiro', hint: '.kiro/steering/' },
  { id: 'aider', label: 'Aider', hint: 'CONVENTIONS.md' },
];

// Which assistants are actually installed here, read from the state file each one
// writes. This is evidence: only an install of ours writes it. Everything below
// (detectTarget) is inference from files a human — or our own `harness` skill —
// may have written for unrelated reasons. Order follows SPEC so the ambiguity
// message is deterministic. A missing, empty or unreadable state means "not
// installed", never an error: a half-written file must not break resolution.
export function installedTargets(cwd = process.cwd()) {
  return TARGET_IDS.filter((id) => {
    try {
      const state = JSON.parse(readFileSync(targetPaths(id, undefined, cwd).stateFile, 'utf8'));
      return Object.keys(state.skills || {}).length > 0;
    } catch { return false; }
  });
}

// Inference, used only when there is no evidence. Unique config dirs win.
//
// Two rules here are scar tissue from issue #249. Claude Code had NO signal at
// all — it was merely the final fallthrough — so any repo with a root AGENTS.md
// resolved to codex even with .claude/ full of skills. And AGENTS.md is the
// weakest signal on purpose: our own `harness` skill writes one into every repo
// it equips, so treating it as a strong hint made the harness poison its own
// detection the moment it ran once.
export function detectTarget(cwd = process.cwd()) {
  const has = (p) => existsSync(join(cwd, p));
  if (has('.cursor')) return 'cursor';
  if (has('.windsurf')) return 'windsurf';
  if (has('.clinerules')) return 'cline';
  if (has('.roo')) return 'roo';
  if (has('.continue')) return 'continue';
  if (has('.junie')) return 'junie';
  if (has('.kiro')) return 'kiro';
  if (has('.zed')) return 'zed';
  if (has('.opencode')) return 'opencode';
  if (has('.amp')) return 'amp';
  if (has('.jules')) return 'jules';
  if (has('.antigravity')) return 'antigravity';
  if (has(join('.github', 'copilot-instructions.md'))) return 'copilot';
  if (has('.claude') || has('CLAUDE.md')) return 'claude';
  if (has('.codex')) return 'codex';
  if (has('.gemini') || has('GEMINI.md')) return 'gemini';
  if (has('AGENTS.md')) return 'codex';       // weakest: our own harness writes this
  return 'claude';
}

// The single point of truth for "which assistant are we acting on". Every command
// goes through here — including doctor, which used to resolve on its own and so
// could report a different target than the one just installed into.
//
// Ambiguity is a distinct outcome, not a value the caller might mistake for an id:
// returning a sentinel string would let a forgetful caller pass it to targetPaths()
// and die with `unknown target`. `ids` empty + `ambiguous` set cannot be used by
// accident.
export function resolveTargets({ cwd = process.cwd(), flagValue } = {}) {
  if (typeof flagValue === 'string' && flagValue.trim()) {
    const ids = flagValue.split(',').map((s) => s.trim()).filter(Boolean);
    return { ids, ambiguous: null, source: 'flag' };
  }
  const found = installedTargets(cwd);
  if (found.length === 1) return { ids: found, ambiguous: null, source: 'evidence' };
  if (found.length > 1) return { ids: [], ambiguous: found, source: 'evidence' };
  return { ids: [detectTarget(cwd)], ambiguous: null, source: 'heuristic' };
}

export function targetPaths(target, home = homedir(), cwd = process.cwd()) {
  const s = SPEC[target];
  if (!s) throw new Error(`unknown target ${target}`);
  const rootAbs = join(cwd, ...s.root.split('/'));
  return {
    root: rootAbs,
    projectRoot: cwd,
    skillDir: (id) => (s.skillExt ? join(rootAbs, `${id}${s.skillExt}`) : join(rootAbs, id)),
    stateFile: join(rootAbs, '.rsc-state.json'),
    hookTarget: join(cwd, ...s.hook.split('/')),
  };
}

export function writeSkill(target, id, fromDir, toPath) {
  return ADAPTER[SPEC[target].adapter].writeSkill(id, fromDir, toPath);
}

export function wireHook(target, paths, sourceMd) {
  return ADAPTER[SPEC[target].adapter].wireHook(paths, sourceMd);
}

// Inverse of wireHook — remove rsc's always-on surface for a target (settings.json
// hook entries / AGENTS-block / cursor rule file). Returns the paths it touched.
export function unwireHook(target, paths) {
  const adapter = ADAPTER[SPEC[target].adapter];
  return adapter.unwireHook ? adapter.unwireHook(paths) : [];
}

// Every known target id — used by `purge` to sweep all assistants, installed or not.
export const TARGET_IDS = Object.keys(SPEC);
