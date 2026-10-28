// Controlled Gallery-only site copies: no global build or test lifecycle.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildGalleryPrecache, finalizeGalleryPwa} from './gallery-pwa-build.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, '../artifacts/aster-package');
const sites = path.join(out, 'sites');
fs.mkdirSync(sites, {recursive:true});
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd:root, maxBuffer:256 * 1024 * 1024});
const files = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const target = 'designs/aster-three-way-match-review-pack.html';
const fontDir = 'designs/assets/fonts/aster-v1/';
const fonts = ['NotoSans-Regular.woff2', 'NotoSans-Bold.woff2', 'NotoSansCJKsc-Regular.woff2'];
const measurements = {};
for (const [name, revision] of [['oldMain', '5124bea'], ['oldAster', '6434b83'], ['shared', null]]) {
  const site = path.join(sites, name);
  fs.rmSync(site, {force:true, recursive:true});
  fs.mkdirSync(site, {recursive:true});
  if (revision) execFileSync('tar', ['-xf', '-', '-C', site], {input:git('archive', revision, 'gallery')});
  else fs.cpSync(path.join(root, 'gallery'), path.join(site, 'gallery'), {recursive:true});
  fs.cpSync(path.join(root, 'dist'), path.join(site, 'dist'), {recursive:true});
  const gallery = path.join(site, 'gallery');
  const precache = buildGalleryPrecache(gallery, site);
  const entries = precache.map(file => ({file, bytes:fs.statSync(path.resolve(gallery, file)).size}));
  assert.ok(entries.every(entry => !entry.file.includes('standalone')));
  fs.writeFileSync(path.join(out, `precache-${name}.json`), JSON.stringify(entries, null, 2));
  measurements[name] = {files:entries.length, bytes:entries.reduce((sum, entry) => sum + entry.bytes, 0)};
  if (name !== 'shared') continue;
  for (const font of fonts) {
    assert.equal(precache.filter(file => file === fontDir + font).length, 1);
    assert.ok(!fs.existsSync(path.join(gallery, 'designs/assets/aster', font)));
    const expectedHash = digest(fs.readFileSync(path.join(gallery, fontDir, font)));
    assert.equal(precache.filter(file => digest(fs.readFileSync(path.resolve(gallery, file))) === expectedHash).length, 1, 'one physical font copy per precache');
  }
  assert.equal(precache.filter(file => file.endsWith('.woff2') && file.startsWith(fontDir)).length, 3);
  finalizeGalleryPwa(site, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const worker = fs.readFileSync(path.join(gallery, 'sw.js'), 'utf8');
  const releasePrecache = JSON.parse(worker.match(/const PRECACHE = (\[[^\n]+\]);/)[1]);
  for (const font of fonts) assert.equal(releasePrecache.filter(file => file.endsWith(fontDir + font)).length, 1);
  assert.ok(files(site).every(file => !file.includes('standalone')));
  measurements.shared.releasePrecacheFiles = releasePrecache.length;
  measurements.shared.releasePrecacheBytes = releasePrecache.reduce((sum, file) => sum + fs.statSync(path.resolve(gallery, file)).size, 0);
}
// Protect every parent-tracked file except the explicitly approved Aster packaging boundary.
const allowed = file => /^gallery\/designs\/(assets\/(aster|fonts\/aster-v1)\/|aster-three-way-match-review-pack\.html$)/.test(file)
  || /^scripts\/[^/]*aster[^/]*\.(mjs|py)$/.test(file) || /^tests\/gallery\/aster[^/]*\.test\.js$/.test(file);
let protectedFiles = 0;
for (const line of git('ls-tree', '-r', '6434b83').toString().trim().split('\n')) {
  const [, object, file] = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/) || [];
  if (!object || allowed(file)) continue;
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(digest(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1'), object, `protected file ${file}`);
  protectedFiles++;
}
// Old main's first 64 manifest records remain byte-equivalent values.
const oldManifest = JSON.parse(git('show', '5124bea:gallery/manifest.json'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'gallery/manifest.json')));
assert.equal(oldManifest.length, 64);
assert.deepEqual(manifest.slice(0, 64), oldManifest);
const html = fs.readFileSync(path.join(root, 'gallery', target), 'utf8');
const previous = git('show', `6434b83:gallery/${target}`).toString();
const engine = text => text.match(/<script type="text\/plain" id="engine-source">([\s\S]*?)<\/script>/)[1];
assert.equal(digest(engine(html)), digest(engine(previous)), 'embedded runtime unchanged');
const app = text => text.slice(text.lastIndexOf('<script>'));
assert.equal(app(html), app(previous), 'embedded app unchanged');
const build = JSON.parse(fs.readFileSync(path.resolve(root, '../artifacts/aster-build.json')));
assert.equal(digest(fs.readFileSync(path.join(root, 'dist/printform.js'))), build.readableRuntimeSha256);
const standalone = fs.readFileSync(build.standaloneTarget);
let expectedStandalone = html;
for (const font of fonts) {
  const embedded = `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'gallery', fontDir, font)).toString('base64')}`;
  expectedStandalone = expectedStandalone.replace(`assets/fonts/aster-v1/${font}`, embedded);
}
// Strong whole-document equality lives here, not in unit tests requiring uncommitted output.
assert.equal(standalone.toString('utf8'), expectedStandalone, 'only three font URLs differ between packagings');
assert.ok(path.relative(root, build.standaloneTarget).startsWith(`..${path.sep}`), 'standalone output outside repository');
assert.ok(!git('ls-files', '--', 'gallery', 'dist').toString().split('\n').some(file => file.includes('standalone')), 'no tracked distribution standalone');
const fontBytes = fonts.reduce((sum, file) => sum + fs.statSync(path.join(root, 'gallery', fontDir, file)).size, 0);
const result = {measurements, incrementalOldAsterBytes:measurements.oldAster.bytes - measurements.oldMain.bytes,
  incrementalSharedBytes:measurements.shared.bytes - measurements.oldMain.bytes,
  savedPrecacheBytes:measurements.oldAster.bytes - measurements.shared.bytes,
  galleryHtmlBytes:Buffer.byteLength(html), oldGalleryHtmlBytes:Buffer.byteLength(previous), standaloneBytes:standalone.length,
  sharedFontCount:3, sharedFontBytes:fontBytes, nonFontIncrementalBytes:measurements.shared.bytes - measurements.oldMain.bytes - fontBytes,
  standaloneInPrecache:false, embeddedRuntimeSha256:digest(engine(html)), readableRuntimeSha256:build.readableRuntimeSha256,
  embeddedAppUnchanged:true, protectedFiles, oldManifestRecords:64};
fs.writeFileSync(path.join(out, 'packaging-results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
