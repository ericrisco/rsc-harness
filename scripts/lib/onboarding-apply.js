import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { applyInstall, pruneSharedBases, removeTargetInstall } from '../install-apply.js';
import { targetPaths } from '../../targets/index.js';
import { targetHasAgents } from '../../targets/agents.js';
import { readState } from './state.js';
import { readManifest, writeManifest } from './manifest-file.js';
import { encodeGoal, identifyPlan } from './onboarding.js';
import { createBackup, restoreBackup } from './backups.js';
import { RETIRED_SKILLS, replaceRetired } from './retired-skills.js';
import { CONSTITUTION_PATH, constitutionIsDraft } from './constitution-draft.js';
import { LAYER_IGNORE, TEMPLATE_SOURCE, targetName, templateAssets } from './tools-skeleton.js';

const sameSet = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/**
 * A receipt accepted before eli5, show-me and bro were retired still names them, and it cannot be
 * rewritten — it is hash-checked against what the user accepted. So it is READ through the
 * retirement: its skills as their successors, and the paths it governed for a retired skill (its
 * link in each assistant and its base in `.rsc/skills/`) as no longer owed. Otherwise every upgraded
 * harness would read as drift for having done exactly what the upgrade is meant to do.
 */
const acceptedSkills = (plan) => replaceRetired(plan.policy.skills);
function retiredGovernedPaths(cwd, plan) {
  const out = new Set();
  for (const id of Object.keys(RETIRED_SKILLS)) {
    out.add(`.rsc/skills/${id}`);
    for (const target of plan.policy?.targets || []) {
      out.add(relative(cwd, targetPaths(target, undefined, cwd).skillDir(id)).split(sep).join('/'));
    }
  }
  return out;
}

/**
 * What THIS target should be holding, which is not the same question as what the project decided.
 *
 * The policy is the PROJECT's: "these are the agents this project wants." Whether an assistant can
 * hold a subagent at all is the TARGET's business, and nine of the seventeen cannot — amp, jules,
 * zed, antigravity, windsurf, cline, roo, continue and aider have no such concept. The installer
 * always knew this and correctly wrote none; the verifier did not, and demanded the project's list
 * from every target, so onboarding could never complete on any of the nine. Since the failure rolls
 * back, what the person got was empty directory shells and no harness — with a recovery command
 * that leads straight back to the same wall.
 *
 * Asking amp for a subagent is not a divergence. It is a category error, and this is where the two
 * categories stop being confused.
 */
export const expectedAgentsFor = (target, plan) => (targetHasAgents(target) ? (plan.policy.agents || []) : []);

function inside(root, path) {
  return path === root || path.startsWith(`${root}${sep}`);
}

export function assertManagedPathsStayInsideRoot(cwd, paths) {
  const root = realpathSync(resolve(cwd));
  for (const rel of paths || []) {
    const clean = rel.replace(/\/$/, '');
    const absolute = resolve(root, clean);
    if (!inside(root, absolute)) throw new Error(`RSC_ROOT_AMBIGUOUS: managed path escapes project root: ${rel}`);
    const segments = relative(root, absolute).split(sep).filter(Boolean);
    let cursor = root;
    for (const segment of segments) {
      cursor = join(cursor, segment);
      if (!existsSync(cursor)) break;
      if (lstatSync(cursor).isSymbolicLink()) {
        const destination = realpathSync(cursor);
        if (!inside(root, destination)) throw new Error(`RSC_ROOT_AMBIGUOUS: managed path follows a symlink outside project root: ${rel}`);
      }
    }
  }
}

function digestPath(path) {
  if (!existsSync(path)) return 'missing';
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return createHash('sha256').update(`link:${readlinkSync(path)}`).digest('hex');
  if (stat.isDirectory()) {
    const rows = readdirSync(path).sort().map((name) => `${name}:${digestPath(join(path, name))}`);
    return createHash('sha256').update(`dir:${rows.join('|')}`).digest('hex');
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function digestGovernedPaths(cwd, paths) {
  return Object.fromEntries((paths || [])
    .filter((path) => path !== '.rsc.json' && path !== '.rsc/backups/')
    .map((path) => [path, digestPath(join(cwd, path.replace(/\/$/, '')))]));
}

function recoveryCommand(plan, planId) {
  const record = plan.record;
  return [
    'npx @ericrisco/rsc@latest onboard',
    `--technical-level ${record.technicalLevel}`,
    `--project-kind ${record.projectKind}`,
    `--goal-base64 ${encodeGoal(record.goal)}`,
    ...(record.softwareScope ? [`--software-scope ${record.softwareScope}`] : []),
    ...(record.workflow ? [`--workflow ${record.workflow}`] : []),
    `--target ${record.targets.join(',')}`,
    `--accept-plan ${planId}`,
  ].join(' ');
}

export function renderOnboardingDocuments(plan, planId) {
  // One dial: `technical_level`. `technical` gets the technical register; `non-technical` and `mixed`
  // get the one with analogies. The accompaniment dial (`accompaniment_level`, and the older
  // `accompaniment` before #276) is retired and never written.
  const profile = `---\ntechnical_level: ${plan.record.technicalLevel}\nproject_kind: ${plan.record.projectKind}\n---\n\n# User profile\n\nGoal: ${plan.record.goal}\n`;
  const rows = plan.decisions.map((d) => `| ${d.kind} | ${d.id} | ${d.state} | ${d.reason} | ${d.reevaluateWhen.join('; ') || '—'} |`).join('\n');
  const installation = `# Accepted harness plan\n\nPlan id: \`${planId}\`\n\n| Kind | Component | Decision | Reason | Reevaluate when |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
  const decisions = `# Harness decisions\n\n- Accepted plan \`${planId}\`.\n- Project kind: ${plan.record.projectKind}.\n- SDD: ${plan.decisions.find((d) => d.id === 'sdd')?.state || 'selected through profile'}.\n`;
  return { profile, installation, decisions };
}

const PROFILE_DIALS = [['technical_level', 'technicalLevel']];
// The retired accompaniment dial, under both names it ever had. Removed on rewrite; tolerated on read.
const RETIRED_PROFILE_KEY = /^accompaniment(_level)?:/;

/**
 * The profile is the USER's file; accepting a plan seeds it, it does not own it (#278).
 *
 * `init` records there what it learns — the domain, the tools, what must not be touched — and `orient`
 * rewrites the dial when someone asks for more or less explanation. Regenerating the file on every
 * accept erased both, and re-accepting is routine: after an update, after a reassess.
 *
 * So: everything the plan does not own is kept byte for byte. `project_kind` and the goal are facts of
 * the plan and are updated. The dial is the subtle part — the plan carries it, but after first contact
 * the user adjusts it — so an existing value stands when the plan did not CHANGE it relative to the
 * previous receipt, and an explicit new value is applied. The retired accompaniment dial is the one
 * thing taken OUT: its lines are dropped, whichever of its two names they use.
 */
export function mergeProfile(existing, plan, previousRecord) {
  const fresh = renderOnboardingDocuments(plan, '').profile;
  if (!existing || !existing.trim()) return fresh;
  const text = existing.replace(/\r\n/g, '\n');
  const block = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  let front = block ? block[1].split('\n') : [];
  let body = block ? text.slice(block[0].length) : text;
  front = front.filter((line) => !RETIRED_PROFILE_KEY.test(line));
  const get = (key) => front.find((line) => line.startsWith(`${key}:`))?.slice(key.length + 1).trim() || null;
  const set = (key, value) => {
    const at = front.findIndex((line) => line.startsWith(`${key}:`));
    if (at >= 0) front[at] = `${key}: ${value}`;
    else front.push(`${key}: ${value}`);
  };
  for (const [key, field] of PROFILE_DIALS) {
    const planned = plan.record[field];
    const keptByUser = get(key) && previousRecord && previousRecord[field] === planned;
    if (!keptByUser) set(key, planned);
  }
  set('project_kind', plan.record.projectKind);
  const goal = `Goal: ${plan.record.goal}`;
  if (/^Goal: .*$/m.test(body)) body = body.replace(/^Goal: .*$/m, () => goal);
  else if (/^# User profile[ \t]*$/m.test(body)) body = body.replace(/^# User profile[ \t]*$/m, () => `# User profile\n\n${goal}`);
  else body = `${body.replace(/\s*$/, '')}\n\n${goal}\n`;
  return `---\n${front.join('\n')}\n---\n${body.startsWith('\n') ? '' : '\n'}${body}`;
}

/**
 * The profile is one person's dials (knowledge-sync never sends it), so it never belongs in a commit
 * either — yet it sat untracked for good, and every session's agent reported it as «cambios sin
 * commitear» (E2E 2026-10-07). Excluded in THIS clone only (`info/exclude`, not `.gitignore`), and
 * never when the team already tracks it: that is their decision.
 */
export function excludePersonalProfile(cwd) {
  const git = (args) => { try { return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
  if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') return false;
  const rel = '02-DOCS/wiki/harness/user-profile.md';
  if (git(['ls-files', '--', rel])) return false;
  const value = git(['rev-parse', '--git-path', 'info/exclude']);
  if (!value) return false;
  const file = resolve(cwd, value);
  const pattern = `/${rel}`;
  mkdirSync(dirname(file), { recursive: true });
  const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (body.split('\n').includes(pattern)) return true;
  appendFileSync(file, `${body && !body.endsWith('\n') ? '\n' : ''}${pattern}\n`);
  return true;
}

export function writeOnboardingDocuments(cwd, plan, planId, previousRecord = null) {
  const dir = join(cwd, '02-DOCS', 'wiki', 'harness');
  mkdirSync(dir, { recursive: true });
  const docs = renderOnboardingDocuments(plan, planId);
  const profilePath = join(dir, 'user-profile.md');
  writeFileSync(profilePath, mergeProfile(existsSync(profilePath) ? readFileSync(profilePath, 'utf8') : '', plan, previousRecord));
  excludePersonalProfile(cwd);
  writeFileSync(join(dir, 'installation-plan.md'), docs.installation);
  const decisionsPath = join(dir, 'decisions.md');
  if (!existsSync(decisionsPath)) writeFileSync(decisionsPath, docs.decisions);
  else if (!readFileSync(decisionsPath, 'utf8').includes(`Accepted plan \`${planId}\``)) {
    appendFileSync(decisionsPath, `${readFileSync(decisionsPath, 'utf8').endsWith('\n') ? '' : '\n'}\n${docs.decisions.replace(/^# Harness decisions\n+/, '')}`);
  }
}

export function verifyOnboarding(cwd, plan, planId) {
  const differences = [];
  if (identifyPlan(plan) !== planId) differences.push('persisted plan identity differs from its canonical content');
  for (const target of plan.policy.targets) {
    const state = readState(targetPaths(target, undefined, cwd).stateFile);
    if (!sameSet(Object.keys(state.skills || {}), acceptedSkills(plan))) differences.push(`${target}: installed skills differ from accepted policy`);
    if (!sameSet(state.agents || [], expectedAgentsFor(target, plan))) differences.push(`${target}: installed agents differ from accepted policy`);
    if (state.policy?.alwaysOn !== plan.policy.alwaysOn) differences.push(`${target}: always-on policy differs`);
    if (state.policy?.codeHooks !== plan.policy.codeHooks) differences.push(`${target}: code-hook policy differs`);
    if (state.policy?.memory !== plan.policy.memory) differences.push(`${target}: memory policy differs`);
    if (state.policy?.context7 !== plan.policy.context7) differences.push(`${target}: context7 policy differs`);
  }
  for (const name of ['user-profile.md', 'installation-plan.md', 'decisions.md']) {
    if (!existsSync(join(cwd, '02-DOCS', 'wiki', 'harness', name))) differences.push(`missing ${name}`);
  }
  const retiredPaths = retiredGovernedPaths(cwd, plan);
  const owed = (path) => !retiredPaths.has(path.replace(/\/$/, ''));
  for (const path of (plan.governedPaths || []).filter(owed)) {
    if (!existsSync(join(cwd, path.replace(/\/$/, '')))) differences.push(`missing governed path ${path}`);
  }
  const manifest = readManifest(cwd);
  if (manifest?.onboarding?.acceptedPlanId !== planId) differences.push('manifest receipt differs from accepted plan');
  const expectedDigests = manifest?.onboarding?.artifactDigests;
  if (!expectedDigests) differences.push('manifest receipt has no governed artifact digests');
  else {
    const expectedPaths = (plan.governedPaths || []).filter((path) => path !== '.rsc.json' && path !== '.rsc/backups/').filter(owed);
    if (!sameSet(Object.keys(expectedDigests).filter(owed), expectedPaths)) differences.push('governed artifact digest inventory differs from accepted plan');
    for (const path of expectedPaths) {
      if (digestPath(join(cwd, path.replace(/\/$/, ''))) !== expectedDigests[path]) differences.push(`governed content differs at ${path}`);
    }
  }
  const docsDir = join(cwd, '02-DOCS', 'wiki', 'harness');
  const profile = existsSync(join(docsDir, 'user-profile.md')) ? readFileSync(join(docsDir, 'user-profile.md'), 'utf8') : '';
  // The plan's facts must be exactly there. The dial must be there with a valid value — not
  // necessarily the plan's, because a dial the user adjusted and the plan did not change is theirs
  // (see mergeProfile). A leftover accompaniment line is not checked at all: it is retired, and an
  // old profile that still carries one is not drift.
  for (const line of [`project_kind: ${plan.record.projectKind}`, `Goal: ${plan.record.goal}`]) {
    if (!profile.split('\n').includes(line)) differences.push(`profile content differs: ${line.split(':')[0]}`);
  }
  if (!/^technical_level: (non-technical|mixed|technical)$/m.test(profile)) differences.push('profile content differs: technical_level');
  const installation = existsSync(join(docsDir, 'installation-plan.md')) ? readFileSync(join(docsDir, 'installation-plan.md'), 'utf8') : '';
  if (!installation.includes(`Plan id: \`${planId}\``)) differences.push('installation plan identity differs');
  for (const decision of plan.decisions || []) {
    const row = `| ${decision.kind} | ${decision.id} | ${decision.state} | ${decision.reason} | ${decision.reevaluateWhen.join('; ') || '—'} |`;
    if (!installation.split('\n').includes(row)) differences.push(`installation plan content differs for ${decision.kind}/${decision.id}`);
  }
  const decisions = existsSync(join(docsDir, 'decisions.md')) ? readFileSync(join(docsDir, 'decisions.md'), 'utf8') : '';
  if (!decisions.includes(`Accepted plan \`${planId}\``)) differences.push('decision ledger omits accepted plan');
  // Every planned assistant is declared; an extra one added outside the plan may be too (#278).
  if (!plan.policy.targets.every((t) => (manifest?.targets || []).includes(t))) differences.push('manifest targets differ from accepted policy');
  if (!sameSet(replaceRetired(manifest?.skills || []), acceptedSkills(plan))) differences.push('manifest skills differ from accepted policy');
  if (!sameSet(manifest?.agents || [], plan.policy.agents || [])) differences.push('manifest agents differ from accepted policy');
  return differences;
}

/**
 * The install-time answer «main | branches» becomes the project's trunk decision, as the same two
 * markers `rsc main unlock|lock` writes (both PROJECT opt-outs, recorded in .rsc.json by the install
 * below, rebuilt in a clone): main → `.no-trunk-guard` (open), branches → `.no-trunk-open` (closed
 * even where nothing in the project looks complex yet).
 */
export function applyWorkflowDecision(cwd, workflow) {
  if (workflow !== 'main' && workflow !== 'branches') return;
  const dir = join(cwd, '.rsc');
  mkdirSync(dir, { recursive: true });
  const open = join(dir, '.no-trunk-guard');
  const closed = join(dir, '.no-trunk-open');
  writeFileSync(workflow === 'main' ? open : closed, '');
  rmSync(workflow === 'main' ? closed : open, { force: true });
}

export async function applyAcceptedOnboarding({ cwd = process.cwd(), plan, planId, now = new Date(), apply = applyInstall }) {
  if (identifyPlan(plan) !== planId) throw new Error('RSC_PLAN_CHANGED: regenerate the plan and ask the user to accept the new id');
  const previousManifest = readManifest(cwd);
  const previousReceipt = previousManifest?.onboarding;
  const previousPlan = previousReceipt?.plan;
  const transactionPaths = [...new Set([
    ...(plan.governedPaths || []),
    ...(previousPlan?.governedPaths || []),
    '.rsc.json',
  ])];
  assertManagedPathsStayInsideRoot(cwd, transactionPaths);
  const snapshotPaths = transactionPaths.filter((path) => path !== '.rsc/backups/');
  const transaction = createBackup({
    cwd, operation: 'onboarding-transaction', target: plan.policy.targets.join('-'),
    paths: snapshotPaths.map((path) => join(cwd, path.replace(/\/$/, ''))), cliVersion: 'onboarding', now,
  });
  const existed = Object.fromEntries((plan.governedPaths || []).map((path) => [path, existsSync(join(cwd, path.replace(/\/$/, '')))]));
  const receipt = {
    schemaVersion: 1,
    acceptedPlanId: planId,
    acceptedAt: now.toISOString(),
    plan,
    provenance: {
      skills: Object.fromEntries(plan.policy.skills.map((id) => [id,
        previousReceipt?.plan?.policy?.skills?.includes(id) ? 'conserved' : previousManifest?.skills?.includes(id) ? 'preexisting' : 'installed',
      ])),
      targets: Object.fromEntries(plan.policy.targets.map((id) => [id,
        previousReceipt?.plan?.policy?.targets?.includes(id) ? 'conserved' : previousManifest?.targets?.includes(id) ? 'preexisting' : 'installed',
      ])),
      paths: {},
    },
  };
  try {
    applyWorkflowDecision(cwd, plan.record.workflow);
    for (const target of previousPlan?.policy?.targets || []) {
      if (!plan.policy.targets.includes(target)) removeTargetInstall({ cwd, target });
    }
    for (const target of plan.policy.targets) {
      await apply({
        cwd,
        target,
        skillIds: plan.policy.skills,
        policy: plan.policy,
        operation: 'onboard',
      });
    }
    pruneSharedBases({ cwd, skillIds: plan.policy.skills });
    writeOnboardingDocuments(cwd, plan, planId, previousPlan?.record || null);
    receipt.provenance.paths = Object.fromEntries((plan.governedPaths || []).map((path) => [
      path,
      existed[path] ? (previousReceipt ? 'conserved' : 'preexisting') : 'installed',
    ]));
    receipt.artifactDigests = digestGovernedPaths(cwd, plan.governedPaths);
    const manifest = readManifest(cwd);
    writeManifest(cwd, {
      ...manifest,
      // Union, with the distinction the removal loop above already makes (#278). An assistant that was
      // in the previous PLAN and is not in this one was removed on purpose. One added OUTSIDE the plan
      // — `sync --target codex` — is still installed, and dropping it from the declaration meant a
      // clone would never build it again.
      targets: [...plan.policy.targets, ...(previousManifest?.targets || []).filter((t) => !plan.policy.targets.includes(t)
        && !(previousPlan?.policy?.targets || []).includes(t)
        && existsSync(targetPaths(t, undefined, cwd).stateFile))],
      skills: [...plan.policy.skills],
      agents: [...(plan.policy.agents || [])],
      onboarding: receipt,
    });
    const differences = verifyOnboarding(cwd, plan, planId);
    if (differences.length) throw new Error(differences.join('; '));
    return receipt;
  } catch (error) {
    restoreBackup({ cwd, id: transaction.id });
    throw new Error(`RSC_ONBOARDING_INCOMPLETE: ${error.message}. Recover with: ${recoveryCommand(plan, planId)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// El suelo del arnés: qué tiene que existir para que decir «listo» sea verdad.
//
// «Completado» estaba definido de forma RELATIVA — el estado real coincide con lo que el plan
// prometió — así que un plan que promete poco se cumplía entero, y una instalación podía imprimir
// RSC_ONBOARDING_READY con tres markdown y un `.rsc.json`. `01-TOOLS/` no existía para el
// instalador y la constitución no se mencionaba en ningún sitio.
//
// Spec: 02-DOCS/wiki/sdd/specs/install-completion-floor.md
//
// Tres cosas que este código NO hace, y cada una es una redacción del plan que se estrelló:
//
//   1. NO se comprueba dentro de `applyAcceptedOnboarding`. Ese camino revierte ante cualquier
//      diferencia, y parte del suelo la produce una fase agéntica posterior: comprobarlo ahí
//      convertía cada instalación nueva en un rollback. Medido, no razonado.
//   2. NO cuelga de `hasDeclaredHarness`. Ese booleano enruta `add`, `install` y el wizard, así que
//      un suelo incompleto habría devuelto RSC_ONBOARDING_REQUIRED y bloqueado la Fase 3 de `init`.
//      El suelo impide AFIRMAR que el arnés está listo; no impide nada más.
//   3. NO compara contenido. `01-TOOLS/` es la capa que el usuario modifica al añadir herramientas
//      y donde viven los `.env`: fijar su contenido convertiría el uso normal en un fallo.
//
// Y la retro-compatibilidad no es una lista de exentos (P3): el suelo viaja DENTRO del plan, así
// que un recibo aceptado por una versión anterior no lo trae y queda exento por construcción.

const TEMPLATE_FLOOR = '01-TOOLS/_TEMPLATE/';

export const HARNESS_FLOOR_MINIMUM = [TEMPLATE_FLOOR, '02-DOCS/wiki/harness/'];
// El onboarding escribe ahora un BORRADOR (`constitution-draft.js`) y el suelo lo acepta: sólo
// mira existencia, y completar el borrador es de la cadena SDD, no del instalador.
export const HARNESS_FLOOR_CONSTITUTION = CONSTITUTION_PATH;

// La plantilla, sus nombres con punto y el `.gitignore` de la capa viven en `tools-skeleton.js`:
// lo que se copia aquí es exactamente lo que `purge` puede recuperar, y sólo si sigue intacto.

/**
 * Crea la parte determinista del esqueleto. Copiar ficheros estáticos es un algoritmo, así que por
 * P1 le toca al binario en vez de pedírsela a una fase agéntica que puede no llegar.
 *
 * Se llama DESPUÉS de que la transacción del apply confirme: el suelo no está en `governedPaths`
 * —no debe estarlo, o se le calcularía digest— así que tampoco está en el snapshot, y crearlo dentro
 * de la transacción dejaría residuo si el apply revirtiera.
 *
 * Idempotente y auto-reparadora POR FICHERO: un `_TEMPLATE/` a medias queda completo al reaplicar, y
 * un fichero que el usuario haya tocado no se sobrescribe nunca.
 */
export function ensureHarnessSkeleton(cwd = process.cwd()) {
  // La guarda existía en este mismo fichero y no se llamaba. `existsSync` sigue los enlaces, así que
  // un `01-TOOLS` o un `_TEMPLATE` que fuese symlink apuntaba el `copyFileSync` fuera de la raíz — y
  // git guarda los symlinks, así que el vector viaja en un clone. El repo ya fija la política
  // contraria para los caminos gobernados, con dos tests que exigen que nada se escriba fuera.
  assertManagedPathsStayInsideRoot(cwd, ['01-TOOLS/', TEMPLATE_FLOOR, '02-DOCS/wiki/harness/']);
  const created = [];
  for (const dir of ['02-DOCS/wiki/harness', '01-TOOLS/_TEMPLATE']) {
    const absolute = join(cwd, dir);
    // lstatSync y no existsSync: un enlace «existe» y nos habría hecho seguir escribiendo a través.
    if (existsSync(absolute) && !lstatSync(absolute).isSymbolicLink()) continue;
    mkdirSync(absolute, { recursive: true });
    created.push(`${dir}/`);
  }
  for (const asset of templateAssets()) {
    const target = join(cwd, '01-TOOLS', '_TEMPLATE', targetName(asset));
    if (existsSync(target)) continue;
    copyFileSync(join(TEMPLATE_SOURCE, asset), target);
    created.push(`${TEMPLATE_FLOOR}${targetName(asset)}`);
  }
  const layer = join(cwd, '01-TOOLS', '.gitignore');
  if (!existsSync(layer)) {
    writeFileSync(layer, LAYER_IGNORE);
    created.push('01-TOOLS/.gitignore');
  }
  return { created };
}

// Un camino declarado se compara por su FORMA, no por su texto: `01-TOOLS/_TEMPLATE` sin barra, con
// `./` delante o con doble barra degradaban la comprobación por fichero a simple existencia de
// directorio, que es el modo de fallo que este suelo existe para evitar, alcanzable con un carácter.
const floorSegments = (path) => String(path).split(/[/\\]+/).filter((part) => part && part !== '.');
const floorKey = (path) => floorSegments(path).join('/');
const TEMPLATE_KEY = floorKey(TEMPLATE_FLOOR);

// Un directorio que existe y está vacío pasa cualquier comprobación de existencia y no sirve para
// nada — el mismo modo de fallo por el que el suelo es `01-TOOLS/_TEMPLATE/` y no `01-TOOLS/`, un
// nivel más abajo.
function floorSatisfied(cwd, path) {
  const key = floorKey(path);
  const absolute = join(cwd, key);
  if (!existsSync(absolute)) return false;
  if (key !== TEMPLATE_KEY) return true;
  const assets = templateAssets();
  // `assets.length > 0` es cinturón y tirantes, y hoy es INALCANZABLE: `templateAssets()` lanza si no
  // puede leer el asset, así que sólo daría cero con un asset legítimamente vacío — un paquete roto
  // de otra forma. Se declara en vez de fingir que un test lo cubre: el mutante que la quita
  // sobrevive la suite, y es equivalente, no un hueco.
  return assets.length > 0 && assets.every((asset) => existsSync(join(absolute, targetName(asset))));
}

/** Qué falta del suelo. Puro, sólo existencia, y vacío para un recibo que no declara suelo. */
// `floorPaths` sale del recibo persistido en `.rsc.json`: un fichero comiteado, propenso a
// conflictos de merge, y que un repo clonado puede traer preparado. Así que se valida la forma antes
// de mirar el disco: un `..` daba el suelo por satisfecho MIRANDO FUERA de la raíz, y un `null` o una
// cadena en lugar de un array tumbaban `rsc install` después de haber instalado.
//
// Devuelve los CAMINOS que faltan (como se muestran). `missingHarnessFloor` los redacta para el
// instalador y `onboardingReadiness` los entrega tal cual a `doctor`: una comprobación, dos lectores.
export function harnessFloorGaps(cwd = process.cwd(), plan = {}) {
  const declared = Array.isArray(plan?.floorPaths) ? plan.floorPaths : [];
  const missing = [];
  for (const path of declared) {
    const segments = typeof path === 'string' ? floorSegments(path) : [];
    const usable = segments.length > 0 && !segments.includes('..') && !String(path).startsWith('/');
    // Un camino que no se puede usar se reporta como NO satisfecho, nunca como satisfecho, y sin
    // repetir su contenido: es dato ajeno y va a un canal que lee un agente.
    if (!usable) { missing.push('<invalid declaration>'); continue; }
    // La barra sólo si el camino declarado la traía: el suelo condicional es un FICHERO, y decir
    // `constitution.md/` invita a buscar un directorio que no existe.
    const shown = String(path).endsWith('/') ? `${floorKey(path)}/` : floorKey(path);
    if (!floorSatisfied(cwd, path)) missing.push(shown);
  }
  return missing;
}

export function missingHarnessFloor(cwd = process.cwd(), plan = {}) {
  return harnessFloorGaps(cwd, plan).map((shown) => `missing harness floor ${shown}`);
}

/**
 * Lo que el instalador puede afirmar honestamente, y qué hacer si no.
 *
 * `action` tiene que poder CREAR lo que falta. Hoy el `Recover with:` del apply reejecuta el
 * onboarding, y el onboarding no puede montar el esqueleto: una recuperación que no recupera
 * consume el único intento que el usuario iba a hacer.
 */
export function harnessReadiness(cwd = process.cwd(), plan = {}) {
  const missing = missingHarnessFloor(cwd, plan);
  return {
    ready: missing.length === 0,
    missing,
    action: missing.length
      ? 'invoke the `harness` skill to scaffold 01-TOOLS/ + 02-DOCS/, and the `constitution` phase when SDD is selected'
      : '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preparación del onboarding, como pregunta PROPIA (#298 punto 5).
//
// `doctor` respondía sólo «¿el arnés instalado funciona?» (`healthy`, y el exit code con él) y un
// usuario leía ese `true` como «el onboarding está terminado» con la constitución sin escribir. Son
// dos preguntas: ésta se calcula con el MISMO suelo que decide RSC_ONBOARDING_READY/INCOMPLETE
// (`harnessFloorGaps`) más los borradores, y nunca toca `healthy`.
//
//   ready          suelo completo, nada en borrador
//   pending        suelo completo, pero algo es un borrador que el usuario debe completar
//   incomplete     falta parte del suelo del plan aceptado (o el recibo no cuadra con su id)
//   not-onboarded  no hay recibo: instalación manual (`rsc add`) o anterior al onboarding
//
// Un recibo de una versión que no declaraba suelo queda exento por construcción (P3), igual que en
// el instalador: aquí no se inventa un suelo que el plan aceptado no traía.
const ONBOARD_ACTION = 'Run `npx @ericrisco/rsc@latest onboard` to record a plan for this harness (optional: what is installed keeps working).';
const draftAction = (path) => `Complete ${path} with the \`constitution\` phase (tell your agent "constitution") before the first SDD feature; ratifying removes \`status: draft\`.`;

export function onboardingReadiness(cwd = process.cwd(), manifest = readManifest(cwd)) {
  const pending = constitutionIsDraft(cwd) ? [CONSTITUTION_PATH] : [];
  const receipt = manifest?.onboarding;
  if (!receipt?.plan) {
    return { status: 'not-onboarded', missing: [], pending, action: ONBOARD_ACTION };
  }
  let identical = false;
  try { identical = identifyPlan(receipt.plan) === receipt.acceptedPlanId; } catch { /* ilegible: no cuadra */ }
  if (!identical) {
    return {
      status: 'incomplete', missing: ['<onboarding receipt does not match its accepted plan id>'], pending,
      action: 'Do not trust the receipt. Re-run `npx @ericrisco/rsc@latest onboard` and accept a fresh plan.',
    };
  }
  const missing = harnessFloorGaps(cwd, receipt.plan);
  if (missing.length) {
    const actions = [];
    if (missing.includes(CONSTITUTION_PATH)) {
      actions.push(`Write ${CONSTITUTION_PATH} with the \`constitution\` phase (tell your agent "constitution"); the SDD plan you accepted requires it.`);
    }
    if (missing.some((path) => path !== CONSTITUTION_PATH)) {
      actions.push('Invoke the `harness` skill to scaffold 01-TOOLS/ + 02-DOCS/.');
    }
    return { status: 'incomplete', missing, pending, action: actions.join(' ') };
  }
  if (pending.length) return { status: 'pending', missing, pending, action: draftAction(CONSTITUTION_PATH) };
  return { status: 'ready', missing, pending, action: '' };
}
