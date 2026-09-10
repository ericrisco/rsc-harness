import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall, pruneSharedBases, removeTargetInstall } from '../install-apply.js';
import { targetPaths } from '../../targets/index.js';
import { readState } from './state.js';
import { readManifest, writeManifest } from './manifest-file.js';
import { encodeGoal, identifyPlan } from './onboarding.js';
import { createBackup, restoreBackup } from './backups.js';

const sameSet = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

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
    `--accompaniment ${record.accompaniment}`,
    `--project-kind ${record.projectKind}`,
    `--goal-base64 ${encodeGoal(record.goal)}`,
    ...(record.softwareScope ? [`--software-scope ${record.softwareScope}`] : []),
    `--target ${record.targets.join(',')}`,
    `--accept-plan ${planId}`,
  ].join(' ');
}

export function renderOnboardingDocuments(plan, planId) {
  const profile = `---\ntechnical_level: ${plan.record.technicalLevel}\naccompaniment: ${plan.record.accompaniment}\nproject_kind: ${plan.record.projectKind}\n---\n\n# User profile\n\nGoal: ${plan.record.goal}\n`;
  const rows = plan.decisions.map((d) => `| ${d.kind} | ${d.id} | ${d.state} | ${d.reason} | ${d.reevaluateWhen.join('; ') || '—'} |`).join('\n');
  const installation = `# Accepted harness plan\n\nPlan id: \`${planId}\`\n\n| Kind | Component | Decision | Reason | Reevaluate when |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
  const decisions = `# Harness decisions\n\n- Accepted plan \`${planId}\`.\n- Project kind: ${plan.record.projectKind}.\n- SDD: ${plan.decisions.find((d) => d.id === 'sdd')?.state || 'selected through profile'}.\n`;
  return { profile, installation, decisions };
}

export function writeOnboardingDocuments(cwd, plan, planId) {
  const dir = join(cwd, '02-DOCS', 'wiki', 'harness');
  mkdirSync(dir, { recursive: true });
  const docs = renderOnboardingDocuments(plan, planId);
  writeFileSync(join(dir, 'user-profile.md'), docs.profile);
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
    if (!sameSet(Object.keys(state.skills || {}), plan.policy.skills)) differences.push(`${target}: installed skills differ from accepted policy`);
    if (!sameSet(state.agents || [], plan.policy.agents || [])) differences.push(`${target}: installed agents differ from accepted policy`);
    if (state.policy?.alwaysOn !== plan.policy.alwaysOn) differences.push(`${target}: always-on policy differs`);
    if (state.policy?.codeHooks !== plan.policy.codeHooks) differences.push(`${target}: code-hook policy differs`);
    if (state.policy?.memory !== plan.policy.memory) differences.push(`${target}: memory policy differs`);
    if (state.policy?.context7 !== plan.policy.context7) differences.push(`${target}: context7 policy differs`);
  }
  for (const name of ['user-profile.md', 'installation-plan.md', 'decisions.md']) {
    if (!existsSync(join(cwd, '02-DOCS', 'wiki', 'harness', name))) differences.push(`missing ${name}`);
  }
  for (const path of plan.governedPaths || []) {
    if (!existsSync(join(cwd, path.replace(/\/$/, '')))) differences.push(`missing governed path ${path}`);
  }
  const manifest = readManifest(cwd);
  if (manifest?.onboarding?.acceptedPlanId !== planId) differences.push('manifest receipt differs from accepted plan');
  const expectedDigests = manifest?.onboarding?.artifactDigests;
  if (!expectedDigests) differences.push('manifest receipt has no governed artifact digests');
  else {
    const expectedPaths = (plan.governedPaths || []).filter((path) => path !== '.rsc.json' && path !== '.rsc/backups/');
    if (!sameSet(Object.keys(expectedDigests), expectedPaths)) differences.push('governed artifact digest inventory differs from accepted plan');
    for (const path of expectedPaths) {
      if (digestPath(join(cwd, path.replace(/\/$/, ''))) !== expectedDigests[path]) differences.push(`governed content differs at ${path}`);
    }
  }
  const docsDir = join(cwd, '02-DOCS', 'wiki', 'harness');
  const profile = existsSync(join(docsDir, 'user-profile.md')) ? readFileSync(join(docsDir, 'user-profile.md'), 'utf8') : '';
  for (const line of [
    `technical_level: ${plan.record.technicalLevel}`,
    `accompaniment: ${plan.record.accompaniment}`,
    `project_kind: ${plan.record.projectKind}`,
    `Goal: ${plan.record.goal}`,
  ]) if (!profile.split('\n').includes(line)) differences.push(`profile content differs: ${line.split(':')[0]}`);
  const installation = existsSync(join(docsDir, 'installation-plan.md')) ? readFileSync(join(docsDir, 'installation-plan.md'), 'utf8') : '';
  if (!installation.includes(`Plan id: \`${planId}\``)) differences.push('installation plan identity differs');
  for (const decision of plan.decisions || []) {
    const row = `| ${decision.kind} | ${decision.id} | ${decision.state} | ${decision.reason} | ${decision.reevaluateWhen.join('; ') || '—'} |`;
    if (!installation.split('\n').includes(row)) differences.push(`installation plan content differs for ${decision.kind}/${decision.id}`);
  }
  const decisions = existsSync(join(docsDir, 'decisions.md')) ? readFileSync(join(docsDir, 'decisions.md'), 'utf8') : '';
  if (!decisions.includes(`Accepted plan \`${planId}\``)) differences.push('decision ledger omits accepted plan');
  if (!sameSet(manifest?.targets || [], plan.policy.targets)) differences.push('manifest targets differ from accepted policy');
  if (!sameSet(manifest?.skills || [], plan.policy.skills)) differences.push('manifest skills differ from accepted policy');
  if (!sameSet(manifest?.agents || [], plan.policy.agents || [])) differences.push('manifest agents differ from accepted policy');
  return differences;
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
    writeOnboardingDocuments(cwd, plan, planId);
    receipt.provenance.paths = Object.fromEntries((plan.governedPaths || []).map((path) => [
      path,
      existed[path] ? (previousReceipt ? 'conserved' : 'preexisting') : 'installed',
    ]));
    receipt.artifactDigests = digestGovernedPaths(cwd, plan.governedPaths);
    const manifest = readManifest(cwd);
    writeManifest(cwd, {
      ...manifest,
      targets: [...plan.policy.targets],
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

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_SOURCE = join(LIB_DIR, '..', '..', 'skills', 'harness', 'assets', '_TEMPLATE');
const TEMPLATE_FLOOR = '01-TOOLS/_TEMPLATE/';

export const HARNESS_FLOOR_MINIMUM = [TEMPLATE_FLOOR, '02-DOCS/wiki/harness/'];
export const HARNESS_FLOOR_CONSTITUTION = '02-DOCS/wiki/sdd/constitution.md';

// Los ficheros que la plantilla trae hoy. Se lee del asset en vez de codificar una lista, para que
// añadir un fichero a la plantilla no deje el suelo comprobando de menos en silencio.
//
// Un error aquí NO se convierte en lista vacía. Comérselo dejaba el suelo permanentemente
// insatisfacible, con un mensaje que ofrecía una acción que leía ese mismo asset ausente y que por
// tanto no podía arreglarlo nunca — y sin nombrar jamás la causa real, que es un paquete roto.
function templateAssets() {
  return readdirSync(TEMPLATE_SOURCE).sort();
}

// npm NUNCA empaqueta un fichero llamado `.gitignore`, así que el asset viaja sin punto y se copia
// con él. Sin esto, desde el paquete publicado se copiaban 4 de 5 ficheros y el que faltaba era el
// único que evita comitear el `.env` que el README —copiado por el propio instalador— manda crear.
const DOTTED = { gitignore: '.gitignore' };
const targetName = (asset) => DOTTED[asset] ?? asset;

// La capa entera, no cada proveedor: el flujo documentado es copiar `_TEMPLATE/` a
// `01-TOOLS/<PROVEEDOR>/`, y depender de que cada copia se lleve su propia protección es depender
// de que nadie se salte un paso con credenciales de por medio.
const LAYER_IGNORE = ['# Escrito por rsc: la capa de herramientas guarda credenciales.',
  '*/.env', '*/.env.*', '!*/.env.example', '*/keys/', '*/out/', ''].join('\n');

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
export function missingHarnessFloor(cwd = process.cwd(), plan = {}) {
  const declared = Array.isArray(plan?.floorPaths) ? plan.floorPaths : [];
  const missing = [];
  for (const path of declared) {
    const segments = typeof path === 'string' ? floorSegments(path) : [];
    const usable = segments.length > 0 && !segments.includes('..') && !String(path).startsWith('/');
    // Un camino que no se puede usar se reporta como NO satisfecho, nunca como satisfecho, y sin
    // repetir su contenido: es dato ajeno y va a un canal que lee un agente.
    if (!usable) { missing.push('missing harness floor <invalid declaration>'); continue; }
    // La barra sólo si el camino declarado la traía: el suelo condicional es un FICHERO, y decir
    // `constitution.md/` invita a buscar un directorio que no existe.
    const shown = String(path).endsWith('/') ? `${floorKey(path)}/` : floorKey(path);
    if (!floorSatisfied(cwd, path)) missing.push(`missing harness floor ${shown}`);
  }
  return missing;
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
