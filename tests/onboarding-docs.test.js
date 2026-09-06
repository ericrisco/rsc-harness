import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const docs = {
  README: readFileSync(join(ROOT, 'README.md'), 'utf8'),
  English: readFileSync(join(ROOT, 'site/index.html'), 'utf8'),
  Spanish: readFileSync(join(ROOT, 'site/es/index.html'), 'utf8'),
  llms: readFileSync(join(ROOT, 'site/llms.txt'), 'utf8'),
};

test('every public surface sends humans and chat agents through canonical onboarding', () => {
  for (const [name, body] of Object.entries(docs)) {
    assert.match(body, /rsc@latest onboard/, `${name} lacks the canonical onboarding command`);
    assert.match(body, /technical-level/, `${name} does not expose the first wizard answer`);
    assert.match(body, /accept-plan/, `${name} does not explain binding acceptance`);
  }
});

test('public claims state the real guarantee boundary and no longer promise an opaque profile menu', () => {
  assert.match(docs.README, /before (?:it )?writes|writes nothing/i);
  assert.match(docs.English, /writes nothing|before writing/i);
  assert.match(docs.Spanish, /no escribe|antes de escribir/i);
  for (const body of Object.values(docs)) {
    assert.doesNotMatch(body, /asks which package and assistant|pregunta qué paquete y asistente/i);
  }
});

test('agent copy says to relay questions and never invent onboarding answers', () => {
  assert.match(docs.llms, /relay|ask the user/i);
  assert.match(docs.llms, /never (?:choose|invent|default)/i);
  assert.match(docs.README, /paste|URL|chat/i);
});
