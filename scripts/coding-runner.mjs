#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCodingServer } from '../coding-runner/server.mjs';
import { configuredOrigin } from '../coding-runner/security.mjs';
import { runnerSourceHash } from '../coding-runner/identity.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: npm run studio:coding-runner -- [--origin https://your-studio-origin]\nBuilds the pinned local Docker companion, binds127.0.0.1:4317, and prints only its pairing URL. No source code or pairing credential is printed.');
  process.exit(0);
}
if (args.length && !(args.length === 2 && args[0] === '--origin')) {
  console.error('Use --help. Only an exact Studio --origin is configurable; no model/host command or image argument is accepted.'); process.exit(1);
}
let origin;
try { origin = configuredOrigin(args[1] || 'https://yapweijun1996.github.io'); }
catch { console.error('Use an exact HTTPS Studio origin, or an explicitly supported localhost development origin.'); process.exit(1); }
const directory = fileURLToPath(new URL('../coding-runner/',import.meta.url));
const image = `printform-coding-runner:${runnerSourceHash(directory).slice(0,24)}`;
const built = await new Promise(resolve=> {
  const child = spawn('docker',['build','--tag',image,directory],{stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  child.once('error',()=>resolve(false)); child.once('exit',code=>resolve(code === 0));
});
if (!built) { console.error('Docker build unavailable/failed. No host-shell or alternate-image fallback exists.'); process.exit(1); }
const companion = createCodingServer({origin,image});
try {
  const info = await companion.listen();
  console.log(`PrintForm isolated source companion ready: ${info.url}/pair`);
  console.log(`Allowed Studio origin: ${origin}\nProfile: ${info.profile}\nRunner source: ${info.runnerSourceHash}\nImage: ${info.imageDigest}`);
  console.log('Open the local pairing page yourself, enter its one-use code in AI settings, then explicitly authorize fictional source for one request. Ctrl+C closes owned workspaces.');
} catch (error) {
  await companion.close().catch(()=>{});
  console.error(`Local companion could not start: ${error.code || 'ENVIRONMENT_UNSUPPORTED'}`); process.exit(1);
}
let stopping = false;
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=> {
  if (stopping) return; stopping = true;
  try { await companion.close(); process.exit(0); }
  catch { console.error('Owned workspace cleanup was not acknowledged.'); process.exit(1); }
});
