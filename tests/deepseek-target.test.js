// DeepSeek Harness as an rsc target: skills where dsh discovers them (.dsh/skills/<id>/SKILL.md), the
// AGENTS.md block it reads as instructions, and the lifecycle hooks (memory, knowledge, update) in a
// Codex-format .dsh/hooks.json that rsc's machine-level bridge runs for whichever project the session
// is in. dsh itself is not needed: the bridge is exercised with the exact payload its Codex bridge sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall } from '../scripts/install-apply.js';
import { detectTarget, TARGET_IDS } from '../targets/index.js';
import { patchWithBlock, inspectDeepseekBridge } from '../targets/deepseek-bridge.js';
import { runBridge, projectOf } from '../targets/deepseek-bridge.mjs';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-dsh-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  return cwd;
}
function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'rsc-dsh-home-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  return Promise.resolve(fn(home)).finally(() => {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
  });
}

test('dsh01 · deepseek is a target, and a .dsh folder is read as DeepSeek Harness', () => {
  assert.ok(TARGET_IDS.includes('deepseek'));
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-dsh-detect-'));
  mkdirSync(join(cwd, '.dsh'));
  assert.equal(detectTarget(cwd), 'deepseek');
});

test('dsh02 · install puts skills where dsh discovers them, the AGENTS.md block, and the Codex-format hooks', () => withHome(async (home) => {
  const cwd = project();
  await applyInstall({ skillIds: ['suggest'], target: 'deepseek', cwd });
  assert.ok(existsSync(join(cwd, '.dsh', 'skills', 'suggest', 'SKILL.md')), 'dsh reads <root>/.dsh/skills/<name>/SKILL.md');
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc/);
  const { hooks } = json(join(cwd, '.dsh', 'hooks.json'));
  for (const event of Object.keys(hooks)) {
    assert.ok(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'].includes(event), `dsh's Codex bridge has no ${event}`);
  }
  const body = JSON.stringify(hooks);
  for (const needle of ['.rsc/session-memory-adapter.mjs', '.rsc/knowledge-sync.mjs', '.rsc/auto-update.mjs']) assert.ok(body.includes(needle), needle);
  assert.ok(!body.includes('$(git'), 'the bridge runs commands from the project root: no shell substitution needed');
  const bridge = inspectDeepseekBridge();
  assert.equal(bridge.status, 'ready');
  assert.ok(bridge.hooks.startsWith(home));
  assert.match(readFileSync(join(home, 'cordis.patch.yml'), 'utf8'), /dsh-hooks-codex[\s\S]*configPath: '.*rsc[/\\]hooks\.json'/);
  const excluded = readFileSync(join(cwd, '.git', 'info', 'exclude'), 'utf8');
  assert.match(excluded, /\/\.dsh\/hooks\.json/, 'the hooks file stays out of commits');
}));

test('dsh03 · the home patch keeps what the person wrote and is rewritten in place, never duplicated', () => {
  const fresh = patchWithBlock('# Your patch layer\n[]\n', '/h/rsc/hooks.json');
  assert.match(fresh, /^# Your patch layer\n# rsc-deepseek-bridge:begin/);
  assert.ok(!fresh.includes('[]'));
  const mine = '- disable: telemetry\n';
  const added = patchWithBlock(mine, '/h/rsc/hooks.json');
  assert.ok(added.startsWith(mine));
  const moved = patchWithBlock(added, '/other/rsc/hooks.json');
  assert.equal(moved.match(/rsc-deepseek-bridge:begin/g).length, 1);
  assert.ok(moved.includes("'/other/rsc/hooks.json'") && !moved.includes("'/h/rsc/hooks.json'"));
  assert.equal(patchWithBlock('[{ disable: x }]\n', '/h'), null, 'a flow list is not guessed at');
  assert.match(patchWithBlock("x: '1'", '/h') ?? 'null', /null/);
});

test('dsh04 · the bridge runs the session project\'s hooks with dsh\'s payload and folds the output for dsh', () => {
  const cwd = project();
  mkdirSync(join(cwd, '.dsh'), { recursive: true });
  mkdirSync(join(cwd, 'src', 'deep'), { recursive: true });
  // Each hook prints a fixed text from a file: no shell quoting in the way of what is under test.
  const say = (name, text) => { writeFileSync(join(cwd, '.dsh', `${name}.txt`), text); return `node -e "process.stdout.write(require('fs').readFileSync('.dsh/${name}.txt','utf8'))"`; };
  writeFileSync(join(cwd, '.dsh', 'hooks.json'), JSON.stringify({ hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: say('start', JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'resume ctx' } })) }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: say('prompt', JSON.stringify({ systemMessage: 'docs updated' })) }] }],
    PostToolUse: [{ matcher: 'bash', hooks: [{ type: 'command', command: say('post', 'plain text') }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'node -e "process.exit(2)"' }] }],
  } }));
  const payload = (event, extra = {}) => JSON.stringify({ session_id: 's1', cwd: join(cwd, 'src', 'deep'), hook_event_name: event, ...extra });
  assert.equal(projectOf(join(cwd, 'src', 'deep')), cwd, 'a session started in a subfolder finds its project');
  assert.equal(runBridge('SessionStart', payload('SessionStart')).hookSpecificOutput.additionalContext, 'resume ctx');
  const said = runBridge('UserPromptSubmit', payload('UserPromptSubmit')).hookSpecificOutput;
  assert.equal(said.hookEventName, 'UserPromptSubmit');
  assert.match(said.additionalContext, /Tell the person[\s\S]*docs updated/, 'dsh drops systemMessage, so the person\'s line rides as context');
  assert.equal(runBridge('PostToolUse', payload('PostToolUse', { tool_name: 'bash' })).hookSpecificOutput.additionalContext, 'plain text');
  assert.deepEqual(runBridge('PostToolUse', payload('PostToolUse', { tool_name: 'str_replace_editor' })), {}, 'the matcher holds');
  assert.equal(runBridge('Stop', payload('Stop')).decision, 'block', 'exit 2 is a block, as in Codex');
});

test('dsh05 · a session outside any rsc project runs nothing and prints nothing', () => {
  const elsewhere = mkdtempSync(join(tmpdir(), 'rsc-dsh-none-'));
  assert.deepEqual(runBridge('SessionStart', JSON.stringify({ cwd: elsewhere })), {});
  assert.deepEqual(runBridge('SessionStart', 'not json'), {});
});

test('dsh06 · end to end: dsh\'s SessionStart reaches the installed memory hook through the bridge', () => withHome(async () => {
  const cwd = project();
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  await applyInstall({ skillIds: ['suggest'], target: 'deepseek', cwd });
  const env = { ...process.env, RSC_NO_UPDATE_CHECK: '1' };
  runBridge('SessionStart', JSON.stringify({ session_id: 'dsh-e2e', cwd, hook_event_name: 'SessionStart', source: 'startup' }), env);
  assert.ok(existsSync(join(cwd, '.rsc', 'memory', 'anchors', 'deepseek--dsh-e2e.json')), 'the session was captured in the project journal, under dsh\'s session id');
}));
