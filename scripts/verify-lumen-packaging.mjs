import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildGalleryPrecache, finalizeGalleryPwa} from './gallery-pwa-build.mjs';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/lumen'), baseline = '39b2bf3bf09c60782a7a2fc5519807809da3dd97';
const git = (...args) => execFileSync('git', args, {cwd:root, maxBuffer:256 * 1024 * 1024});
const hash = (bytes, algo = 'sha256') => createHash(algo).update(bytes).digest('hex');
const allowed = new Set(['gallery/manifest.json', 'gallery/js/categories.js', 'tests/gallery/manifest.test.js', 'tests/gallery/order.test.js', 'tests/gallery/categories.test.js', 'scripts/verify-atlas-packaging.mjs']);
let protectedFiles = 0;
for (const line of git('ls-tree', '-r', baseline).toString().trim().split('\n')) {
  const [, object, file] = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/) || [];
  if (!object || allowed.has(file)) continue;
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1'), object, `protected accepted file ${file}`); protectedFiles++;
}
const oldAudit = git('show', `${baseline}:scripts/verify-atlas-packaging.mjs`).toString();
const newAudit = fs.readFileSync(path.join(root, 'scripts/verify-atlas-packaging.mjs'), 'utf8');
assert.equal(newAudit.replace('// Historical 65→66 Atlas audit; prerequisites: docs/ATLAS_HISTORICAL_AUDIT.md.\n', '').replace("import {requireAtlasAuditBaseline} from './atlas-audit-baseline.mjs';\n", '').replace('requireAtlasAuditBaseline(root);\n', ''), oldAudit, 'all historical Atlas assertions unchanged');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'gallery/manifest.json')));
assert.deepEqual(manifest.slice(0, 66), JSON.parse(git('show', `${baseline}:gallery/manifest.json`))); assert.equal(manifest.length, 67);
assert.equal(manifest.filter(m => m.no === 'PF-067').length, 1);
const fonts = ['NotoSans-Regular.woff2', 'NotoSans-Bold.woff2', 'NotoSansCJKsc-Regular.woff2'], fontDir = 'designs/assets/fonts/aster-v1/';
const html = fs.readFileSync(path.join(root, 'gallery/designs/lumen-learning-progress-portfolio.html'), 'utf8');
const build = JSON.parse(fs.readFileSync(path.join(out, 'build.json')));
let detached = html;
for (const font of fonts) detached = detached.replace(`assets/fonts/aster-v1/${font}`, `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'gallery', fontDir, font)).toString('base64')}`);
assert.equal(fs.readFileSync(build.standaloneTarget, 'utf8'), detached, 'entire document identical except three font URLs');
assert.ok(path.relative(root, build.standaloneTarget).startsWith('../'));
assert.equal(hash(fs.readFileSync(path.join(root, 'dist/printform.js'))), build.readableRuntimeSha256);
assert.equal(hash(html.match(/<script type="text\/plain" id="engine-source">([\s\S]*?)<\/script>/)[1]), build.embeddedRuntimeSha256);
const measurements = {};
for (const name of ['before', 'after']) {
  const site = path.join(out, `site-${name}`); fs.rmSync(site, {force:true, recursive:true}); fs.mkdirSync(site, {recursive:true});
  if (name === 'before') execFileSync('tar', ['-xf', '-', '-C', site], {input:git('archive', baseline, 'gallery')});
  else fs.cpSync(path.join(root, 'gallery'), path.join(site, 'gallery'), {recursive:true});
  fs.cpSync(path.join(root, 'dist'), path.join(site, 'dist'), {recursive:true});
  const gallery = path.join(site, 'gallery'), precache = buildGalleryPrecache(gallery, site);
  const entries = precache.map(file => ({file, bytes:fs.statSync(path.resolve(gallery, file)).size}));
  measurements[name] = {files:entries.length, bytes:entries.reduce((a, e) => a + e.bytes, 0)};
  assert.ok(entries.every(e => !/standalone|__pycache__|\.pyc$/.test(e.file)));
  fs.writeFileSync(path.join(out, `precache-${name}.json`), JSON.stringify(entries, null, 2));
  for (const font of fonts) {
    assert.equal(precache.filter(f => f === fontDir + font).length, 1);
    const digest = hash(fs.readFileSync(path.join(gallery, fontDir, font)));
    assert.equal(precache.filter(f => hash(fs.readFileSync(path.resolve(gallery, f))) === digest).length, 1, 'one physical copy per shared font');
  }
  if (name === 'after') {
    finalizeGalleryPwa(site, 'cccccccccccccccccccccccccccccccccccccccc');
    const worker = fs.readFileSync(path.join(gallery, 'sw.js'), 'utf8'), release = JSON.parse(worker.match(/const PRECACHE = (\[[^\n]+\]);/)[1]);
    assert.ok(release.every(f => !f.includes('standalone')));
    for (const font of fonts) assert.equal(release.filter(f => f.endsWith(fontDir + font)).length, 1);
    measurements.after.releaseFiles = release.length; measurements.after.releaseBytes = release.reduce((a, f) => a + fs.statSync(path.resolve(gallery, f)).size, 0);
  }
}
const result = {baseline, measurements, incrementalPrecacheBytes:measurements.after.bytes - measurements.before.bytes, galleryHtmlBytes:Buffer.byteLength(html), standaloneBytes:fs.statSync(build.standaloneTarget).size,
  protectedFiles, protectedManifestRecords:66, additionalFontBytes:0, standaloneInPrecache:false, onlyFontURLsDiffer:true, embeddedRuntimeSha256:build.embeddedRuntimeSha256, atlasAssertionsUnchanged:true};
fs.writeFileSync(path.join(out, 'packaging-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
