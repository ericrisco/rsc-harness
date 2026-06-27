/**
 * Tests for skills/roast-me/tools/extract_prompts.py
 *
 * Spawns the Python extractor via child_process and asserts on its output.
 * Skips gracefully if python3 is not available in this environment.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EXTRACTOR = join(ROOT, 'skills', 'roast-me', 'tools', 'extract_prompts.py');

// ---------------------------------------------------------------------------
// Check python3 availability — skip all tests gracefully if absent.
// ---------------------------------------------------------------------------
const pythonCheck = spawnSync('python3', ['--version'], { encoding: 'utf8' });
const PYTHON_AVAILABLE = pythonCheck.status === 0;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal Claude Code JSONL session file.
 *
 * Produces a sequence of lines that look like a real Claude session:
 *   user prompt → assistant response → tool_result (with error) → assistant recovery → user prompt
 *
 * The first user prompt is followed by a tool error that the agent recovers
 * from on its own (no correction from the user). This tests that
 * `effective_error_rate` excludes it (the error WAS auto-recovered).
 */
function buildClaudeSessionJsonl() {
  const events = [
    // 1. User opens with a prompt.
    {
      type: 'user',
      timestamp: '2026-06-01T10:00:00Z',
      message: {
        isMeta: false,
        content: [{ type: 'text', text: 'Fix the login flow in src/auth.ts' }],
      },
    },
    // 2. Assistant responds with a tool_use call.
    {
      type: 'assistant',
      timestamp: '2026-06-01T10:00:05Z',
      message: {
        content: [
          { type: 'tool_use', id: 'tu_001', name: 'Read', input: { file_path: '/tmp/nonexistent.ts' } },
        ],
      },
    },
    // 3. Tool result — an error (file not found).
    {
      type: 'user',
      timestamp: '2026-06-01T10:00:06Z',
      message: {
        isMeta: false,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu_001',
            is_error: true,
            content: [{ type: 'text', text: 'File not found: /tmp/nonexistent.ts' }],
          },
        ],
      },
    },
    // 4. Assistant recovers — makes a successful call.
    {
      type: 'assistant',
      timestamp: '2026-06-01T10:00:10Z',
      message: {
        content: [
          { type: 'tool_use', id: 'tu_002', name: 'Read', input: { file_path: 'src/auth.ts' } },
        ],
      },
    },
    // 5. Successful tool result (recovery confirmed).
    {
      type: 'user',
      timestamp: '2026-06-01T10:00:11Z',
      message: {
        isMeta: false,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu_002',
            is_error: false,
            content: [{ type: 'text', text: 'export function login() { ... }' }],
          },
        ],
      },
    },
    // 6. Second real user prompt — no error, no correction.
    {
      type: 'user',
      timestamp: '2026-06-01T10:01:00Z',
      message: {
        isMeta: false,
        content: [{ type: 'text', text: 'Now add a rate-limit check to the login handler.' }],
      },
    },
  ];

  return events.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

/**
 * Write a fake Claude session to a temp directory structure that mirrors
 * ~/.claude/projects/<encoded-path>/<session>.jsonl
 *
 * Returns the path to the fake home directory.
 */
function createFakeClaudeHome() {
  const fakeHome = mkdtempSync(join(tmpdir(), 'roast-me-home-'));
  const projectsDir = join(fakeHome, '.claude', 'projects', '-fake-project');
  mkdirSync(projectsDir, { recursive: true });
  const sessionFile = join(projectsDir, 'session-001.jsonl');
  writeFileSync(sessionFile, buildClaudeSessionJsonl(), 'utf8');
  return fakeHome;
}

// ---------------------------------------------------------------------------
// Helper: run extractor with a custom HOME so it reads our fixture.
// ---------------------------------------------------------------------------
function runExtractor(fakeHome, extraArgs = []) {
  return spawnSync(
    'python3',
    [EXTRACTOR, '--runtime', 'claude', '--days', '365', ...extraArgs],
    {
      encoding: 'utf8',
      env: { ...process.env, HOME: fakeHome },
    }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('extract_prompts.py: auto-recovered error is excluded from effective_error_rate', (t) => {
  if (!PYTHON_AVAILABLE) {
    t.skip('python3 not available in this environment');
    return;
  }

  const fakeHome = createFakeClaudeHome();
  const result = runExtractor(fakeHome);

  assert.equal(result.status, 0, `extractor crashed:\n${result.stderr}`);

  // stdout must contain the output path line.
  const outputLine = result.stdout.split('\n').find((l) => l.startsWith('Output: '));
  assert.ok(outputLine, `no 'Output:' line in stdout:\n${result.stdout}`);

  const outputPath = outputLine.replace('Output: ', '').trim();
  assert.ok(existsSync(outputPath), `output file not created at ${outputPath}`);

  const data = JSON.parse(readFileSync(outputPath, 'utf8'));
  const meta = data.metadata;
  const prompts = data.prompts;

  // There are 2 real user prompts in our fixture.
  assert.ok(prompts.length >= 1, `expected at least 1 prompt record, got ${prompts.length}`);

  // The first prompt is followed by an error that was auto-recovered.
  const firstPrompt = prompts.find((p) => p.prompt_text.includes('Fix the login flow'));
  assert.ok(firstPrompt, 'first prompt record not found');

  assert.equal(
    firstPrompt.followed_by_error,
    true,
    'first prompt should be flagged as followed_by_error'
  );
  assert.equal(
    firstPrompt.error_was_recovered,
    true,
    'first prompt error should be marked as auto-recovered'
  );

  // effective_error_rate counts only unrecovered errors.
  // Our fixture has 1 error total, recovered=1, so unrecovered=0.
  assert.equal(
    meta.effective_error_rate,
    0,
    `effective_error_rate should be 0 (auto-recovered error excluded), got ${meta.effective_error_rate}`
  );

  // error_rate includes the raw error.
  assert.ok(
    meta.error_rate > 0,
    `raw error_rate should be > 0, got ${meta.error_rate}`
  );
});

test('extract_prompts.py: unknown --runtime exits 0 with empty result and a message', (t) => {
  if (!PYTHON_AVAILABLE) {
    t.skip('python3 not available in this environment');
    return;
  }

  const fakeHome = mkdtempSync(join(tmpdir(), 'roast-me-home-empty-'));
  const result = spawnSync(
    'python3',
    [EXTRACTOR, '--runtime', 'xyz_unknown_runtime_12345', '--days', '7'],
    {
      encoding: 'utf8',
      env: { ...process.env, HOME: fakeHome },
    }
  );

  // Must exit 0 — unknown runtime is not a crash.
  assert.equal(result.status, 0, `expected exit 0 for unknown runtime, got ${result.status}\n${result.stderr}`);

  // Must print a message about the unknown runtime (to stderr) and not invent records.
  const combinedOutput = result.stdout + result.stderr;
  assert.ok(
    combinedOutput.toLowerCase().includes('unknown runtime') ||
    combinedOutput.toLowerCase().includes('unknown') ||
    combinedOutput.toLowerCase().includes('known runtimes'),
    `expected a message about unknown runtime, got:\n${combinedOutput}`
  );

  // The output file path must appear in stdout.
  const outputLine = result.stdout.split('\n').find((l) => l.startsWith('Output: '));
  assert.ok(outputLine, `no 'Output:' line in stdout:\n${result.stdout}`);

  const outputPath = outputLine.replace('Output: ', '').trim();
  assert.ok(existsSync(outputPath), `output file not created at ${outputPath}`);

  const data = JSON.parse(readFileSync(outputPath, 'utf8'));

  // Empty result — zero records.
  assert.equal(data.prompts.length, 0, `expected 0 prompts for unknown runtime, got ${data.prompts.length}`);
  assert.equal(data.metadata.total_prompts, 0);
});

test('extract_prompts.py: accepts bare number for days (positional argument)', (t) => {
  if (!PYTHON_AVAILABLE) {
    t.skip('python3 not available in this environment');
    return;
  }

  const fakeHome = mkdtempSync(join(tmpdir(), 'roast-me-home-pos-'));
  // Run with a bare positional number — no --days flag.
  const result = spawnSync(
    'python3',
    [EXTRACTOR, '3', '--runtime', 'claude'],
    {
      encoding: 'utf8',
      env: { ...process.env, HOME: fakeHome },
    }
  );

  // Must exit 0 (no data is fine, but must not crash on the argument).
  assert.equal(result.status, 0, `extractor crashed on positional days arg:\n${result.stderr}`);

  const outputLine = result.stdout.split('\n').find((l) => l.startsWith('Output: '));
  assert.ok(outputLine, `no 'Output:' line in stdout:\n${result.stdout}`);

  const outputPath = outputLine.replace('Output: ', '').trim();
  assert.ok(existsSync(outputPath), `output file not created at ${outputPath}`);

  const data = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.equal(data.metadata.days, 3, `expected days=3, got ${data.metadata.days}`);
});
