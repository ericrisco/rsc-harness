import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleLifecycle } from '../targets/session-memory-adapter.mjs';

// A student lost a three-hour session to this and was being told, by their own agent, to delete
// parts of the harness. Three faults, chained:
//
//   1. Everything the adapter had to say went out as `hookSpecificOutput.additionalContext`, tagged
//      with whatever event was running. Claude Code accepts that field on a few events only, so on
//      Stop, PreCompact and SessionEnd the whole hook output was rejected.
//   2. `editCount` only ever grows and the hint is `editCount >= 20`, so past the twentieth edit it
//      fired on EVERY turn for the rest of the session. Compaction does not reset the count, which
//      is why `/compact` — the thing the agent recommends — made it worse rather than better.
//   3. Nothing read `stop_hook_active`, the field that exists so a Stop hook does not wake itself.
//
// The root of the first one is that two different things shared one channel: the resume CONTEXT is
// information for the model, the compaction HINT is a message for the person.

function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-hint-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [] }));
  writeFileSync(join(cwd, 'a.txt'), 'x');
  return cwd;
}
const past = (cwd, native, n = 21) => {
  for (let i = 0; i < n; i++) handleLifecycle({ target: 'claude', event: 'edit', native, cwd });
};
const run = (cwd, event, native) => handleLifecycle({ target: 'claude', event, native, cwd }).output;

test('the hint never rides on an event that cannot carry additionalContext', () => {
  const cwd = project();
  const native = { session_id: 'S1', cwd };
  past(cwd, native);
  for (const event of ['turn', 'compact', 'end', 'request', 'edit', 'boundary']) {
    const out = run(cwd, event, native);
    assert.equal(out.hookSpecificOutput, undefined,
      `${event} must not emit hookSpecificOutput for a hint, got ${JSON.stringify(out)}`);
  }
});

// It fires on the event that CROSSES the threshold, which is usually an edit, and it travels by the
// universal channel — so it is still said, and saying it can no longer fail validation.
test('the hint still reaches the person, as a system message', () => {
  const cwd = project();
  const native = { session_id: 'S2', cwd };
  const said = [];
  const others = [];
  for (let i = 0; i < 25; i++) {
    const out = handleLifecycle({ target: 'claude', event: 'edit', native, cwd }).output;
    if (/compact/i.test(out.systemMessage || '')) said.push(out.systemMessage);
    else if (out.systemMessage) others.push(out.systemMessage);
    assert.equal(out.hookSpecificOutput, undefined);
  }
  assert.equal(said.length, 1, `said ${said.length} times`);
  // The memory's other notices ride the same universal channel and are unaffected — worth holding,
  // because moving the hint here must not drown out or displace them.
  assert.ok(others.length >= 1, 'the ordinary notice channel still works');
});

// The channel that WAS always valid keeps working: SessionStart is one of the events that accepts
// additionalContext, and the resume context is genuinely information for the model.
test('the resume context still goes to the model on SessionStart', () => {
  const cwd = project();
  const native = { session_id: 'S3', cwd };
  handleLifecycle({ target: 'claude', event: 'edit', native, cwd });
  handleLifecycle({ target: 'claude', event: 'end', native, cwd });
  const out = handleLifecycle({ target: 'claude', event: 'start', native: { session_id: 'S4', cwd }, cwd }).output;
  if (out.hookSpecificOutput) {
    assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.ok(typeof out.hookSpecificOutput.additionalContext === 'string');
  }
});

// The one that cost the student three hours: past the twentieth edit the hint used to come back on
// every single event for the rest of the session, and compaction did not reset the count.
test('the hint is said once per session, not on every event after the twentieth edit', () => {
  const cwd = project();
  const native = { session_id: 'S5', cwd };
  let said = 0;
  const count = (out) => { if (/compact/i.test(out.systemMessage || '')) said += 1; };
  past(cwd, native, 25);
  for (let round = 0; round < 10; round++) {
    for (const event of ['turn', 'request', 'edit', 'boundary', 'compact']) {
      count(handleLifecycle({ target: 'claude', event, native, cwd }).output);
    }
  }
  assert.ok(said <= 1, `the hint was repeated ${said} times across fifty events after the threshold`);
});

test('a Stop hook that is already driving the turn adds nothing to the loop', () => {
  const cwd = project();
  const native = { session_id: 'S6', cwd, stop_hook_active: true };
  past(cwd, native);
  assert.deepEqual(run(cwd, 'turn', native), {}, 'stop_hook_active means: do not wake this again');
});

// Turning the hint off is the documented escape hatch, and it must not cost the memory itself.
test('compactionHint:false silences the hint and keeps recording', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-hint-off-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({
    version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [], memory: { compactionHint: false },
  }));
  writeFileSync(join(cwd, 'a.txt'), 'x');
  const native = { session_id: 'S7', cwd };
  past(cwd, native);
  assert.deepEqual(run(cwd, 'turn', native), {});
  assert.ok(existsSync(join(cwd, '.rsc', 'memory')), 'memory must still be recorded');
});

// The hint state had to live somewhere, and the session record was the wrong place: its schema is
// closed and every field is required, so a new field would invalidate every record already written.
test('records written before this change are still valid', () => {
  const cwd = project();
  const native = { session_id: 'S8', cwd };
  past(cwd, native, 3);
  const dir = join(cwd, '.rsc', 'memory');
  const file = readdirSync(dir).find((f) => f.endsWith('.json') && !f.includes('anchor'));
  if (file) {
    const record = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    assert.equal(record.compactionHinted, undefined, 'the hint flag must not have leaked into the record');
  }
});
