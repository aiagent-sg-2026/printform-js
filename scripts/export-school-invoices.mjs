import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const designs = path.join(root, 'gallery/designs');
const assets = path.join(designs, 'assets/school-invoices');
const output = path.resolve(process.argv[2] || path.join(root, '../output/school-invoices/offline'));
execFileSync(process.execPath, [path.join(root, 'scripts/sync-school-invoices.mjs'), '--check']);
const data = JSON.parse(fs.readFileSync(path.join(assets, 'data.json'), 'utf8'));
const uri = file => `data:${file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.woff2') ? 'font/woff2' : 'font/ttf'};base64,${fs.readFileSync(file).toString('base64')}`;
fs.mkdirSync(output, { recursive: true });
for (const style of data.styles) {
  let html = fs.readFileSync(path.join(designs, `${style.file}.html`), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, file) => {
    const absolute = path.resolve(designs, file);
    const css = fs.readFileSync(absolute, 'utf8').replace(/url\('([^']+)'\)/g,
      (_, url) => `url('${uri(path.resolve(path.dirname(absolute), url))}')`);
    return `<style>\n${css}\n</style>`;
  });
  html = html.replace(/<script id="school-engine" type="text\/plain" data-src="([^"]+)"><\/script>/,
    (_, file) => `<script id="school-engine" type="text/plain">\n${fs.readFileSync(path.resolve(designs, file), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) =>
    `<script>\n${fs.readFileSync(path.resolve(designs, file), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
  html = html.replace('<script>', `<script>window.SCHOOL_ASSETS=${JSON.stringify({ 'demo-qr.svg': uri(path.join(assets, 'demo-qr.svg')) })};</script>\n<script>`);
  const licenses = ['FONT-LICENSE.txt', '../demobank/FONT-LICENSE.txt'].map(file => fs.readFileSync(path.resolve(assets, file), 'utf8')).join('\n');
  html = html.replace('</head>', `<!-- Bundled font licenses:\n${licenses}\n-->\n</head>`);
  if (/<(?:link|script)[^>]+(?:src|href)=/i.test(html)) throw new Error('External dependency remains');
  const file = path.join(output, `pf${style.number}-${style.file}.html`);
  fs.writeFileSync(file, html); console.log(file);
}
