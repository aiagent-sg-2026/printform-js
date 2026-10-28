import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {describe, it, expect} from 'vitest';
const root = path.resolve(import.meta.dirname, '../..');
const source = fs.readFileSync(path.join(root, 'gallery/designs/aster-three-way-match-review-pack.html'), 'utf8');
const doc = new DOMParser().parseFromString(source, 'text/html');
const dir = path.join(root, 'gallery/designs/assets/fonts/aster-v1');
const fonts = {
  'NotoSans-Regular.woff2':'97d815f50e8c21ba906b5f7fc8b7578f3b42b3e343b8fed49c13de29c67e697e',
  'NotoSans-Bold.woff2':'ed815795ac241cc631899cc16b737b1dcecc968a7179851af209ce8220ed1ef0',
  'NotoSansCJKsc-Regular.woff2':'c251539b16999f8cadc16f97402e28252e6051c76670721b7e8461ed40df3b28'
};
describe('Aster bounded shared-font packaging', () => {
  it('references exactly three relative same-origin fonts, not embedded duplicates or CDN', () => {
    const urls = [...doc.querySelector('style').textContent.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);
    expect(urls).toEqual(Object.keys(fonts).map(file => `assets/fonts/aster-v1/${file}`));
    for (const url of urls) expect(fs.existsSync(path.resolve(root, 'gallery/designs', url))).toBe(true);
    expect(source).not.toMatch(/data:font|https?:\/\/[^\s'"<>]+\.woff/);
  });
  it.each(Object.entries(fonts))('preserves exact renamed OFL bytes for %s', (file, hash) => {
    expect(createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex')).toBe(hash);
    expect(fs.existsSync(path.join(root, 'gallery/designs/assets/aster', file))).toBe(false);
  });
  it('keeps the complete original license alongside shared font bytes', () => {
    const license = fs.readFileSync(path.join(dir, 'FONT-LICENSE.txt'));
    expect(createHash('sha256').update(license).digest('hex')).toBe('d5af5686ff42bfbca85ba9427cc5f447daa9a861412b3005a4fea4e544c41ebe');
    expect(source).toContain('Modified Aster families; redundant radical cmap aliases removed');
  });
  it('preserves exact embedded sample and original artwork independent of font URLs', () => {
    const sample = JSON.parse(fs.readFileSync(path.join(root, 'gallery/designs/assets/aster/sample.json')));
    expect(JSON.parse(doc.getElementById('sample-data').textContent)).toEqual(sample);
    const logo = JSON.parse(doc.getElementById('logo-data').textContent);
    expect(Buffer.from(logo.split(',')[1], 'base64').toString('utf8')).toBe(fs.readFileSync(path.join(root, 'gallery/designs/assets/aster/logo.svg'), 'utf8'));
    // Whole-document standalone equality is enforced by verify-aster-packaging;
    // ordinary unit tests must not require an uncommitted output-only artifact.
  });
});
