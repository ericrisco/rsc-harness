import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from '../scripts/consult.js';
import { loadManifest } from '../scripts/lib/manifest.js';

test('ranks postgres skill for a database query', async () => {
  const m = loadManifest();
  const ranked = await rank(m, 'guardar datos en una base de datos sql postgres');
  assert.ok(ranked.slice(0, 3).some((r) => r.id === 'postgresdb'));
});

test('ranks web skill for a website query', async () => {
  const m = loadManifest();
  const ranked = await rank(m, 'quiero una web nextjs react');
  assert.ok(ranked.slice(0, 3).some((r) => r.id === 'nextjs'));
});

test('empty query returns []', async () => {
  const m = loadManifest();
  assert.deepEqual(await rank(m, '   '), []);
});

test('prototype-looking query terms do not crash synonym expansion', async () => {
  const m = loadManifest();
  const ranked = await rank(m, 'simplify the constructor without changing behavior');
  assert.ok(Array.isArray(ranked));
});

test('ranks suggest for multilingual skill recommendation intent queries', async () => {
  const m = loadManifest();
  const queries = [
    'vull que detecti la intenció de recomanar skills',
    'quiero instalar la skill adecuada según mi intención',
    'recommend the right skill for this task',
    'recommande la bonne compétence pour cette tâche',
    'consiglia la skill giusta per questo lavoro',
    'recomenda a habilidade certa para esta tarefa',
    'empfiehl die richtige skill fuer diese aufgabe',
  ];

  for (const query of queries) {
    const ranked = await rank(m, query);
    assert.ok(
      ranked.slice(0, 3).some((r) => r.id === 'suggest'),
      `${query} should rank suggest near the top; got ${ranked.slice(0, 6).map((r) => r.id).join(', ')}`,
    );
  }
});

test('low-confidence metadata matches do not produce accidental recommendations', async () => {
  const m = loadManifest();
  const ranked = await rank(m, 'vull millorar com es recomanen skills segons la intenció de l usuari');
  assert.ok(ranked.length > 0);
  assert.notEqual(ranked[0].score, 1);
  assert.ok(ranked.slice(0, 3).some((r) => r.id === 'suggest'));
});

test('generic recommendation wording does not hijack non-skill intent', async () => {
  const m = loadManifest();
  const ranked = await rank(m, 'recommend a pricing strategy for my SaaS');
  assert.equal(ranked[0].id, 'pricing');
});

test('ranks project bootstrap intent for starting a web project', async () => {
  const m = loadManifest();
  const ranked = await rank(m, 'quiero montar una pagina web para vender cursos online');
  const ids = ranked.slice(0, 4).map((r) => r.id);
  assert.ok(ids.includes('init'), `expected init in top 4; got ${ids.join(', ')}`);
  assert.ok(ids.includes('nextjs'), `expected nextjs in top 4; got ${ids.join(', ')}`);
});

test('ranks bro first for human-language rewrite intent across supported phrasing', async () => {
  const m = loadManifest();
  const queries = [
    'bro, escribe como un humano',
    'escribe como un humano',
    'hazlo más natural y menos robótico',
    'Això sona escrit per una IA. Fes-ho més humà',
    'rewrite your last answer in plain human language',
    'say it without all the corporate jargon',
  ];

  for (const query of queries) {
    const ranked = await rank(m, query);
    assert.equal(
      ranked[0]?.id,
      'bro',
      `${query} should rank bro first; got ${ranked.slice(0, 6).map((r) => r.id).join(', ')}`,
    );
  }
});
