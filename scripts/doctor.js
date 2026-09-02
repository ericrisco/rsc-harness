import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { targetPaths, TARGET_IDS } from '../targets/index.js';
import { readState } from './lib/state.js';
import { divergence } from './lib/divergence.js';
import { loadManifest } from './lib/manifest.js';
import { listBackups } from './lib/backups.js';
import { SDD_GATE_TEXT } from '../targets/hook-once.mjs';
import { isEnabled, checkSello, readSello, countFindings, readEffectiveConfig, validateRiskConfig } from '../targets/sello.mjs';
import { designIdentity } from './lib/design-identity.js';
import { startingPointSummary } from './lib/starting-point.js';
import { countGaps, listSkills, listAgents } from './lib/capabilities.js';
import { resolveCommands, commandPath, targetHasCommands } from '../targets/commands.js';
import { inspectMemoryWiring } from '../targets/memory.js';
import { metricsSummary } from '../targets/session-memory-core.mjs';
import { agentPath } from '../targets/agents.js';

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

// A wired hook is a promise to run a file. `settings.json` existing only proves the
// promise was made — and a fresh clone brings that file (committed) without .rsc/
// (ignored), so every session start fails while the report says all-clear. Read the
// commands we wired and check the files they name actually exist.
//
// Hookless targets get an empty list by construction: their always-on surface is a
// markdown block with no script behind it, so there is nothing that can go missing.
export function missingHookScripts({ target, home = homedir(), cwd = process.cwd() } = {}) {
  if (HOOKLESS_TARGETS.has(target)) return [];
  const file = targetPaths(target, home, cwd).hookTarget;
  let settings;
  try { settings = JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
  const commands = [];
  for (const entries of Object.values(settings?.hooks || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) for (const h of entry?.hooks || []) {
      if (typeof h?.command === 'string') commands.push(h.command);
    }
  }
  const seen = new Set();
  // Commands name the project through ${CLAUDE_PROJECT_DIR}, which only the client
  // expands. Resolve it here or every wired script reads as missing and the report
  // calls a healthy install broken — the mirror image of the bug this check fixes.
  const expand = (c) => c.split('${CLAUDE_PROJECT_DIR}').join(cwd);
  for (const raw of commands) {
    const cmd = expand(raw);
    for (const m of cmd.matchAll(/["']?([^"'\s]*[\\/]\.rsc[\\/][^"'\s]+\.mjs)["']?/g)) {
      const script = m[1];
      if (!existsSync(script)) seen.add(script);
    }
  }
  return [...seen];
}

export function doctor({ target, home, cwd }) {
  const root = cwd || process.cwd();
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const manifest = loadManifest();
  const backups = listBackups({ cwd: root });
  const memory = inspectMemoryWiring(
    target,
    root,
    state.memory,
    Boolean(Object.keys(state.skills || {}).length || state.agents?.length || state.commands?.length),
  );
  if (state.memory && !['unsupported', 'disabled'].includes(memory.mode)) {
    const hasStore = existsSync(join(root, '.rsc', 'memory', 'sessions'))
      || existsSync(join(root, '02-DOCS', 'raw', 'worklog', '.rsc-memory', 'sessions'));
    try {
      memory.metrics = hasStore
        ? metricsSummary({ cwd: root })
        : { sessions: [], total: { cost: null, toolCalls: null }, knownTotal: { cost: 0, toolCalls: 0 }, unknown: { cost: 0, toolCalls: 0 } };
    } catch { memory.metrics = { sessions: [], total: { cost: null, toolCalls: null }, knownTotal: { cost: 0, toolCalls: 0 }, unknown: { cost: 0, toolCalls: 0 } }; }
  }
  const actualSkills = listSkills({ target, home, cwd: root }).map((entry) => entry.id);
  const actualAgents = listAgents({ target, home, cwd: root }).agents.map((entry) => entry.id);
  const desiredCommands = new Set(resolveCommands({
    target,
    skills: actualSkills,
    agents: actualAgents,
    memoryMode: memory.status === 'ready' ? memory.mode : 'degraded',
  }).map((command) => command.name));
  const missingCommands = [];
  const commandOrphans = [];
  if (targetHasCommands(target)) {
    for (const id of state.commands || []) {
      const path = commandPath(target, root, id);
      if (!path || !existsSync(path)) missingCommands.push({ id, path, action: 'Run `npx @ericrisco/rsc sync` to restore this managed command.' });
      else if (!desiredCommands.has(id)) commandOrphans.push({ id, path, action: 'Restore its backing skill/agent with `rsc add`, or run `rsc sync` to reconcile it.' });
    }
  }
  const missingAgents = (state.agents || []).filter((id) => {
    const path = agentPath(target, root, id);
    return path && !existsSync(path);
  }).map((id) => ({ id, action: 'Run `npx @ericrisco/rsc sync` to restore this managed agent.' }));
  const report = {
    target,
    installed: Object.keys(state.skills),
    missing: [],
    // Wired means it can actually run, not merely that the file declaring it is there.
    hookWired: existsSync(paths.hookTarget) && missingHookScripts({ target, home, cwd }).length === 0,
    manifestSkills: manifest.counts.skills,
    backups: {
      exists: existsSync(join(root, '.rsc', 'backups')),
      count: backups.length,
      latest: backups[0]?.id || null,
    },
    contextBudget: contextBudget({ target, home, cwd }),
    sello: selloStatus(root),
    // Whether this harness has a design identity at all. `design` has always DECLARED that it
    // stops without one; until lib/design-identity.js nothing checked it (P2). Reported here,
    // never nagged about and never blocking: a missing identity is low risk (P7).
    designIdentity: designIdentity(root),
    // The other half of the same question: an identity is what this project settled on, a starting
    // point is what it has to settle FROM. Three skills promise to propose one and none could look;
    // this is the look. One field, not a section — a report grows for every user who runs it (P5).
    designStartingPoint: startingPointSummary(root),
    // An inert gate must never read as an armed one (the same rule the sello follows):
    // the gitmoji guard has a per-project kill switch, so say which state it is in.
    gitmojiGuard: existsSync(join(root, '.rsc', '.no-gitmoji')) ? 'opted-out' : 'armed',
    // Counted, never interpreted — by spec, the gap log's reader is the user.
    automationGaps: countGaps(root),
    memory,
    missingAgents,
    missingCommands,
    commandOrphans,
    commandCollisions: state.commandCollisions || [],
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

// Every hook rsc wires, as a table rather than a chain of `if`s: adding one is a row, and
// tests/doctor-hook-counts.test.js iterates it, so a hook added without a row fails the suite instead
// of shipping uncounted. `needle` is the SCRIPT PATH, never the bare `.rsc` — a user's own hook that
// merely mentions the directory must not be counted as ours.
//
// `injects` marks the two hooks that put text into the conversation. It matters because a duplicated
// guard costs processes, not bytes, and conflating the two is how this report lied in the first place.
export const RSC_HOOKS = [
  { id: 'session-start', label: 'session-start', needle: '.rsc/session-start.', injects: 'sessionStart' },
  { id: 'userprompt-gate', label: 'userprompt-gate', needle: '.rsc/userprompt-gate.', injects: 'perTurn' },
  { id: 'worklog-checkpoint', label: 'worklog-checkpoint', needle: '.rsc/worklog-checkpoint.', injects: null },
  { id: 'ship-guard', label: 'ship-guard', needle: '.rsc/ship-guard.', injects: null },
  { id: 'danger-guard', label: 'danger-guard', needle: '.rsc/danger-guard.', injects: null },
  { id: 'gitmoji-guard', label: 'gitmoji-guard', needle: '.rsc/gitmoji-guard.', injects: null },
  // The bash-era form, still retired by unwireHook. If uninstall knows how to remove it, the report
  // has to know how to count it.
  { id: 'legacy-cat-form', label: 'legacy suggest hook', needle: 'skills/rsc/suggest', injects: 'sessionStart' },
];

// Separators come from whatever platform installed: JSON escapes a Windows backslash as a pair, so
// the haystack is normalized before comparing. Same lesson as targets/claude.js, same one-liner.
const entryWiring = (entry) => JSON.stringify(entry).replace(/\\\\/g, '/');

/**
 * How many times each rsc hook is wired, per event.
 * @returns {{perEvent: Object<string, Object<string, number>>, indeterminate: string[]}}
 */
export function countHookEntries(settings) {
  const perEvent = {};
  const indeterminate = [];
  const hooks = settings && typeof settings === 'object' ? settings.hooks : null;
  if (!hooks || typeof hooks !== 'object') return { perEvent, indeterminate };

  for (const [event, entries] of Object.entries(hooks)) {
    // A hand-edited file can put anything here. An event we cannot read is REPORTED, never counted as
    // zero — a silent zero is exactly the "all clear" this whole delivery exists to stop.
    if (!Array.isArray(entries)) { indeterminate.push(event); continue; }
    for (const entry of entries) {
      const wiring = entryWiring(entry);
      for (const hook of RSC_HOOKS) {
        if (!wiring.includes(hook.needle)) continue;
        perEvent[event] ||= {};
        perEvent[event][hook.id] = (perEvent[event][hook.id] || 0) + 1;
      }
    }
  }
  return { perEvent, indeterminate };
}

// The most copies any one hook has, per injection channel — that is the multiplier that channel pays.
function maxCopies(perEvent, channel) {
  let most = 1;
  for (const byHook of Object.values(perEvent)) {
    for (const [id, n] of Object.entries(byHook)) {
      const hook = RSC_HOOKS.find((h) => h.id === id);
      if (hook && hook.injects === channel && n > most) most = n;
    }
  }
  return most;
}

function readScope(scopeRoot, label) {
  const settingsPath = join(scopeRoot, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) {
    return { label, root: scopeRoot, wired: false, status: 'ok', alwaysOnBytes: 0, perTurnBytes: 0, version: null };
  }
  let raw;
  let settings;
  try {
    raw = readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(raw); // a scope we cannot parse is reported, not guessed at
  } catch {
    return { label, root: scopeRoot, wired: true, status: 'unknown', alwaysOnBytes: 0, perTurnBytes: 0, version: null };
  }
  const wired = raw.includes('.rsc/') || raw.includes('.rsc\\\\');
  let version = null;
  try { version = readFileSync(join(scopeRoot, '.rsc', '.version'), 'utf8').trim() || null; } catch { /* unknown */ }

  const { perEvent, indeterminate } = countHookEntries(settings);
  // The context regime is a STATIC fact, not a caveat: the repeated body is suppressed because the
  // hook calls the single-shot guard, and that guard is a file on disk. Present → the body lands once
  // however many entries fire. Absent (an install older than the guard) → every entry injects.
  //
  // Measured during clarify: four entries sharing a session_id cost ~1.27× context, not 4×. A figure
  // that multiplied unconditionally would be the same lie that started this spec, aimed the other way.
  const dedupeGuard = existsSync(join(scopeRoot, '.rsc', 'hook-once.mjs'));
  const bodyCopies = dedupeGuard ? 1 : maxCopies(perEvent, 'sessionStart');
  const gateCopies = dedupeGuard ? 1 : maxCopies(perEvent, 'perTurn');

  return {
    label,
    root: scopeRoot,
    wired,
    status: 'ok',
    version,
    hookCounts: perEvent,
    hookCountsUnknown: indeterminate.length ? indeterminate : null,
    dedupeGuard,
    alwaysOnBytes: wired ? alwaysOnBytesFor(scopeRoot, raw) * bodyCopies : 0,
    perTurnBytes: wired && raw.includes('userprompt-gate') ? Buffer.byteLength(SDD_GATE_TEXT) * gateCopies : 0,
  };
}

// One finding per scope that has any hook wired more than once. Both costs are named, because they
// are different quantities: processes are 4× unconditionally, bytes only when the guard is missing.
function duplicateEntryFindings(scopes) {
  const out = [];
  for (const scope of scopes) {
    if (scope.status !== 'ok' || !scope.hookCounts) continue;
    const repeated = [];
    for (const [event, byHook] of Object.entries(scope.hookCounts)) {
      for (const [id, n] of Object.entries(byHook)) {
        if (n > 1) repeated.push({ event, id, n, label: RSC_HOOKS.find((h) => h.id === id)?.label || id });
      }
    }
    if (!repeated.length) continue;
    const worst = Math.max(...repeated.map((r) => r.n));
    const list = repeated.map((r) => `${r.event}/${r.label} ×${r.n}`).join(', ');
    const contextNote = scope.dedupeGuard
      ? 'Context cost stays near 1× — the single-shot guard suppresses the repeated always-on body '
        + '(the residue is the banners printed outside it).'
      : `Context cost is the full ${worst}× — this scope has no single-shot guard materialized, so every `
        + 'entry injects the always-on body again.';
    out.push({
      id: 'duplicate-hook-entries',
      severity: 'high',
      summary: `The ${scope.label} scope wires the same hook more than once: ${list}. `
        + `Execution cost is ${worst}× processes per event — every session start, every turn, and every `
        + `Bash command spawns that many. ${contextNote}`,
      action: 'Re-run an install or sync with a current rsc (`npx @ericrisco/rsc@latest`); one pass '
        + 'collapses the extra copies. No need to hand-edit settings.json.',
    });
  }
  return out;
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
  const orphanScripts = missingHookScripts({ target, home, cwd });
  if (orphanScripts.length) {
    // ONE finding, not one per file: a clone is missing all eight at once, and a list of
    // eight paths buries the single thing the reader has to do (principle 5).
    findings.push({
      id: 'hook-scripts-missing',
      severity: 'high',
      summary: `${orphanScripts.length} hook script(s) named by the wiring are not on disk, so those hooks `
        + 'fail every time they fire. This is what a fresh clone looks like: the settings travelled, the '
        + 'scripts did not.',
      action: 'Rebuild them with `npx @ericrisco/rsc repair` from this project root.',
    });
  }
  const drift = divergence({ cwd, target, home });
  if (drift.missing.length || drift.extra.length || drift.ownMissing.length) {
    // The day-two case: a teammate changed the harness and this checkout has not caught
    // up. Reported always, even after someone declines to align — the divergence does not
    // stop being true because they said no.
    const parts = [];
    if (drift.missing.length) parts.push(`missing ${drift.missing.join(', ')}`);
    if (drift.ownMissing.length) parts.push(`${drift.ownMissing.join(', ')} declared by the team but not in this repo`);
    if (drift.extra.length) parts.push(`${drift.extra.join(', ')} installed but no longer declared`);
    findings.push({
      id: 'manifest-divergence',
      severity: 'medium',
      summary: `This checkout does not match what .rsc.json declares: ${parts.join('; ')}.`,
      action: drift.ownMissing.length && !drift.missing.length && !drift.extra.length
        ? 'Those come from the repo, not from rsc — pull, or ask whoever wrote them.'
        : 'Align with `npx @ericrisco/rsc sync`. Nothing is written until you run it.',
    });
  }
  findings.push(...duplicateEntryFindings(scopes));
  for (const s of scopes) {
    if (s.hookCountsUnknown) {
      findings.push({
        id: 'indeterminate-hook-event',
        severity: 'low',
        summary: `In the ${s.label} scope, ${s.hookCountsUnknown.join(', ')} is not a list of hook entries, `
          + 'so its copies cannot be counted. A count this report cannot make is said out loud, never '
          + 'reported as zero.',
        action: 'Fix that entry in settings.json (or remove it), then re-run `rsc doctor`.',
      });
    }
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
