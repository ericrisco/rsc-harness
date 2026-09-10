import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeOnboarding, scanProject, buildOnboardingPlan, identifyPlan } from '../scripts/lib/onboarding.js';
import { applyAcceptedOnboarding, verifyOnboarding, ensureHarnessSkeleton, missingHarnessFloor, harnessReadiness } from '../scripts/lib/onboarding-apply.js';

test('post-apply verification names a missing managed artifact and prevents a ready verdict', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-verify-'));
  const record = normalizeOnboarding({
    technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations',
    goal: 'Run an operations desk', targets: ['codex'],
  });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  rmSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md'));
  const differences = verifyOnboarding(cwd, plan, id);
  assert.ok(differences.some((difference) => difference.includes('user-profile.md')));
});

test('doctor reports a policy-deferred gitmoji guard as deferred', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-doctor-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'small', goal: 'Build calculator', targets: ['claude'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) });
  const { doctor } = await import('../scripts/doctor.js');
  assert.equal(doctor({ cwd, target: 'claude' }).gitmojiGuard, 'deferred');
});

test('post-apply verification rejects changed governed file content', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-content-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  writeFileSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md'), '# corrupted\n');
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('content differs')));
});

test('artifact digest inventory must cover every governed path', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-digest-inventory-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  const manifestPath = join(cwd, '.rsc.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.onboarding.artifactDigests = {};
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('digest inventory')));
});

test('verification requires every persisted decision reason and reevaluation condition', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-reasons-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  const path = join(cwd, '02-DOCS/wiki/harness/installation-plan.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\| ([^|]+) \| ([^|]+) \| (selected|deferred) \| [^|]+ \| [^|]+ \|/g, '| $1 | $2 | $3 | omitted | omitted |'));
  const manifestPath = join(cwd, '.rsc.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // Simulate a faulty renderer that blessed its own output after writing it.
  const { createHash } = await import('node:crypto');
  manifest.onboarding.artifactDigests['02-DOCS/wiki/harness/installation-plan.md'] = createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('installation plan content differs')));
});

test('onboarding refuses a governed path whose symlink leaves the project root', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'rsc-onboard-outside-'));
  symlinkSync(outside, join(cwd, '02-DOCS'), 'dir');
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) }), /symlink outside project root/);
  assert.deepEqual(readdirSync(outside), []);
});

test('onboarding refuses an external backup symlink before snapshotting private files', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-backup-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'rsc-onboard-backup-outside-'));
  mkdirSync(join(cwd, '.rsc'));
  symlinkSync(outside, join(cwd, '.rsc', 'backups'), 'dir');
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) }), /symlink outside project root/);
  assert.deepEqual(readdirSync(outside), []);
});

test('application refuses an identity that does not match the complete canonical plan', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-drift-'));
  const record = normalizeOnboarding({
    technicalLevel: 'technical', accompaniment: 'L1', projectKind: 'software',
    softwareScope: 'small', goal: 'One calculator', targets: ['claude'],
  });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: 'f'.repeat(64) }), /RSC_PLAN_CHANGED/);
});

test('RSC-owned output does not change the accepted project-evidence identity', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-stable-'));
  const record = normalizeOnboarding({
    technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations',
    goal: 'Run an operations desk', targets: ['codex'],
  });
  const before = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(before);
  await applyAcceptedOnboarding({ cwd, plan: before, planId: id });
  // El esqueleto también es salida de RSC, y este invariante escapaba sólo porque el paso nuevo no
  // estaba aquí: sus dos `.md` entraban como evidencia de proyecto y movían la identidad del plan.
  ensureHarnessSkeleton(cwd);
  const after = buildOnboardingPlan(record, scanProject(cwd));
  assert.equal(identifyPlan(after), id);
});

test('decisions are append-only across onboarding applications', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-decisions-'));
  mkdirSync(join(cwd, '02-DOCS/wiki/harness'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS/wiki/harness/decisions.md'), '# Decisions\n\n- Human decision survives.\n');
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) });
  assert.match(readFileSync(join(cwd, '02-DOCS/wiki/harness/decisions.md'), 'utf8'), /Human decision survives/);
});

test('verification checks governed paths on disk, not only the state claim', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-path-verify-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  rmSync(join(cwd, 'AGENTS.md'));
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('AGENTS.md')));
});

test('an application failure is typed and carries executable recovery', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-partial-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan), apply: async () => { throw new Error('disk full'); } }), (error) => {
    assert.match(error.message, /RSC_ONBOARDING_INCOMPLETE.*npx .*onboard/s);
    for (const flag of ['--technical-level', '--accompaniment', '--project-kind', '--goal-base64', '--target', '--accept-plan']) assert.match(error.message, new RegExp(flag));
    return true;
  });
});

test('a partial target application rolls back and preserves the accepted recovery plan id', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-partial-rollback-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  const { applyInstall } = await import('../scripts/install-apply.js');
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: id, apply: async (input) => {
    await applyInstall(input);
    throw new Error('late failure');
  } }), /RSC_ONBOARDING_INCOMPLETE/);
  assert.equal(existsSync(join(cwd, '.claude', 'skills', 'specify')), false);
  assert.equal(identifyPlan(buildOnboardingPlan(record, scanProject(cwd))), id);
});

test('a failure while finalizing the receipt rolls back every applied artifact', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-finalize-rollback-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const { applyInstall } = await import('../scripts/install-apply.js');
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan), apply: async (input) => {
    await applyInstall(input);
    rmSync(join(cwd, '.rsc.json'), { force: true });
    mkdirSync(join(cwd, '.rsc.json'));
  } }), /RSC_ONBOARDING_INCOMPLETE/);
  assert.equal(existsSync(join(cwd, 'AGENTS.md')), false);
  assert.equal(existsSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md')), false);
  assert.equal(existsSync(join(cwd, '.rsc.json')), false);
});

test('accepting fewer targets removes the deselected RSC installation before READY', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-target-reconcile-'));
  mkdirSync(join(cwd, '.git'));
  const bothRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude', 'codex'] });
  const both = buildOnboardingPlan(bothRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: both, planId: identifyPlan(both) });
  const codexRecord = normalizeOnboarding({ ...bothRecord, softwareScope: 'small', targets: ['codex'] });
  const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) });
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.deepEqual(manifest.targets, ['codex']);
  assert.equal(existsSync(join(cwd, '.claude', 'skills', 'specify')), false);
  assert.equal(existsSync(join(cwd, '.rsc', 'skills', 'specify')), false);
  assert.doesNotMatch(readFileSync(join(cwd, '.gitignore'), 'utf8'), /^\.claude\//m);
  assert.deepEqual(verifyOnboarding(cwd, codex, identifyPlan(codex)), []);
});

test('switching from Claude growing software to fresh Codex small software does not inherit agents', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-target-switch-'));
  const claudeRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude'] });
  const claude = buildOnboardingPlan(claudeRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: claude, planId: identifyPlan(claude) });
  const codexRecord = normalizeOnboarding({ ...claudeRecord, softwareScope: 'small', goal: 'Build calculator', targets: ['codex'] });
  const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) });
  assert.equal(existsSync(join(cwd, '.codex', 'agents', 'developer.toml')), false);
  assert.deepEqual(verifyOnboarding(cwd, codex, identifyPlan(codex)), []);
});

test('removing a target preserves matching gitignore lines that predated RSC', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ignore-owner-'));
  mkdirSync(join(cwd, '.git'));
  writeFileSync(join(cwd, '.gitignore'), '.claude/skills/orient\nkeep.tmp\n');
  const claudeRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'small', goal: 'Build calculator', targets: ['claude'] });
  const claude = buildOnboardingPlan(claudeRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: claude, planId: identifyPlan(claude) });
  const codexRecord = normalizeOnboarding({ ...claudeRecord, targets: ['codex'] });
  const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) });
  const gitignore = readFileSync(join(cwd, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.claude\/skills\/orient$/m);
  assert.match(gitignore, /^keep\.tmp$/m);
});

test('a corrupt prior target state cannot delete a path outside the project', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-state-root-'));
  const outside = join(mkdtempSync(join(tmpdir(), 'rsc-state-outside-')), 'keep.txt');
  writeFileSync(outside, 'keep');
  const bothRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude', 'codex'] });
  const both = buildOnboardingPlan(bothRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: both, planId: identifyPlan(both) });
  const statePath = join(cwd, '.claude', 'skills', '.rsc-state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.skills.orient.files.push(outside);
  writeFileSync(statePath, JSON.stringify(state));
  const codexRecord = normalizeOnboarding({ ...bothRecord, targets: ['codex'] });
  const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) }), /PREVIOUS_INSTALL_INCOMPATIBLE/);
  assert.equal(readFileSync(outside, 'utf8'), 'keep');
});

test('a corrupt prior target state cannot delete the project root or an unrelated file inside it', async () => {
  for (const malicious of ['root', 'inside']) {
    const cwd = mkdtempSync(join(tmpdir(), 'rsc-state-owned-root-'));
    const keep = join(cwd, 'KEEP.txt');
    writeFileSync(keep, 'keep');
    const bothRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude', 'codex'] });
    const both = buildOnboardingPlan(bothRecord, scanProject(cwd));
    await applyAcceptedOnboarding({ cwd, plan: both, planId: identifyPlan(both) });
    const statePath = join(cwd, '.claude', 'skills', '.rsc-state.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    state.skills.orient.files.push(malicious === 'root' ? cwd : keep);
    writeFileSync(statePath, JSON.stringify(state));
    const codexRecord = normalizeOnboarding({ ...bothRecord, targets: ['codex'] });
    const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
    await assert.rejects(applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) }), /PREVIOUS_INSTALL_INCOMPATIBLE/);
    assert.equal(readFileSync(keep, 'utf8'), 'keep');
  }
});

test('state identifiers cannot use traversal to bless deletion of a user file', async () => {
  for (const kind of ['skill', 'agent']) {
    const cwd = mkdtempSync(join(tmpdir(), 'rsc-state-id-root-'));
    const keep = join(cwd, 'KEEP.txt');
    writeFileSync(keep, 'keep');
    const bothRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude', 'codex'] });
    const both = buildOnboardingPlan(bothRecord, scanProject(cwd));
    await applyAcceptedOnboarding({ cwd, plan: both, planId: identifyPlan(both) });
    const statePath = join(cwd, '.claude', 'skills', '.rsc-state.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (kind === 'skill') state.skills['../../KEEP.txt'] = { files: [keep] };
    else state.agents.push('../../KEEP');
    writeFileSync(statePath, JSON.stringify(state));
    const codexRecord = normalizeOnboarding({ ...bothRecord, targets: ['codex'] });
    const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
    await assert.rejects(applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) }), /PREVIOUS_INSTALL_INCOMPATIBLE/);
    assert.equal(readFileSync(keep, 'utf8'), 'keep');
  }
});

test('a repeated application records conserved provenance', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-provenance-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  const receipt = await applyAcceptedOnboarding({ cwd, plan, planId: id });
  assert.ok(Object.values(receipt.provenance.paths).includes('conserved'));
  assert.ok(Object.values(receipt.provenance.paths).every((v) => ['installed', 'preexisting', 'conserved'].includes(v)));
  assert.ok(Object.values(receipt.provenance.skills).every((v) => v === 'conserved'));
  assert.ok(Object.values(receipt.provenance.targets).every((v) => v === 'conserved'));
});

test('every route materialized by onboarding is declared by the accepted plan', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-route-inventory-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) });
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const name of readdirSync(dir)) {
      const rel = prefix ? `${prefix}/${name}` : name;
      const path = join(dir, name);
      if (lstatSync(path).isDirectory()) walk(path, rel); else files.push(rel);
    }
  };
  walk(cwd);
  for (const file of files) {
    assert.ok(plan.governedPaths.some((owned) => {
      if (owned === file || (owned.endsWith('/') && file.startsWith(owned))) return true;
      const path = join(cwd, owned);
      return existsSync(path) && lstatSync(path).isDirectory() && file.startsWith(`${owned}/`);
    }), `${file} is absent from governedPaths`);
  }
});

test('a git project declares the gitignore route that onboarding modifies', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gitignore-inventory-'));
  mkdirSync(join(cwd, '.git'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  assert.ok(plan.governedPaths.includes('.gitignore'));
});

// ─────────────────────────────────────────────────────────────────────────────
// El suelo del arnés. Spec: 02-DOCS/wiki/sdd/specs/install-completion-floor.md
//
// Una instalación podía imprimir RSC_ONBOARDING_READY con tres markdown y un `.rsc.json`:
// `01-TOOLS/` no existía para el instalador y la constitución no se mencionaba en ningún sitio.
//
// Tres cosas que estos tests fijan porque tres redacciones del plan se estrellaron contra ellas:
//   · el suelo NO se comprueba dentro del apply, que revierte ante cualquier diferencia;
//   · el suelo NO cuelga de `hasDeclaredHarness`, que es el enrutador de `add`/`install`;
//   · la reparación y la comprobación son POR FICHERO — un `_TEMPLATE/` a medias es invisible
//     a nivel de directorio.

const softwareRecord = (scope) => normalizeOnboarding({
  technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software',
  softwareScope: scope, goal: 'Build a thing', targets: ['claude'],
});
const opsRecord = () => normalizeOnboarding({
  technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations',
  goal: 'Run an operations desk', targets: ['codex'],
});
const freshWorkspace = (name) => mkdtempSync(join(tmpdir(), `rsc-floor-${name}-`));

// AC1b — el CRITICAL de la primera redacción, convertido en guarda permanente. Si alguien vuelve a
// comprobar el suelo dentro de la transacción, esto se pone rojo: el apply revierte ante cualquier
// diferencia y nada determinista creaba el suelo antes de que se verificase.
test('floor: applying never fails or reverts because of the harness floor', async () => {
  for (const record of [softwareRecord('complex'), softwareRecord('small'), opsRecord()]) {
    const cwd = freshWorkspace('apply');
    const plan = buildOnboardingPlan(record, scanProject(cwd));
    await applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) });
    assert.deepEqual(verifyOnboarding(cwd, plan, identifyPlan(plan)), [], 'el apply no puede autobloquearse');
  }
});

// AC1 + AC8 — el instalador CREA la parte determinista, porque copiar ficheros estáticos es un
// algoritmo y por P1 le toca al binario. Y es idempotente: la segunda pasada no crea nada.
test('floor: the installer creates the deterministic skeleton, and does it once', async () => {
  const cwd = freshWorkspace('skeleton');
  const first = ensureHarnessSkeleton(cwd);
  assert.ok(existsSync(join(cwd, '01-TOOLS/_TEMPLATE')), '01-TOOLS/_TEMPLATE/ tiene que existir');
  assert.ok(existsSync(join(cwd, '02-DOCS/wiki/harness')), '02-DOCS/wiki/harness/ también');
  assert.ok(readdirSync(join(cwd, '01-TOOLS/_TEMPLATE')).length >= 5, 'con su contenido, no vacío');
  assert.ok(first.created.length > 0, 'la primera pasada crea');
  assert.deepEqual(ensureHarnessSkeleton(cwd).created, [], 'la segunda no toca nada');
});

// AC7c — el modo de fallo por el que `clarify` rechazó `01-TOOLS/` a secas, un nivel más abajo: si
// la comprobación es por directorio, un `_TEMPLATE/` al que le falta un fichero pasa en verde.
test('floor: a half-copied template is detected and repaired, file by file', async () => {
  const cwd = freshWorkspace('partial');
  const plan = buildOnboardingPlan(opsRecord(), scanProject(cwd));
  ensureHarnessSkeleton(cwd);
  const victim = readdirSync(join(cwd, '01-TOOLS/_TEMPLATE'))[0];
  rmSync(join(cwd, '01-TOOLS/_TEMPLATE', victim));
  assert.ok(
    missingHarnessFloor(cwd, plan).some((m) => m.includes('01-TOOLS/_TEMPLATE')),
    'un directorio que existe pero está incompleto NO es suelo',
  );
  assert.ok(ensureHarnessSkeleton(cwd).created.length === 1, 'y se repara justo el que falta');
  assert.deepEqual(missingHarnessFloor(cwd, plan), []);
});

// AC2 + AC3
test('floor: a missing floor path is named, a complete floor is silent', async () => {
  const cwd = freshWorkspace('names');
  const plan = buildOnboardingPlan(opsRecord(), scanProject(cwd));
  ensureHarnessSkeleton(cwd);
  assert.deepEqual(missingHarnessFloor(cwd, plan), [], 'suelo completo');
  rmSync(join(cwd, '01-TOOLS'), { recursive: true });
  const missing = missingHarnessFloor(cwd, plan);
  assert.equal(missing.length, 1);
  assert.match(missing[0], /missing harness floor 01-TOOLS\/_TEMPLATE\//);
});

// AC4 + AC5 + AC10 — la constitución es vinculante SÓLO donde el plan elige SDD. Es lo que impide
// contradecir los criterios 5 y 17 de la spec de onboarding enviada en 1.3.1.
test('floor: the constitution is required only where the plan selects SDD', async () => {
  const withSdd = freshWorkspace('sdd-yes');
  const planWith = buildOnboardingPlan(softwareRecord('complex'), scanProject(withSdd));
  assert.ok(planWith.decisions.some((d) => d.id === 'sdd' && d.state === 'selected'), 'fixture inválido');
  assert.ok(planWith.floorPaths.includes('02-DOCS/wiki/sdd/constitution.md'));
  ensureHarnessSkeleton(withSdd);
  assert.ok(missingHarnessFloor(withSdd, planWith).some((m) => m.includes('constitution.md')));

  const noSdd = freshWorkspace('sdd-no');
  const planWithout = buildOnboardingPlan(softwareRecord('small'), scanProject(noSdd));
  assert.ok(planWithout.decisions.some((d) => d.id === 'sdd' && d.state === 'deferred'), 'fixture inválido');
  assert.ok(!planWithout.floorPaths.includes('02-DOCS/wiki/sdd/constitution.md'));
  ensureHarnessSkeleton(noSdd);
  assert.deepEqual(missingHarnessFloor(noSdd, planWithout), [], 'SDD pospuesto no paga constitución');
});

// Retro-compatibilidad. Misma forma que el corte de intent-scrutiny: el estado se deriva del
// contenido del propio recibo, sin lista de exentos (P3). Un recibo de ≤1.3.3 no trae el campo.
test('floor: a receipt from before this version carries no floor and is exempt', async () => {
  const cwd = freshWorkspace('legacy');
  const plan = buildOnboardingPlan(opsRecord(), scanProject(cwd));
  const legacy = { ...plan };
  delete legacy.floorPaths;
  assert.deepEqual(missingHarnessFloor(cwd, legacy), [], 'nada de lo ya instalado se pone en rojo');
  assert.deepEqual(missingHarnessFloor(cwd, { ...plan, floorPaths: [] }), []);
});

// AC6 — el suelo se comprueba por EXISTENCIA. Si se digiriese, añadir una herramienta —que es para
// lo que existe `01-TOOLS/`— convertiría el uso normal en un fallo de verificación.
test('floor: adding a tool under 01-TOOLS never breaks verification', async () => {
  const cwd = freshWorkspace('tool');
  const plan = buildOnboardingPlan(opsRecord(), scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  ensureHarnessSkeleton(cwd);
  mkdirSync(join(cwd, '01-TOOLS/STRIPE'), { recursive: true });
  writeFileSync(join(cwd, '01-TOOLS/STRIPE/.env'), 'STRIPE_API_KEY=sk_test_x\n');
  assert.deepEqual(verifyOnboarding(cwd, plan, id), [], 'el contenido de esa capa no está fijado');
  assert.deepEqual(missingHarnessFloor(cwd, plan), []);
});

// AC7 — la acción que se ofrece tiene que poder CREAR lo que falta. Hoy el `Recover with:` del apply
// reejecuta el onboarding, y el onboarding no puede crear el esqueleto: una recuperación que no
// recupera consume el intento del usuario.
test('floor: readiness reports what is missing and an action that can create it', async () => {
  const cwd = freshWorkspace('readiness');
  const plan = buildOnboardingPlan(softwareRecord('complex'), scanProject(cwd));
  ensureHarnessSkeleton(cwd);
  const report = harnessReadiness(cwd, plan);
  assert.equal(report.ready, false, 'falta la constitución: no está listo');
  assert.ok(report.missing.some((m) => m.includes('constitution.md')));
  assert.ok(report.action.length > 0, 'tiene que ofrecer algo');
  assert.doesNotMatch(report.action, /\bonboard\b/, 'reejecutar el onboarding no crea el suelo');
  assert.match(report.action, /harness/i, 'lo que crea el esqueleto es `harness`');
});

// ─────────────────────────────────────────────────────────────────────────────
// Lo que el panel de refutadores encontró sobre 1bcf47e. Cada test de aquí abajo existe porque un
// mutante sobrevivió o porque había una regresión medida, no porque pareciera prudente añadirlo.

// HIGH-1, el peor del ciclo: los dos `.md` que copia el esqueleto entran como evidencia de proyecto
// (`markdown:2`) y MUEVEN la identidad del plan. Medido: el segundo `onboard --accept-plan <id>` con
// el mismo comando y directorio moría con RSC_PLAN_CHANGED, y con él quedaba inalcanzable el propio
// contrato que este ciclo añade a `llms.txt` — el agente escribe la constitución, reejecuta para
// obtener el READY que ese documento declara obligatorio, y no existía comando que lo imprimiera.
// `scanProject` ya tenía el carve-out para `02-DOCS/wiki/harness/` y ninguno para `01-TOOLS/`.
test('floor: the skeleton the installer writes never moves the project-evidence identity', async () => {
  const cwd = freshWorkspace('identity');
  const record = opsRecord();
  const before = identifyPlan(buildOnboardingPlan(record, scanProject(cwd)));
  ensureHarnessSkeleton(cwd);
  const after = identifyPlan(buildOnboardingPlan(record, scanProject(cwd)));
  assert.equal(after, before, 'lo que RSC escribe no puede contar como evidencia del usuario');
});

// HIGH-2: `existsSync` sigue los enlaces, así que un `01-TOOLS` o un `_TEMPLATE` que sea symlink
// apuntaba el `copyFileSync` fuera de la raíz — y git guarda los symlinks, así que viaja en el clone.
// El repo ya fija la política contraria en dos tests del camino viejo, con `readdirSync(outside)`
// vacío. La guarda existe en este mismo fichero; simplemente no se llamaba.
test('floor: the skeleton refuses to write through a symlink that leaves the root', () => {
  for (const link of ['01-TOOLS', join('01-TOOLS', '_TEMPLATE')]) {
    const cwd = freshWorkspace('escape');
    const outside = mkdtempSync(join(tmpdir(), 'rsc-outside-'));
    mkdirSync(join(cwd, link, '..'), { recursive: true });
    symlinkSync(outside, join(cwd, link));
    assert.throws(() => ensureHarnessSkeleton(cwd), /RSC_ROOT_AMBIGUOUS/, `${link} no puede escapar`);
    assert.deepEqual(readdirSync(outside), [], 'nada se escribe fuera de la raíz');
  }
});

// MEDIUM-3: npm NUNCA empaqueta un `.gitignore`, así que desde el tarball se copiaban 4 de 5
// ficheros — y el que faltaba es justo el que evita comitear el `.env` que el README copiado le dice
// al usuario que cree. La suite era ciega por construcción: aseveraba `>= 5` sobre el repo, cierto
// ahí y falso en el artefacto publicado. El asset se llama ahora `gitignore` y se copia con punto.
test('floor: the template protection travels in the published package', () => {
  const assets = readdirSync(new URL('../skills/harness/assets/_TEMPLATE', import.meta.url));
  assert.ok(!assets.includes('.gitignore'), 'un `.gitignore` no llegaría al paquete de npm');
  assert.ok(assets.includes('gitignore'), 'tiene que viajar sin punto y copiarse con él');
  const cwd = freshWorkspace('protect');
  ensureHarnessSkeleton(cwd);
  assert.ok(existsSync(join(cwd, '01-TOOLS/_TEMPLATE/.gitignore')), 'y aterrizar como `.gitignore`');
  assert.ok(existsSync(join(cwd, '01-TOOLS/.gitignore')), 'la cobertura es de capa, no por proveedor');
  const layer = readFileSync(join(cwd, '01-TOOLS/.gitignore'), 'utf8');
  assert.match(layer, /\.env/, 'la capa donde viven las credenciales queda cubierta');
});

// MEDIUM-4: `templateAssets()` se comía cualquier error en `[]`, y con `assets.length > 0` eso
// dejaba el suelo permanentemente insatisfacible con una acción que no podía arreglarlo, sin nombrar
// nunca la causa real (el paquete roto). Y el mutante que quitaba esa guarda sobrevivía la suite.
test('floor: an empty template directory is not a satisfied floor', () => {
  const cwd = freshWorkspace('empty');
  const plan = buildOnboardingPlan(opsRecord(), scanProject(cwd));
  mkdirSync(join(cwd, '01-TOOLS/_TEMPLATE'), { recursive: true });
  mkdirSync(join(cwd, '02-DOCS/wiki/harness'), { recursive: true });
  assert.ok(
    missingHarnessFloor(cwd, plan).some((m) => m.includes('_TEMPLATE')),
    'un directorio que existe y está vacío no es suelo',
  );
});

// MEDIUM-5: la comprobación por fichero colgaba de una igualdad de cadena exacta, así que
// `01-TOOLS/_TEMPLATE` sin barra, o `./01-TOOLS/...`, la degradaban en silencio a existencia de
// directorio. Es el mutante nº4 del constructor alcanzable con un carácter.
test('floor: the per-file check survives a differently spelled path', () => {
  const cwd = freshWorkspace('spelling');
  ensureHarnessSkeleton(cwd);
  rmSync(join(cwd, '01-TOOLS/_TEMPLATE', readdirSync(join(cwd, '01-TOOLS/_TEMPLATE'))[0]));
  for (const spelling of ['01-TOOLS/_TEMPLATE/', '01-TOOLS/_TEMPLATE', './01-TOOLS/_TEMPLATE/', '01-TOOLS//_TEMPLATE/']) {
    assert.equal(missingHarnessFloor(cwd, { floorPaths: [spelling] }).length, 1, `no detecta con: ${spelling}`);
  }
});

// MEDIUM-6: `floorPaths` sale de `.rsc.json`, un fichero comiteado y propenso a conflictos de merge.
// Un camino con `..` daba el suelo por satisfecho MIRANDO FUERA de la raíz, y un `null` o una cadena
// en vez de un array tumbaban `rsc install` DESPUÉS de haber instalado.
test('floor: a malformed or escaping floor declaration is named, never followed and never fatal', () => {
  const cwd = freshWorkspace('malformed');
  ensureHarnessSkeleton(cwd);
  for (const floorPaths of [['../../../../etc/passwd'], ['/etc/passwd'], ['01-TOOLS/_TEMPLATE/', null], '01-TOOLS/_TEMPLATE/', 42]) {
    const result = missingHarnessFloor(cwd, { floorPaths });
    assert.ok(Array.isArray(result), `tiene que devolver un array para: ${JSON.stringify(floorPaths)}`);
    assert.ok(!result.some((m) => m.includes('etc/passwd')), 'jamás mira fuera de la raíz');
  }
  assert.ok(
    missingHarnessFloor(cwd, { floorPaths: ['../../../../etc/passwd'] }).length > 0,
    'un camino que escapa se reporta como no satisfecho, no como satisfecho',
  );
});

// Mutante superviviente: quitar `02-DOCS/wiki/harness/` del suelo. Es una de las dos filas del suelo
// mínimo verbatim de §0 y nada aseveraba ni que estuviera ni que su ausencia se detectara.
test('floor: the minimum floor is both rows, and both are detected', () => {
  const cwd = freshWorkspace('minimum');
  const plan = buildOnboardingPlan(opsRecord(), scanProject(cwd));
  assert.ok(plan.floorPaths.includes('01-TOOLS/_TEMPLATE/'));
  assert.ok(plan.floorPaths.includes('02-DOCS/wiki/harness/'));
  ensureHarnessSkeleton(cwd);
  rmSync(join(cwd, '02-DOCS/wiki/harness'), { recursive: true });
  assert.ok(missingHarnessFloor(cwd, plan).some((m) => m.includes('02-DOCS/wiki/harness')));
});
