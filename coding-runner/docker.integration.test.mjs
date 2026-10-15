// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createCodingServer } from './server.mjs';
import { sha, JSON_RESPONSE_BYTES } from './policy.mjs';
import { runnerSourceHash } from './identity.mjs';
import { chromium } from '@playwright/test';
import { sourceRunnerBrowser } from '../tests/support/source-runner-browser.mjs';

// Opt-in actual Docker and local-origin browser coverage; not a published AI pilot.
const integration = describe.skipIf(process.env.PF_CODING_INTEGRATION !== '1');
const docker = promisify(execFile);
let browser;
const releaseIdentity = { release: 'synthetic-test', contractHash: 'contract', knowledgeHash: 'knowledge', packageHash: 'package' };
async function start(limits) {
  const transport = await sourceRunnerBrowser(browser);
  const companion = createCodingServer({ origin:transport.origin, port:0, image:process.env.PF_CODING_IMAGE || 'printform-coding-runner:local', limits });
  const close = async()=> { try { await companion.close(); } finally { await transport.close(); } };
  try {
    const { url, runnerSourceHash:identity } = await companion.listen(); expect(identity).toBe(runnerSourceHash());
    async function pair() {
      const credentials = await transport.pair(url); expect(credentials.runnerSourceHash).toBe(identity); return credentials.token;
    }
    const request = (token,path,body,options)=>transport.request(url,token,path,body,options);
    const token = await pair();
    async function workspace(files = []) {
      const result = await request(token,'/v1/workspaces',{files,releaseIdentity,documentId:'synthetic-document',baseRevision:3,runId:randomUUID()});
      expect(result.status).toBe(200); return result.body;
    }
    async function call(workspace,operation,args,options) {
      const admitted = await request(token,`/v1/workspaces/${workspace.id}/calls`,{operation,expectedRevision:workspace.revision,args},options);
      if (admitted.status >= 400) return admitted.body;
      const result = await request(token,`/v1/workspaces/${workspace.id}/calls/${admitted.body.callId}?wait=1`);
      if (result.body.afterRevision !== null) workspace.revision = result.body.afterRevision;
      return result.body;
    }
    return {url,pair,token,request,workspace,call,close};
  } catch (error) { await close(); throw error; }
}
async function runningContainer(workspaceId) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const { stdout } = await docker('docker', ['container', 'ls', '--quiet', '--filter', `label=io.printform.coding.workspace=${workspaceId}`, '--filter', 'name=pf-run-']);
    if (stdout.trim()) return stdout.trim().split('\n')[0];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Actual run container did not start');
}

integration('isolated Node source companion', () => {
  beforeAll(async()=> { browser = await chromium.launch({headless:true,chromiumSandbox:true}); },30000);
  afterAll(async()=> { await browser?.close(); });
  it('edits, really fails a test, repairs, builds, diffs and binds JSON artifacts', async () => {
    const api = await start();
    try {
      const build = `import { writeFileSync, mkdirSync } from 'node:fs';\nmkdirSync('build', { recursive: true });\nwriteFileSync('build/operations.json', JSON.stringify({format:'printform-operation-artifact',version:1,summary:'Fictional source test',operations:[{type:'set_heading',value:'FICTIONAL SOURCE REPORT'}]}));\n`;
      const ws = await api.workspace([{ path: 'main.mjs', content: 'export const answer = 41;\n' }, { path: 'build.mjs', content: build }]);
      expect((await api.call(ws, 'search', { pattern: 'answer', literal: true })).result.matches[0].path).toBe('main.mjs');
      const failed = await api.call(ws, 'run', { command: `node --input-type=module -e "import {answer} from './main.mjs';import assert from 'node:assert/strict';assert.equal(answer,42)"` });
      expect(failed.exitCode).not.toBe(0); expect(failed.error.code).toBe('COMMAND_FAILED'); expect(failed.stderr).toContain('AssertionError');
      const before = ws.revision;
      const rejected = await api.call(ws, 'patch', { changes: [{ path: 'main.mjs', expectedDigest: sha('export const answer = 41;\n'), content: 'export const answer = 42;\n' }, { path: 'build.mjs', expectedDigest: sha('not current'), content: '' }] });
      expect(rejected.error.code).toBe('STALE_FILE'); expect(ws.revision).toBe(before);
      expect((await api.call(ws, 'read', { path: 'main.mjs' })).result.content).toContain('41');
      await api.call(ws, 'write', { path: 'main.mjs', expectedDigest: sha('export const answer = 41;\n'), content: 'export const answer = 42;\n' });
      const passed = await api.call(ws, 'run', { command: `node --input-type=module -e "import {answer} from './main.mjs';import assert from 'node:assert/strict';assert.equal(answer,42)" && node build.mjs` });
      expect(passed.exitCode).toBe(0); expect(passed.error).toBeUndefined();
      const artifact = await api.call(ws, 'artifacts', { callId: passed.callId, path: 'build/operations.json' });
      const changes = await api.call(ws, 'diff', {}); expect(changes.result.changes.some((entry) => entry.path === 'main.mjs' && entry.after.includes('42'))).toBe(true);
      await api.call(ws, 'write', { path: 'new.txt', expectedDigest: null, content: 'changed' });
      expect((await api.call(ws, 'artifacts', { callId: passed.callId, path: 'build/operations.json' })).error.code).toBe('STALE_ARTIFACT');
    } finally { await api.close(); }
  }, 180000);

  it('rejects foreign origin/owner/stale/path/env and deduplicates admission', async () => {
    const api = await start();
    try {
      const ws = await api.workspace([{ path: 'a.txt', content: 'safe' }]);
      expect((await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, { operation: 'write', expectedRevision: 0, args: { path: '../outside', expectedDigest: null, content: 'bad' } })).body.error.code).toBe('UNSAFE_PATH');
      expect((await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, { operation: 'run', expectedRevision: 0, args: { command: 'true', env: { NODE_OPTIONS: '--inspect' } } })).status).toBe(400);
      const other = await api.pair();
      expect((await api.request(other, `/v1/workspaces/${ws.id}/close`, {})).body.error.code).toBe('WORKSPACE_NOT_FOUND');
      expect((await api.request(api.token, `/v1/workspaces/${ws.id}/close`, {}, { headers: { origin: 'https://evil.example' } })).body.error.code).toBe('ORIGIN_REJECTED');
      const intent = randomUUID(), body = { operation: 'run', expectedRevision: 0, args: { command: 'printf once >> a.txt' } };
      const [one, two] = await Promise.all([api.request(api.token, `/v1/workspaces/${ws.id}/calls`, body, { intent }), api.request(api.token, `/v1/workspaces/${ws.id}/calls`, body, { intent })]);
      expect(one.body.callId).toBe(two.body.callId);
      const done = await api.request(api.token, `/v1/workspaces/${ws.id}/calls/${one.body.callId}?wait=1`); ws.revision = done.body.afterRevision;
      expect((await api.call(ws, 'read', { path: 'a.txt' })).result.content).toBe('safeonce');
      expect((await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, { ...body, args: { command: 'true' } }, { intent })).body.error.code).toBe('INTENT_CONFLICT');
      expect((await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, body)).body.error.code).toBe('STALE_REVISION');
      const isolation = await api.call(ws, 'run', { command: `test ! -e /var/run/docker.sock && node -e "const net=require('net');net.connect(443,'1.1.1.1').on('error',()=>process.exit(0));setTimeout(()=>process.exit(3),1000)"` });
      expect(isolation.exitCode).toBe(0);
    } finally { await api.close(); }
  }, 180000);

  it('removes actual active process containers on Stop and recovers the workspace', async () => {
    const api = await start();
    try {
      const ws = await api.workspace();
      const accepted = await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, { operation: 'run', expectedRevision: 0, args: { command: `node -e "while(true){}" & node -e "while(true){}"` } });
      const container = await runningContainer(ws.id);
      const stopped = await api.request(api.token, `/v1/workspaces/${ws.id}/cancel`, {});
      expect(stopped.body.processesRemoved).toBe(true); await expect(docker('docker', ['container', 'inspect', container])).rejects.toThrow();
      const receipt = await api.request(api.token, `/v1/workspaces/${ws.id}/calls/${accepted.body.callId}?wait=1`);
      expect(receipt.body.error.code).toBe('CANCELLED'); expect(receipt.body.exitCode).not.toBe(0); ws.revision = receipt.body.afterRevision;
      expect((await api.call(ws, 'run', { command: 'printf recovered' })).stdout).toBe('recovered');
      expect((await api.call(ws, 'list', {})).result.entries).toEqual([]);
    } finally { await api.close(); }
  }, 180000);

  it('quarantines unsafe layouts without reading symlinks and enforces source quota', async () => {
    const api = await start();
    try {
      const ws = await api.workspace();
      const result = await api.call(ws, 'run', { command: 'ln -s /etc/passwd stolen' });
      expect(result.exitCode).toBe(0); expect(result.error.code).toBe('UNSAFE_TREE'); expect(result.effectUnknown).toBe(true); expect(result.afterDigest).toBeNull();
      expect((await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, { operation: 'read', expectedRevision: 0, args: { path: 'stolen' } })).body.error.code).toBe('WORKSPACE_QUARANTINED');
      await api.request(api.token, `/v1/workspaces/${ws.id}/close`, {});
      const quota = await api.workspace();
      expect((await api.call(quota, 'write', { path: 'too-big', expectedDigest: null, content: 'x'.repeat(262145) })).error).toBeDefined();
      expect((await api.call(quota, 'list', {})).result.entries).toEqual([]);
      const tooLarge = await api.call(quota, 'run', { command: `node -e "require('fs').writeFileSync('large','x'.repeat(262145))"` });
      expect(tooLarge.exitCode).toBe(0); expect(tooLarge.error.code).toBe('SOURCE_QUOTA');
    } finally { await api.close(); }
  }, 180000);

  it('ends daemonized descendants on normal shell exit and seals PID1 inspection', async () => {
    const api = await start();
    try {
      const ws = await api.workspace();
      const done = await api.call(ws, 'run', { command: '(sleep 0.3; printf late > late.txt) & kill -USR1 1; printf parent-finished' });
      expect(done.exitCode).toBe(0); expect(done.stdout).toBe('parent-finished'); expect(done.stderr).not.toContain('Debugger listening');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const next = await api.call(ws, 'run', { command: 'test ! -e late.txt && printf safe' });
      expect(next.exitCode).toBe(0); expect(next.stdout).toBe('safe');
    } finally { await api.close(); }
  }, 180000);

  it('revokes even a workspace whose create response was not yet consumed', async () => {
    const api = await start();
    try {
      const creating = api.request(api.token, '/v1/workspaces', {
        files: [{ path: 'synthetic.txt', content: 'x'.repeat(200000) }], releaseIdentity, documentId: 'unconsumed', baseRevision: 0, runId: 'pending-create'
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const revoked = await api.request(api.token, '/v1/revoke', {});
      expect(revoked.body.workspacesClosed).toBe(true);
      const result = await creating;
      if (result.body.id) {
        const filter = `label=io.printform.coding.workspace=${result.body.id}`;
        expect((await docker('docker', ['container', 'ls', '--all', '--quiet', '--filter', filter])).stdout.trim()).toBe('');
        expect((await docker('docker', ['volume', 'ls', '--quiet', '--filter', filter])).stdout.trim()).toBe('');
      } else expect(result.status).toBe(401);
    } finally { await api.close(); }
  }, 180000);

  it('revokes an owner including real active work and admits only revoke replay', async () => {
    const api = await start();
    try {
      const ws = await api.workspace();
      await api.request(api.token, `/v1/workspaces/${ws.id}/calls`, { operation: 'run', expectedRevision: 0, args: { command: `node -e "while(true){}"` } });
      const container = await runningContainer(ws.id), intent = randomUUID();
      const closed = await api.request(api.token, '/v1/revoke', {}, { intent }); expect(closed.body.workspacesClosed).toBe(true);
      await expect(docker('docker', ['container', 'inspect', container])).rejects.toThrow();
      expect((await api.request(api.token, '/v1/revoke', {}, { intent })).body).toEqual(closed.body);
      expect((await api.request(api.token, '/v1/workspaces', { files: [], releaseIdentity, documentId: 'd', baseRevision: 0, runId: 'r' })).status).toBe(401);
    } finally { await api.close(); }
  }, 180000);
  it('preserves exact UTF-8 BOM bytes across unrelated whole-tree patches and JSON artifacts',async()=> {
    const api = await start();
    try {
      const ws = await api.workspace();
      const created = await api.call(ws,'run',{command:`node -e "require('node:fs').writeFileSync('bom.txt',Buffer.from([239,187,191,120]))"`});
      expect(created.exitCode).toBe(0);
      const before = await api.call(ws,'read',{path:'bom.txt'});
      expect(before.result.content).toBe('\uFEFFx'); expect(before.result.bytes).toBe(4);
      const unrelated = await api.call(ws,'write',{path:'unrelated.txt',expectedDigest:null,content:'ok'});
      expect(unrelated.changes.map(change=>change.path)).toEqual(['unrelated.txt']);
      const inspected = await api.call(ws,'run',{command:`node -e "process.stdout.write(require('node:fs').readFileSync('bom.txt').toString('hex'))"`});
      expect(inspected.stdout).toBe('efbbbf78');
      const built = await api.call(ws,'run',{command:`node -e "require('node:fs').writeFileSync('operations.json',String.fromCharCode(65279)+JSON.stringify({format:'printform-operation-artifact',version:1,summary:'Fictional BOM artifact',operations:[{type:'set_heading',value:'FICTIONAL BOM REPORT'}]}))"`});
      const one = (await api.call(ws,'artifacts',{callId:built.callId,path:'operations.json'})).result;
      const two = (await api.call(ws,'artifacts',{callId:built.callId,path:'operations.json'})).result;
      expect(one.id).toBe(two.id); expect(one.content.startsWith('\uFEFF')).toBe(true);
      expect(one.bytes).toBe(Buffer.byteLength(one.content)); expect(one.contentDigest).toBe(sha(Buffer.from(one.content)));
    } finally { await api.close(); }
  },180000);

  it('returns escaped control output with its committed source revision inside the declared JSON budget',async()=> {
    const api = await start();
    try {
      const ws = await api.workspace();
      const result = await api.call(ws,'run',{command:`node -e "require('node:fs').writeFileSync('probe.txt','x');process.stdout.write(Buffer.alloc(50000))"`});
      expect(result.exitCode).toBe(0); expect(result.stdout).toBe('\0'.repeat(50000)); expect(result.afterRevision).toBe(1);
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(JSON_RESPONSE_BYTES);
      expect((await api.call(ws,'read',{path:'probe.txt'})).result.content).toBe('x');
    } finally { await api.close(); }
  },180000);
});
