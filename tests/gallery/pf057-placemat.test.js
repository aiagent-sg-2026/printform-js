import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { filterDesigns } from '../../gallery/js/filter.js';
const root = path.resolve(import.meta.dirname, '../..');
const dir = path.join(root, 'gallery/designs/assets/pf057');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json')));
const source = file => fs.readFileSync(path.join(dir, file), 'utf8');
const context = { window: {} }; vm.createContext(context); vm.runInContext(source('math.js'), context);
const math = context.window.PF057Math;

describe('PF-057 independent integer arithmetic', () => {
  it('has exactly reconciled approved rates and one synchronized numeric source', () => {
    expect(math.validate(data)).toBe(true);
    const results = data.withRebate.flatMap(g => g.tiers.map(t => math.resultingBp(g.baseBp, t.rebateBp)));
    expect(results).toEqual([600, 500, 400, 900, 750]);
    expect(results.map(math.percent)).toEqual(['6.00%', '5.00%', '4.00%', '9.00%', '7.50%']);
    data.withRebate.forEach(g => g.tiers.forEach(t => {
      const result = math.resultingBp(g.baseBp, t.rebateBp);
      // Independent multiplication identity; no floating-point rate comparison.
      expect(result * 10000 + g.baseBp * t.rebateBp).toBe(g.baseBp * 10000);
    }));
    expect(data.withoutRebate.map(n => n.rateBp)).toEqual([750, 550]);
    expect(math.rebatePercent(3750)).toBe('37.5%');
    execFileSync(process.execPath, ['scripts/sync-pf057-data.mjs', '--check'], { cwd: root });
  });
  it('checks rebate boundaries, unsafe numbers and unsupported fractions', () => {
    expect(math.resultingBp(800, 0)).toBe(800);
    expect(math.resultingBp(800, 10000)).toBe(0);
    for (const args of [[-1, 0], [800, 10001], [NaN, 100], [800.5, 2000], [801, 2500], [Number.MAX_SAFE_INTEGER, 1]]) {
      expect(() => math.resultingBp(...args)).toThrow();
    }
    const bad = structuredClone(data); bad.withRebate[0].tiers[1].incomeMinRM++;
    expect(() => math.validate(bad)).toThrow('Non-contiguous');
  });
  it('keeps complete translation keys, math qualifications and sample warnings', () => {
    expect(Object.keys(data.translations.ms).sort()).toEqual(Object.keys(data.translations.en).sort());
    for (const t of Object.values(data.translations)) {
      expect(t.headers).toHaveLength(5); expect(t.benefits).toHaveLength(3);
      expect(t.flat).toContain('APR'); expect(t.offerWarning).toContain('NOT A FINANCIAL OFFER');
    }
    expect(data.website).toMatch(/\.example$/); expect(data.email).toMatch(/\.example$/);
  });
});

describe('PF-057 template and catalogue', () => {
  it('creates real configured sections, grouped HTML tables and original vector assets', () => {
    const dom = new JSDOM('<main id="pf057-root"></main>', { runScripts: 'outside-only' });
    dom.window.PF057_DATA = data;
    for (const file of ['math.js', 'icons.js', 'placemat.js']) dom.window.eval(source(file));
    const document = dom.window.document, forms = [...document.querySelectorAll('.printform')];
    expect(forms.map(n => n.lang)).toEqual(['en', 'ms']);
    for (const form of forms) {
      expect(form.dataset.paperSize).toBe('A4'); expect(Number(form.dataset.papersizeHeight)).toBeCloseTo(297 / 25.4 * 96, 5);
      for (const cls of ['pheader', 'pdocinfo', 'prowitem', 'pfooter']) expect(form.querySelectorAll(`.${cls}`)).toHaveLength(1);
      expect(form.querySelectorAll('.pf057-tiers thead th')).toHaveLength(5);
      expect([...form.querySelectorAll('.pf057-tiers tbody th')].map(n => n.rowSpan)).toEqual([3, 2]);
      expect(form.querySelectorAll('canvas,iframe,a')).toHaveLength(0);
      expect(form.querySelector('.pf057-warning').textContent).toContain('SAMPLE — FICTIONAL FINANCING DEMONSTRATION');
      expect(form.textContent).toContain('NOT A FINANCIAL OFFER');
    }
    for (const file of ['hero.svg', 'mark.svg']) {
      expect(source(file)).toContain('<svg'); expect(source(file)).not.toMatch(/<image|https?:\/\/(?!www\.w3\.org)/);
    }
    dom.window.close();
  });
  it('is searchable in Finance without reclassifying existing templates', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'gallery/manifest.json')));
    const entry = manifest.find(n => n.no === 'PF-057');
    expect(entry).toMatchObject({ paper: 'A4', pages: 2, type: 'Financing Placemat' });
    for (const query of ['PF-057', 'placemat', 'brochure', 'Malay', 'Bahasa Melayu', 'pembiayaan', '英马双语']) {
      expect(filterDesigns(manifest, { category: 'finance', query })).toContainEqual(entry);
    }
    expect(filterDesigns(manifest, { category: 'sales', query: 'PF-057' })).toEqual([]);
  });
});
