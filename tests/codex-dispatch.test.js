import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { promisify } from 'node:util';
import TOML from '@iarna/toml';
import { tmpdir } from './helpers/scratch.js';
import { agentByName, agentPath, allAgentNames, writeAgents } from '../targets/agents.js';
import { writeManifest } from '../scripts/lib/manifest-file.js';

const run = promisify(execFile);
const read = (path) => readFileSync(path, 'utf8');
const review = read(new URL('../skills/review/SKILL.md', import.meta.url));

test('Codex profiles inherit the project model and omit generic tool names', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codex-profiles-'));
  writeManifest(cwd, { targets: ['codex'], skills: [], agentModels: { codex: 'inherit' } });
  const names = allAgentNames();
  const profiles = writeAgents('codex', cwd, 'balanced', names);
  assert.equal(profiles.length, names.length);
  for (const path of profiles) {
    const profile = TOML.parse(read(path));
    assert.equal(profile.tools, undefined, path);
    assert.equal(profile.model, undefined, path);
    assert.equal(profile.developer_instructions.trim(), agentByName(profile.name).body.trim());
  }
});

test('a pre-4.1.11 profile without its digest upgrades, and a user edit survives', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'codex-upgrade-'));
  const dir = join(cwd, '.codex', 'agents');
  mkdirSync(dir, { recursive: true });
  const agent = agentByName('go-reviewer');
  const path = agentPath('codex', cwd, agent.name);
  const old = `name = "${agent.name}"\ndescription = "${agent.desc}"\nmodel = "gpt-5.1-mini"\ntools = ["read", "search"]\ndeveloper_instructions = '''\n${agent.body}\n'''\n`;
  writeFileSync(path, old + '# personal edit\n');
  assert.deepEqual(writeAgents('codex', cwd, 'balanced', [agent.name]), []);
  assert.equal(read(path), old + '# personal edit\n');
  writeFileSync(path, old);
  assert.deepEqual(writeAgents('codex', cwd, 'balanced', [agent.name]), [path]);
  assert.equal(TOML.parse(read(path)).tools, undefined);
});

// Copyable dispatch pairs in the review skill double as input to the native router test.
const table = review.split('`agent_type` | `task_name`')[1]?.split('\n\n')[0] || '';
const pairs = [...table.matchAll(/^`([\w-]+)`\s*\|\s*`(\w+)`$/gm)].map(([, role, task]) => ({ role, task }));
test('the Codex panel has a distinct valid task name for each installed reviewer', () => {
  assert.deepEqual(pairs.map(p => p.role), ['refuter-correctness', 'refuter-security', 'refuter-tests', 'finding-verifier']);
  assert.equal(new Set(pairs.map(p => p.task)).size, pairs.length);
  for (const { task } of pairs) assert.match(task, /^[a-z0-9_]+$/);
});

// Set RSC_TEST_CODEX to the 0.171.0-alpha.13.2 executable. Only the model replies
// are scripted. Codex discovers the files, routes the calls and builds each child request.
test('Codex loads and dispatches the documented review panel', { skip: !process.env.RSC_TEST_CODEX }, async t => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'codex-router-')));
  const home = join(cwd, 'codex-home');
  mkdirSync(home);
  writeManifest(cwd, { targets: ['codex'], skills: [], agentModels: { codex: 'inherit' } });
  writeAgents('codex', cwd, 'balanced', allAgentNames());
  assert.equal(pairs.length, 4);
  for (const { role, task } of pairs) await t.test(role, async () => {
    let sawChild;
    const childRequest = new Promise(resolve => { sawChild = resolve; });
    let receivedInstructions;
    const server = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const { input } = JSON.parse(raw);
      const result = input.find(item => item.type === 'function_call_output');
      let item = { type: 'message', id: 'msg_ok', role: 'assistant', content: [{ type: 'output_text', text: 'OK' }] };
      if (input.some(message => message.type === 'agent_message')) {
        receivedInstructions = input.filter(m => m.role === 'developer').flatMap(m => m.content.map(c => c.text?.trim()));
        sawChild();
      } else if (!result) {
        item = { type: 'function_call', id: 'fc_1', call_id: 'call_1', namespace: 'collaboration', name: 'spawn_agent',
          arguments: JSON.stringify({ agent_type: role, task_name: task, fork_turns: 'none', message: 'Return OK.' }) };
      } else if (result.output.includes('"/root/' + task + '"')) {
        await childRequest;
      }
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const event = (payload) => response.write('data: ' + JSON.stringify(payload) + '\n\n');
      event({ type: 'response.created', response: { id: 'resp_1' } });
      event({ type: 'response.output_item.done', output_index: 0, item });
      event({ type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [item] } });
      response.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      writeFileSync(join(home, 'config.toml'), TOML.stringify({
        model_provider: 'fixture', model: 'gpt-5.4', projects: { [cwd]: { trust_level: 'trusted' } },
        model_providers: { fixture: { name: 'fixture', wire_api: 'responses', base_url: `http://127.0.0.1:${server.address().port}/v1` } },
      }));
      const cli = run(process.env.RSC_TEST_CODEX, ['exec', '--enable', 'multi_agent_v2', '--json', '--skip-git-repo-check', 'Dispatch the test profile.'],
        { cwd, env: { PATH: process.env.PATH, HOME: cwd, CODEX_HOME: home }, timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
      cli.child.stdin.end();
      const { stdout, stderr } = await cli;
      assert.doesNotMatch(stdout + stderr, /unknown variant|malformed agent role|failed to load.*agent/i);
      assert.ok(receivedInstructions?.includes(agentByName(role).body.trim()), `missing ${role} instructions in the child request`);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
