import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const surfaces = {
  readme: read('README.md'),
  en: read('site/index.html'),
  es: read('site/es/index.html'),
  llms: read('site/llms.txt'),
  package: read('package.json'),
};

test('public surfaces define rsc-harness as the guided harness builder', () => {
  // 2026-10-10, owner's tagline: «tú construyes el producto, el arnés te lo construye rsc».
  assert.match(surfaces.readme.slice(0, 2400), /You build the product[\s\S]*rsc-harness builds its harness/i);
  assert.match(surfaces.en.slice(0, 9000), /You build the product[\s\S]*rsc-harness builds its harness/i);
  assert.match(surfaces.es.slice(0, 9000), /Tú construyes el producto[\s\S]*rsc-harness construye su arnés/i);
  assert.match(surfaces.llms.slice(0, 1200), /guided harness builder/i);
  assert.match(JSON.parse(surfaces.package).description, /guided harness builder/i);
});

test('the public story names the Frankenstein risk and concrete best practices', () => {
  for (const [name, body] of Object.entries({ readme: surfaces.readme, en: surfaces.en, es: surfaces.es })) {
    assert.match(body, /Frankenstein/i, `${name} must name the improvised-harness failure`);
    assert.match(body, /progressive|bajo demanda/i, `${name} must explain progressive loading`);
    assert.match(body, /project root|raíz del proyecto/i, `${name} must explain project boundaries`);
    assert.match(body, /accept|acept/i, `${name} must explain plan acceptance`);
    assert.match(body, /evidence|evidencia/i, `${name} must explain evidence-led growth`);
  }
});

test('the website leads with the agent handoff and demonstrates proportional judgment', () => {
  for (const [name, body] of Object.entries({ en: surfaces.en, es: surfaces.es })) {
    // The install block: the message to paste comes first, the terminal command is the fallback.
    const start = body.indexOf('<!-- HERO -->');
    const hero = body.slice(start, body.indexOf('<!-- ', start + 5));
    assert.ok(start >= 0 && hero.includes('agent-prompt'), `${name} must have the agent prompt in the install block`);
    assert.ok(hero.indexOf('agent-prompt') < hero.indexOf('rsc@latest onboard'), `${name} must put the agent prompt before the terminal command`);
    assert.match(body, /for AI agents reading this page|para agentes que leen esta página/i, `${name} must keep the instructions agents follow`);
    assert.match(body, /selected|seleccionado/i, `${name} must show a selected component`);
    assert.match(body, /deferred|pospuesto/i, `${name} must show a deferred component`);
    assert.match(body, /excluded|excluido/i, `${name} must show an excluded component`);
  }
});

test('social-image sources carry the builder story without inventory as the headline', () => {
  const cover = read('site/cover.html');
  const anatomy = read('site/cover-anatomy.html');
  const svg = read('site/og.svg');
  for (const [name, body] of Object.entries({ cover, anatomy, svg })) {
    assert.match(body, /harness/i, `${name} must name the product category`);
    assert.match(body, /build|wizard|plan/i, `${name} must show guided construction`);
    assert.doesNotMatch(body, /<h1>\s*272 skills/i, `${name} must not headline inventory`);
  }
});
