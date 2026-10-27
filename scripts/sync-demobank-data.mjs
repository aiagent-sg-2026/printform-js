import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '../gallery/designs/assets/demobank');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
const script = `// Generated from data.json by scripts/sync-demobank-data.mjs. Do not edit.\nwindow.DEMOBANK_DATA = ${JSON.stringify(data)};\n`;
const target = path.join(dir, 'data.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== script) throw new Error('DemoBank data.js is stale');
} else fs.writeFileSync(target, script);
