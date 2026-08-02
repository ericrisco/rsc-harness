#!/usr/bin/env node
import { loadManifest, skillsForProfile } from './lib/manifest.js';
import { detectTarget, TARGETS } from '../targets/index.js';
import { detectRepo } from './detect-repo.js';
import { rank } from './consult.js';
import { expandRecommends, toOutcomes, hasOutcome } from './lib/recommend.js';
import { applyInstall, listInstalled, uninstall, syncInstalled, purge } from './install-apply.js';
import { doctor } from './doctor.js';
import { say, select, pickFrom, banner, confirm } from './lib/ui.js';
import { refreshRegistry, registryStatus } from './lib/registry.js';
import { audit, writeAuditReport } from './audit.js';
import { DOMAINS } from './lib/domains.js';
import { listBackups, restoreBackup } from './lib/backups.js';
import { runUpgrade } from './lib/upgrade.js';

const argv = process.argv.slice(2);
const cmd = argv[0];

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
  say(`   ${n++}. From there, work in your own words. orient + suggest stay always-on:`);
  say('      they keep you oriented after each step and propose the missing skill (you confirm, it installs).');
  say('\n   Add something by hand anytime:    npx @ericrisco/rsc add <skill>');
  say('   Browse the catalog / get picks:   npx @ericrisco/rsc consult "whatever you need"');
  say('────────────────────────────────────────────────────────');
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
  say('  2. After reload you are EQUIPPED — orient + suggest are always-on.');
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
  }
  for (const f of b.findings) {
    say(`\n  [${f.severity.toUpperCase()}] ${f.summary}`);
    say(`  → ${f.action}`);
  }
  say('════════════════════════════════════════════════\n');
}

async function wizard() {
  const m = loadManifest();
  await banner();
  say('  the skill catalog for your assistant (Claude Code · Codex · Cursor · Gemini · Antigravity)\n');
  // Navigable loop: esc / "← Back" / "no" all return here instead of quitting.
  for (;;) {
    const choice = await select('What do you want to do?', [
      { key: 'base', label: 'Base install — the essentials (orient + suggest + harness + init)' },
      { key: 'sdd', label: 'Base + Spec-Driven Development — the specify → plan → implement → ship flow' },
      { key: 'manual', label: 'Pick skills by hand, by area' },
    ]);
    if (choice === null) { say('\nOK — nothing installed. Anytime: npx @ericrisco/rsc'); return; }

    let ids;
    if (choice === 'base') ids = skillsForProfile(m, 'minimal');
    else if (choice === 'sdd') ids = skillsForProfile(m, 'core');
    else if (choice === 'manual') {
      const picked = await manualSelect();
      if (picked === null) continue;          // backed out → re-show this menu
      ids = picked;
    } else continue;

    // The floor is always installed: the compass + the detector.
    ids = [...new Set(['orient', 'suggest', ...ids])];
    if (ids.length <= 2 && choice !== 'base') {
      say('\nNothing chosen — back to the menu.');
      continue;
    }

    const targets = await selectAgents();
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

async function main() {
  // --target accepts one id or a comma list (e.g. --target claude,codex). No flag → detect.
  const f = flag('target');
  const targets = typeof f === 'string'
    ? f.split(',').map((s) => s.trim()).filter(Boolean)
    : [detectTarget()];
  const target = targets[0];
  switch (cmd) {
    case undefined:
      return wizard();
    case 'add': {
      // Positional args = skill ids; skip flags and any flag value (the token after a --flag).
      const requested = [];
      for (let i = 1; i < argv.length; i++) {
        if (argv[i].startsWith('--')) { i++; continue; }
        requested.push(argv[i]);
      }
      const ids = [...new Set(['orient', 'suggest', ...requested])];
      for (const t of targets) await applyInstall({ skillIds: ids, target: t });
      say(`✅ Installed for ${targets.join(', ')}: ${requested.join(', ')}`);
      return void say('   ↻ Reload/restart your assistant so the new skill activates.');
    }
    case 'install': {
      const profile = flag('profile') || 'minimal';
      const without = argv.filter((a, i) => argv[i - 1] === '--without');
      let ids = skillsForProfile(loadManifest(), profile);
      ids = [...new Set(['orient', 'suggest', ...ids])].filter((id) => !without.includes(id));
      for (const t of targets) await applyInstall({ skillIds: ids, target: t });
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
    case 'list':
      return void say(listInstalled({ target }).join('\n') || '(nothing installed)');
    case 'doctor': {
      const report = doctor({ target });
      if (argv.includes('--json')) return void say(JSON.stringify(report, null, 2));
      printContextBudget(report.contextBudget);
      return void say(JSON.stringify({ ...report, contextBudget: undefined }, null, 2));
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
          const cfg = S.readConfig(root) || {};
          // `off` never validates: it is the recovery advertised by every deny
          // message, so a broken config must not be able to lock it away.
          if (sub === 'on') {
            try { S.validateRiskConfig(cfg); } catch (e) { say(e.message); process.exitCode = 1; return; }
          }
          const { writeFileSync, mkdirSync } = await import('node:fs');
          const { dirname } = await import('node:path');
          mkdirSync(dirname(paths.config), { recursive: true });
          writeFileSync(paths.config, JSON.stringify({ ...cfg, enabled: sub === 'on' }, null, 2) + '\n');
          say(sub === 'on'
            ? '✅ sello ON for this project. Risk-0 changes (docs/copy) still pass silently; everything else needs a review before commit/push/PR.'
            : '✅ sello OFF for this project. Delivery behaves exactly as before.');
          return;
        }
        case 'freeze': {
          const cfg = S.readConfig(root);
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
          const cfg = S.readConfig(root);
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
          const current = S.computeCandidate(root, S.readConfig(root));
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
          const cfg = S.readConfig(root);
          let lowered = [];
          let configError;
          try { ({ lowered } = S.validateRiskConfig(cfg || {})); } catch (e) { configError = e.message; }
          say(JSON.stringify({
            enabled,
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
          say('Use: npx @ericrisco/rsc sello on|off|status|freeze|approve --lenses a,b [--accept-partial-lenses]|block --reason "…"|budget --lines N|budget-check [--justify "…"]|check|report');
          return;
      }
    }
    case 'uninstall': {
      const dry = argv.includes('--dry-run');
      // `uninstall --all` is an alias for a full purge.
      if (argv.includes('--all')) return void (await runPurge(dry, argv.includes('--with-docs')));
      const ids = argv.slice(1).filter((a) => !a.startsWith('--'));
      const removed = await uninstall({ skillIds: ids, target, dryRun: dry });
      return void say((dry ? 'Would remove:\n' : 'Removed:\n') + (removed.join('\n') || '(nothing)'));
    }
    case 'purge':
      return void (await runPurge(argv.includes('--dry-run'), argv.includes('--with-docs')));
    default:
      say(`rsc: unknown command '${cmd}'.`);
      say('Use: npx @ericrisco/rsc | add <id...> | install --profile <p> | consult "<text>" | list | audit | registry refresh | doctor | sync | sello <on|off|status|…> | backups | restore <id|latest> | upgrade | uninstall <id> | purge');
  }
}

main().catch((e) => {
  console.error('rsc error:', e.message);
  process.exit(1);
});
