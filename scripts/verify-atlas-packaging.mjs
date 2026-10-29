import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildGalleryPrecache, finalizeGalleryPwa} from './gallery-pwa-build.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/atlas');
const git = (...args) => execFileSync('git', args, {cwd:root, maxBuffer:256 * 1024 * 1024});
const hash = (v, algorithm = 'sha256') => createHash(algorithm).update(v).digest('hex');
const fonts = ['NotoSans-Regular.woff2', 'NotoSans-Bold.woff2', 'NotoSansCJKsc-Regular.woff2'];
const fontDir = 'designs/assets/fonts/aster-v1/';
const allowed = file => ['gallery/manifest.json', 'gallery/js/categories.js', 'tests/gallery/manifest.test.js', 'tests/gallery/order.test.js', 'tests/gallery/categories.test.js'].includes(file);
let protectedFiles = 0;
for (const line of git('ls-tree', '-r', '5b69abf').toString().trim().split('\n')) {
  const [, object, file] = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/) || [];
  if (!object || allowed(file)) continue;
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1'), object, `protected accepted file ${file}`); protectedFiles++;
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'gallery/manifest.json')));
assert.deepEqual(manifest.slice(0, 65), JSON.parse(git('show', '5b69abf:gallery/manifest.json')));
assert.equal(manifest.length, 66);
const html = fs.readFileSync(path.join(root, 'gallery/designs/atlas-landed-cost-dossier.html'), 'utf8');
const build = JSON.parse(fs.readFileSync(path.join(out, 'build.json')));
let detached = html;
for (const font of fonts) detached = detached.replace(`assets/fonts/aster-v1/${font}`, `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'gallery', fontDir, font)).toString('base64')}`);
assert.equal(fs.readFileSync(build.standaloneTarget, 'utf8'), detached, 'whole document identical except three font URLs');
assert.ok(path.relative(root, build.standaloneTarget).startsWith('../'));
assert.equal(hash(fs.readFileSync(path.join(root, 'dist/printform.js'))), build.readableRuntimeSha256);
const engine = html.match(/<script type="text\/plain" id="engine-source">([\s\S]*?)<\/script>/)[1];
assert.equal(hash(engine), build.embeddedRuntimeSha256);
const measurements = {};
for (const name of ['before', 'after']) {
  const site = path.join(out, `site-${name}`); fs.rmSync(site, {force:true, recursive:true}); fs.mkdirSync(site, {recursive:true});
  if (name === 'before') execFileSync('tar', ['-xf', '-', '-C', site], {input:git('archive', '5b69abf', 'gallery')});
  else fs.cpSync(path.join(root, 'gallery'), path.join(site, 'gallery'), {recursive:true});
  fs.cpSync(path.join(root, 'dist'), path.join(site, 'dist'), {recursive:true});
  const gallery = path.join(site, 'gallery'), precache = buildGalleryPrecache(gallery, site);
  const entries = precache.map(file => ({file, bytes:fs.statSync(path.resolve(gallery, file)).size}));
  measurements[name] = {files:entries.length, bytes:entries.reduce((a, e) => a + e.bytes, 0)};
  assert.ok(entries.every(e => !e.file.includes('standalone')));
  fs.writeFileSync(path.join(out, `precache-${name}.json`), JSON.stringify(entries, null, 2));
  for (const font of fonts) {
    assert.equal(precache.filter(f => f === fontDir + font).length, 1);
    const digest = hash(fs.readFileSync(path.join(gallery, fontDir, font)));
    assert.equal(precache.filter(f => hash(fs.readFileSync(path.resolve(gallery, f))) === digest).length, 1, 'one physical copy per shared font');
  }
  if (name === 'after') {
    finalizeGalleryPwa(site, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const worker = fs.readFileSync(path.join(gallery, 'sw.js'), 'utf8');
    const release = JSON.parse(worker.match(/const PRECACHE = (\[[^\n]+\]);/)[1]);
    assert.ok(release.every(f => !f.includes('standalone')));
    for (const font of fonts) assert.equal(release.filter(f => f.endsWith(fontDir + font)).length, 1);
    measurements.after.releaseFiles = release.length;
    measurements.after.releaseBytes = release.reduce((a, f) => a + fs.statSync(path.resolve(gallery, f)).size, 0);
  }
}
const result = {measurements, incrementalPrecacheBytes:measurements.after.bytes - measurements.before.bytes, galleryHtmlBytes:Buffer.byteLength(html),
  standaloneBytes:fs.statSync(build.standaloneTarget).size, protectedFiles, protectedManifestRecords:65, sharedFontCopies:3,
  additionalFontBytes:0, standaloneInPrecache:false, onlyFontURLsDiffer:true, embeddedRuntimeSha256:build.embeddedRuntimeSha256};
fs.writeFileSync(path.join(out, 'packaging-results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
