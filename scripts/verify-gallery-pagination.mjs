import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

// Serial real-browser catalogue audit. Start your own local static server first.
// Record a baseline before changing the engine; compare after rebuilding assets.
// --baseline permits only byte-identical pre-existing geometry issues, never new ones.
const root = path.resolve(import.meta.dirname, '..');
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const output = path.resolve(option('--output') || path.join(root, '../pf055-gallery-check.json'));
const baselinePath = option('--baseline');
const baseline = baselinePath ? JSON.parse(await fs.readFile(path.resolve(baselinePath), 'utf8')) : [];
const manifest = JSON.parse(await fs.readFile(path.join(root, 'gallery/manifest.json'), 'utf8'));
const baseURL = process.env.PF055_BASE_URL || 'http://127.0.0.1:4185';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [], differences = [];
try {
  const page = await browser.newPage({ viewport: { width:1200,height:1100 } });
  for (const design of manifest) {
    const errors = [], onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    let result;
    try {
      await page.goto(`${baseURL}/gallery/${design.file}`);
      await page.waitForFunction(() => window.__printFormProcessed === true, null, { timeout:30000 });
      const pages = await page.locator('.printform_page').evaluateAll(nodes => nodes.map(p => {
        const b = p.getBoundingClientRect();
        return {width:b.width,height:b.height,text:p.textContent,overflow:p.scrollWidth>p.clientWidth+1,
          outside:[...p.children].filter(n => { const r=n.getBoundingClientRect();
            return r.width>0 && (r.left<b.left-1 || r.right>b.right+1 || r.bottom>b.bottom+1 || r.top<b.top-1);
          }).map(n => n.className)};
      }));
      result = { id:design.id,no:design.no,count:pages.length,
        textHash:crypto.createHash('sha256').update(pages.map(p=>p.text).join('\n')).digest('hex'),
        pages:pages.map(({text,...p})=>p),errors };
    } catch (error) { result = {id:design.id,error:error.message,errors}; }
    page.off('pageerror', onError);
    results.push(result);
    const before = baseline.find(n => n.id === design.id);
    if (before) {
      if (JSON.stringify(before) !== JSON.stringify(result)) differences.push({id:design.id,before,after:result});
    } else if (result.error || !result.count || result.errors.length || result.pages.some(p=>p.overflow || p.outside.length)) {
      differences.push({id:design.id,after:result});
    }
    console.log(`${design.no}: ${result.count ?? 'FAILED'} pages${before ? ' (baseline compared)' : ''}`);
  }
  for (const before of baseline) {
    if (!results.some(n=>n.id===before.id)) differences.push({id:before.id,error:'Missing baseline design'});
  }
} finally { await browser.close(); }
await fs.mkdir(path.dirname(output), { recursive:true });
await fs.writeFile(output, JSON.stringify(results,null,2));
await fs.writeFile(output.replace(/\.json$/, '') + '-comparison.json', JSON.stringify({designs:results.length,baselineDesigns:baseline.length,differences},null,2));
console.log(`Verified ${results.length} designs; ${differences.length} new issues or baseline differences`);
if (differences.length) process.exitCode = 1;
