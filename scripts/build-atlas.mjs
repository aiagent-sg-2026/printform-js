// Focused source build; optional detached output is never a Gallery asset.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'gallery/designs/assets/atlas');
const read = file => fs.readFile(path.join(dir, file), 'utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function bundle(entry, name) {
  const result = await build({configFile:false, logLevel:'warn', build:{write:false, minify:true, target:'es2022', lib:{entry:path.join(root, entry), name, formats:['iife']}}});
  const output = (Array.isArray(result) ? result : [result]).flatMap(b => b.output);
  if (output.length !== 1 || output[0].type !== 'chunk') throw new Error('One inline chunk required');
  return output[0].code;
}
await build({root, configFile:path.join(root, 'vite.config.js')});
const runtime = await bundle('src/vite-entry.js', 'AtlasPrintFormRuntime');
const app = await bundle('gallery/designs/assets/atlas/controller.mjs', 'AtlasLandedCostDossier');
const fontDir = path.join(root, 'gallery/designs/assets/fonts/aster-v1');
const fonts = {}, embedded = {};
for (const [key, file] of Object.entries({LATIN_REGULAR:'NotoSans-Regular.woff2', LATIN_BOLD:'NotoSans-Bold.woff2', CJK:'NotoSansCJKsc-Regular.woff2'})) {
  fonts[key] = `assets/fonts/aster-v1/${file}`;
  embedded[key] = `data:font/woff2;base64,${(await fs.readFile(path.join(fontDir, file))).toString('base64')}`;
}
const readableRuntimeSha256 = hash(await fs.readFile(path.join(root, 'dist/printform.js')));
const provenance = `PrintForm-JS built from unmodified src/vite-entry.js.\nReadable runtime SHA-256: ${readableRuntimeSha256}\nEmbedded runtime SHA-256: ${hash(runtime)}\nOriginal Atlas artwork and authoring: MIT.\n${await fs.readFile(path.join(root, 'LICENSE'), 'utf8')}\n${await fs.readFile(path.join(fontDir, 'FONT-LICENSE.txt'), 'utf8')}`;
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const values = {PROVENANCE:provenance, SAMPLE:json(JSON.parse(await read('sample.json'))),
  ARTWORK:json(`data:image/svg+xml;base64,${Buffer.from(await read('route.svg')).toString('base64')}`),
  ENGINE:runtime.replace(/<\/script/gi, '<\\/script'), APP:app.replace(/<\/script/gi, '<\\/script')};
const styles = await read('styles.css'), shell = await read('shell.html');
const render = urls => shell.replace(/__(PROVENANCE|STYLES|SAMPLE|ARTWORK|ENGINE|APP)__/g, (_, key) => key === 'STYLES' ? styles.replace(/__(LATIN_REGULAR|LATIN_BOLD|CJK)__/g, (_, k) => urls[k]) : values[key]);
const html = render(fonts), standalone = render(embedded);
const target = path.join(root, 'gallery/designs/atlas-landed-cost-dossier.html');
const standaloneTarget = path.resolve(root, '../artifacts/standalone/atlas-landed-cost-dossier.html');
await fs.writeFile(target, html); await fs.mkdir(path.dirname(standaloneTarget), {recursive:true}); await fs.writeFile(standaloneTarget, standalone);
const out = path.resolve(root, '../artifacts/atlas'); await fs.mkdir(out, {recursive:true});
await fs.writeFile(path.join(out, 'build.json'), JSON.stringify({target, standaloneTarget, htmlBytes:Buffer.byteLength(html), standaloneBytes:Buffer.byteLength(standalone),
  htmlSha256:hash(html), standaloneSha256:hash(standalone), readableRuntimeSha256, embeddedRuntimeSha256:hash(runtime), appSha256:hash(app)}, null, 2));
console.log(`${target}: ${Buffer.byteLength(html)} bytes; standalone output only: ${Buffer.byteLength(standalone)} bytes`);
