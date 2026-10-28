// Rebuild the genuine runtime from current source, then embed it. No site build.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'gallery/designs/assets/meridian');
const {build} = await import('vite');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFile(path.join(source, name), 'utf8');
async function bundle(entry, name) {
  const result = await build({configFile:false, logLevel:'warn', build:{write:false, minify:true,
    lib:{entry:path.join(root,entry),name,formats:['iife']}, target:'es2022'}});
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
  const chunks = outputs.filter(asset => asset.type === 'chunk');
  if (chunks.length !== 1 || outputs.some(asset => asset.type !== 'chunk'))
    throw new Error('Standalone bundle must contain exactly one inline chunk and no external assets.');
  return chunks[0].code;
}
// Never trust an existing dist file or its timestamp: build current source every run.
await build({root, configFile:path.join(root,'vite.config.js')});
const readable = await fs.readFile(path.join(root,'dist/printform.js'));
const engine = await bundle('src/vite-entry.js', 'MeridianPrintFormRuntime');
const app = await bundle('gallery/designs/assets/meridian/controller.mjs', 'MeridianPurchaseOrder');
const [shell, css, sample, logo, license, barcodeLicense] = await Promise.all([read('shell.html'),read('styles.css'),read('sample.json'),read('logo.svg'),
  fs.readFile(path.join(root,'LICENSE'),'utf8'),fs.readFile(path.join(root,'studio-v2/vendor/jsbarcode-3.12.1.js'),'utf8').then(s => s.slice(0,s.indexOf('*/') + 2))]);
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const provenance = `PrintForm-JS built from unmodified src/vite-entry.js and formatter modules.\nReadable runtime SHA-256: ${sha(readable)}\nEmbedded runtime SHA-256: ${sha(engine)}\nOriginal Meridian artwork, sample clauses and authoring source: MIT.\n${license}\nExisting barcode renderer: studio-v2/core/barcode.js; JsBarcode 3.12.1, MIT:\n${barcodeLicense}`;
const values = {PROVENANCE:provenance, STYLES:css, SAMPLE:json(JSON.parse(sample)), LOGO:json(`data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`),
  ENGINE:engine.replace(/<\/script/gi,'<\\/script'), APP:app.replace(/<\/script/gi,'<\\/script')};
const output = shell.replace(/__(PROVENANCE|STYLES|SAMPLE|LOGO|ENGINE|APP)__/g, (_, key) => values[key]);
const target = path.join(root,'gallery/designs/meridian-enterprise-purchase-order.html');
await fs.writeFile(target,output);
await fs.mkdir(path.resolve(root,'../artifacts'),{recursive:true});
await fs.writeFile(path.resolve(root,'../artifacts/meridian-build.json'),JSON.stringify({
  target, htmlSha256:sha(output), readableRuntimeSha256:sha(readable), embeddedRuntimeSha256:sha(engine),
  appSha256:sha(app), builtAt:new Date().toISOString(), offline:true},null,2));
console.log(`${path.relative(root,target)}: ${Buffer.byteLength(output)} bytes; SHA-256 ${sha(output)}`);
