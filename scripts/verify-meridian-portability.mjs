// Isolated source-copy build proof; never reads or changes sibling operational state.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.argv[2]||path.resolve(root,'../artifacts/portability'));
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'meridian-reproduction-'));
const isolated=path.join(temporary,'repo');
const html='gallery/designs/meridian-enterprise-purchase-order.html';
const runtime='dist/printform.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={started:new Date().toISOString(),dependencyMode:'existing node_modules linked; source copied; no prebuilt dist',stages:[]};
await fs.mkdir(output,{recursive:true});
try {
  await fs.mkdir(isolated);
  for(const name of ['package.json','package-lock.json','vite.config.js','LICENSE','src',
    'scripts/build-meridian.mjs','gallery/designs/assets/meridian',
    'studio-v2/core/barcode.js','studio-v2/vendor/jsbarcode-3.12.1.js']) {
    const destination=path.join(isolated,name);
    await fs.mkdir(path.dirname(destination),{recursive:true});
    await fs.cp(path.join(root,name),destination,{recursive:true});
  }
  await fs.symlink(path.join(root,'node_modules'),path.join(isolated,'node_modules'),process.platform==='win32'?'junction':'dir');
  report.initialParentEntries=await fs.readdir(temporary);
  assert.deepEqual(report.initialParentEntries,['repo'],'isolated checkout has no sibling files');
  const expectedHtml=sha(await fs.readFile(path.join(root,html)));
  const expectedRuntime=sha(await fs.readFile(path.join(root,runtime)));
  for(const stage of ['no-dist','poisoned-future-dist']) {
    if(stage==='poisoned-future-dist') {
      await fs.writeFile(path.join(isolated,runtime),'throw new Error("stale runtime must never be embedded");');
      const future=new Date(Date.now()+86400000);
      await fs.utimes(path.join(isolated,runtime),future,future);
    }
    const log=execFileSync(process.execPath,['scripts/build-meridian.mjs'],{cwd:isolated,encoding:'utf8',timeout:120000});
    await fs.writeFile(path.join(output,`${stage}.log`),log);
    const htmlSha256=sha(await fs.readFile(path.join(isolated,html)));
    const runtimeSha256=sha(await fs.readFile(path.join(isolated,runtime)));
    assert.equal(htmlSha256,expectedHtml,'isolated HTML reproduces delivered bytes');
    assert.equal(runtimeSha256,expectedRuntime,'runtime is rebuilt from current source, regardless of dist timestamp');
    report.stages.push({stage,htmlSha256,runtimeSha256,status:'passed'});
  }
  report.status='passed';
} catch(error) {
  report.status='failed';report.failure={message:error.message,stack:error.stack};process.exitCode=1;
} finally {
  await fs.rm(temporary,{recursive:true,force:true});
  report.finished=new Date().toISOString();report.temporaryRemoved=true;
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
