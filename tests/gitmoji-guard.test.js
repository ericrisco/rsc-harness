// gitmoji-guard.test.js — the tests the constitution demands for a new gate:
//  P2: the gate proves it gates (real denials, real allowances — not a decorative hook).
//  P6: every deny message carries its `Recover:` line, asserted here, not assumed.
//  P7: friction proportional to risk — anything unreadable is allowed, and the
//      kill-switch (.rsc/.no-gitmoji) is proven to actually disarm the guard.
//  P3: the reference table in `git-workflow` is checked AGAINST the guard's data, so the
//      documented emoji set and the enforced one cannot drift apart in silence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { GITMOJIS, EMOJI_SET, hasGitmoji, commitMessages, denyMessage } from '../targets/gitmoji-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const GUARD = join(REPO, 'targets', 'gitmoji-guard.mjs');
const REFERENCE = join(REPO, 'skills', 'git-workflow', 'references', 'gitmoji.md');

// Run the real guard the way Claude Code does (stdin hook JSON). A crash must NOT read
// as "allow", or the parity tests below would pass on a guard that merely fell over.
function runGuard(root, command) {
  const r = spawnSync('node', [GUARD, root], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `guard crashed (exit ${r.status}): ${r.stderr}`);
  assert.equal(r.stderr.trim(), '', `guard wrote to stderr: ${r.stderr}`);
  if (!r.stdout.trim()) return null; // silence = allow
  const parsed = JSON.parse(r.stdout); // a non-JSON body is a bug — let it throw
  return parsed.hookSpecificOutput?.permissionDecision === 'deny' ? parsed : null;
}
const denyReason = (root, cmd) => runGuard(root, cmd)?.hookSpecificOutput?.permissionDecisionReason ?? null;
const freshRoot = () => mkdtempSync(join(tmpdir(), 'rsc-gitmoji-'));

// ---- the data table -------------------------------------------------------------

test('gitmoji: the official set is loaded as data, complete and well-formed', () => {
  assert.equal(GITMOJIS.length, 75, 'the gitmoji.dev set has 75 entries');
  for (const [emoji, code, semver, description] of GITMOJIS) {
    assert.ok(emoji.length > 0, 'every row carries its emoji');
    assert.match(code, /^:[a-z0-9_+-]+:$/, `shortcode is well-formed: ${code}`);
    assert.ok(semver === null || ['patch', 'minor', 'major'].includes(semver), `semver is valid: ${code}`);
    assert.ok(description.length > 0, `${code} says what it means`);
  }
  assert.equal(new Set(GITMOJIS.map(([, c]) => c)).size, GITMOJIS.length, 'no duplicate shortcodes');
});

test('gitmoji: the git-workflow reference table matches the enforced set (no silent drift)', () => {
  const doc = readFileSync(REFERENCE, 'utf8');
  // Rows look like: | 🐛 | `:bug:` | patch | Fix a bug |
  const rows = [...doc.matchAll(/^\|\s*(\S+)\s*\|\s*`(:[a-z0-9_+-]+:)`\s*\|/gm)].map((m) => [m[1], m[2]]);
  assert.equal(rows.length, GITMOJIS.length, 'the doc documents exactly the enforced set');
  const byCode = new Map(GITMOJIS.map(([e, c]) => [c, e]));
  for (const [emoji, code] of rows) {
    assert.ok(byCode.has(code), `${code} is in the enforced set`);
    assert.equal(emoji, byCode.get(code), `${code} renders the same emoji in the doc and the guard`);
  }
});

// ---- the recognizer -------------------------------------------------------------

test('gitmoji: both prescribed shapes are accepted, for every emoji in the set', () => {
  for (const [emoji] of GITMOJIS) {
    assert.ok(hasGitmoji(`${emoji} feat(api): add paging`), `emoji-first: ${emoji}`);
    assert.ok(hasGitmoji(`feat(api): ${emoji} add paging`), `after the header: ${emoji}`);
  }
});

test('gitmoji: shortcodes and bare code points (no U+FE0F) are accepted too', () => {
  assert.ok(hasGitmoji(':sparkles: feat: add x'), 'shortcode form');
  assert.ok(hasGitmoji('feat: :bug: fix x'), 'shortcode after the header');
  assert.ok(hasGitmoji('⚡ perf: faster'), 'bare ⚡ without the variation selector');
  assert.ok(hasGitmoji('⚡️ perf: faster'), '⚡️ with the variation selector');
});

test('gitmoji: a bare conventional message is rejected — that is the whole point', () => {
  for (const m of [
    'feat(api): add paging', 'fix: reject expired tokens', 'chore(release): 1.0.25',
    'wip', 'Merge branch main', '', '   ',
  ]) assert.ok(!hasGitmoji(m), `no gitmoji: "${m}"`);
});

test('gitmoji: an emoji buried mid-subject is not an intention marker', () => {
  assert.ok(!hasGitmoji('feat(ui): add the ✨ sparkle toggle'));
  assert.ok(!hasGitmoji('docs: explain 🐛 triage'));
});

test('gitmoji: a non-gitmoji emoji does not satisfy the rule', () => {
  assert.ok(!EMOJI_SET.has('🍕'), 'fixture emoji is genuinely outside the set');
  assert.ok(!hasGitmoji('🍕 feat: add pizza'));
});

test('gitmoji: git\'s own functional prefixes are exempt (autosquash consumes them)', () => {
  for (const m of ['fixup! ✨ feat: add paging', 'squash! feat: add paging', 'amend! whatever']) {
    assert.ok(hasGitmoji(m), `exempt: ${m}`);
  }
});

test('gitmoji: only the subject line is judged, not the body', () => {
  assert.ok(hasGitmoji('✨ feat: add paging\n\nwhy this matters'), 'gitmoji in the subject → pass');
  assert.ok(!hasGitmoji('feat: add paging\n\n✨ mentioned in the body'), 'body emoji does not count');
});

// ---- reading the message out of the command -------------------------------------

test('gitmoji: reads the message from every commit form an agent actually types', () => {
  assert.deepEqual(commitMessages('git commit -m "feat: x"'), ['feat: x']);
  assert.deepEqual(commitMessages("git commit -m 'feat: x'"), ['feat: x']);
  assert.deepEqual(commitMessages('git commit -am "feat: x"'), ['feat: x']);
  assert.deepEqual(commitMessages('git commit --message="feat: x"'), ['feat: x']);
  assert.deepEqual(commitMessages('git -C /repo commit -m "feat: x"'), ['feat: x']);
  assert.deepEqual(commitMessages('git add -A && git commit -m "feat: x"'), ['feat: x']);
  assert.deepEqual(commitMessages('cd /repo && git commit -m "feat: x"'), ['feat: x']);
  // The heredoc form: the body is the message and may itself contain && or ;
  assert.deepEqual(
    commitMessages('git commit -m "$(cat <<\'EOF\'\nfeat: x\n\nwhy && how; really\nEOF\n)"'),
    ['feat: x'],
  );
  // Two commits in one command: both are read.
  assert.deepEqual(
    commitMessages('git commit -m "✨ feat: a" && git commit -m "fix: b"'),
    ['✨ feat: a', 'fix: b'],
  );
});

test('gitmoji: nothing readable → nothing enforced (fail open by design)', () => {
  for (const c of [
    'git commit',                          // editor commit
    'git commit --amend --no-edit',        // keeps the existing message
    'git commit -F .git/COMMITMSG',        // message from a file
    'git commit --file=msg.txt',
    'git commit -C HEAD',                  // reuses another commit's message
    'git commit -m "$MSG"',                // a variable, not a literal
    'git status',                          // not a commit at all
    'git log --oneline -m',
    'echo "git commit -m broken"',         // a mention, not an invocation
    'grep -rn "git commit -m" docs/',      // searching for the string
    'printf \'%s\' "git commit -m x" > note.txt',
  ]) assert.deepEqual(commitMessages(c), [], `unreadable/irrelevant: ${c}`);
});

// ---- the gate, end to end -------------------------------------------------------

test('gitmoji-guard: DENIES a commit with no gitmoji', () => {
  const root = freshRoot();
  for (const c of [
    'git commit -m "feat(api): add paging"',
    'git add -A && git commit -m "fix: reject expired tokens"',
    'git commit -am "chore: bump deps"',
    'git commit -m "$(cat <<\'EOF\'\ndocs: rewrite the readme\nEOF\n)"',
  ]) assert.ok(runGuard(root, c), `should deny: ${c}`);
});

test('gitmoji-guard: ALLOWS a commit that carries one', () => {
  const root = freshRoot();
  for (const c of [
    'git commit -m "✨ feat(api): add paging"',
    'git commit -m "feat(api): ✨ add paging"',
    'git commit -m ":bug: fix: reject expired tokens"',
    'git add -A && git commit -m "🔧 chore: bump deps"',
    'git commit -m "$(cat <<\'EOF\'\n📝 docs: rewrite the readme\n\nwhy\nEOF\n)"',
    'git commit --amend --no-edit',
    'git status && git log --oneline',
  ]) assert.equal(runGuard(root, c), null, `should allow: ${c}`);
});

test('gitmoji-guard: one bad message in a chain is enough to deny', () => {
  const root = freshRoot();
  assert.ok(runGuard(root, 'git commit -m "✨ feat: a" && git commit -m "fix: b"'));
});

test('gitmoji-guard: only Bash tool calls are judged', () => {
  const root = freshRoot();
  const r = spawnSync('node', [GUARD, root], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { command: 'git commit -m "feat: x"' } }),
    encoding: 'utf8',
  });
  assert.equal(r.stdout.trim(), '', 'a non-Bash tool call is never denied');
});

test('gitmoji-guard: malformed hook input never blocks the user', () => {
  const root = freshRoot();
  for (const input of ['', 'not json', '{}', '{"tool_name":"Bash"}']) {
    const r = spawnSync('node', [GUARD, root], { input, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '', `allowed on malformed input: ${JSON.stringify(input)}`);
  }
});

// ---- P6: the refusal carries its own way out ------------------------------------

test('gitmoji-guard: every deny names the recovery, the fix and the kill switch', () => {
  const root = freshRoot();
  const reason = denyReason(root, 'git commit -m "feat(api): add paging"');
  assert.ok(reason.includes('Recover:'), 'the deny carries a Recover: line');
  assert.ok(reason.includes('✨ feat(api): add paging'), 'it hands back the corrected message');
  assert.ok(reason.includes('.rsc/.no-gitmoji'), 'it names the opt-out');
  assert.ok(reason.includes('gitmoji.dev'), 'it names where the convention comes from');
});

test('gitmoji-guard: the suggested rewrite matches the commit type', () => {
  for (const [type, emoji] of [['feat', '✨'], ['fix', '🐛'], ['docs', '📝'], ['perf', '⚡️'], ['ci', '👷']]) {
    assert.ok(
      denyMessage(`${type}(scope): do the thing`).includes(`${emoji} ${type}(scope): do the thing`),
      `${type} → ${emoji}`,
    );
  }
  // An unrecognized type still gets a usable rewrite rather than an empty suggestion.
  assert.ok(denyMessage('nonsense subject').includes('🔧 nonsense subject'));
});

// ---- P7: the kill switch really kills -------------------------------------------

test('gitmoji-guard: .rsc/.no-gitmoji disarms it completely', () => {
  const root = freshRoot();
  assert.ok(runGuard(root, 'git commit -m "feat: x"'), 'armed before the opt-out');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.no-gitmoji'), '');
  assert.equal(runGuard(root, 'git commit -m "feat: x"'), null, 'silent after the opt-out');
});
