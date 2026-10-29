// Fresh current-source runtime, no site build or lifecycle test sweep.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = path.join(root, 'gallery/designs/assets/aster');
const read = name => fs.readFile(path.join(dir, name), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
async function bundle(entry, name) {
  const result = await build({configFile:false, logLevel:'warn', build:{write:false, minify:true, target:'es2022',
    lib:{entry:path.join(root, entry), name, formats:['iife']}}});
  const output = (Array.isArray(result) ? result : [result]).flatMap(b => b.output);
  if (output.length !== 1 || output[0].type !== 'chunk') throw new Error('Standalone must have one inline chunk');
  return output[0].code;
}
await build({root, configFile:path.join(root, 'vite.config.js')});
const runtime = await bundle('src/vite-entry.js', 'AsterPrintFormRuntime');
const app = await bundle('gallery/designs/assets/aster/controller.mjs', 'AsterReviewPack');
const fontDir = path.join(root, 'gallery/designs/assets/fonts/aster-v1');
const fonts = {}, embeddedFonts = {};
for (const [key, file] of Object.entries({LATIN_REGULAR:'NotoSans-Regular.woff2', LATIN_BOLD:'NotoSans-Bold.woff2', CJK:'NotoSansCJKsc-Regular.woff2'})) {
  fonts[key] = `assets/fonts/aster-v1/${file}`;
  embeddedFonts[key] = `data:font/woff2;base64,${(await fs.readFile(path.join(fontDir, file))).toString('base64')}`;
}
const styles = await read('styles.css');
const css = values => styles.replace(/__(LATIN_REGULAR|LATIN_BOLD|CJK)__/g, (_, key) => values[key]);
const json = v => JSON.stringify(v).replace(/</g, '\\u003c');
const readableHash = hash(await fs.readFile(path.join(root, 'dist/printform.js')));
const provenance = `PrintForm-JS built from unmodified src/vite-entry.js.\nReadable runtime SHA-256: ${readableHash}\nEmbedded runtime SHA-256: ${hash(runtime)}\nOriginal Aster artwork and authoring: MIT.\n${await fs.readFile(path.join(root, 'LICENSE'), 'utf8')}\n${await fs.readFile(path.join(fontDir, 'FONT-LICENSE.txt'), 'utf8')}`;
const values = {PROVENANCE:provenance, SAMPLE:json(JSON.parse(await read('sample.json'))),
  LOGO:json(`data:image/svg+xml;base64,${Buffer.from(await read('logo.svg')).toString('base64')}`),
  ENGINE:runtime.replace(/<\/script/gi, '<\\/script'), APP:app.replace(/<\/script/gi, '<\\/script')};
const shell = await read('shell.html');
const render = fontURLs => shell.replace(/__(PROVENANCE|STYLES|SAMPLE|LOGO|ENGINE|APP)__/g, (_, key) => key === 'STYLES' ? css(fontURLs) : values[key]);
const output = render(fonts), standalone = render(embeddedFonts);
const target = path.join(root, 'gallery/designs/aster-three-way-match-review-pack.html');
// Output-only download artifact: never place it in Gallery, dist or site-dist.
const standaloneTarget = path.resolve(root, '../artifacts/standalone/aster-three-way-match-review-pack.html');
await fs.writeFile(target, output);
await fs.mkdir(path.dirname(standaloneTarget), {recursive:true});
await fs.writeFile(standaloneTarget, standalone);
await fs.writeFile(path.resolve(root, '../artifacts/aster-build.json'), JSON.stringify({target, standaloneTarget,
  htmlBytes:Buffer.byteLength(output), standaloneBytes:Buffer.byteLength(standalone),
  htmlSha256:hash(output), standaloneSha256:hash(standalone), readableRuntimeSha256:readableHash,
  embeddedRuntimeSha256:hash(runtime), appSha256:hash(app), offline:true}, null, 2));
console.log(`${path.relative(root, target)}: ${Buffer.byteLength(output)} bytes; SHA-256 ${hash(output)}`);
console.log(`${standaloneTarget}: ${Buffer.byteLength(standalone)} bytes; output only`);
