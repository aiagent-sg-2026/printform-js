import { describe, it, expect } from 'vitest';
import { newProject, sampleData, compileProject, designOf } from '../studio-v3/model.js';
import { validateProject } from '../studio-v2/core/acceptance.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { createBus, editProject, designOperations } from '../studio-v3/controller.js';
import { inspectProject, bindingValidation, validatePaperReport } from '../studio-v3/validation.js';
import { readProject, saveProject, validateDesign } from '../studio-v3/file-io.js';

describe('Studio v3 ERP authoring', () => {
  it.each(['invoice','purchase','delivery'])('creates a valid %s with a canonical registry and supplied amounts', type => {
    const p = newProject(type);
    expect(validateProject(p).errors).toEqual([]);
    expect(bindingValidation(p).valid).toBe(true);
    expect(p.spec.mode).toBe('canonical');
    const supplied = structuredClone(p.sampleData);
    supplied.summary.total = 99123; supplied.items[0].amount = 317;
    p.sampleData = supplied;
    expect(validateProject(p).errors).toEqual([]);
    expect(bindingValidation(p).valid).toBe(true);
    const template = document.createElement('template'); template.innerHTML = p.templateHtml;
    const bound = bindTemplate(template,supplied,p.manifest);
    expect(bound.report.tableRows).toBe(45);
    if (type !== 'delivery') expect(bound.fragment.querySelector('[data-v3-id="totals-total"]').textContent).toContain('99,123');
    expect(p.sampleData.summary.total).toBe(99123);
  });
  it.each([0,1,45,100,500])('binds exactly %i rows without a row-count pagination shortcut', rows => {
    const p = newProject(); p.sampleData = sampleData('invoice',rows);
    expect(validateProject(p).valid).toBe(true);
    const template = document.createElement('template'); template.innerHTML = p.templateHtml;
    const bound = bindTemplate(template,p.sampleData,p.manifest);
    expect(bound.report.tableRows).toBe(rows);
    expect(bound.fragment.querySelectorAll('.prowitem')).toHaveLength(rows);
    expect([...bound.fragment.querySelectorAll('.prowitem')].map(n => Number(n.dataset.pfRowIndex))).toEqual(Array.from({length:rows},(_,i) => i));
  });
  it('blank -> structure -> edit -> undo/redo -> save/reopen preserves bindings and fields', async () => {
    const bus = createBus(newProject('invoice',true));
    const d = designOf(bus.project); d.blocks.header.enabled = true; d.title = 'Custom invoice';
    await editProject(bus,designOperations(bus.project,d),'header');
    expect(bus.project.templateHtml).toContain('Custom invoice');
    await bus.navigateHistory('undo',bus.revision);
    expect(designOf(bus.project).blocks.header.enabled).toBe(false);
    await bus.navigateHistory('redo',bus.revision);
    const opened = readProject(saveProject(bus.project));
    expect(designOf(opened)).toEqual(designOf(bus.project));
    expect(opened.sampleData).toEqual(bus.project.sampleData);
    expect(opened.spec.components.some(c => c.id === 'header-company')).toBe(true);
  });
  it('binds an alternate collection and reports missing fields and bad numeric types', () => {
    let p = newProject(); const d = designOf(p); d.collection = '/lines';
    p.sampleData.lines = p.sampleData.items; delete p.sampleData.items;
    p = compileProject(p,d);
    expect(bindingValidation(p).valid).toBe(true);
    delete p.sampleData.lines[0].description;
    p.sampleData.lines[1].amount = '250';
    const report = bindingValidation(p);
    expect(report.errors.map(e => e.code)).toContain('MISSING_FIELD');
    expect(report.errors.map(e => e.code)).toContain('NUMBER_REQUIRED');
    expect(report.errors[0].path).toBe('/lines/0/description');
  });
  it('rejects hostile project settings and preserves text as inert content', () => {
    const p = newProject(), d = designOf(p);
    d.header[0].pointer = ''; d.header[0].text = '<img src=x onerror=alert(1)><script>bad()</script>';
    const safe = compileProject(p,d);
    expect(safe.templateHtml).toContain('&lt;script&gt;');
    expect(validateProject(safe).valid).toBe(true);
    for (const pointer of ['/items/*','/__proto__/x','./constructor/x']) {
      const hostile = designOf(p); hostile.collection = pointer;
      expect(() => validateDesign(hostile)).toThrow();
    }
    const hostile = JSON.parse(saveProject(p)); hostile.project.manifest.studioV3.columns[0].width = 100000;
    expect(() => readProject(JSON.stringify(hostile))).toThrow();
  });
  it('never lets a static pass substitute for the current browser render', () => {
    const p = newProject();
    expect(inspectProject(p).ready).toBe(false);
    expect(inspectProject(p,{status:'blocked',validation:{errors:[],warnings:[]}}).ready).toBe(false);
    const overflowing = validatePaperReport({status:'ready',validation:{errors:[]},pageGeometry:[{width:794,height:21012,pageIndex:1}],metrics:{verticalOverflowPages:0}});
    expect(overflowing.status).toBe('blocked');
    expect(overflowing.validation.errors[0].code).toBe('PAPER_SIZE_OVERFLOW');
  });
});
