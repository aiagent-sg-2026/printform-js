import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { finalizeStudioV3Pwa } from '../scripts/studio-v3-pwa.mjs';

export const OLD = 'a'.repeat(40), NEXT = 'b'.repeat(40);
export async function upgradeServer() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'printform-upgrade-'));
  for (const revision of [OLD,NEXT]) {
    const root = path.join(temp,revision); fs.mkdirSync(root,{recursive:true});
    fs.cpSync('site-dist/studio-v3',path.join(root,'studio-v3'),{recursive:true});
    fs.cpSync('site-dist/dist',path.join(root,'dist'),{recursive:true});
    fs.mkdirSync(path.join(root,'studio-v2')); fs.copyFileSync('studio-v2/icon.svg',path.join(root,'studio-v2/icon.svg'));
    fs.copyFileSync('studio-v3/index.html',path.join(root,'studio-v3/index.html'));
    fs.copyFileSync('studio-v3/sw.js',path.join(root,'studio-v3/sw.js'));
    // Different bytes in build B demonstrate that immutable URLs really switch.
    fs.appendFileSync(path.join(root,'studio-v3/app.js'),`\n;globalThis.__upgradeFixtureBuild='${revision}';\n`);
    if (revision === NEXT) fs.appendFileSync(path.join(root,'studio-v3/styles.css'),'\n:root { --upgrade-marker:build-b; }\n');
    finalizeStudioV3Pwa(root,revision);
    // Match a Pages deployment: only the currently deployed release is hosted.
    fs.readdirSync(path.join(root,'studio-v3/releases')).filter(name=>name !== revision).forEach(name=>fs.rmSync(path.join(root,'studio-v3/releases',name),{recursive:true}));
  }
  let current = OLD, fail = false;
  const types = {'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  const server = http.createServer((request,response)=> {
    const url = new URL(request.url,'http://localhost');
    let file = path.resolve(temp,current,`.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(path.join(temp,current)+path.sep)) { response.writeHead(404); response.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
    if (fail && file.includes(`/releases/${NEXT}/styles.css`)) { response.writeHead(200,{'Content-Type':'text/css'}); response.end('/* partial deployment */'); return; }
    if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/studio-v3/`,publish:({broken = false}={})=> { current = NEXT; fail = broken; },
    close:async()=> { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); fs.rmSync(temp,{recursive:true,force:true}); }};
}
