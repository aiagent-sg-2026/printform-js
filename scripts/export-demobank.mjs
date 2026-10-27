import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const designs = path.join(root, 'gallery/designs');
const assets = path.join(designs, 'assets/demobank');
const out = path.resolve(process.argv[2] || path.join(root, '../output/demobank-statement-offline.html'));
const dataURI = file => {
  const mime = file.endsWith('.svg') ? 'image/svg+xml' : 'font/ttf';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
};
let html = fs.readFileSync(path.join(designs, 'demobank-fourpage-statement.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, file) => {
  const absolute = path.resolve(designs, file);
  const css = fs.readFileSync(absolute, 'utf8').replace(/url\('([^']+)'\)/g, (_, url) =>
    `url('${dataURI(path.resolve(path.dirname(absolute), url))}')`);
  return `<style>\n${css}\n</style>`;
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) =>
  `<script>\n${fs.readFileSync(path.resolve(designs, file), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
const images = Object.fromEntries(['logo.svg','banner.svg','barcode.svg','qr.svg'].map(file => [file, dataURI(path.join(assets,file))]));
html = html.replace('<div id="demobank-root"></div>', `<div id="demobank-root"></div>\n<script>window.DEMOBANK_ASSETS=${JSON.stringify(images)};</script>`);
const license = fs.readFileSync(path.join(assets,'FONT-LICENSE.txt'),'utf8');
html = html.replace('</head>', `<!-- Embedded DejaVu fonts, unmodified. License:\n${license}\n-->\n</head>`);
if (/<(?:link|script)[^>]+(?:src|href)=/i.test(html)) throw new Error('External stylesheet or script remains');
fs.mkdirSync(path.dirname(out), {recursive:true}); fs.writeFileSync(out, html);
console.log(out);
