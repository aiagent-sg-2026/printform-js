import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, '../output/school-invoices'));
const assets = path.join(root, 'gallery/designs/assets/school-invoices');
const data = JSON.parse(await fs.readFile(path.join(assets, 'data.json'), 'utf8'));
const report = JSON.parse(await fs.readFile(path.join(output, 'verification.json'), 'utf8'));
if (report.cases.length !== 24 || report.errors.length) throw new Error('Verify all 24 PDFs before packaging');
const preview = path.join(output, 'previews'); await fs.mkdir(preview, { recursive: true });
async function sheet(entries, file, cols, cellWidth = 400) {
  const cellHeight = Math.ceil(cellWidth * 297 / 210) + 40;
  const canvas = createCanvas(cols * cellWidth, Math.ceil(entries.length / cols) * cellHeight);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e4e8ed'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [i, entry] of entries.entries()) {
    const image = await loadImage(path.join(output, entry.file));
    const x = i % cols * cellWidth, y = Math.floor(i / cols) * cellHeight;
    const scale = Math.min((cellWidth - 16) / image.width, (cellHeight - 44) / image.height);
    ctx.fillStyle = '#23374e'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(entry.label, x + 9, y + 21);
    ctx.drawImage(image, x + (cellWidth - image.width * scale) / 2, y + 32, image.width * scale, image.height * scale);
  }
  await fs.writeFile(path.join(preview, file), canvas.toBuffer('image/png'));
}
for (const paper of ['A4', 'A5']) {
  const entries = report.cases.filter(n => n.paper === paper && n.mode === 'short').map(n => ({ file: n.pdf.images[0], label: `${n.style} · ${paper} · single page` }));
  await sheet(entries, `${paper}-six-short.png`, 3);
}
for (const style of data.styles) {
  const entries = report.cases.filter(n => n.style === style.id && n.mode === 'long').flatMap(n => n.pdf.images.map((file, i) => ({ file,
    label: `PF-${style.number} · ${n.paper} · ${['first', 'continuation', 'final'][i]} / ${n.pdf.pages} pages` })));
  await sheet(entries, `pf${style.number}-long-review.png`, 3, 430);
}
const context = { window: {} }; vm.createContext(context);
vm.runInContext(await fs.readFile(path.join(assets, 'art.js'), 'utf8'), context);
const artwork = path.join(output, 'artwork'); await fs.mkdir(artwork, { recursive: true });
for (const style of data.styles) {
  await fs.writeFile(path.join(artwork, `${style.id}-mark.svg`), context.window.SchoolInvoiceArt.mark(style.id));
  const scene = context.window.SchoolInvoiceArt.scene(style.id);
  if (scene) await fs.writeFile(path.join(artwork, `${style.id}-scene.svg`), scene);
}
const sharedFiles = ['gallery/designs/assets/demobank/DejaVuSansCondensed.ttf',
  'gallery/designs/assets/demobank/DejaVuSansCondensed-Bold.ttf', 'gallery/designs/assets/demobank/FONT-LICENSE.txt',
  'dist/printform.js', 'LICENSE', 'docs/SCHOOL_INVOICES.md', 'docs/SCHOOL_INVOICES_VERIFICATION.md',
  'gallery/README.md', 'gallery/manifest.json', 'gallery/js/categories.js',
  'tests/gallery/categories.test.js', 'tests/gallery/manifest.test.js',
  'e2e/gallery-filters.spec.js', 'e2e/pf057-placemat.spec.js',
  'scripts/sync-school-invoices.mjs', 'scripts/export-school-invoices.mjs', 'scripts/verify-school-invoices.mjs',
  'scripts/school-invoice-dom-checks.mjs', 'scripts/school-invoice-pdf-checks.mjs', 'scripts/package-school-invoices.mjs',
  'scripts/build-school-invoice-fonts.py', 'tests/gallery/school-invoices.test.js', 'e2e/school-invoices.spec.js',
  'package.json', 'package-lock.json'];
const sourceFiles = [...data.styles.flatMap(n => [`gallery/designs/${n.file}.html`, `gallery/thumbs/${n.file}.png`]),
  ...['data.json', 'data.js', 'math.js', 'art.js', 'template.js', 'controller.js', 'invoice.css', 'themes.css',
    'invoice.schema.json', 'DemoSchoolCJK-Regular.woff2', 'DemoSchoolCJK-Bold.woff2', 'FONT-LICENSE.txt', 'FONT-PROVENANCE.md',
    'cjk-glyphs.txt', 'demo-qr.svg'].map(n => `gallery/designs/assets/school-invoices/${n}`), ...sharedFiles];
const zip = async (name, cwd, files) => {
  const target = path.join(output, name);
  await fs.rm(target, { force: true });
  execFileSync('zip', ['-q', '-9', target, ...files], { cwd }); return target;
};
console.log(await zip('school-invoices-source.zip', root, sourceFiles));
const pdfs = (await fs.readdir(path.join(output, 'pdf'))).filter(n => n.endsWith('.pdf')).map(n => `pdf/${n}`);
console.log(await zip('school-invoices-24-pdfs.zip', output, pdfs));
const offline = (await fs.readdir(path.join(output, 'offline'))).filter(n => n.endsWith('.html')).map(n => `offline/${n}`);
console.log(await zip('school-invoices-six-offline.zip', output, offline));
await fs.copyFile(path.join(root, 'docs/SCHOOL_INVOICES_VERIFICATION.md'), path.join(output, 'VERIFICATION_REPORT.md'));
const names = ['school-invoices-source.zip', 'school-invoices-24-pdfs.zip', 'school-invoices-six-offline.zip'];
const checksums = await Promise.all(names.map(async file => {
  const bytes = await fs.readFile(path.join(output, file));
  return { file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}));
await fs.writeFile(path.join(output, 'ARTIFACTS.json'), JSON.stringify({ sourceCommit: report.sourceCommit,
  verification: 'verification.json', report: 'VERIFICATION_REPORT.md', archives: checksums }, null, 2));
console.log(preview);
