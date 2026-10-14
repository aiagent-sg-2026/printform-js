import {describe,it,expect} from 'vitest';
import {newDemoProject} from '../studio-v3/demo-templates.js';
import {demoDataForKind} from '../studio-v3/demo-catalog.js';
import {scenarioCandidate,SCENARIO_IDS} from '../studio-v3/scenario-matrix.js';
import {bindingValidation} from '../studio-v3/validation.js';
import {bindTemplate} from '../studio-v2/core/binding.js';

describe('exact-kind business layout scenarios',()=> {
  for (const kind of ['BankPayment','BankReceipt','ProgressClaim','CertifiedClaim','PCAR','CCAR']) {
    it(`${kind} preserves supplied business fields and binds every selected scenario`,()=> {
      const project=newDemoProject(kind), original=structuredClone(project), fixture=demoDataForKind(kind);
      project.sampleData.notes='Private ERP note must not enter synthetic candidates';
      for (const id of SCENARIO_IDS) {
        const candidate=scenarioCandidate(project,id), data=candidate.sampleData;
        expect(data.items).toHaveLength(id==='long' ? 45 : Number(id));
        expect(data.document).toEqual(fixture.document);
        expect(data.summary).toEqual(fixture.summary);
        expect(data.parentDocuments).toEqual(fixture.parentDocuments);
        expect(data.notes).toBe(fixture.notes);
        for (const key of ['bank','cashMovement','allocations','project','claim','certification']) expect(data[key]).toEqual(fixture[key]);
        expect(bindingValidation(candidate).errors).toEqual([]);
        const template=document.createElement('template');template.innerHTML=candidate.templateHtml;
        const bound=bindTemplate(template,data,candidate.manifest);
        expect(bound.report.errors).toEqual([]);
        expect(bound.report.tableRows).toBe(data.items.length);
        data.items.forEach((row,index)=> {
          const supplied=fixture.items[index%fixture.items.length];
          for (const key of Object.keys(supplied).filter(key=>!['no','description'].includes(key))) expect(row[key]).toEqual(supplied[key]);
        });
      }
      expect(project.sampleData.items).toEqual(original.sampleData.items);
      expect(project.sampleData.summary).toEqual(original.sampleData.summary);
    });
  }
  it('does not replace an unknown exact kind with invoice data',()=> {
    const project=newDemoProject('PCAR');project.sampleData.document.kind='UnregisteredClaim';
    expect(()=>scenarioCandidate(project,'45')).toThrow();
  });
  it('reports custom paths missing rather than borrowing private source fields',()=> {
    const project=newDemoProject('BankPayment');
    project.manifest.studioV3.header.push({id:'private',label:'Private',pointer:'/bank/privateReference'});
    project.sampleData.bank.privateReference='Private reference';
    expect(bindingValidation(scenarioCandidate(project,'1')).errors).toContainEqual(expect.objectContaining({code:'MISSING_FIELD',path:'/bank/privateReference'}));
  });
});
