import {describe,it,expect} from 'vitest';
import {businessDemoInput} from '../studio-v3/business-document-demos.js';
import {createBusinessDocumentProject} from '../studio-v3/business-document-project.js';
import {designOf} from '../studio-v3/model.js';
import {createDraft} from '../studio-v3/agent-draft.js';

const cases = [
  ['PurchaseRequisition','/requisition/status/value'],
  ['MaintenanceWorkOrder','/maintenance/asset/serialNumber']
];

describe('new supplied business context remains source-bound',()=> {
  it.each(cases)('%s permits label styling, not fabricated facts or another source', (kind,pointer)=> {
    const project = createBusinessDocumentProject(businessDemoInput(kind));
    const original = designOf(project).customer.find(field=>field.pointer === pointer);
    const before = structuredClone(project), draft = createDraft(project);
    const target = `customer-${original.id}`;
    draft.apply('Style the supplied context label', [{type:'set_field',target,patch:{label:'Source reference',labelStyle:{bold:true}}}]);
    const valid = draft.project;
    for(const patch of [{kind:'static',pointer:'',text:'INVENTED APPROVAL OR ID',format:''},{pointer:'/document/number'}]) {
      expect(()=>draft.apply('Replace supplied fact',[{type:'set_field',target,patch}])).toThrow();
      expect(draft.project).toBe(valid);
      expect(draft.count).toBe(1);
      expect(draft.project.sampleData).toEqual(before.sampleData);
    }
    expect(designOf(draft.project).customer.find(field=>field.id === original.id)).toMatchObject({pointer,label:'Source reference',labelStyle:{bold:true}});
    expect(project).toEqual(before);
  });

  it.each(cases)('%s rejects source substitution after removal and restores the original through Undo', (kind,pointer)=> {
    const project = createBusinessDocumentProject(businessDemoInput(kind));
    const original = structuredClone(designOf(project).customer.find(field=>field.pointer === pointer));
    const draft = createDraft(project), target = `customer-${original.id}`;
    draft.apply('Remove context field',[{type:'remove_field',target}]);
    const removed = draft.project;
    expect(()=>draft.apply('Re-add an unrelated fact',[{type:'add_field',section:'customer',field:{...original,pointer:'/document/number'}}])).toThrow();
    expect(draft.project).toBe(removed);
    expect(draft.undo()).toBe(true);
    expect(designOf(draft.project).customer.find(field=>field.id === original.id)).toEqual(original);
    expect(draft.project.sampleData).toEqual(project.sampleData);
    expect(draft.project).toBe(project);
  });
});
