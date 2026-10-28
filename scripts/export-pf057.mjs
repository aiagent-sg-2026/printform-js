import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const designs = path.join(root, 'gallery/designs');
const assets = path.join(designs, 'assets/pf057');
execFileSync(process.execPath, [path.join(root, 'scripts/sync-pf057-data.mjs'), '--check']);
const out = path.resolve(process.argv[2] || path.join(root, '../output/pf057/pf057-offline.html'));
const uri = file => `data:${file.endsWith('.svg') ? 'image/svg+xml' : 'font/ttf'};base64,${fs.readFileSync(file).toString('base64')}`;
let html = fs.readFileSync(path.join(designs, 'demobank-bilingual-financing-placemat.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, file) => {
  const absolute = path.resolve(designs, file);
  const css = fs.readFileSync(absolute, 'utf8').replace(/url\('([^']+)'\)/g,
    (_, url) => `url('${uri(path.resolve(path.dirname(absolute), url))}')`);
  return `<style>\n${css}\n</style>`;
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) =>
  `<script>\n${fs.readFileSync(path.resolve(designs, file), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
const images = Object.fromEntries(['hero.svg', 'mark.svg'].map(file => [file, uri(path.join(assets, file))]));
html = html.replace('<script>\n// Generated', `<script>window.PF057_ASSETS=${JSON.stringify(images)};</script>\n<script>\n// Generated`);
const license = fs.readFileSync(path.join(designs, 'assets/demobank/FONT-LICENSE.txt'), 'utf8');
html = html.replace('</head>', `<!-- Unmodified DejaVu fonts; license:\n${license}\n-->\n</head>`);
if (/<(?:link|script)[^>]+(?:src|href)=/i.test(html)) throw new Error('External dependency remains');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out);
