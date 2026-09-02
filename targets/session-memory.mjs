#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { capture, learn, memoryStatus, metricsSummary, resume } from './session-memory-core.mjs';

function input() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const operation = process.argv[2] || 'status';
const payload = { ...input(), cwd: process.env.RSC_PROJECT_CWD || process.cwd() };
let result;
if (operation === 'capture') result = capture(payload);
else if (operation === 'resume') result = resume(payload);
else if (operation === 'learn') result = learn(payload);
else if (operation === 'metrics') result = metricsSummary(payload);
else if (operation === 'status') result = memoryStatus(payload);
else {
  process.stderr.write(`Unknown memory operation: ${operation}\n`);
  process.exitCode = 2;
}

if (result !== undefined) process.stdout.write(`${JSON.stringify(result)}\n`);
