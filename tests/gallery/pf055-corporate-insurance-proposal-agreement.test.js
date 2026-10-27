import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { categoryOf } from '../../gallery/js/categories.js';
import { filterDesigns } from '../../gallery/js/filter.js';

const root = path.resolve(import.meta.dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('gallery/designs/corporate-insurance-proposal-agreement.html');
const manifest = JSON.parse(read('gallery/manifest.json'));

describe('PF055 fictional Corporate Insurance Proposal and Agreement', () => {
  it('integrates the A4 sample into sales with consistent approved naming', () => {
    const design = manifest.find(n => n.no === 'PF-055');
    expect(design).toMatchObject({ id:'corporate-insurance-proposal-agreement',paper:'A4',type:'Proposal and Agreement',pages:20,
      title:{ en:'Corporate Insurance Proposal and Agreement',zh:'企业保险方案及协议' } });
    expect(categoryOf(design)).toBe('sales');
    for (const query of ['PF-055','corporate','insurance','proposal','agreement','企业保险方案及协议','pink','mixed-flow','appendix']) {
      expect(filterDesigns(manifest, { category:'sales',query })).toContainEqual(design);
    }
    expect(filterDesigns(manifest, { category:'purchasing',query:'PF-055' })).toEqual([]);
    expect(html).toContain('<h1>Corporate Insurance<br>Proposal and Agreement</h1>');
    expect(html).toContain('not a verified legal contract');
    const authored = html + ['-content.js','.js','.css'].map(suffix =>
      read(`gallery/designs/assets/corporate-insurance-proposal-agreement${suffix}`)).join('');
    expect(authored + JSON.stringify(design)).not.toMatch(/purchase|procurement|\bPO\b|DEMO-PO/i);
    expect(html).toContain('NOT A POLICY'); expect(html).toContain('No affiliation with, or endorsement by, any insurer');
    expect(html).not.toMatch(/https?:\/\//);
  });
  it('constructs complete ordered content with signature before the long appendix and no authored pages', () => {
    const dom = new JSDOM(html, { runScripts:'outside-only' });
    try {
      for (const file of ['corporate-insurance-proposal-agreement-content.js','corporate-insurance-proposal-agreement.js']) {
        dom.window.eval(read(`gallery/designs/assets/${file}`));
      }
      const doc = dom.window.document;
      const ids = Array.from(doc.querySelectorAll('[data-content-id]'), n => n.dataset.contentId);
      expect(ids.length).toBe(204); expect(new Set(ids).size).toBe(ids.length);
      expect(ids.indexOf('signature')).toBeLessThan(ids.indexOf('appendix-001'));
      expect(ids.at(-1)).toBe('document-end');
      for (const [id,count] of [['benefit',28],['package',22],['supplement',20]]) {
        expect(doc.querySelectorAll(`.prowitem[data-pf-table-id="${id}"]`)).toHaveLength(count);
        expect(doc.querySelector(`.prowheader[data-pf-table-id="${id}"]`).dataset.pfKeepWithNext).toBe('true');
      }
      expect(doc.querySelector('[data-pf-columns="2"]').children).toHaveLength(36);
      expect(ids.filter(id => /^appendix-\d/.test(id))).toHaveLength(60);
      expect(doc.querySelectorAll('.printform_page,.tb_page_break_before')).toHaveLength(0);
    } finally { dom.window.close(); }
  });
});
