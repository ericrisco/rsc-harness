import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { targetPaths, TARGET_IDS } from '../targets/index.js';
import { readState } from './lib/state.js';
import { loadManifest } from './lib/manifest.js';
import { listBackups } from './lib/backups.js';
import { SDD_GATE_TEXT } from '../targets/hook-once.mjs';
import { isEnabled, checkSello, readSello, countFindings, readEffectiveConfig, validateRiskConfig } from '../targets/sello.mjs';

// The sello's health, surfaced where the user already looks (spec: non-blocking
// findings live in the project and are SUMMARIZED here, never nagged about).
// An INERT gate must never read as an armed one — a config that silently disables
// enforcement is reported here, loudly.
function selloStatus(root) {
  try {
    if (!isEnabled(root)) return { enabled: false };
    const sello = readSello(root);
    const verdict = checkSello(root);
    const out = {
      enabled: true,
      decidedBy: readEffectiveConfig(root)?.scope,
      check: verdict.code,
      status: sello.missing ? 'none' : sello.corrupt ? 'corrupt' : sello.status,
      nonBlockingFindings: countFindings(root),
    };
    if (verdict.warning) out.warning = verdict.warning;
    if (verdict.code === 'no-trunk') out.inert = 'no-trunk';
    if (existsSync(join(root, '.rsc', '.no-ship-guard'))) {
      out.note = 'ship-guard branch-hygiene rules are opted out (.rsc/.no-ship-guard); the sello itself still enforces.';
    }
    try {
      const { lowered } = validateRiskConfig(readEffectiveConfig(root) || {});
      if (lowered.length) out.loweredClasses = lowered;
    } catch (e) { out.configError = e.message; }
    return out;
  } catch { return { enabled: false }; }
}

export function doctor({ target, home, cwd }) {
  const root = cwd || process.cwd();
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const manifest = loadManifest();
  const backups = listBackups({ cwd: root });
  const report = {
    target,
    installed: Object.keys(state.skills),
    missing: [],
    hookWired: existsSync(paths.hookTarget),
    manifestSkills: manifest.counts.skills,
    backups: {
      exists: existsSync(join(root, '.rsc', 'backups')),
      count: backups.length,
      latest: backups[0]?.id || null,
    },
    contextBudget: contextBudget({ target, home, cwd }),
    sello: selloStatus(root),
  };
  for (const [id, e] of Object.entries(state.skills)) {
    for (const f of e.files) if (!existsSync(f)) report.missing.push(`${id}:${f}`);
  }
  return report;
}

// ---------------------------------------------------------------------------------------
// Context budget — what the harness costs in tokens before the user has typed anything.
//
// Until this existed, the only way to learn that a harness was injecting the same 11KB block
// twice per session was to read the hook wiring by hand. `audit` judges bloat by NUMBER of
// installed skills, which is orthogonal: five heavy skills cost more than twenty light ones.
// This measures weight, names the biggest contributors, and never writes anything.
// ---------------------------------------------------------------------------------------

// Targets whose "always-on" surface is a markdown file the assistant reads on its own terms
// (the AGENTS.md family, cursor rules). There is no per-session or per-turn injection to
// measure, and reporting 0 would read as "this costs you nothing" — a different, wrong claim.
const HOOKLESS_TARGETS = new Set(TARGET_IDS.filter((t) => t !== 'claude'));

const bytesOf = (p) => { try { return statSync(p).size; } catch { return 0; } };

// The always-on body a wired scope injects: the hook command embeds the exact SKILL.md path,
// so read it from there rather than guessing the layout.
function alwaysOnBytesFor(scopeRoot, settingsRaw) {
  const fromCommand = /"([^"]*suggest[^"]*SKILL\.md)"/.exec(settingsRaw || '');
  if (fromCommand && bytesOf(fromCommand[1])) return bytesOf(fromCommand[1]);
  return bytesOf(join(scopeRoot, '.rsc', 'skills', 'suggest', 'SKILL.md'));
}

function readScope(scopeRoot, label) {
  const settingsPath = join(scopeRoot, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) {
    return { label, root: scopeRoot, wired: false, status: 'ok', alwaysOnBytes: 0, perTurnBytes: 0, version: null };
  }
  let raw;
  try {
    raw = readFileSync(settingsPath, 'utf8');
    JSON.parse(raw); // a scope we cannot parse is reported, not guessed at
  } catch {
    return { label, root: scopeRoot, wired: true, status: 'unknown', alwaysOnBytes: 0, perTurnBytes: 0, version: null };
  }
  const wired = raw.includes('.rsc/') || raw.includes('.rsc\\\\');
  let version = null;
  try { version = readFileSync(join(scopeRoot, '.rsc', '.version'), 'utf8').trim() || null; } catch { /* unknown */ }
  return {
    label,
    root: scopeRoot,
    wired,
    status: 'ok',
    version,
    alwaysOnBytes: wired ? alwaysOnBytesFor(scopeRoot, raw) : 0,
    perTurnBytes: wired && raw.includes('userprompt-gate') ? Buffer.byteLength(SDD_GATE_TEXT) : 0,
  };
}

// Frontmatter `description` of an installed skill — the part of a skill that is ALWAYS in
// context, whether or not the skill is ever invoked. Cheap to parse, and the figure that
// matters most as the catalog grows.
function descriptionBytes(skillDir) {
  try {
    const text = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm) return 0;
    const d = /description:\s*([\s\S]*?)(?=\n[a-z_]+:|$)/.exec(fm[1]);
    return d ? Buffer.byteLength(d[1].trim()) : 0;
  } catch { return 0; }
}

export function contextBudget({ target, home = homedir(), cwd = process.cwd() } = {}) {
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const installed = Object.keys(state.skills || {});
  const hookless = HOOKLESS_TARGETS.has(target);

  // Both scopes rsc can be wired in. They are independent installs: this is exactly the pair
  // that silently doubles every injected block.
  const scopes = hookless ? [] : [
    readScope(cwd, 'project'),
    ...(join(home) === join(cwd) ? [] : [readScope(home, 'user')]),
  ];
  const wired = scopes.filter((s) => s.wired);

  const perSkill = installed.map((id) => {
    const base = state.skills[id]?.base || paths.skillDir(id);
    return { id, bytes: bytesOf(join(base, 'SKILL.md')), descriptionBytes: descriptionBytes(base) };
  });
  const descriptionsBytes = perSkill.reduce((s, k) => s + k.descriptionBytes, 0);

  const findings = [];
  if (wired.length > 1) {
    const doubled = wired.reduce((s, k) => s + k.alwaysOnBytes + k.perTurnBytes, 0)
      - (wired[0].alwaysOnBytes + wired[0].perTurnBytes);
    findings.push({
      id: 'duplicate-wiring',
      severity: 'high',
      summary: `rsc is wired in ${wired.length} scopes (${wired.map((s) => s.label).join(' + ')}), so every `
        + `injected block lands ${wired.length} times — about ${doubled} wasted bytes per session.`,
      action: 'Keep ONE scope. Remove the other with `npx @ericrisco/rsc uninstall --all` run from that '
        + 'root, or update both to a version that de-duplicates at runtime.',
    });
  }
  for (const s of scopes) {
    if (s.status === 'unknown') {
      findings.push({
        id: 'unreadable-scope',
        severity: 'low',
        summary: `The ${s.label} scope at ${s.root} has a settings.json that cannot be parsed, so its weight is unknown.`,
        action: 'Fix or remove that settings.json, then re-run `rsc doctor`.',
      });
    }
  }

  const byBytes = (a, b) => b.bytes - a.bytes;
  return {
    scopes,
    notApplicable: hookless ? ['sessionStart', 'perTurn'] : [],
    sessionStartBytes: wired.reduce((s, k) => s + k.alwaysOnBytes, 0),
    perTurnBytes: wired.reduce((s, k) => s + k.perTurnBytes, 0),
    descriptionsBytes,
    installedSkills: installed.length,
    topContributors: {
      bodies: [...perSkill].sort(byBytes).slice(0, 5).map(({ id, bytes }) => ({ id, bytes })),
      descriptions: [...perSkill]
        .sort((a, b) => b.descriptionBytes - a.descriptionBytes)
        .slice(0, 5)
        .map(({ id, descriptionBytes: bytes }) => ({ id, bytes })),
    },
    findings,
    note: hookless
      ? 'This target has no hook injection; only skill weight applies.'
      : 'sessionStart counts the always-on body per wired scope; conditional banners are excluded.',
  };
}
