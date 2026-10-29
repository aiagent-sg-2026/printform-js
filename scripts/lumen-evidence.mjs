import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root, '../artifacts/lumen');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const describe = file => ({file, bytes:fs.statSync(file).size, sha256:digest(file)});
const json = file => JSON.parse(fs.readFileSync(path.join(out, file)));
const copies = {'lumen-default.json':'sample.json', 'lumen.schema.json':'schema.json', 'lumen-default.expected.json':'expected.json', 'lumen-scenario.expected.json':'scenarios.json', 'lumen-edge-cases.json':'edges.json', 'oracle-generator.py':'oracle-generator.py', 'lumen-grove-original.svg':'grove.svg'};
const approvedCopies = Object.entries(copies).map(([input, name]) => {
  const source = path.resolve(root, '../lumen-input', input), file = path.join(root, 'gallery/designs/assets/lumen', name);
  assert.equal(digest(source), digest(file), `approved transfer copy ${name}`); return {input, target:name, sha256:digest(file)};
});
const artifacts = fs.readdirSync(out).filter(f => /\.(pdf|png|json|log)$/.test(f) && !/^(first-|look-|layout-|server|pwa-server|evidence-inventory)/.test(f)).map(f => describe(path.join(out, f)));
const build = json('build.json'), packaging = json('packaging-results.json'), browser = json('browser-results.json'), pdf = json('pdf-results.json');
const result = {baseline:'39b2bf3bf09c60782a7a2fc5519807809da3dd97', node:process.version,
  chromium:execFileSync('/home/ai-agent/.cache/ms-playwright/chromium-1234/chrome-linux/chrome', ['--version'], {encoding:'utf8'}).trim(),
  preflight:'ad8b8313-0998-43c6-bc12-5632453bd305', status:'implemented-tested-awaiting-independent-review',
  build, packaging, browserChecks:browser.results.length, pdfDocuments:pdf.length, pdfPages:pdf.reduce((a, p) => a + p.pages, 0), exactPdfCells:pdf.reduce((a, p) => a + p.anchoredExactCells, 0),
  approvedCopies, thumbnail:describe(path.join(root, 'gallery/thumbs/lumen-learning-progress-portfolio.png')),
  runtimeSource:['src/vite-entry.js', 'src/printform.js', 'src/printform/formatter.js', 'src/printform/config.js', 'scripts/gallery-pwa-build.mjs'].map(f => describe(path.join(root, f))),
  sharedFonts:fs.readdirSync(path.join(root, 'gallery/designs/assets/fonts/aster-v1')).filter(f => f.endsWith('.woff2')).map(f => describe(path.join(root, 'gallery/designs/assets/fonts/aster-v1', f))), artifacts};
fs.writeFileSync(path.join(out, 'evidence-inventory.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({node:result.node, chromium:result.chromium, browserChecks:result.browserChecks, pdfDocuments:result.pdfDocuments, pdfPages:result.pdfPages, exactPdfCells:result.exactPdfCells, inventoriedArtifacts:artifacts.length}));
