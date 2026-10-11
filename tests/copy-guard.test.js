import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractRules, loadRules, findViolations, proseOnly } from '../targets/copy-rules.mjs';

// A student's report (2026-10-11): a project forbade recruitment wording in decisions.md, and the
// agent still delivered an ad with it, because it decided that negating a banned word ("this is not
// a recruitment network") was allowed. Rules written as prose are read by the model, never checked.
// These tests pin the deterministic check that now stands between the model and the reader.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const CARLOS_DECISIONS = `## 2026-10-08 · Política de comunicación: nada de MLM ni reclutamiento

El negocio se presenta como un activo profesional de diagnóstico selectivo, nunca como multinivel.
Queda prohibido en cualquier texto público (anuncios, presentaciones, emails): "captar", "reclutar",
"vender a cualquiera", "perseguir contactos", "lista de contactos", "libertad financiera", "ingresos
pasivos", "únete a mi equipo" y cualquier lenguaje de reclutamiento o prospección. Se habla de
"profesionales que encajan", "diagnóstico", "selección" y "acompañamiento".
`;

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'rsc-copy-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

test('1 · a prohibition written in prose yields its quoted phrases, and only the forbidden ones', () => {
  const phrases = extractRules(CARLOS_DECISIONS).map((r) => r.phrase);
  for (const p of ['captar', 'reclutar', 'vender a cualquiera', 'perseguir contactos', 'lista de contactos', 'libertad financiera', 'ingresos pasivos', 'únete a mi equipo']) {
    assert.ok(phrases.includes(p), `missing banned phrase: ${p}`);
  }
  // The very next sentence lists the words to USE. Banning them would make the guard worse than none.
  for (const p of ['profesionales que encajan', 'diagnóstico', 'selección', 'acompañamiento']) {
    assert.ok(!phrases.includes(p), `an allowed word was read as banned: ${p}`);
  }
});

test('2 · a heading list and a "Never use:" line are both read', () => {
  const md = `# Voice guide\n\nNever use: leverage, seamless, elevate\n\n## Frases prohibidas\n\n- "game-changer"\n- sin compromiso\n- \`gratis*\`\n\n## Words we like\n\n- clear\n`;
  const phrases = extractRules(md).map((r) => r.phrase);
  assert.deepEqual(phrases.sort(), ['elevate', 'game-changer', 'gratis*', 'leverage', 'seamless', 'sin compromiso'].sort());
});

test('3 · matching ignores case and accents, and a negation is still a hit', () => {
  const rules = extractRules(CARLOS_DECISIONS);
  const hits = findViolations('Esto no va de VENDER A CUALQUIERA ni de perseguir contactos.\nÚnete a mi equipo.', rules);
  assert.deepEqual(hits.map((h) => h.phrase).sort(), ['perseguir contactos', 'vender a cualquiera', 'únete a mi equipo'].sort());
  assert.equal(hits.find((h) => h.phrase === 'únete a mi equipo').line, 2);
});

test('4 · a banned verb also catches its derivatives, the exact leak the reproduction showed', () => {
  const rules = extractRules(CARLOS_DECISIONS);
  const hits = findViolations('No es una red de captación. Nadie te recluta.', rules).map((h) => h.phrase);
  assert.ok(hits.includes('captar'), 'captación must hit the captar rule');
  assert.ok(hits.includes('reclutar'), 'recluta must hit the reclutar rule');
  // …and only words built on that stem: the guard must not fire on unrelated words.
  assert.deepEqual(findViolations('Un diagnóstico sereno para profesionales que encajan.', rules), []);
});

test('5 · an explicit * widens a phrase; without it, a phrase never matches inside another word', () => {
  const rules = extractRules('## Banned\n\n- gratis*\n- free\n');
  assert.deepEqual(findViolations('Prueba gratuita', rules), []);
  assert.deepEqual(findViolations('Totalmente gratisimo', rules).map((h) => h.phrase), ['gratis*']);
  assert.deepEqual(findViolations('freedom', rules), []);
});

test('6 · code spans and fenced blocks are not copy: an agent may cite a rule there', () => {
  const rules = extractRules(CARLOS_DECISIONS);
  const text = 'La regla prohíbe `captar`.\n\n```\nreclutar\n```\nTexto final limpio.';
  assert.deepEqual(findViolations(proseOnly(text), rules), []);
});

test('7 · rules are loaded from the whole wiki, raw/ excluded, and carry their source', () => {
  const dir = project({
    '02-DOCS/wiki/harness/decisions.md': CARLOS_DECISIONS,
    '02-DOCS/wiki/brand/voice-guide.md': '## Never use\n\n- leverage\n',
    '02-DOCS/raw/notes.md': 'Queda prohibido "nada"\n',
  });
  try {
    const rules = loadRules(dir);
    assert.ok(rules.some((r) => r.phrase === 'leverage' && r.source.endsWith('voice-guide.md')));
    assert.ok(rules.some((r) => r.phrase === 'captar' && r.source.endsWith('decisions.md')));
    assert.ok(!rules.some((r) => r.phrase === 'nada'), 'raw/ is unprocessed input, not policy');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the Stop hook ─────────────────────────────────────────────────────────────────────────────

function runHook(dir, input) {
  const r = spawnSync(process.execPath, [join(ROOT, 'targets', 'copy-guard.mjs'), dir], { input: JSON.stringify(input), encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr };
}

test('8 · the hook blocks a final answer that carries a banned phrase, once', () => {
  const dir = project({ '02-DOCS/wiki/harness/decisions.md': CARLOS_DECISIONS });
  try {
    const bad = runHook(dir, { last_assistant_message: 'Anuncio: No es una red de captación.' });
    assert.equal(bad.code, 0);
    const out = JSON.parse(bad.out);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /captar/);
    assert.match(out.reason, /decisions\.md/);
    // Second pass in the same turn: never loop.
    const again = runHook(dir, { last_assistant_message: 'No es una red de captación.', stop_hook_active: true });
    assert.equal(again.out, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('9 · the hook stays silent on clean copy, on a project without rules, and with the opt-out', () => {
  const dir = project({ '02-DOCS/wiki/harness/decisions.md': CARLOS_DECISIONS });
  const bare = project({ '02-DOCS/wiki/index.md': '# Index\n' });
  try {
    assert.equal(runHook(dir, { last_assistant_message: 'Un diagnóstico de 45 minutos para profesionales que encajan.' }).out, '');
    assert.equal(runHook(bare, { last_assistant_message: 'captar reclutar' }).out, '');
    mkdirSync(join(dir, '.rsc'), { recursive: true });
    writeFileSync(join(dir, '.rsc', '.no-copy-guard'), '');
    assert.equal(runHook(dir, { last_assistant_message: 'captar' }).out, '');
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(bare, { recursive: true, force: true }); }
});

test('10 · without last_assistant_message the hook reads the final turn from the transcript', () => {
  const dir = project({ '02-DOCS/wiki/harness/decisions.md': CARLOS_DECISIONS });
  const lines = [
    { type: 'user', message: { role: 'user', content: 'escribe un anuncio' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Primer borrador limpio.' }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Texto final: perseguir contactos no.' }] } },
  ];
  const tp = join(dir, 't.jsonl');
  writeFileSync(tp, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  try {
    const out = JSON.parse(runHook(dir, { transcript_path: tp }).out);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /perseguir contactos/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('11 · a broken input fails open', () => {
  const dir = project({ '02-DOCS/wiki/harness/decisions.md': CARLOS_DECISIONS });
  try {
    const r = spawnSync(process.execPath, [join(ROOT, 'targets', 'copy-guard.mjs'), dir], { input: 'not json', encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the CLI ───────────────────────────────────────────────────────────────────────────────────

test('12 · `rsc copy check` exits 1 with the hit and its rule, 0 on clean text', () => {
  const dir = project({ '02-DOCS/wiki/harness/decisions.md': CARLOS_DECISIONS, 'ad.txt': 'Línea uno.\nNo es para vender a cualquiera.\n', 'ok.txt': 'Diagnóstico sereno.\n' });
  try {
    const cli = (args) => spawnSync(process.execPath, [join(ROOT, 'scripts', 'rsc.js'), 'copy', ...args], { cwd: dir, encoding: 'utf8' });
    const bad = cli(['check', 'ad.txt']);
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /vender a cualquiera/);
    assert.match(bad.stdout, /ad\.txt:2/);
    assert.equal(cli(['check', 'ok.txt']).status, 0);
    const rules = cli(['rules', '--json']);
    assert.equal(rules.status, 0);
    assert.ok(JSON.parse(rules.stdout).some((r) => r.phrase === 'captar'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── precision: 3.0.21 turned documentation ABOUT rules into rules ─────────────────────────────
// Every sample below is real text from a wiki where 3.0.21 extracted 70+ "banned phrases" (file
// names, table cells, "add", "review", a lone "y") and then blocked ordinary answers.

test('13 · a mention of a ban is not a declaration of one', () => {
  const samples = [
    '- [x] Reproducir. Anuncio «deja claro que no es multinivel»: 2/3 entregan vocabulario prohibido negado («red de captación», «lista de contactos»).',
    '- **3.0.21, copy guard:** las frases prohibidas de un proyecto se hacen cumplir con un Stop hook y `rsc copy check`. Caso de un alumno: el modelo negaba palabras prohibidas («no es una red de captación») creyendo que estaba permitido.',
    '| P1 | Todo `skill-id` en SKILL.md debe existir; paths absolutos/personales prohibidos (nuestro `.claude/settings.json`). | Hoy `review` anuncia `/code-review` y `rsc-review` que no existen; `detect-repo.js` emite `design-eng`. | S |',
    'El gate prohíbe tocar `targets/agents.js` sin test, y nunca uses `add` sin `--target`.',
  ];
  for (const md of samples) assert.deepEqual(extractRules(md).map((r) => r.phrase), [], md.slice(0, 60));
});

test('14 · a wrapped "Vetado:" list is read to its end, code-quoted items included', () => {
  const md = '**Vetado:** `revolutionary`, `game-changer`, `seamless`,\n`supercharge`, "In today\'s landscape".\n\nOtro párrafo con "comillas" normales.\n';
  assert.deepEqual(extractRules(md).map((r) => r.phrase).sort(), ['game-changer', "In today's landscape", 'revolutionary', 'seamless', 'supercharge'].sort());
});

test('15 · process records are not policy: ftd/ and sdd/ are skipped', () => {
  const dir = project({
    '02-DOCS/wiki/ftd/feature.md': 'Prohibido "captar".\n',
    '02-DOCS/wiki/sdd/specs/x.md': '## Never use\n\n- leverage\n',
    '02-DOCS/wiki/brand/voice.md': 'Prohibido "reclutar".\n',
    '02-DOCS/wiki/_archive/old.md': 'Prohibido "vender".\n',
  });
  try { assert.deepEqual(loadRules(dir).map((r) => r.phrase), ['reclutar']); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('16 · a lone letter or a stopword is never a rule', () => {
  assert.deepEqual(extractRules('## Banned\n\n- y\n- the\n- ok go\n').map((r) => r.phrase), ['ok go']);
  // An unquoted list splits on commas only, so a common word is never cut out of a phrase.
  assert.deepEqual(extractRules('Vetado: blobs, ilustraciones de cerebros, robots o personas.\n').map((r) => r.phrase), ['blobs', 'ilustraciones de cerebros', 'robots o personas']);
});

test('17 · visual bans are not copy rules, and a list ends with its sentence', () => {
  const md = '## Logo y color\n\nVetado: personas, blobs.\n\n## Voz\n\nVetado: game-changer, y **logos de terceros**. Un logo corporativo mal dibujado hunde el asset.\n';
  assert.deepEqual(extractRules(md).map((r) => r.phrase), ['game-changer', 'logos de terceros']);
  const dir = project({ '02-DOCS/wiki/brand/visual-identity.md': 'Vetado: personas.\n', '02-DOCS/wiki/brand/voice.md': 'Vetado: leverage.\n' });
  try { assert.deepEqual(loadRules(dir).map((r) => r.phrase), ['leverage']); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
