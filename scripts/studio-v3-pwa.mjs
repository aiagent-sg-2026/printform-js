import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Immutable URLs keep already-open clients on one build after another tab updates.
export function finalizeStudioV3Pwa(output, revision = process.env.GITHUB_SHA || 'local') {
  if (!/^(?:[a-f0-9]{40}|local)$/.test(revision)) throw new Error('Invalid Studio v3 build revision.');
  const root = path.resolve(output,'studio-v3'), release = `releases/${revision}`;
  const target = path.resolve(root,release); fs.mkdirSync(target,{recursive:true});
  const names = ['app.js','tokens.css','styles.css','ai-panel.css','update.css'];
  for (const name of names) fs.copyFileSync(path.resolve(root,name),path.resolve(target,name));
  if (fs.existsSync(path.resolve(root,'chunks'))) fs.cpSync(path.resolve(root,'chunks'),path.resolve(target,'chunks'),{recursive:true});
  for (const name of ['printform.js','printform-document.js']) fs.copyFileSync(path.resolve(output,'dist',name),path.resolve(target,name));
  fs.copyFileSync(path.resolve(output,'studio-v2/icon.svg'),path.resolve(root,'icon.svg'));
  const index = path.resolve(root,'index.html');
  const html = fs.readFileSync(index,'utf8').replaceAll('__PRINTFORM_V3_REVISION__',revision)
    .replace('__PRINTFORM_V3_ASSETS__',`./${release}/`)
    .replace('../studio-v2/icon.svg','./icon.svg');
  fs.writeFileSync(index,html.replace(/(href|src)="(app\.js|tokens\.css|styles\.css|ai-panel\.css|update\.css)"/g,`$1="${release}/$2"`));
  const files = ['index.html','manifest.webmanifest','icon.svg'];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = path.resolve(dir,entry.name);
      if (entry.isDirectory()) walk(file); else files.push(path.relative(root,file).split(path.sep).join('/'));
    }
  };
  walk(target);
  const shell = files.map(name=>({url:`./${name}`,hash:createHash('sha256').update(fs.readFileSync(path.resolve(root,name))).digest('hex')}));
  const worker = path.resolve(root,'sw.js'), source = fs.readFileSync(worker,'utf8');
  if (!source.includes('__PRINTFORM_V3_REVISION__') || !source.includes('"__PRINTFORM_V3_SHELL__"')) throw new Error('Missing Studio v3 worker placeholders.');
  fs.writeFileSync(worker,source.replaceAll('__PRINTFORM_V3_REVISION__',revision).replace('"__PRINTFORM_V3_SHELL__"',JSON.stringify(shell)));
  console.log(`Studio v3 verified shell: ${revision.slice(0,12)} · ${shell.length} files`);
}
