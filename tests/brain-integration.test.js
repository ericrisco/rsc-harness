import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {capture} from '../targets/session-memory-core.mjs';
import {handleLifecycle} from '../targets/session-memory-adapter.mjs';
const cli=fileURLToPath(new URL('../scripts/rsc.js',import.meta.url));
function project(t){const p=mkdtempSync(join(tmpdir(),'rsc-brain-harness-'));t.after(()=>rmSync(p,{recursive:true,force:true}));writeFileSync(join(p,'.rsc.json'),JSON.stringify({brain:{mode:'remote',url:'http://127.0.0.1:4317',spaceId:'space',projectId:'project'}}));return p;}
test('Brain projects cannot recreate local memory even via direct core calls',t=>{
  const cwd=project(t);
  assert.throws(()=>capture({cwd,sessionId:'example',target:'codex'}), /Brain.*rsc-brain/);
  assert.equal(existsSync(join(cwd,'.rsc','memory')),false);
});
test('old lifecycle adapter stands down to dedicated Brain hooks without local journal',t=>{
  const cwd=project(t);
  const result=handleLifecycle({cwd,target:'claude',event:'start'});
  assert.equal(result.brain,true);
  assert.equal(result.capture,null);
  assert.equal(existsSync(join(cwd,'.rsc','memory')),false);
});
test('rsc memory refuses offline toggles on linked projects with recovery',t=>{
  const cwd=project(t);
  let result;try{execFileSync(process.execPath,[cli,'memory','off'],{cwd,encoding:'utf8',stdio:'pipe'});}catch(e){result=e;}
  assert.ok(result,'must reject local-mode toggle');
  assert.match(result.stderr,/Brain/);
  assert.match(result.stderr,/rsc-brain/);
});
test('rsc brain forwards literal arguments to separately installed Brain CLI',t=>{
  const cwd=project(t);const bin=join(cwd,'rsc-brain');
  writeFileSync(bin,'#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)))\n',{mode:0o700});
  const result=execFileSync(process.execPath,[cli,'brain','catalog','--query','a; echo unsafe'],{cwd,env:{...process.env,PATH:`${cwd}:${process.env.PATH}`},encoding:'utf8'});
  assert.deepEqual(JSON.parse(result),['catalog','--query','a; echo unsafe']);
});
