import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {describe, it, expect} from 'vitest';
const root = path.resolve(import.meta.dirname, '../..');
const source = fs.readFileSync(path.join(root, 'gallery/designs/atlas-landed-cost-dossier.html'), 'utf8');
const dir = path.join(root, 'gallery/designs/assets/atlas');
const doc = new DOMParser().parseFromString(source, 'text/html');
describe('Atlas shared-font lightweight packaging', () => {
  it('uses only the three unchanged same-origin Aster font assets', () => {
    const urls = [...doc.querySelector('style').textContent.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]);
    expect(urls).toEqual(['NotoSans-Regular.woff2', 'NotoSans-Bold.woff2', 'NotoSansCJKsc-Regular.woff2'].map(file => `assets/fonts/aster-v1/${file}`));
    expect(source).not.toContain('data:font/'); expect(Buffer.byteLength(source)).toBeLessThan(200000);
    expect(doc.querySelectorAll('script[src],link[rel=stylesheet]')).toHaveLength(0);
    expect(doc.querySelector('link[rel=icon]').getAttribute('href')).toBe('data:,');
  });
  it('embeds actual source JSON and original route artwork, not expected allocations', () => {
    expect(JSON.parse(doc.querySelector('#sample-data').textContent)).toEqual(JSON.parse(fs.readFileSync(path.join(dir, 'sample.json'))));
    const artwork = JSON.parse(doc.querySelector('#artwork-data').textContent);
    expect(Buffer.from(artwork.split(',')[1], 'base64').toString()).toBe(fs.readFileSync(path.join(dir, 'route.svg'), 'utf8'));
    expect(source).not.toContain('oracleMethod'); expect(source).not.toContain('defaultScenarios');
  });
  it('retains runtime hash, licenses, accessible native controls and safe initial print state', () => {
    const hash = createHash('sha256').update(doc.querySelector('#engine-source').textContent).digest('hex');
    expect(source).toContain(`Embedded runtime SHA-256: ${hash}`); expect(source).toContain('SIL OPEN FONT LICENSE');
    expect([...doc.querySelectorAll('select')].map(n => n.id)).toEqual(['containers', 'count', 'basis', 'mode', 'scenario', 'notes']);
    for (const control of doc.querySelectorAll('select')) expect(control.closest('label')).not.toBe(null);
    expect(doc.querySelector('#print').disabled).toBe(true); expect(doc.querySelector('#status').getAttribute('aria-live')).toBe('polite');
    expect(doc.querySelector('style').textContent).toContain('min-height:44px');
  });
});
