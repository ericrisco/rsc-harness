import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { TARGET_IDS } from '../../targets/index.js';
import { resolveAgentNames } from '../../targets/agents.js';
import { loadManifest, skillsForProfile } from './manifest.js';
import { managedPathsForInstall } from '../install-apply.js';

export const ONBOARDING_SCHEMA_VERSION = 1;
export const ONBOARDING_VALUES = Object.freeze({
  technicalLevel: ['non-technical', 'mixed', 'technical'],
  accompaniment: ['L0', 'L1', 'L2', 'L3'],
  projectKind: ['software', 'operations', 'research', 'content', 'mixed'],
  softwareScope: ['small', 'growing', 'complex'],
});

const ignored = new Set([
  '.git', '.rsc', 'node_modules', '.venv', '.next', 'dist', 'build', 'coverage', '__pycache__', '.dart_tool',
  '.claude', '.codex', '.cursor', '.opencode', '.amp', '.jules', '.zed', '.gemini', '.antigravity',
  '.windsurf', '.clinerules', '.roo', '.continue', '.junie', '.kiro', '.aider',
]);
const manifests = new Set(['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pubspec.yaml', 'requirements.txt']);
const sourceExt = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.dart', '.java', '.kt', '.swift', '.php', '.rb']);

const clean = (value) => String(value ?? '').trim();
const oneOf = (field, value, values) => {
  if (!values.includes(value)) throw new Error(`invalid ${field}: expected ${values.join('|')}`);
  return value;
};

export function normalizeOnboarding(raw = {}) {
  const schemaVersion = Number(raw.schemaVersion ?? ONBOARDING_SCHEMA_VERSION);
  if (schemaVersion !== ONBOARDING_SCHEMA_VERSION) throw new Error(`invalid schemaVersion: expected ${ONBOARDING_SCHEMA_VERSION}`);
  const technicalLevel = oneOf('technical-level', clean(raw.technicalLevel).toLowerCase(), ONBOARDING_VALUES.technicalLevel);
  const accompaniment = oneOf('accompaniment', clean(raw.accompaniment).toUpperCase(), ONBOARDING_VALUES.accompaniment);
  const projectKind = oneOf('project-kind', clean(raw.projectKind).toLowerCase(), ONBOARDING_VALUES.projectKind);
  const goal = clean(raw.goal).replace(/\s+/g, ' ');
  if (!goal) throw new Error('invalid goal: a concrete goal is required');
  const targets = [...new Set((Array.isArray(raw.targets) ? raw.targets : clean(raw.targets).split(','))
    .map((target) => clean(target).toLowerCase()).filter(Boolean))].sort();
  if (!targets.length || targets.some((target) => !TARGET_IDS.includes(target))) {
    throw new Error(`invalid target: expected one or more of ${TARGET_IDS.join(',')}`);
  }
  const needsScope = projectKind === 'software' || projectKind === 'mixed';
  const softwareScope = clean(raw.softwareScope).toLowerCase();
  if (needsScope) oneOf('software-scope', softwareScope, ONBOARDING_VALUES.softwareScope);
  return {
    schemaVersion,
    technicalLevel,
    accompaniment,
    projectKind,
    goal,
    ...(needsScope ? { softwareScope } : {}),
    targets,
  };
}

function extension(file) {
  const dot = file.lastIndexOf('.');
  return dot < 0 ? '' : file.slice(dot);
}

export function scanProject(root = process.cwd()) {
  const absolute = realpathSync(resolve(root));
  const signals = [];
  const stacks = new Set();
  const complexitySignals = new Set();
  let markdownCount = 0;
  let sourceFileCount = 0;
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      const rel = relative(absolute, path).split(sep).join('/');
      if (rel.startsWith('../') || rel === '..') throw new Error('project scan escaped the selected root');
      if (rel === '02-DOCS/wiki/harness' || rel.startsWith('02-DOCS/wiki/harness/')) continue;
      if (entry.isDirectory()) { visit(path); continue; }
      if (!entry.isFile()) continue;
      let isSignal = manifests.has(entry.name) || entry.name.endsWith('.md');
      // Codex stores the always-on layer in AGENTS.md. Ignore a file that contains
      // only our managed block, while retaining a user's surrounding instructions
      // as real project evidence across repair/re-onboarding.
      if (entry.name === 'AGENTS.md') {
        const human = readFileSync(path, 'utf8')
          .replace(/\n*<!-- rsc-suggest:start -->[\s\S]*?<!-- rsc-suggest:end -->\n*/g, '')
          .trim();
        isSignal = Boolean(human);
      }
      if (isSignal && manifests.has(entry.name)) signals.push(`manifest:${entry.name}`);
      else if (isSignal) markdownCount++;
      if (sourceExt.has(extension(entry.name))) sourceFileCount++;
      const lowerRel = rel.toLowerCase();
      if (/(^|[/_.-])(auth|login|oauth|session)([/_.-]|$)/.test(lowerRel)) complexitySignals.add('authentication');
      if (/(^|[/_.-])(payment|billing|checkout)([/_.-]|$)/.test(lowerRel)) complexitySignals.add('payments');
      if (/(^|[/_.-])(database|persistence|migration|schema)([/_.-]|$)/.test(lowerRel)) complexitySignals.add('persistence');
      if (/(^|[/_.-])(integration|webhook|connector)([/_.-]|$)/.test(lowerRel)) complexitySignals.add('external-integrations');
      if (entry.name === 'package.json') {
        try {
          const pkg = JSON.parse(readFileSync(path, 'utf8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          for (const [name, stack] of [['next', 'nextjs'], ['react', 'react'], ['vue', 'vue'], ['svelte', 'svelte']]) if (deps[name]) stacks.add(stack);
          stacks.add('node');
          const names = Object.keys(deps).join(' ').toLowerCase();
          if (/(passport|auth0|clerk|next-auth|better-auth)/.test(names)) complexitySignals.add('authentication');
          if (/(stripe|paypal|adyen|braintree)/.test(names)) complexitySignals.add('payments');
          if (/(prisma|typeorm|sequelize|mongoose|postgres|mysql|sqlite|supabase|firebase)/.test(names)) complexitySignals.add('persistence');
          if (/(webhook|octokit|twilio|sendgrid|slack)/.test(names)) complexitySignals.add('external-integrations');
        } catch { stacks.add('node'); }
      }
      if (entry.name === 'pyproject.toml' || entry.name === 'requirements.txt') stacks.add('python');
      if (entry.name === 'go.mod') stacks.add('go');
      if (entry.name === 'Cargo.toml') stacks.add('rust');
      if (entry.name === 'pubspec.yaml') stacks.add('flutter');
    }
  };
  visit(absolute);
  if (markdownCount) signals.push(`markdown:${markdownCount}`);
  let parentHarness = null;
  let cursor = dirname(absolute);
  while (cursor !== dirname(cursor)) {
    if (existsSync(join(cursor, '.rsc.json'))) {
      parentHarness = relative(absolute, cursor).split(sep).join('/') || '..';
      break;
    }
    cursor = dirname(cursor);
  }
  const evidence = {
    schemaVersion: 1,
    signals: [...new Set(signals)].sort(),
    stacks: [...stacks].sort(),
    complexitySignals: [...complexitySignals].sort(),
    sourceFileCount,
    parentHarness,
  };
  Object.defineProperty(evidence, 'root', { value: absolute, enumerable: false });
  return evidence;
}

function selected(id, kind, reason, provenance = 'declared-intent') {
  return { kind, id, state: 'selected', reason, provenance, reevaluateWhen: [] };
}
function deferred(id, kind, reason, reevaluateWhen, provenance = 'proportionality-policy') {
  return { kind, id, state: 'deferred', reason, provenance, reevaluateWhen };
}

export function buildOnboardingPlan(record, evidence) {
  const normalized = normalizeOnboarding(record);
  const isSoftware = normalized.projectKind === 'software' || normalized.projectKind === 'mixed';
  const goalSignals = [];
  const goal = normalized.goal.toLowerCase();
  if (/auth|login|oauth|sesión|session/.test(goal)) goalSignals.push('authentication');
  if (/payment|billing|checkout|pago|cobro/.test(goal)) goalSignals.push('payments');
  if (/database|persistence|persistencia|base de datos/.test(goal)) goalSignals.push('persistence');
  if (/integration|integración|webhook|third-party|tercero/.test(goal)) goalSignals.push('external-integrations');
  const complexitySignals = [...new Set([...(evidence.complexitySignals || []), ...goalSignals])].sort();
  const needsSdd = isSoftware && (normalized.softwareScope !== 'small' || complexitySignals.length > 0);
  const profile = needsSdd ? 'core' : 'minimal';
  const catalog = loadManifest();
  const catalogIds = new Set(catalog.skills.map((skill) => skill.id));
  const detectedSkills = (evidence.stacks || []).filter((stack) => catalogIds.has(stack));
  const skills = [...new Set([...skillsForProfile(catalog, profile), ...detectedSkills])].sort();
  const baseAgents = needsSdd;
  const hooks = needsSdd;
  const agents = baseAgents ? resolveAgentNames(skills, []).sort() : [];
  const gitmojiGuard = hooks && normalized.targets.includes('claude');
  const decisions = skills.map((id) => detectedSkills.includes(id)
    ? selected(id, 'skill', `Detected ${id} evidence inside the selected project root.`, 'workspace-evidence')
    : selected(id, 'skill', needsSdd
      ? (id === 'sdd' && complexitySignals.length
        ? `Included because the accepted work has ${complexitySignals.join(', ')} complexity.`
        : `Included in the development workflow for ${normalized.softwareScope} software.`)
      : `Included in the lightweight foundation for this ${normalized.projectKind} project.`));
  const sddTriggers = ['multiple related features', 'authentication or persistence', 'external integrations', 'cross-cutting changes'];
  if (!needsSdd) decisions.push(deferred('sdd', 'workflow', isSoftware
    ? 'The software scope is small, so specification overhead is not justified yet.'
    : 'SDD applies to substantial software work, which is not the declared project purpose.', sddTriggers));
  if (baseAgents) {
    for (const id of agents) decisions.push(selected(id, 'agent', 'The accepted substantial software workflow requires this implementation or review role.'));
  } else {
    decisions.push(deferred('base-agents', 'agent', 'No substantial software implementation is planned.', ['substantial software implementation is introduced']));
  }
  decisions.push(hooks
    ? selected('code-hooks', 'hook', 'The accepted software workflow needs its deterministic code gates.')
    : deferred('code-hooks', 'hook', 'Code-only gates would add unrelated behavior to this project.', ['a substantial software workflow is accepted']));
  decisions.push(gitmojiGuard
    ? selected('gitmoji-guard', 'guard', 'Claude Code supports the commit guard and the accepted code policy includes it.')
    : deferred('gitmoji-guard', 'guard', 'No selected target and project policy justify this Claude-only commit guard.', ['Claude Code is selected and a governed software workflow adopts the convention']));
  decisions.push(selected('memory', 'capability', 'Local bounded project memory supports continuity without an external account.'));
  decisions.push(selected('harness-documents', 'route', 'The accepted profile and plan are persisted under 02-DOCS/wiki/harness/.'));
  decisions.push(deferred('context7', 'integration', 'No external MCP connection is installed without a specific need and separate consent.', ['a software task needs current third-party library documentation']));
  decisions.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const policy = {
    skills,
    targets: normalized.targets,
    baseAgents,
    agents,
    alwaysOn: true,
    codeHooks: needsSdd,
    gitmojiGuard,
    memory: true,
  };
  const root = evidence.root;
  const governedPaths = root ? [...new Set([
    '.rsc.json', '.rsc/backups/',
    ...(existsSync(join(root, '.git')) ? ['.gitignore'] : []),
    '02-DOCS/wiki/harness/user-profile.md',
    '02-DOCS/wiki/harness/decisions.md',
    '02-DOCS/wiki/harness/installation-plan.md',
    ...normalized.targets.flatMap((target) => managedPathsForInstall({ skillIds: skills, target, cwd: root, policy })
      .map((path) => relative(root, path).split(sep).join('/'))),
  ])].sort() : ['.rsc.json', '.rsc/', '02-DOCS/wiki/harness/'];
  return {
    schemaVersion: 1,
    record: normalized,
    evidence: {
      schemaVersion: evidence.schemaVersion,
      signals: [...evidence.signals], stacks: [...evidence.stacks],
      complexitySignals: [...(evidence.complexitySignals || [])],
      sourceFileCount: evidence.sourceFileCount, parentHarness: evidence.parentHarness,
    },
    decisions,
    policy,
    governedPaths,
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export const canonicalJson = (value) => JSON.stringify(canonical(value));
export const identifyPlan = (plan) => createHash('sha256').update(canonicalJson(plan)).digest('hex');
export const shellQuote = (value) => `'${String(value).replaceAll("'", `'"'"'`)}'`;

export function recommendDeferredComponents(acceptedPlan, currentEvidence) {
  const baseline = acceptedPlan?.evidence || {};
  const grewBy = (currentEvidence?.sourceFileCount || 0) - (baseline.sourceFileCount || 0);
  const addedManifests = (currentEvidence?.signals || []).filter((signal) => signal.startsWith('manifest:') && !(baseline.signals || []).includes(signal));
  const addedComplexity = (currentEvidence?.complexitySignals || []).filter((signal) => !(baseline.complexitySignals || []).includes(signal));
  if (grewBy < 5 && !addedManifests.length && !addedComplexity.length) return [];
  const evidence = addedComplexity.length
    ? `The project added ${addedComplexity.join(', ')} evidence.`
    : grewBy >= 5
    ? `The project grew by ${grewBy} source files since the accepted plan.`
    : `The project added software manifest evidence: ${addedManifests.join(', ')}.`;
  const suggestedRecord = {
    ...acceptedPlan.record,
    projectKind: ['software', 'mixed'].includes(acceptedPlan.record.projectKind) ? acceptedPlan.record.projectKind : 'mixed',
    softwareScope: 'growing',
  };
  return (acceptedPlan.decisions || [])
    .filter((decision) => decision.state === 'deferred' && ['sdd', 'base-agents', 'code-hooks'].includes(decision.id))
    .map((decision) => ({
      kind: decision.kind,
      id: decision.id,
      explanation: `${evidence} This matches: ${decision.reevaluateWhen.join('; ')}.`,
      requiresNewPlan: true,
      suggestedRecord,
    }));
}

export function missingOnboardingFields(raw = {}) {
  const missing = [];
  if (!clean(raw.technicalLevel)) missing.push('technical-level');
  if (!clean(raw.accompaniment)) missing.push('accompaniment');
  if (!clean(raw.projectKind)) missing.push('project-kind');
  if (!clean(raw.goal)) missing.push('goal');
  const kind = clean(raw.projectKind).toLowerCase();
  if ((kind === 'software' || kind === 'mixed') && !clean(raw.softwareScope)) missing.push('software-scope');
  if (!(Array.isArray(raw.targets) ? raw.targets.length : clean(raw.targets))) missing.push('target');
  return missing;
}
