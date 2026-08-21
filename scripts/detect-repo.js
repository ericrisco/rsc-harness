import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// What counts as a frontend, and which stack skill owns it. Before this table, "frontend" meant
// React or Next and nothing else, so a Vue/Svelte/Astro/Angular/Solid repo got no design skill at
// all — even though the catalog ships a skill for each of them. Every entry here also earns the
// `design-eng` umbrella, which is the one skill that routes a UI request to the sibling that owns
// it. Kept as a table, not a chain of `if`s, so adding a framework is one line and the test
// iterates it. Spec: 02-DOCS/wiki/sdd/specs/motion-craft-skills.md
const FRONTEND_DEPS = [
  ['next', 'nextjs'],
  ['react', 'nextjs'],
  ['vue', 'vue-nuxt'],
  ['nuxt', 'vue-nuxt'],
  ['svelte', 'svelte'],
  ['@sveltejs/kit', 'svelte'],
  ['astro', 'astro'],
  ['@angular/core', 'angular'],
  ['solid-js', 'solid-js'],
];

export function detectRepo(dir = process.cwd()) {
  const found = new Set();
  const has = (f) => existsSync(join(dir, f));
  const pkg = has('package.json') ? safeJson(join(dir, 'package.json')) : null;
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [dep, stack] of FRONTEND_DEPS) {
      if (!deps[dep]) continue;
      found.add(stack);
      found.add('design');
      // The umbrella, not a motion skill: it decides which of the craft siblings answers. A repo
      // that never animates anything still benefits from the routing, and one that does gets sent
      // to the right place instead of having `design` guess.
      found.add('design-eng');
    }
  }
  if (has('pubspec.yaml')) { found.add('flutter'); found.add('design'); }
  if (has('requirements.txt') || has('pyproject.toml')) found.add('fastapi');
  if (has('go.mod')) found.add('go');
  if (has('prisma') || has('migrations') || readdirSafe(dir).some((f) => f.endsWith('.sql'))) found.add('postgresdb');
  if (has('Dockerfile') || has('compose.yaml') || has('.github')) found.add('deployment');
  return [...found];
}

export function detectRepoProfile(dir = process.cwd()) {
  const has = (f) => existsSync(join(dir, f));
  const pkg = has('package.json') ? safeJson(join(dir, 'package.json')) : null;
  const pyproject = has('pyproject.toml') ? readSafe(join(dir, 'pyproject.toml')) : '';
  const requirements = has('requirements.txt') ? readSafe(join(dir, 'requirements.txt')) : '';
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const scripts = pickScripts(pkg?.scripts || {});
  const packageManagers = detectPackageManagers(dir);
  const testRunners = [];
  const signals = [];

  if (deps.vitest || /(^|\s)vitest(\s|$)/.test(scripts.test || '')) testRunners.push('vitest');
  if (deps.jest || /(^|\s)jest(\s|$)/.test(scripts.test || '')) testRunners.push('jest');
  if (deps['@playwright/test'] || deps.playwright || /playwright/.test(scripts.test || '')) testRunners.push('playwright');
  if (/pytest/i.test(pyproject) || /pytest/i.test(requirements)) testRunners.push('pytest');
  if (has('go.mod')) testRunners.push('go test');
  if (has('pubspec.yaml')) testRunners.push('flutter test');

  const monorepo = Boolean(
    pkg?.workspaces ||
    has('pnpm-workspace.yaml') ||
    has('turbo.json') ||
    has('nx.json') ||
    has('lerna.json')
  );
  if (pkg?.workspaces) signals.push('package.json#workspaces');
  for (const f of ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json']) {
    if (has(f)) signals.push(f);
  }

  return {
    stacks: detectRepo(dir),
    packageManagers,
    scripts,
    testRunners: unique(testRunners),
    monorepo,
    signals,
    commands: recommendedCommands({ scripts, packageManagers, testRunners, has }),
    strictTdd: testRunners.length > 0,
  };
}

function safeJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

function readSafe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

function readdirSafe(d) {
  try { return readdirSync(d); } catch { return []; }
}

function pickScripts(scripts) {
  const out = {};
  for (const k of ['test', 'lint', 'typecheck', 'build']) {
    if (scripts[k]) out[k] = scripts[k];
  }
  return out;
}

function detectPackageManagers(dir) {
  const managers = [];
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) managers.push('pnpm');
  if (existsSync(join(dir, 'yarn.lock'))) managers.push('yarn');
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) managers.push('bun');
  if (existsSync(join(dir, 'package-lock.json'))) managers.push('npm');
  if (!managers.length && existsSync(join(dir, 'package.json'))) managers.push('npm');
  return managers;
}

function recommendedCommands({ scripts, packageManagers, testRunners, has }) {
  const pm = packageManagers[0] || 'npm';
  const run = (script) => pm === 'npm' ? `npm run ${script}` : `${pm} run ${script}`;
  const nodeVerify = ['lint', 'typecheck', 'test', 'build'].filter((s) => scripts[s]).map(run);
  const apply = [];
  const verify = [...nodeVerify];

  if (scripts.test) apply.push(run('test'));
  if (testRunners.includes('pytest')) {
    apply.push('pytest');
    if (!verify.includes('pytest')) verify.push('pytest');
  }
  if (testRunners.includes('go test')) {
    apply.push('go test ./...');
    if (!verify.includes('go test ./...')) verify.push('go test ./...');
  }
  if (testRunners.includes('flutter test')) {
    apply.push('flutter test');
    if (!verify.includes('flutter test')) verify.push('flutter test');
  }
  if (!verify.length && has('go.mod')) verify.push('go test ./...');
  return { apply: unique(apply), verify: unique(verify) };
}

function unique(items) {
  return [...new Set(items)];
}
