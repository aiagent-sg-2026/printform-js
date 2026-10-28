import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.PF057_OUTPUT || path.join(root, '../output/pf057'));
const stage = path.join(output, 'pf057-delivery');
const zip = path.join(output, 'PF057-DemoBank-placemat.zip');
const verification = JSON.parse(fs.readFileSync(path.join(output, 'pf057-verification.json')));
if (verification.pdf.pages.length !== 2 || verification.offline.errors.length) throw new Error('Verify final artifacts first');
// Explicit allowlist: never walk the workspace, input, logs or node_modules.
const sourceFiles = [
  'gallery/designs/demobank-bilingual-financing-placemat.html',
  'gallery/thumbs/demobank-bilingual-financing-placemat.png',
  'docs/PF057_PLACEMAT.md', 'LICENSE',
  'gallery/manifest.json', 'gallery/js/filter.js', 'gallery/js/categories.js',
  'scripts/sync-pf057-data.mjs', 'scripts/export-pf057.mjs', 'scripts/verify-pf057.mjs',
  'scripts/pf057-checks.mjs', 'scripts/package-pf057.mjs',
  'tests/gallery/pf057-placemat.test.js', 'e2e/pf057-placemat.spec.js',
  'dist/printform.js',
  ...fs.readdirSync(path.join(root, 'gallery/designs/assets/pf057')).map(file => `gallery/designs/assets/pf057/${file}`),
  ...['DejaVuSansCondensed.ttf', 'DejaVuSansCondensed-Bold.ttf', 'FONT-LICENSE.txt'].map(file => `gallery/designs/assets/demobank/${file}`)
];
const artifacts = ['pf057-offline.html', 'pf057-demobank-placemat.pdf', 'pf057-data.json',
  'pf057-page-1.png', 'pf057-page-2.png', 'pf057-mobile-390.png',
  'pf057-pdf-page-1.png', 'pf057-pdf-page-2.png', 'pf057-verification.json', 'PF057_VERIFICATION_REPORT.md'];
for (const file of [...sourceFiles.map(file => path.join(root, file)), ...artifacts.map(file => path.join(output, file))]) {
  if (!fs.statSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error(`Unsafe source: ${file}`);
}
fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to);
}
for (const file of sourceFiles) copy(path.join(root, file), path.join(stage, 'source', file));
for (const file of artifacts) copy(path.join(output, file), path.join(stage, file));
// Keep one directly usable SVG set outside the source tree for design tools.
for (const file of ['hero.svg', 'mark.svg']) copy(path.join(root, 'gallery/designs/assets/pf057', file), path.join(output, `pf057-${file}`));
fs.writeFileSync(path.join(stage, 'README.txt'), `PF-057 DemoBank bilingual financing placemat\n\nOpen pf057-offline.html directly in a browser: no installation/network required.\nPDF: A4 portrait, two pages, English then Malay. SAMPLE ONLY, NOT A FINANCIAL OFFER.\nPrint: 100% scale, margins none, backgrounds enabled, browser headers/footers off.\n\nSource: source/gallery/designs/demobank-bilingual-financing-placemat.html\nRuntime: source/dist/printform.js (repository MIT license).\nFonts: source/gallery/designs/assets/demobank/FONT-LICENSE.txt\nOriginal artwork/licenses: source/gallery/designs/assets/pf057/\nChange data.json, then run source/scripts/sync-pf057-data.mjs and export-pf057.mjs with Node24.\nVerifier additionally needs playwright and pdfjs-dist; gallery unit tests use the parent repository's Vitest setup.\nSee docs/PF057_PLACEMAT.md and the English verification report for limits.\nNo supplied reference images, private data, real bank assets, payment codes or node_modules.\n`);
fs.writeFileSync(path.join(stage, 'source/package.json'), JSON.stringify({
  name: 'pf057-demobank-delivery', private: true, engines: { node: '>=24' }, license: 'MIT',
  scripts: { verify: 'node scripts/verify-pf057.mjs', 'test:math': 'vitest run tests/gallery/pf057-placemat.test.js --maxWorkers=1 --no-file-parallelism' },
  devDependencies: { '@playwright/test': '1.62.0', 'pdfjs-dist': '6.3.289', jsdom: '27.0.1', vitest: '4.1.11' }
}, null, 2) + '\n');
const hashes = [];
function inventory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) inventory(file);
    else hashes.push(`${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.relative(stage, file)}`);
  }
}
inventory(stage); fs.writeFileSync(path.join(stage, 'SHA256SUMS.txt'), `${hashes.sort().join('\n')}\n`);
fs.rmSync(zip, { force: true }); execFileSync('zip', ['-q', '-r', zip, '.'], { cwd: stage });
const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
if (names.some(name => name.startsWith('/') || name.split('/').includes('..') || /reference-layout|node_modules|\.log$/.test(name))) throw new Error('Unsafe ZIP entry');
execFileSync('unzip', ['-tq', zip]);
console.log(`${zip}: ${fs.statSync(zip).size} bytes; ${hashes.length} files; references/logs/node_modules excluded`);
