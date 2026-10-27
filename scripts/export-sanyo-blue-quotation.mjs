import fs from 'node:fs';
import path from 'node:path';

// Run after npm run build:assets. This is a standalone gallery export, not a
// Studio V2 attested transaction document. No remote dependencies are retained.
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'gallery/designs/sanyo-blue-sales-quotation.html');
const directory = path.dirname(source);
const output = path.resolve(process.argv[2] || path.join(root, 'output/sanyo-blue-sales-quotation-offline.html'));
let html = fs.readFileSync(source, 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, file) =>
  '<style>\n' + fs.readFileSync(path.resolve(directory, file), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) =>
  '<script>\n' + fs.readFileSync(path.resolve(directory, file), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
if (/<(?:link|script)[^>]+(?:src|href)=/i.test(html)) throw new Error('External asset reference remains');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(output);
