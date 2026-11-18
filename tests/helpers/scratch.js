// Node runs each test file in its own process. Give its fixtures and subprocesses
// a private temp directory and remove only that directory after all test hooks.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'rsc-t-'));
process.once('exit', () => {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
});
for (const name of ['TMPDIR', 'TMP', 'TEMP']) process.env[name] = scratch;

export { tmpdir };
