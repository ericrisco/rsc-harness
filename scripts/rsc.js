#!/usr/bin/env node
import { loadManifest, skillsForProfile } from './lib/manifest.js';
import { detectTarget, installedTargets, resolveTargets, TARGETS } from '../targets/index.js';
import { detectRepo } from './detect-repo.js';
import { rank } from './consult.js';
import { expandRecommends, toOutcomes, hasOutcome } from './lib/recommend.js';
import { applyInstall, listInstalled, listInstalledAgents, listInstalledCommands, uninstall, syncInstalled, purge, collisions } from './install-apply.js';
import { stackAgentNames } from '../targets/agents.js';
import { doctor } from './doctor.js';
import { ask, say, select, pickFrom, banner, confirm, isInteractive } from './lib/ui.js';
import { refreshRegistry, registryStatus } from './lib/registry.js';
import { audit, writeAuditReport } from './audit.js';
import { DOMAINS } from './lib/domains.js';
import { listBackups, restoreBackup } from './lib/backups.js';
import { runUpgrade } from './lib/upgrade.js';
import { diagnose, repair } from './lib/repair.js';
import { DEFAULT_SKILL_FLOOR, withDefaultSkillFloor } from './lib/default-skill-floor.js';
import { readManifest, writeManifest } from './lib/manifest-file.js';
import {
  normalizeOnboarding, missingOnboardingFields, scanProject,
  buildOnboardingPlan, decodeGoal, encodeGoal, identifyPlan, recommendDeferredComponents,
} from './lib/onboarding.js';
import { applyAcceptedOnboarding, verifyOnboarding } from './lib/onboarding-apply.js';

const rawArgv = process.argv.slice(2);
const GLOBAL_VALUE_FLAGS = new Set([
  '--target', '--technical-level', '--accompaniment', '--project-kind', '--goal', '--goal-base64', '--software-scope', '--accept-plan',
]);
const COMMANDS = new Set(['onboard', 'reassess', 'add', 'install', 'consult', 'catalog', 'audit', 'list', 'doctor', 'memory', 'sync', 'backups', 'restore', 'upgrade', 'registry', 'worktrees', 'capabilities', 'sello', 'repair', 'uninstall', 'purge']);
function positionalTokens(input) {
  const out = [];
  for (let i = 0; i < input.length; i++) {
    if (GLOBAL_VALUE_FLAGS.has(input[i]) || input[i] === '--profile' || input[i] === '--without') { i++; continue; }
    if (input[i].startsWith('--')) continue;
    out.push(input[i]);
  }
  return out;
}
const candidate = positionalTokens(rawArgv)[0];
const cmd = candidate || undefined;
const argv = cmd && COMMANDS.has(cmd)
  ? [cmd, ...rawArgv.filter((_, index) => index !== rawArgv.indexOf(cmd))]
  : rawArgv;

const targetLabel = (id) => TARGETS.find((t) => t.id === id)?.label || id;

function requestedIds(start = 1) {
  const valueFlags = new Set(['--target', '--profile', '--without']);
  const ids = [];
  for (let i = start; i < argv.length; i++) {
    if (valueFlags.has(argv[i])) { i++; continue; }
    if (argv[i].startsWith('--')) continue;
    ids.push(argv[i]);
  }
  return ids;
}

function onboardingInput(targets) {
  const value = (name) => {
    const v = flag(name);
    return typeof v === 'string' && !v.startsWith('--') ? v : undefined;
  };
  return {
    schemaVersion: 1,
    technicalLevel: value('technical-level'),
    accompaniment: value('accompaniment'),
    projectKind: value('project-kind'),
    goal: value('goal') || (value('goal-base64') ? decodeGoal(value('goal-base64')) : undefined),
    softwareScope: value('software-scope'),
    targets,
  };
}

function onboardingRequired(raw, action = 'onboard') {
  const payload = {
    code: 'RSC_ONBOARDING_REQUIRED',
    schemaVersion: 1,
    missing: missingOnboardingFields(raw),
    recovery: `Run npx @ericrisco/rsc@latest ${action} --technical-level <non-technical|mixed|technical> --accompaniment <L0|L1|L2|L3> --project-kind <software|operations|research|content|mixed> --goal "<what you want>" --target <assistant>`,
  };
  console.error(`RSC_ONBOARDING_REQUIRED ${JSON.stringify(payload)}`);
  process.exitCode = 2;
}

function hasDeclaredHarness(manifest = readManifest()) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.targets) || !manifest.targets.length
    || !manifest.targets.every((target) => TARGETS.some((known) => known.id === target))
    || !Array.isArray(manifest.skills) || !manifest.skills.length) return false;
  const receipt = manifest.onboarding;
  if (receipt) {
    try {
      const verified = receipt.schemaVersion === 1
        && identifyPlan(receipt.plan) === receipt.acceptedPlanId
        && verifyOnboarding(process.cwd(), receipt.plan, receipt.acceptedPlanId).length === 0;
      if (verified) return true;
      if (receipt.maintenanceDrift && installedTargets(process.cwd()).some((target) => manifest.targets.includes(target))) return true;
    } catch { return false; }
  }
  // Backward compatibility is evidence-based: an actually installed pre-onboarding
  // harness keeps its maintenance commands. A hand-written or merely committed
  // declaration with no local state cannot bypass first contact.
  return installedTargets(process.cwd()).some((target) => manifest.targets.includes(target));
}

function markMaintenanceDrift(action) {
  const manifest = readManifest();
  if (!manifest?.onboarding) return;
  writeManifest(process.cwd(), {
    ...manifest,
    onboarding: {
      ...manifest.onboarding,
      maintenanceDrift: { action, recordedAt: new Date().toISOString(), requiresReassessment: true },
    },
  });
}

function renderPlan(plan, planId) {
  say('RSC_ONBOARDING_PLAN');
  say(`Plan id: ${planId}`);
  say(`Project: ${plan.record.projectKind}${plan.record.softwareScope ? ` (${plan.record.softwareScope})` : ''}`);
  say(`Targets: ${plan.policy.targets.join(', ')}`);
  say('Selected:');
  for (const decision of plan.decisions.filter((d) => d.state === 'selected')) say(`  + ${decision.kind}/${decision.id} — ${decision.reason}`);
  say('Deferred:');
  for (const decision of plan.decisions.filter((d) => d.state === 'deferred')) say(`  - ${decision.kind}/${decision.id} — ${decision.reason} Reevaluate: ${decision.reevaluateWhen.join('; ')}`);
  say('Excluded:');
  for (const decision of plan.decisions.filter((d) => d.state === 'excluded')) say(`  × ${decision.kind}/${decision.id} — ${decision.reason}`);
  say('Managed paths:');
  for (const path of plan.governedPaths) say(`  ${path}`);
  if (plan.evidence.parentHarness) say(`Parent harness detected at ${plan.evidence.parentHarness}; it is not inherited by this plan.`);
  const pieces = [
    'npx @ericrisco/rsc@latest onboard',
    `--technical-level ${plan.record.technicalLevel}`,
    `--accompaniment ${plan.record.accompaniment}`,
    `--project-kind ${plan.record.projectKind}`,
    `--goal-base64 ${encodeGoal(plan.record.goal)}`,
    ...(plan.record.softwareScope ? [`--software-scope ${plan.record.softwareScope}`] : []),
    `--target ${plan.record.targets.join(',')}`,
    `--accept-plan ${planId}`,
  ];
  say(`Accept exactly this plan: ${pieces.join(' ')}`);
}

async function runOnboarding(targets) {
  const raw = onboardingInput(targets);
  if (isInteractive() && missingOnboardingFields(raw).length) {
    await banner(loadManifest().counts.skills);
    say('Before rsc writes anything, it will learn how to help and show the exact harness plan.');
    raw.technicalLevel ||= await select('How technical should the conversation be?', [
      { key: 'non-technical', label: 'Plain language — explain terms and avoid code jargon' },
      { key: 'mixed', label: 'Mixed — concise explanations with useful technical detail' },
      { key: 'technical', label: 'Technical — assume I am comfortable with code and tooling' },
    ]);
    raw.accompaniment ||= await select('How much accompaniment do you want?', [
      { key: 'L0', label: 'L0 — results only' },
      { key: 'L1', label: 'L1 — brief reasons, questions only when needed' },
      { key: 'L2', label: 'L2 — explain each relevant decision' },
      { key: 'L3', label: 'L3 — guide me through everything' },
    ]);
    raw.projectKind ||= await select('What are you building or running?', [
      { key: 'software', label: 'Software or a website' },
      { key: 'operations', label: 'Operations, a company or a process' },
      { key: 'research', label: 'Research or a knowledge base' },
      { key: 'content', label: 'Content or publishing' },
      { key: 'mixed', label: 'A combination of these' },
    ]);
    raw.goal ||= await ask('What do you want this project to achieve? > ');
    if ((raw.projectKind === 'software' || raw.projectKind === 'mixed') && !raw.softwareScope) {
      raw.softwareScope = await select('How much software work is expected now?', [
        { key: 'small', label: 'Small — one focused tool or a few simple changes' },
        { key: 'growing', label: 'Growing — several related features or integrations' },
        { key: 'complex', label: 'Complex — multiple systems, teams or critical behavior' },
      ]);
    }
    if (!raw.targets?.length) raw.targets = await selectAgents();
    if (!raw.technicalLevel || !raw.accompaniment || !raw.projectKind || !raw.goal || !raw.targets?.length) {
      say('Cancelled — nothing was touched.');
      return;
    }
  }
  if (missingOnboardingFields(raw).length) return onboardingRequired(raw);
  let record;
  try { record = normalizeOnboarding(raw); } catch (error) {
    console.error(`RSC_ONBOARDING_INVALID: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const plan = buildOnboardingPlan(record, scanProject(process.cwd()));
  const planId = identifyPlan(plan);
  const accepted = flag('accept-plan');
  if (!accepted) {
    renderPlan(plan, planId);
    if (!isInteractive()) return;
    if (!(await confirm('Accept this exact harness plan?'))) return void say('Cancelled — nothing was touched.');
  }
  if (accepted && accepted !== planId) {
    console.error(`RSC_PLAN_CHANGED: accepted ${accepted}, current plan is ${planId}. Regenerate the plan and ask the user to accept the new id.`);
    process.exitCode = 3;
    return;
  }
  try {
    await applyAcceptedOnboarding({ cwd: process.cwd(), plan, planId });
    say(`RSC_ONBOARDING_READY ${planId}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 4;
  }
}

function runReassessment() {
  const manifest = readManifest();
  const plan = manifest?.onboarding?.plan;
  if (!plan) {
    console.error('RSC_ONBOARDING_REQUIRED: no accepted onboarding receipt. Run npx @ericrisco/rsc@latest onboard');
    process.exitCode = 2;
    return;
  }
  const recommendations = recommendDeferredComponents(plan, scanProject(process.cwd()));
  if (!recommendations.length) return void say('RSC_REASSESSMENT_NO_CHANGE');
  say('RSC_REASSESSMENT_RECOMMENDED');
  for (const item of recommendations) say(`  ${item.kind}/${item.id}: ${item.explanation}`);
  const record = recommendations[0].suggestedRecord || plan.record;
  say('Review a new plan; nothing has been installed:');
  say([
    'npx @ericrisco/rsc@latest onboard',
    `--technical-level ${record.technicalLevel}`,
    `--accompaniment ${record.accompaniment}`,
    `--project-kind ${record.projectKind}`,
    `--goal-base64 ${encodeGoal(record.goal)}`,
    ...(record.softwareScope ? [`--software-scope ${record.softwareScope}`] : []),
    `--target ${record.targets.join(',')}`,
  ].join(' '));
  say('Show the new plan and ask the user to accept its id before applying it.');
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}

function classifyRequested(ids) {
  const skills = new Set(loadManifest().skills.map((skill) => skill.id));
  const agents = new Set(stackAgentNames());
  const out = { skills: [], agents: [], unknown: [] };
  for (const id of ids) {
    if (skills.has(id)) out.skills.push(id);
    else if (agents.has(id)) out.agents.push(id);
    else out.unknown.push(id);
  }
  return out;
}

function reportUnknown(ids) {
  if (!ids.length) return false;
  const candidates = [...loadManifest().skills.map((skill) => skill.id), ...stackAgentNames()];
  for (const id of ids) {
    const close = [...candidates].sort((a, b) => editDistance(id, a) - editDistance(id, b) || a.localeCompare(b)).slice(0, 3);
    console.error(`rsc: unknown skill or agent '${id}'. Closest: ${close.join(', ')}`);
  }
  process.exitCode = 1;
  return true;
}

// Commands that act ON one assistant. Only these stop when two are installed and no
// flag says which: `purge` sweeps every target by design, and the catalog/consult
// side barely touches one, so blocking them would be a regression, not a safeguard.
const NEEDS_TARGET = new Set([
  'onboard', 'add', 'install', 'list', 'doctor', 'sync', 'uninstall', 'capabilities', 'catalog', 'registry',
]);

function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] || true) : undefined;
}

// Remove everything rsc installed in this project (skills, hooks, .rsc/), across
// every assistant. Keeps 02-DOCS/ unless --with-docs. `purge` / `uninstall --all`.
async function runPurge(dryRun, withDocs) {
  const removed = await purge({ cwd: process.cwd(), withDocs, dryRun });
  say(`${dryRun ? 'Would remove' : 'Removed'} ${removed.length} path(s):`);
  for (const r of removed) say(`  - ${r}`);
  if (!withDocs) say('\nKept 02-DOCS/ (your knowledge base). Add --with-docs to remove it too.');
}

async function recommendIds(query, { labeledOnly = false } = {}) {
  const m = loadManifest();
  const repo = detectRepo();
  const ranked = query ? (await rank(m, query)).map((r) => r.id) : [];
  let base = [...new Set(query ? [...ranked, ...repo] : repo)].filter((id) => id !== 'suggest');
  if (labeledOnly) base = base.filter(hasOutcome);
  base = base.slice(0, 4);
  let out = expandRecommends(m, base).filter((id) => id !== 'suggest');
  if (labeledOnly) out = out.filter(hasOutcome);
  return out.slice(0, 6);
}

// Pick skills by browsing the domains, accumulating across rounds.
// Returns the chosen skill ids, or null if the user backed out to the main menu.
async function manualSelect() {
  const chosen = new Set();
  for (;;) {
    const opts = DOMAINS.map((d, i) => ({ key: String(i), label: `${d.title} (${d.ids.length})` }));
    opts.push({ key: 'done', label: chosen.size ? `✅ Finish & install (${chosen.size} chosen)` : 'Finish (install nothing)' });
    opts.push({ key: 'back', label: '← Back to the main menu' });
    const k = await select('\nWhich area do you want to install skills from?', opts);
    if (k === 'back' || k === null) return null;          // esc or Back → main menu
    if (k === 'done') break;
    const d = DOMAINS[parseInt(k, 10)];
    const picked = await pickFrom(`${d.title}:`, d.ids);  // null = esc → leave this area unchanged
    if (picked) picked.forEach((id) => chosen.add(id));
    say(`   → ${chosen.size} skills chosen so far.`);
  }
  return [...chosen];
}

// Ask which assistants to install into. The detected one is pre-labelled but
// nothing is auto-applied — the user always confirms the set (one or many).
async function selectAgents() {
  const detected = detectTarget();
  const items = TARGETS.map((t) => ({
    id: t.id,
    label: `${t.label}  (${t.hint})${t.id === detected ? '   ⟵ detected here' : ''}`,
  }));
  const chosen = await pickFrom('Which assistants do you want to install for? (space to toggle, a = all)', items);
  if (chosen === null) return null;          // esc → back to the main menu
  return chosen.length ? chosen : [detected];
}

// After installing, remind the user how to actually start — per IDE — and that
// rsc keeps recommending skills as they work. The harness/SDD *init* runs INSIDE
// the assistant (with the user present), never blindly from this CLI.
function printNextSteps(targets, ids) {
  const hasHarness = ids.includes('harness');
  const hasSdd = ids.includes('sdd') || ids.includes('sdd-init');
  const label = (id) => TARGETS.find((t) => t.id === id)?.label || id;
  const openLine = `Open this project in: ${targets.map((t) => `**${label(t)}**`).join(' · ')}`;

  say('\n────────────────────────────────────────────────────────');
  say('👉 When you start working (these steps happen in your assistant, not here):');
  let n = 1;
  say(`   ${n++}. ${openLine}`);
  if (hasHarness) {
    say(`   ${n++}. Set up the second brain — tell it:`);
    say('        "set up the harness for this project"');
    say('      → creates 01-TOOLS/ (connections) + 02-DOCS/ (wiki) + CLAUDE.md/AGENTS.md.');
  }
  if (hasSdd) {
    say(`   ${n++}. For a new feature, tell it:`);
    say('        "sdd-init"   then   "I want <your idea>"');
    say('      → walks you specify → plan → tasks → implement → verify → ship.');
  }
  say(`   ${n++}. From there, work in your own words. orient + suggest stay always-on; bro is ready on request:`);
  say('      they keep you oriented, propose missing skills, and rewrite in plain human language when asked.');
  say('\n   Add something by hand anytime:    npx @ericrisco/rsc add <skill>');
  say('   Browse the catalog / get picks:   npx @ericrisco/rsc consult "whatever you need"');
  say('────────────────────────────────────────────────────────');
  if (targets.includes('codex')) say('   Codex: review and trust the project lifecycle hook once with `/hooks`; until then memory is reported as requiring trust.');
  if (targets.includes('cursor')) say('   Cursor: startup memory is assisted because its sessionStart hook is fire-and-forget; the installed always-on rule performs the read-before-action fallback.');
  printAgentHandoff();
}

// A machine-readable handoff addressed to the AGENT (not the human). After an
// equipping install the skills + hooks are on disk but NOT live until the session
// reloads (Claude Code loads them at SessionStart; Codex reads AGENTS.md next turn).
// "Minute 1" = the user's NEXT message works with everything loaded — so we tell the
// agent to reload, confirm it's equipped, and explicitly NOT auto-start a task.
function printAgentHandoff() {
  say('\n════════════════ AGENT HANDOFF ════════════════');
  say('rsc is installed but NOT active in this session yet.');
  say('AGENT, do this now:');
  say('  1. Reload/restart this session so the new skills + hooks load');
  say('     (Claude Code: restart the session · Codex/AGENTS.md tools: next turn).');
  say('  2. After reload you are EQUIPPED — orient + suggest are always-on; bro is installed.');
  say('  3. Tell the user rsc is ready; they can start in their own words.');
  say('     Do NOT auto-start a task — wait for the user.');
  say('════════════════════════════════════════════════');
}

// What the harness costs in context before the user types anything. Printed ahead of the raw
// health JSON because it is the part a human acts on: the figures say whether the harness is
// paying its way, and the findings say what to do about it.
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function printContextBudget(b) {
  if (!b) return;
  say('\n════════════════ CONTEXT BUDGET ════════════════');
  if (b.notApplicable.length) {
    say(`  ${b.note}`);
  } else {
    say(`  Per session start : ${kb(b.sessionStartBytes)}   (always-on body, per wired scope)`);
    say(`  Per user turn     : ${kb(b.perTurnBytes)}`);
  }
  say(`  Skill descriptions: ${kb(b.descriptionsBytes)}   (${b.installedSkills} installed, always in context)`);
  if (b.topContributors.bodies.length) {
    const top = b.topContributors.bodies.map((t) => `${t.id} ${kb(t.bytes)}`).join(' · ');
    say(`  Heaviest bodies   : ${top}`);
  }
  for (const s of b.scopes.filter((x) => x.wired)) {
    say(`  Scope ${s.label.padEnd(8)}: ${s.root}${s.version ? ` (${s.version})` : ''}${s.status === 'unknown' ? ' — UNREADABLE' : ''}`);
    // Copies are printed only when there is something to see. A line saying "×1" on every healthy
    // box is noise, and noise is what gets a report skimmed instead of read.
    const repeated = Object.entries(s.hookCounts || {})
      .flatMap(([event, byHook]) => Object.entries(byHook).filter(([, n]) => n > 1).map(([id, n]) => `${event}/${id} ×${n}`));
    if (repeated.length) say(`  Hook copies     : ${repeated.join(' · ')}`);
  }
  for (const f of b.findings) {
    say(`\n  [${f.severity.toUpperCase()}] ${f.summary}`);
    say(`  → ${f.action}`);
  }
  say('════════════════════════════════════════════════\n');
}

async function wizard(flagTargets) {
  const m = loadManifest();
  await banner(m.counts.skills);
  say('  the skill catalog for your assistant (Claude Code · Codex · Cursor · Gemini · Antigravity)\n');
  // The base set is READ from the manifest, never enumerated here: a hand-kept list in a menu
  // label is parallel accounting (P3), and it silently starts lying the day a skill's profiles
  // change. The exact ids are printed before the install confirmation either way.
  const baseIds = skillsForProfile(m, 'minimal');
  // Navigable loop: esc / "← Back" / "no" all return here instead of quitting.
  for (;;) {
    const choice = await select('What do you want to do?', [
      { key: 'base', label: `Base install — the essentials (${baseIds.length} skills)` },
      { key: 'sdd', label: 'Base + Spec-Driven Development — the specify → plan → implement → ship flow' },
      { key: 'manual', label: 'Pick skills by hand, by area' },
    ]);
    if (choice === null) { say('\nOK — nothing installed. Anytime: npx @ericrisco/rsc'); return; }

    let ids;
    if (choice === 'base') ids = baseIds;
    else if (choice === 'sdd') ids = skillsForProfile(m, 'core');
    else if (choice === 'manual') {
      const picked = await manualSelect();
      if (picked === null) continue;          // backed out → re-show this menu
      ids = picked;
    } else continue;

    // The floor is always installed: compass + detector + human-language pass.
    ids = withDefaultSkillFloor(ids);
    if (ids.length <= DEFAULT_SKILL_FLOOR.length && choice !== 'base') {
      say('\nNothing chosen — back to the menu.');
      continue;
    }

    const targets = flagTargets || await selectAgents();
    if (targets === null) continue;           // esc in the assistant picker → back to menu
    say(`\nI'll install ${ids.length} skills for: ${targets.join(', ')}`);
    say('   ' + ids.join(', '));
    say('   (real files live once in .rsc/skills/ — each assistant just links to them)');
    if (!(await confirm('Install it?'))) {
      say('Cancelled — back to the menu.');
      continue;                                // "no" / esc → back to menu, not quit
    }
    for (const target of targets) {
      await applyInstall({ skillIds: ids, target });
      say(`   ✅ ${target}`);
    }
    say(`\n✅ Installed ${ids.length} skills for ${targets.length} assistant(s).`);
    printNextSteps(targets, ids);
    return;
  }
}

// Installing replaces whatever sits where a skill goes. If that is something the user
// wrote by hand, it is the one thing an install can destroy — so it is named first and
// they decide. Silence here is what made someone lose three months of work with a backup
// they never knew to restore.
async function guardCollisions(targets, ids) {
  const hit = [...new Set(targets.flatMap((t) => collisions({ target: t, skillIds: ids })))];
  if (!hit.length) return true;
  say(`\n⚠️  These are already here and rsc did not put them — they look like your own work:`);
  for (const id of hit) say(`     ${id}`);
  say('   Installing would replace them. A backup is kept, but you would have to know to restore it.');
  if (!isInteractive()) {
    console.error('rsc: refusing to overwrite hand-written skills. Rename them, or re-run with --force.');
    process.exitCode = 1;
    return false;
  }
  return confirm('Replace them anyway?');
}

async function main() {
  // One resolution for every command, doctor included: `doctor` used to resolve on its
  // own and could report a different assistant than the one just installed into.
  // --target accepts one id or a comma list (e.g. --target claude,codex).
  const f = flag('target');
  const resolved = resolveTargets({ flagValue: typeof f === 'string' ? f : undefined });
  let targets = resolved.ids;
  if (resolved.ambiguous && NEEDS_TARGET.has(cmd)) {
    // Two installations, no flag: the whole point of this release is that we do NOT pick.
    if (isInteractive()) {
      const picked = await pickFrom(
        'Two assistants are installed here. Which one do you mean?',
        resolved.ambiguous.map((id) => ({ id, label: `${targetLabel(id)}  (${listInstalled({ target: id }).length} skills)` })),
      );
      if (!picked || !picked.length) return void say('Cancelled — nothing was touched.');
      targets = picked;
    } else {
      console.error(
        `rsc: ${resolved.ambiguous.join(' and ')} are both installed here, so I will not guess.\n` +
        `     Say which one:  npx @ericrisco/rsc ${cmd} --target ${resolved.ambiguous[0]}`,
      );
      process.exitCode = 1;
      return;
    }
  }
  if (!targets.length) targets = [detectTarget()];
  const target = targets[0];
  switch (cmd) {
    case undefined:
      return hasDeclaredHarness() ? wizard(f ? targets : null) : runOnboarding(f ? targets : []);
    case 'onboard':
      return runOnboarding(f ? targets : []);
    case 'reassess':
      return runReassessment();
    case 'add': {
      if (!hasDeclaredHarness()) return onboardingRequired(onboardingInput(targets));
      const requested = requestedIds();
      const selected = classifyRequested(requested);
      if (reportUnknown(selected.unknown)) return;
      const ids = withDefaultSkillFloor(selected.skills);
      if (!argv.includes('--force') && !(await guardCollisions(targets, ids))) return;
      const currentManifest = readManifest();
      const receipt = currentManifest?.onboarding;
      const maintainedIds = receipt ? [...new Set([...(currentManifest.skills || []), ...(receipt.plan.policy.skills || []), ...ids])].sort() : ids;
      const policy = receipt ? { ...receipt.plan.policy, skills: maintainedIds } : undefined;
      for (const t of targets) await applyInstall({ skillIds: maintainedIds, agentIds: selected.agents, target: t, policy });
      markMaintenanceDrift(`add ${requested.join(',')}`);
      say(`✅ Installed for ${targets.join(', ')}: ${requested.join(', ')}`);
      return void say('   ↻ Reload/restart your assistant so the new skill activates.');
    }
    case 'install': {
      if (!hasDeclaredHarness()) return onboardingRequired(onboardingInput(targets));
      const profile = flag('profile') || 'minimal';
      const without = argv.filter((a, i) => argv[i - 1] === '--without');
      let ids = skillsForProfile(loadManifest(), profile);
      ids = withDefaultSkillFloor(ids).filter((id) => !without.includes(id));
      if (!argv.includes('--force') && !(await guardCollisions(targets, ids))) return;
      const receipt = readManifest()?.onboarding;
      const policy = receipt ? { ...receipt.plan.policy, skills: ids } : undefined;
      for (const t of targets) await applyInstall({ skillIds: ids, target: t, policy });
      markMaintenanceDrift(`install ${profile}`);
      say(`✅ Profile '${profile}' installed for ${targets.join(', ')} (${ids.length} skills)`);
      printAgentHandoff();
      return;
    }
    case 'consult': {
      const ids = await recommendIds(argv.slice(1).join(' '));
      if (!ids.length) return void say('(no recommendations)');
      for (const o of toOutcomes(ids)) say(`${o.id}\t${o.label}`);
      return;
    }
    case 'catalog': {
      // Full catalog dump for SEMANTIC in-agent discovery: every skill as
      // `id  <installed|available>  short description`, unranked. `consult` ranks
      // lexically and returns nothing for natural-language / Catalan intent; `catalog`
      // hands the agent the whole candidate set so the MODEL picks the best-fit missing
      // skill by meaning. `--available` drops what's already installed for this target.
      const m = loadManifest();
      const installed = new Set(listInstalled({ target }));
      const onlyAvailable = argv.includes('--available');
      const short = (d) => {
        const s = String(d || '').split('. ')[0].replace(/\s+/g, ' ').trim();
        return s.length > 160 ? `${s.slice(0, 159)}…` : s;
      };
      for (const sk of [...m.skills].sort((a, b) => a.id.localeCompare(b.id))) {
        const state = installed.has(sk.id) ? 'installed' : 'available';
        if (onlyAvailable && state === 'installed') continue;
        say(`${sk.id}\t${state}\t${short(sk.description)}`);
      }
      return;
    }
    case 'audit': {
      const report = audit();
      const written = writeAuditReport(report);
      say(report.summary.headline);
      for (const o of report.overlaps) say(`  ~ overlap: ${o.a} ↔ ${o.b} (${o.sharedTags.join(', ')})`);
      for (const h of report.heavyDomains) say(`  ! heavy: ${h.domain} — ${h.count} skills`);
      for (const n of report.noFootprint) say(`  ? no footprint: ${n.id} (${n.reason})`);
      if (written.length) say(`\nReport: ${written[0]}`);
      else say('\n(no harness wiki here — printed above only; run `harness` to keep a written record)');
      return;
    }
    case 'list': {
      const skills = listInstalled({ target }).map((id) => `skill\t${id}`);
      const agents = listInstalledAgents({ target }).map((agent) => `agent\t${agent.id}\t${agent.source}${agent.skills.length ? `:${agent.skills.join(',')}` : ''}`);
      const commands = listInstalledCommands({ target }).map((command) => `command\t${command.id}\t${command.path}`);
      return void say([...skills, ...agents, ...commands].join('\n') || '(nothing installed)');
    }
    case 'doctor': {
      const report = doctor({ target });
      if (argv.includes('--json')) return void say(JSON.stringify(report, null, 2));
      printContextBudget(report.contextBudget);
      return void say(JSON.stringify({ ...report, contextBudget: undefined }, null, 2));
    }
    case 'memory': {
      const sub = argv[1] || 'status';
      const root = process.cwd();
      if (sub === 'on' || sub === 'off') {
        const { readManifest, writeManifest } = await import('./lib/manifest-file.js');
        const current = readManifest(root) || { version: 1, targets: targets || [], skills: [], agents: [], ownSkills: [], optOuts: [] };
        writeManifest(root, { ...current, memory: sub === 'off' ? false : { enabled: true } });
        for (const t of targets) await syncInstalled({ target: t, cwd: root });
        say(`rsc memory ${sub}: ${sub === 'on' ? 'enabled' : 'disabled'} for this project (${targets.join(', ') || 'declaration only'}).`);
        return;
      }
      const M = await import('../targets/session-memory-core.mjs');
      if (sub === 'status') {
        const reports = targets.map((t) => doctor({ target: t, cwd: root }).memory);
        return void say(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
      }
      if (sub === 'resume') {
        const result = M.resume({ cwd: root });
        return void say(argv.includes('--json') ? JSON.stringify(result, null, 2) : (result.context || '(no local continuation for this branch/worktree)'));
      }
      if (sub === 'save') {
        const result = M.capture({
          cwd: root,
          sessionId: typeof flag('session') === 'string' ? flag('session') : `manual-${Date.now()}`,
          target: target || 'manual',
          event: 'save',
          force: true,
        });
        return void say(JSON.stringify(result, null, 2));
      }
      if (sub === 'learn') {
        const value = (name) => { const v = flag(name); return typeof v === 'string' && !v.startsWith('--') ? v : undefined; };
        const result = M.learn({
          cwd: root,
          text: value('text'),
          evidence: value('evidence'),
          scope: value('scope') || 'project',
          confidence: value('confidence'),
          approved: argv.includes('--approve'),
        });
        if (!result.saved) process.exitCode = 1;
        return void say(JSON.stringify(result, null, 2));
      }
      if (sub === 'metrics') return void say(JSON.stringify(M.metricsSummary({ cwd: root }), null, 2));
      say('Use: npx @ericrisco/rsc memory on|off|status|save [--session id]|resume [--json]|learn --text "…" --evidence "…" --scope project|global --confidence 0..1 --approve|metrics');
      process.exitCode = 1;
      return;
    }
    case 'sync': {
      const dry = argv.includes('--dry-run');
      for (const t of targets) {
        const result = await syncInstalled({ target: t, dryRun: dry });
        const verb = dry ? 'Would sync' : 'Synced';
        say(`${verb} ${t}: ${result.synced.length ? result.synced.join(', ') : '(nothing to sync)'}`);
        if (dry && result.paths?.length) {
          for (const p of result.paths) say(`  ${p}`);
        }
      }
      return;
    }
    case 'backups': {
      const backups = listBackups();
      if (!backups.length) return void say('(no backups)');
      for (const b of backups) {
        say(`${b.id}\t${b.operation}\t${b.target}\t${b.entries.length} files\t${b.createdAt}`);
      }
      return;
    }
    case 'restore': {
      const dry = argv.includes('--dry-run');
      const id = argv.slice(1).find((a) => !a.startsWith('--'));
      const result = restoreBackup({ id, dryRun: dry });
      say(`${dry ? 'Would restore' : 'Restored'} ${result.snapshot.id}`);
      for (const p of result.changed) say(`  ${p}`);
      return;
    }
    case 'upgrade': {
      const dry = argv.includes('--dry-run');
      const global = argv.includes('--global');
      const result = runUpgrade({ targets, dryRun: dry, global });
      if (result.ran) say('Upgraded global @ericrisco/rsc. Restart your shell if needed.');
      else say(`${dry ? 'Would run' : 'Upgrade guide'}: ${result.plan.installCommand}`);
      say(`After upgrade: ${result.plan.syncCommand}`);
      return;
    }
    case 'registry': {
      const sub = argv[1];
      if (sub === 'refresh') {
        const registry = refreshRegistry({ target });
        say(`✅ Registry updated: .rsc/skill-registry.md (${registry.counts.skills} skills)`);
        return;
      }
      if (sub === 'status') {
        say(JSON.stringify(registryStatus(), null, 2));
        return;
      }
      say('Use: npx @ericrisco/rsc registry refresh | registry status');
      return;
    }
    case 'worktrees': {
      // The deterministic half of "the cleanup is the default". `ship` and the `worktrees` skill call
      // this instead of judging by eye, which is what turns a rule that was only ever written down
      // into one that actually runs.
      const W = await import('../targets/worktree-reaper.mjs');
      // From inside a worktree, home is the main checkout — you cannot remove the floor you stand on.
      const root = W.resolveMainRoot(process.cwd());
      const sub = argv[1];

      if (!W.isCleanupEnabled(root)) {
        say(`worktree cleanup is off for this project (.rsc/${W.OPT_OUT}). Delete that file to turn it back on.`);
        return;
      }

      const candidates = W.classifyWorktrees(root).filter((c) => c.verdict !== 'skip');

      if (sub === 'reap') {
        const one = argv[2] && !argv[2].startsWith('--') ? argv[2] : undefined;
        // Naming a path SELECTS it; it does not accept the risk of removing it. Conflating the two
        // meant the strongest refusal in the module — "holds files that are in no commit" — was
        // defeated by an argument the sweep itself told the agent to type.
        const confirmed = argv.includes('--confirm');
        const targets = one ? [one] : candidates.filter((c) => c.verdict === 'safe').map((c) => c.path);
        if (!targets.length) { say('nothing to clean up.'); return; }
        for (const t of targets) {
          const out = W.reapWorktree(root, t, { confirmed });
          if (out.removed) {
            say(`✅ removed ${out.path}`);
            if (out.branchKept) say(`   branch ${out.branch} kept — git will not delete it safely, and while it exists the commits are recoverable.`);
          } else {
            say(`⏸  kept ${t} — ${out.reason}`);
            if (one && !confirmed) say('   If that is acceptable and you want it gone anyway: add --confirm');
            process.exitCode = 1;
          }
        }
        return;
      }

      if (!candidates.length) { say('No worktrees to clean up.'); return; }
      say(`${candidates.length} worktree(s) whose work has landed:`);
      for (const c of candidates) say(W.describe(c));
      say('');
      say('Remove the safe ones:  npx @ericrisco/rsc worktrees reap');
      say('Remove one by name:    npx @ericrisco/rsc worktrees reap <path> [--confirm]');
      return;
    }
    case 'capabilities': {
      // "What do I already have that solves this?" — the deterministic step the
      // automation-gap rule requires BEFORE anyone proposes creating a skill or an
      // agent. Without this command that rule would rest on the model's memory.
      const { capabilities, appendGap, countGaps } = await import('./lib/capabilities.js');
      const { resolveRoot } = await import('../targets/sello.mjs');
      // A string flag must not swallow the next FLAG as its value (`flag()` returns
      // the following token blindly), or `--procedure --verdict x` records "--verdict".
      const str = (name) => {
        const v = flag(name);
        return typeof v === 'string' && !v.startsWith('--') ? v : undefined;
      };
      // Subcommand by presence, not by position: `capabilities --target claude gap-log`
      // used to fall through and silently record nothing.
      if (argv.includes('gap-log')) {
        // The writer and doctor must agree on the root, or a run from a subdirectory
        // writes a log nothing counts.
        const root = resolveRoot(process.cwd());
        try {
          const p = appendGap({ procedure: str('procedure'), verdict: str('verdict'), cwd: root });
          say(`📝 recorded (${countGaps(root)} total): ${p}`);
        } catch (e) { say(e.message); process.exitCode = 1; }
        return;
      }
      // `capabilities repetition` — read the ledger nobody was interrogating. It lives here and not in
      // a new command because the enumeration and the writing already live here, and splitting them
      // across two places is the parallel bookkeeping P3 forbids.
      if (argv.includes('repetition')) {
        const root = resolveRoot(process.cwd());
        const { repetitionReport } = await import('./lib/repetition-report.js');
        const rep = repetitionReport({ cwd: root });
        if (argv.includes('--json')) return void say(JSON.stringify(rep, null, 2));
        if (rep.blocked) { say(`⚠️  ${rep.reason}`); process.exitCode = 1; return; }
        if (!rep.offer) { say(`# nada que ofrecer — ${rep.reason} (${rep.entries} entradas leídas)`); return; }
        const o = rep.offer;
        const where = o.repos.length ? ` · ${o.repos.map((r) => `${r.repo}×${r.n}`).join(', ')}` : '';
        say(`🔁 «${o.procedure}» visto ${o.seen} veces (${o.dates.join(', ')})${where}`);
        say(`   → ${o.kind}: ${o.why}`);
        say(`   registra la decisión con: rsc capabilities gap-log --procedure "..." --verdict proposed-${o.kind === 'capability' ? 'capability' : 'accepted'}|proposed-declined`);
        if (rep.uncertain.length) {
          say(`   (${rep.uncertain.length} parecido(s) que NO se agruparon por debajo del umbral — deliberado)`);
        }
        return;
      }
      const full = argv.includes('--full');
      const reports = targets.map((t) => capabilities({ target: t, full }));
      if (argv.includes('--json')) {
        return void say(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
      }
      for (const caps of reports) {
        if (reports.length > 1) say(`# target: ${caps.target}`);
        for (const s of caps.installed) say(`skill\t${s.id}\tinstalled-${s.scope}\t${s.description}`);
        for (const s of caps.available) say(`skill\t${s.id}\tavailable${s.description ? `\t${s.description}` : ''}`);
        if (caps.agentsSupported) {
          for (const a of caps.agents) say(`agent\t${a.id}\t${a.scope}\t${a.path}`);
          if (!caps.agents.length) say('# no agent files found (this target supports them)');
        } else {
          say(`# ${caps.target} has no file-based agents — the agent option does not apply here`);
        }
        if (caps.commandsSupported) {
          for (const command of caps.commands) say(`command\t${command.id}\tproject\t${command.path}`);
          if (!caps.commands.length) say('# no managed command files found (this target supports them)');
        } else {
          say(`# ${caps.target} has no supported project command surface`);
        }
        say(`memory\t${caps.memory.mode}\t${caps.memory.status}\t${caps.memory.reason}`);
      }
      if (!full) say('# catalog shown as ids; add --full for descriptions, or use `catalog --available` to match by meaning');
      return;
    }
    case 'sello': {
      // Deterministic transitions of the sello (review receipt). The `review` skill
      // orchestrates the lenses; every state change and every check runs HERE, token-free.
      const S = await import('../targets/sello.mjs');
      const root = S.resolveRoot(process.cwd());
      const sub = argv[1];
      const paths = S.selloPaths(root);
      // flag() yields boolean true for a valueless flag; every string flag below
      // goes through this so `--lenses` with no value is a usage error, not a crash.
      const str = (name) => { const v = flag(name); return typeof v === 'string' ? v : undefined; };
      switch (sub) {
        case 'on':
        case 'off': {
          // --global writes the user-scope switch (every project inherits it);
          // without it, the project switch, which always wins over the global one.
          const isGlobal = argv.includes('--global');
          const target = isGlobal ? S.globalConfigPath() : paths.config;
          const cfg = (isGlobal ? S.readGlobalConfig() : S.readConfig(root)) || {};
          delete cfg.scope; // derived, never persisted
          // `off` never validates: it is the recovery advertised by every deny
          // message, so a broken config must not be able to lock it away.
          if (sub === 'on') {
            try { S.validateRiskConfig(cfg); } catch (e) { say(e.message); process.exitCode = 1; return; }
          }
          const { writeFileSync, mkdirSync } = await import('node:fs');
          const { dirname } = await import('node:path');
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, JSON.stringify({ ...cfg, enabled: sub === 'on' }, null, 2) + '\n');
          const where = isGlobal ? 'for every project (global)' : 'for this project';
          say(sub === 'on'
            ? `✅ sello ON ${where}. Risk-0 changes (docs/copy) still pass silently; everything else needs a review before commit/push/PR.`
            : `✅ sello OFF ${where}. Delivery behaves exactly as before.`);
          if (isGlobal) {
            const p = S.readConfig(root);
            if (p && p.enabled !== undefined && p.enabled !== (sub === 'on')) {
              say(`   ⚠️  this project overrides it (project = ${p.enabled ? 'on' : 'off'}); the project switch always wins. Change it with \`sello ${p.enabled ? 'off' : 'on'}\` here.`);
            }
          }
          return;
        }
        case 'freeze': {
          const cfg = S.readEffectiveConfig(root);
          const candidate = S.computeCandidate(root, cfg);
          if (!candidate) { say(S.MESSAGES.noTrunk()); process.exitCode = 1; return; }
          const paths2 = Object.keys(candidate.files);
          if (!paths2.length) { say('sello: nothing to freeze — the working tree matches the trunk base.'); return; }
          const risk = S.classifyRisk(paths2, cfg);
          if (risk.configError) say(`⚠️  ${risk.configError}\n   (using the default risk table until it is fixed)`);
          const required = S.lensesRequired(risk.tier, cfg);
          S.writeSello(root, { status: 'frozen', ...candidate, risk, required, lenses: [], createdAt: new Date().toISOString() });
          say(`🧊 frozen: ${paths2.length} file(s), risk tier ${risk.tier} → ${required} lens(es) required.`);
          for (const [p, c] of Object.entries(risk.classes)) if (c !== 'default' && c !== 'docs') say(`   ${p} → ${c}`);
          if (risk.lowered?.length) say(`   (lowered by config: ${risk.lowered.join(', ')})`);
          return;
        }
        case 'approve':
        case 'block': {
          const sello = S.readSello(root);
          if (sello.missing || sello.corrupt || !sello.status) { say(S.MESSAGES.notFrozen()); process.exitCode = 1; return; }
          const cfg = S.readEffectiveConfig(root);
          const current = S.computeCandidate(root, cfg);
          const changed = current && Object.keys({ ...sello.files, ...current.files })
            .some((p) => sello.files[p] !== current.files[p]);
          if (sub === 'approve' && (changed || sello.base !== current?.base)) {
            say(S.MESSAGES.staleFreeze()); process.exitCode = 1; return;
          }
          const lenses = (str('lenses') || '').split(',').map((s) => s.trim()).filter(Boolean);
          const required = sello.required ?? S.lensesRequired(sello.risk?.tier ?? 1, cfg);
          // An incomplete panel must not seal silently (spec error path): the user
          // may still accept the gap, but only on purpose.
          if (sub === 'approve' && lenses.length < required && !argv.includes('--accept-partial-lenses')) {
            say(S.MESSAGES.partialLenses(lenses.length, required)); process.exitCode = 1; return;
          }
          const note = str('note');
          if (note) S.appendFindings(root, [`${new Date().toISOString().slice(0, 10)} ${note}`]);
          const status = sub === 'approve' ? 'approved' : 'blocked';
          const next = { ...sello, status, lenses, reason: str('reason') };
          S.writeSello(root, next);
          S.appendLog(root, {
            at: new Date().toISOString(), status, base: sello.base, risk: sello.risk?.tier,
            files: Object.keys(sello.files).length, lenses, digest: S.candidateDigest(sello),
            partialLenses: lenses.length < required || undefined, reason: str('reason'),
          });
          say(sub === 'approve'
            ? `✅ sealed with ${lenses.length}/${required} lens(es)${lenses.length ? `: ${lenses.join(', ')}` : ''}.`
            : '⛔ blocked — fix and re-review.');
          return;
        }
        case 'budget': {
          const sello = S.readSello(root);
          if (sello.missing || sello.corrupt) { say(S.MESSAGES.notFrozen()); process.exitCode = 1; return; }
          const lines = Number(flag('lines'));
          if (!Number.isFinite(lines) || lines <= 0) { say('Use: rsc sello budget --lines <N>'); process.exitCode = 1; return; }
          S.writeSello(root, { ...sello, budget: { lines, declaredAt: new Date().toISOString() } });
          say(`📏 fix budget declared: ${lines} line(s). budget-check will hold the fix to it.`);
          return;
        }
        case 'budget-check': {
          const sello = S.readSello(root);
          if (sello.missing || sello.corrupt || !sello.budget) { say('sello: no declared budget. Recover: run `rsc sello budget --lines <N>` BEFORE fixing.'); process.exitCode = 1; return; }
          const current = S.computeCandidate(root, S.readEffectiveConfig(root));
          const spent = S.budgetSpent(sello, current || { numstat: {} });
          if (spent <= sello.budget.lines) { say(`✅ within budget: ~${spent}/${sello.budget.lines} line(s).`); return; }
          const justify = str('justify');
          if (typeof justify === 'string' && justify.trim()) {
            S.writeSello(root, { ...sello, budget: { ...sello.budget, exceeded: spent, justification: justify } });
            S.appendFindings(root, [`budget exceeded (~${spent}/${sello.budget.lines}): ${justify}`]);
            say(`⚠️ over budget (~${spent}/${sello.budget.lines}) — justification recorded.`);
            return;
          }
          say(S.MESSAGES.overBudget(spent, sello.budget.lines));
          process.exitCode = 1;
          return;
        }
        case 'check': {
          const verdict = S.checkSello(root);
          if (verdict.warning) say(`⚠️  ${verdict.warning}`);
          if (verdict.ok) { say(`✅ sello check: ${verdict.code}`); return; }
          say(verdict.message);
          process.exitCode = 1;
          return;
        }
        case 'report': {
          const { existsSync, readFileSync } = await import('node:fs');
          say(existsSync(paths.findings) ? readFileSync(paths.findings, 'utf8') : '(no non-blocking findings recorded)');
          return;
        }
        case 'status': {
          const { existsSync } = await import('node:fs');
          const { join } = await import('node:path');
          const enabled = S.isEnabled(root);
          const verdict = S.checkSello(root);
          const sello = S.readSello(root);
          const cfg = S.readEffectiveConfig(root);
          let lowered = [];
          let configError;
          try { ({ lowered } = S.validateRiskConfig(cfg || {})); } catch (e) { configError = e.message; }
          const globalCfg = S.readGlobalConfig();
          const projectCfg = S.readConfig(root);
          say(JSON.stringify({
            enabled,
            // Which scope decided, and what each one says — two scopes quietly
            // disagreeing is a failure this harness has already lived through.
            decidedBy: cfg?.scope,
            scopes: {
              global: globalCfg?.enabled === undefined ? 'unset' : globalCfg.enabled ? 'on' : 'off',
              project: projectCfg?.enabled === undefined ? 'unset' : projectCfg.enabled ? 'on' : 'off',
            },
            check: verdict.code,
            // An inert gate must never look armed: name every reason it is standing down.
            inert: enabled && ['no-trunk', 'disabled'].includes(verdict.code) ? verdict.code : undefined,
            shipGuardOptOut: existsSync(join(root, '.rsc', '.no-ship-guard')) || undefined,
            warning: verdict.warning,
            configError,
            loweredClasses: lowered.length ? lowered : undefined,
            status: sello.missing ? 'none' : sello.corrupt ? 'corrupt' : sello.status,
            risk: sello.risk?.tier,
            lenses: sello.lenses,
            lensesRequired: sello.required,
            budget: sello.budget,
            nonBlockingFindings: S.countFindings(root),
          }, null, 2));
          return;
        }
        default:
          say('Use: npx @ericrisco/rsc sello on|off [--global]|status|freeze|approve --lenses a,b [--accept-partial-lenses]|block --reason "…"|budget --lines N|budget-check [--justify "…"]|check|report');
          return;
      }
    }
    case 'uninstall': {
      const dry = argv.includes('--dry-run');
      // `uninstall --all` is an alias for a full purge.
      if (argv.includes('--all')) return void (await runPurge(dry, argv.includes('--with-docs')));
      const selected = classifyRequested(requestedIds());
      if (reportUnknown(selected.unknown)) return;
      const removed = await uninstall({ skillIds: selected.skills, agentIds: selected.agents, target, dryRun: dry });
      return void say((dry ? 'Would remove:\n' : 'Removed:\n') + (removed.join('\n') || '(nothing)'));
    }
    case 'repair': {
      // One command, no flags, for someone who does not know what is wrong. Restorations
      // happen on their own; anything that changes a decision is asked, one by one.
      const dry = argv.includes('--dry-run');
      const yes = argv.includes('--yes');
      const found = diagnose({ target, invoked: true });
      if (!found.length) return void say('Nothing to repair — this harness is healthy.');
      say(`\nFound ${found.length} thing(s):\n`);
      for (const f of found) say(`  [${f.class === 'restore' ? 'fix' : 'ask'}] ${f.summary}\n      → ${f.action}`);
      const accept = async (f) => {
        if (yes) return true;
        if (!isInteractive()) return false;
        return confirm(`\nApply: ${f.summary}`);
      };
      const r = await repair({ target, dryRun: dry, invoked: true, accept });
      say('');
      if (dry) return void say(`Dry run — nothing written. Would apply ${r.applied.length}.`);
      say(`Repaired ${r.applied.length} thing(s).${r.backup ? ' A copy of the previous state was kept.' : ''}`);
      for (const p of r.pending) say(`  still pending (your call): ${p.summary}\n      → ${p.action}`);
      return void say('   ↻ Reload/restart your assistant.');
    }
    case 'purge':
      return void (await runPurge(argv.includes('--dry-run'), argv.includes('--with-docs')));
    default:
      say(`rsc: unknown command '${cmd}'.`);
      say('Use: npx @ericrisco/rsc onboard | reassess | add <id...> | install --profile <p> | consult "<text>" | list | capabilities [--full|gap-log] | audit | registry refresh | doctor | sync | memory <on|off|status|save|resume|learn|metrics> | sello <on|off|status|…> | worktrees [reap [path] [--confirm]] | backups | restore <id|latest> | upgrade | repair | uninstall <id> | purge');
      say('Any command takes --target <claude|codex|cursor|copilot|gemini|…> (comma-separate for several)');
      say('   → without it, rsc uses the assistant already installed here; if two are, it asks instead of guessing.');
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('rsc error:', e.message);
  process.exit(1);
});
