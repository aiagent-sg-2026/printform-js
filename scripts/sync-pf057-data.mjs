import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '../gallery/designs/assets/pf057');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
const output = `// Generated from data.json by scripts/sync-pf057-data.mjs. Do not edit.\nwindow.PF057_DATA = ${JSON.stringify(data, null, 2)};\n`;
const target = path.join(dir, 'data.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('PF057 data.js is stale');
} else fs.writeFileSync(target, output);
