import { describe,it,expect } from 'vitest';
import { newProject,designOf,compileProject } from '../studio-v3/model.js';
import { formDesign,createBus,designOperations,editProject,alterFields } from '../studio-v3/controller.js';
import { rightView } from '../studio-v3/workspace-views.js';
import { readProject,saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { bindingValidation } from '../studio-v3/validation.js';
import { applyAuthoring } from '../studio-v3/ai-authoring.js';
import { semanticObservation } from '../studio-v3/observation-context.js';
import { elementMetadata,validateElementReferences } from '../studio-v3/ai-element-tags.js';
import { inspectTemplate } from '../studio-v2/core/template-inspection.js';

function supplied() {
  const project=newProject(); project.sampleData.identifiers={code:'00012345-AB',ean:'0123456789012'};
  return project;
}
function bindingForm(project,selected) {
  const host=document.createElement('div'); host.innerHTML=rightView(project,{mode:'design',selected,tab:'binding'});
  return host.querySelector('form[data-form="binding"]');
}
function barcodeDesign(project,pointer='/identifiers/code',format='CODE128') {
  const added=alterFields(project,'footer','add-field'), compiled=compileProject(project,added.design), form=bindingForm(compiled,added.selected);
  form.elements.bindingMode.value='barcode'; form.elements.pointer.value=pointer; form.elements.barcodeFormat.value=format;
  return {design:formDesign(compiled,added.selected,form,'binding'),selected:added.selected};
}

describe('no-code printable barcode authoring',()=> {
  it.each([['CODE128','/identifiers/code','00012345-AB'],['EAN13','/identifiers/ean','0123456789012']])('applies %s with exact string persistence, real bars, history and inspection metadata',async(format,pointer,value)=> {
    const project=supplied(), bus=createBus(project), {design,selected}=barcodeDesign(project,pointer,format);
    await editProject(bus,designOperations(bus.project,design),'human barcode');
    const saved=readProject(saveProject(bus.project)), field=saved.manifest.studioV3.footer.at(-1);
    expect(field).toMatchObject({kind:'barcode',pointer,format:'',text:'',barcode:{format,moduleWidth:2,height:48,displayValue:true}});
    expect(saved.sampleData).toEqual(project.sampleData); expect(bindingValidation(saved).valid).toBe(true);
    const template=document.createElement('template'); template.innerHTML=saved.templateHtml;
    const bound=bindTemplate(template,saved.sampleData,saved.manifest), host=document.createElement('div'); host.append(bound.fragment);
    expect(bound.report.errors).toEqual([]); expect(host.querySelector(`[data-v3-id="${selected}"] svg rect`)).not.toBeNull();
    expect(host.querySelector(`[data-v3-id="${selected}"] svg`).textContent).toContain(value);
    expect(inspectTemplate(saved.templateHtml).bindings.some(binding=>binding.barcode===pointer)).toBe(true);
    expect(saved.spec.components.find(component=>component.id===selected).binding).toEqual({barcode:pointer});
    await bus.navigateHistory('undo',bus.revision); expect(bus.project.manifest.studioV3.footer).toEqual(project.manifest.studioV3.footer);
    await bus.navigateHistory('redo',bus.revision); expect(bus.project.manifest.studioV3.footer.at(-1).barcode.format).toBe(format);
  });
  it.each(['012345678901','0123456789013',123456789012,'0123456789012 ','<svg onload=alert(1)>'])('rejects EAN13 invalid or coerced input %j before commit',async value=> {
    const project=supplied(), bus=createBus(project), {design}=barcodeDesign(project,'/identifiers/ean','EAN13');
    project.sampleData.identifiers.ean=value;
    const invalid=createBus(project);
    await expect(editProject(invalid,designOperations(invalid.project,design),'invalid barcode')).rejects.toThrow();
    expect(invalid.revision).toBe(bus.revision);
  });
  it('does not replace protected financial fields with bars even by changing the target pointer',()=> {
    const project=supplied(), form=bindingForm(project,'totals-total');
    form.elements.bindingMode.value='barcode'; form.elements.pointer.value='/identifiers/code';
    expect(()=>formDesign(project,'totals-total',form,'binding')).toThrow('Protected');
    const design=designOf(project);
    expect(()=>applyAuthoring(design,[{type:'set_field',target:'totals-total',patch:{kind:'barcode',pointer:'/identifiers/code',format:'',barcode:{format:'CODE128',moduleWidth:2,height:48,displayValue:true}}}],project)).toThrow('UNSAFE');
  });
  it('requires explicit barcode options and rejects injected formats, expressions and dimension tampering',()=> {
    const project=supplied(), valid=barcodeDesign(project).design;
    for (const patch of [{format:'QR'},{moduleWidth:0},{moduleWidth:1.5},{height:999},{displayValue:'true'},{fetch:'https://example.invalid'}]) {
      const design=structuredClone(valid); Object.assign(design.footer.at(-1).barcode,patch);
      expect(()=>compileProject(project,design)).toThrow();
    }
    const design=structuredClone(valid); design.footer.at(-1).pointer='/constructor/value'; expect(()=>compileProject(project,design)).toThrow();
  });
  it('includes barcode values only with observation authorization',()=> {
    const project=supplied(), {design,selected}=barcodeDesign(project), compiled=compileProject(project,design);
    const denied=semanticObservation(compiled,{}, {text:false,values:false},[selected]);
    expect(JSON.stringify(denied)).not.toContain('00012345-AB'); expect(JSON.stringify(denied)).not.toContain('/identifiers/code');
    const allowed=semanticObservation(compiled,{}, {text:true,values:true},[selected]);
    expect(allowed.fields.find(field=>field.id===selected).values).toEqual(['00012345-AB']);
    const meta=elementMetadata(compiled,selected); expect(validateElementReferences(compiled,[{...meta,documentId:compiled.manifest.documentId,revision:compiled.revision,comment:''}],compiled.revision)).toHaveLength(1);
  });
});
