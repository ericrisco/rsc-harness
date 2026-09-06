import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { TARGET_IDS } from '../../targets/index.js';
import { loadManifest, skillsForProfile } from './manifest.js';

export const ONBOARDING_SCHEMA_VERSION = 1;
export const ONBOARDING_VALUES = Object.freeze({
  technicalLevel: ['non-technical', 'mixed', 'technical'],
  accompaniment: ['L0', 'L1', 'L2', 'L3'],
  projectKind: ['software', 'operations', 'research', 'content', 'mixed'],
  softwareScope: ['small', 'growing', 'complex'],
});

const ignored = new Set(['.git', '.rsc', 'node_modules', '.venv', '.next', 'dist', 'build', 'coverage', '__pycache__', '.dart_tool']);
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
  let sourceFileCount = 0;
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      const rel = relative(absolute, path).split(sep).join('/');
      if (rel.startsWith('../') || rel === '..') throw new Error('project scan escaped the selected root');
      if (entry.isDirectory()) { visit(path); continue; }
      if (!entry.isFile()) continue;
      if (manifests.has(entry.name) || entry.name.endsWith('.md')) signals.push(rel);
      if (sourceExt.has(extension(entry.name))) sourceFileCount++;
      if (entry.name === 'package.json') {
        try {
          const pkg = JSON.parse(readFileSync(path, 'utf8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          for (const [name, stack] of [['next', 'nextjs'], ['react', 'react'], ['vue', 'vue'], ['svelte', 'svelte']]) if (deps[name]) stacks.add(stack);
          stacks.add('node');
        } catch { stacks.add('node'); }
      }
      if (entry.name === 'pyproject.toml' || entry.name === 'requirements.txt') stacks.add('python');
      if (entry.name === 'go.mod') stacks.add('go');
      if (entry.name === 'Cargo.toml') stacks.add('rust');
      if (entry.name === 'pubspec.yaml') stacks.add('flutter');
    }
  };
  visit(absolute);
  let parentHarness = null;
  let cursor = dirname(absolute);
  while (cursor !== dirname(cursor)) {
    if (existsSync(join(cursor, '.rsc.json'))) {
      parentHarness = relative(absolute, cursor).split(sep).join('/') || '..';
      break;
    }
    cursor = dirname(cursor);
  }
  return {
    schemaVersion: 1,
    signals: [...new Set(signals)].sort(),
    stacks: [...stacks].sort(),
    sourceFileCount,
    parentHarness,
  };
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
  const needsSdd = isSoftware && normalized.softwareScope !== 'small';
  const profile = needsSdd ? 'core' : 'minimal';
  const skills = skillsForProfile(loadManifest(), profile).sort();
  const baseAgents = needsSdd;
  const hooks = needsSdd;
  const decisions = skills.map((id) => selected(id, 'skill', needsSdd
    ? `Included in the development workflow for ${normalized.softwareScope} software.`
    : `Included in the lightweight foundation for this ${normalized.projectKind} project.`));
  const sddTriggers = ['multiple related features', 'authentication or persistence', 'external integrations', 'cross-cutting changes'];
  if (!needsSdd) decisions.push(deferred('sdd', 'workflow', isSoftware
    ? 'The software scope is small, so specification overhead is not justified yet.'
    : 'SDD applies to substantial software work, which is not the declared project purpose.', sddTriggers));
  decisions.push(baseAgents
    ? selected('base-agents', 'agent', 'Substantial software work benefits from implementation and independent review roles.')
    : deferred('base-agents', 'agent', 'No substantial software implementation is planned.', ['substantial software implementation is introduced']));
  decisions.push(hooks
    ? selected('code-hooks', 'hook', 'The accepted software workflow needs its deterministic code gates.')
    : deferred('code-hooks', 'hook', 'Code-only gates would add unrelated behavior to this project.', ['a substantial software workflow is accepted']));
  decisions.push(hooks
    ? selected('gitmoji-guard', 'guard', 'The selected code hook policy includes the repository commit convention.')
    : deferred('gitmoji-guard', 'guard', 'No code commit convention was justified for this project.', ['a governed software repository adopts the convention']));
  decisions.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  return {
    schemaVersion: 1,
    record: normalized,
    evidence: structuredClone(evidence),
    decisions,
    policy: {
      skills,
      targets: normalized.targets,
      baseAgents,
      hooks,
      gitmojiGuard: hooks,
      memory: true,
    },
    governedPaths: ['.rsc.json', '.rsc/', '02-DOCS/wiki/harness/'],
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

export function recommendDeferredComponents(acceptedPlan, currentEvidence) {
  const baseline = acceptedPlan?.evidence || {};
  const grewBy = (currentEvidence?.sourceFileCount || 0) - (baseline.sourceFileCount || 0);
  const addedManifests = (currentEvidence?.signals || []).filter((signal) => manifests.has(signal.split('/').at(-1)) && !(baseline.signals || []).includes(signal));
  if (grewBy < 5 && !addedManifests.length) return [];
  const evidence = grewBy >= 5
    ? `The project grew by ${grewBy} source files since the accepted plan.`
    : `The project added software manifest evidence: ${addedManifests.join(', ')}.`;
  return (acceptedPlan.decisions || [])
    .filter((decision) => decision.state === 'deferred' && ['sdd', 'base-agents', 'code-hooks'].includes(decision.id))
    .map((decision) => ({
      kind: decision.kind,
      id: decision.id,
      explanation: `${evidence} This matches: ${decision.reevaluateWhen.join('; ')}.`,
      requiresNewPlan: true,
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
