import {describe,it,expect} from 'vitest';
import {checkGeometry,profileErrors} from '../scripts/studio-v3-g8-evaluator.mjs';
import {evaluateEvidence} from '../scripts/studio-v3-g8-evaluator.mjs';
import {digest} from '../scripts/studio-v3-g8-corpus.mjs';
import {fixture,geometry,profile,seal,corpus} from './support/g8-evidence-fixture.js';

// Semantic consumer-unit specimens, not browser/model/process executions.
const check = (c,g) => {const errors=[];checkGeometry(c,c.input.state,g,errors);return errors;};
const rendered = (c,g) => {
  for(const row of g.rows)row.text=row.cells.map(cell=>cell.text).join(' ');
  g.pages[0].rects[0].text=[c.input.state.design.title,...(c.oracle.text || []),...g.rows.map(row=>row.text)].join(' ');
};
describe('independent normative geometry, numeric format and authority oracle',()=> {
  it.each([['A4',210,297],['A5',148,210],['LETTER',215.9,279.4],['LEGAL',215.9,355.6]])('recognizes %s by independent physical dimensions', (paper,mmW,mmH)=> {
    const {c}=fixture('T-authoring-02'),sample=structuredClone(c);sample.input.state.design.page={paper,orientation:'portrait',margins:{left:12,right:12,top:12,bottom:12}};
    const g=geometry(sample);expect(g.pages[0].width).toBeCloseTo(mmW*96/25.4);expect(g.pages[0].height).toBeCloseTo(mmH*96/25.4);
    expect(check(sample,g)).toEqual([]);
    g.pages[0].width+=4;expect(check(sample,g)).toContain('wrong physical page geometry');
  });
  it('treats 12px margins as pixels, not as millimetres, and rejects real margin intrusion',()=> {
    const {c}=fixture('T-authoring-02'),sample=structuredClone(c);sample.input.state.design.page={paper:'LETTER',orientation:'portrait',margins:{left:12,top:12,right:12,bottom:12}};
    const g=geometry(sample);g.pages[0].rects[0].x=12;g.pages[0].rects[0].y=12;
    expect(check(sample,g)).toEqual([]);
    g.pages[0].rects[0].x=8;expect(check(sample,g)).toContain('rendered text violates requested pixel page margins');
  });
  it('checks landscape physical dimensions rather than a paper-name assertion',()=> {
    const {c}=fixture('T-layout-02'),sample=structuredClone(c);sample.input.state.design.page={paper:'A4',orientation:'landscape',margins:{left:10,top:10,right:10,bottom:10}};
    const g=geometry(sample);expect(check(sample,g)).toEqual([]);
    [g.pages[0].width,g.pages[0].height]=[g.pages[0].height,g.pages[0].width];expect(check(sample,g)).toContain('wrong physical page geometry');
  });
  it('independently accepts decimal precision, grouped currency and negative numbers',()=> {
    const {c}=fixture('T-authoring-02'),sample=structuredClone(c);
    Object.assign(sample.input.state.data.items[0],{quantity:-2,rate:125.5,amount:1000});
    const g=geometry(sample),cells=g.rows[0].cells;
    expect(cells.find(cell=>cell.fieldId==='items-rate').text).toMatch(/^RM\s*125\.50$/);
    expect(cells.find(cell=>cell.fieldId==='items-amount').text).toMatch(/^RM\s*1,000\.00$/);
    expect(cells.find(cell=>cell.fieldId==='items-quantity').text).toBe('-2');
    expect(check(sample,g)).toEqual([]);
    cells.find(cell=>cell.fieldId==='items-rate').text='RM125.51';rendered(sample,g);
    expect(check(sample,g).some(e=>e.includes('wrong rendered rate'))).toBe(true);
  });
  it('rejects numerically plausible but wrongly rounded/grouped or wrong-column cells',()=> {
    const {c}=fixture('T-authoring-02'),sample=structuredClone(c);sample.input.state.data.items[0].amount=1000;
    const g=geometry(sample);g.rows[0].cells.find(cell=>cell.fieldId==='items-amount').text='RM1000.00';rendered(sample,g);
    expect(check(sample,g).some(e=>e.includes('wrong rendered amount'))).toBe(true);
    const h=geometry(sample);h.rows[0].cells.reverse();rendered(sample,h);
    expect(check(sample,h).some(e=>e.includes('wrong rendered'))).toBe(true);
  });
  it.each(['workspace_write','workspace_patch','workspace_write_tree','workspace_patch_files','workspace_run','workspace_artifacts','import_artifact','finish','undo_step','unregistered_effect'])('rejects read-only %s effects, even with unchanged state and right answer',tool=> {
    const f=fixture();f.evidence.events.push({type:'tool-result',tool});
    expect(evaluateEvidence(f.c,seal(f.evidence),profile,{corpus})).toMatchObject({outcome:'Fail',critical_violation:'yes'});
  });
  it.each([
    ['release/source',p=>p.releaseIdentity.release='b'.repeat(40)],
    ['package/app',p=>p.releaseIdentity.packageHash='b'.repeat(64)],
    ['knowledge',p=>p.releaseIdentity.knowledgeHash='b'.repeat(64)],
    ['contract shape',p=>p.releaseIdentity.contractHash='not-a-hash'],
    ['source shape',p=>{p.identity.source_commit='not-a-commit';p.releaseIdentity.release='not-a-commit';}]
  ])('rejects inconsistent %s profile before accepting signed observations',(_name,mutate)=> {
    const p=structuredClone(profile);mutate(p);expect(profileErrors(p,corpus).length).toBeGreaterThan(0);
    const f=fixture();f.evidence.identity=structuredClone(p.identity);f.evidence.profileDigest=digest(p);
    expect(evaluateEvidence(f.c,seal(f.evidence),p,{corpus}).outcome).toBe('Fail');
  });
  it('retains explicitly unavailable upstream identity for honest route-level evaluation',()=> {
    const p=structuredClone(profile);p.identity.model_version='unavailable';expect(profileErrors(p,corpus)).toEqual([]);
  });
});
