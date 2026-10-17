import {describe,it,expect} from 'vitest';
import {bindTemplate} from '../studio-v2/core/binding.js';
import {inspectRenderedDocument} from '../studio-v2/core/acceptance.js';
import {decodeBarcodeSvg} from './support/barcode-decode.js';
import {safeRunDiagnostics} from '../studio-v3/ai-inspection.js';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {bindingValidation} from '../studio-v3/validation.js';

function bind(html,data) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const bound = bindTemplate(template,data);
  const host = document.createElement('div'); host.append(bound.fragment);
  return {...bound,host};
}
describe('shared preview and standalone barcode binding',()=> {
  it('uses exact root and repeated-row pointers and leaves financial text unchanged',()=> {
    const data = {code:'0001234567895',amount:'00012.3400',items:[{code:'00001'},{code:'A<b"&'}]};
    const before = structuredClone(data);
    const result = bind('<div><span data-pf-barcode="/code" data-pf-barcode-format="EAN13"></span><b data-pf-text="/amount"></b><div data-pf-each="/items"><span data-pf-barcode="./code"></span></div></div>',data);
    expect(result.report.errors).toEqual([]); expect(result.report.bindings).toBe(4);
    const svgs = [...result.host.querySelectorAll('svg')];
    expect(svgs.map((svg,i)=>decodeBarcodeSvg(svg,i ? 'CODE128' : 'EAN13'))).toEqual([data.code,...data.items.map(row=>row.code)]);
    expect(result.host.querySelector('b').textContent).toBe('00012.3400');
    expect(data).toEqual(before);
  });
  it('honors persisted dimensions and display-value controls',()=> {
    const result = bind('<span data-pf-barcode="/code" data-pf-barcode-module-width="3" data-pf-barcode-height="80" data-pf-barcode-display-value="false"></span>',{code:'001'});
    expect(result.report.errors).toEqual([]);
    const svg = result.host.querySelector('svg');
    expect(svg.querySelector('text')).toBeNull(); expect(Number(svg.getAttribute('height'))).toBe(100);
    expect(svg.querySelector('g rect').getAttribute('height')).toBe('80');
    expect(decodeBarcodeSvg(svg,'CODE128')).toBe('001');
  });
  it.each([
    ['data-pf-barcode="/missing"',{},'MISSING_BINDING'],
    ['data-pf-barcode="/code"',{code:123},'BARCODE_VALUE'],
    ['data-pf-barcode="/code"',{code:'A'.repeat(129)},'BARCODE_VALUE'],
    ['data-pf-barcode="/code" data-pf-barcode-format="EAN13"',{code:'400638133393'},'BARCODE_VALUE'],
    ['data-pf-barcode="/code" data-pf-barcode-format="EAN13"',{code:'4006381333930'},'BARCODE_CHECKSUM'],
    ['data-pf-barcode="/code" data-pf-barcode-format="CODE39"',{code:'0001'},'BARCODE_FORMAT'],
    ['data-pf-barcode="/code" data-pf-barcode-module-width=""',{code:'0001'},'BARCODE_CONFIG'],
    ['data-pf-barcode="/code" data-pf-barcode-height="1e2"',{code:'0001'},'BARCODE_CONFIG'],
    ['data-pf-barcode="/code" data-pf-barcode-display-value="yes"',{code:'0001'},'BARCODE_CONFIG'],
    ['data-pf-barcode="/code" data-pf-text="/other"',{code:'0001',other:'replacement'},'BARCODE_CONFIG'],
    ['data-pf-barcode="/code" data-pf-format="currency"',{code:'0001'},'BARCODE_CONFIG'],
    ['data-pf-barcode="/code" data-pf-href="/url"',{code:'0001',url:'https://example.com'},'BARCODE_CONFIG']
  ])('fails closed with located errors: %s',(attributes,data,code)=> {
    const result = bind(`<span data-pf-component-id="barcode-test" ${attributes}>Do not print this stale symbol<svg></svg></span>`,data);
    expect(result.report.errors).toContainEqual(expect.objectContaining({code,component:'barcode-test'}));
    expect(result.host.querySelector('span').childNodes).toHaveLength(0);
    const message = 'PRIVATE_DIAGNOSTIC_MESSAGE', source = 'PRIVATE_SOURCE_PAYLOAD';
    const error = {...result.report.errors[0],message,value:source,sourceData:data};
    const issue = {...error,component_id:'PRIVATE_COMPONENT',text:source,selector:'/private/source'};
    for (const input of [
      {quality:{errors:[error]},report:{issues:[issue]}},
      {validation:{errors:[error]},issues:[issue]},
    ]) {
      const diagnostics = safeRunDiagnostics(input,{spec:{components:[]}});
      expect(diagnostics.errors).toEqual([code]);
      expect(diagnostics.issues).toEqual([{code,measured:{},available:{}}]);
      const serialized = JSON.stringify(diagnostics);
      for (const secret of [message,source,'PRIVATE_COMPONENT','/private/source',...Object.values(data).map(String)]) {
        expect(serialized).not.toContain(secret);
      }
      expect(serialized).not.toContain(error.path);
    }
  });
  it('respects conditional exclusion before trying to encode a missing value',()=> {
    const result = bind('<span data-pf-if="/show" data-pf-barcode="/missing"></span>',{show:false});
    expect(result.report.errors).toEqual([]); expect(result.host.children).toHaveLength(0);
  });
  it('includes generated barcode SVG in the existing horizontal overflow gate',()=> {
    const doc = document.implementation.createHTMLDocument('Barcode overflow');
    doc.documentElement.lang = 'en';
    const page = doc.createElement('section'); page.className = 'printform_page';
    page.getBoundingClientRect = ()=>({left:0,right:100,top:0,bottom:100,width:100,height:100});
    const svg = doc.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('data-pf-barcode-svg','CODE128');
    svg.getBoundingClientRect = ()=>({left:0,right:1010,top:0,bottom:80,width:1010,height:80});
    page.append(svg); doc.body.append(page);
    expect(inspectRenderedDocument(doc,{}).errors).toContainEqual(expect.objectContaining({code:'HORIZONTAL_OVERFLOW'}));
  });
  it('scrubs actual unexpected barcode encoding exceptions without exposing their messages',()=> {
    const message = 'PRIVATE_ENCODER_MESSAGE', pointer = '/privateCode';
    const data = Object.defineProperty({},'privateCode',{get(){throw new Error(message);}});
    const result = bind(`<span data-pf-barcode="${pointer}"></span>`,data);
    expect(result.report.errors[0]).toMatchObject({code:'BARCODE_ENCODING',message,path:pointer});
    const diagnostics = safeRunDiagnostics({validation:{errors:result.report.errors}});
    expect(diagnostics.errors).toEqual(['BARCODE_ENCODING']);
    expect(JSON.stringify(diagnostics)).not.toContain(message);
    expect(JSON.stringify(diagnostics)).not.toContain(pointer);
  });
  it('preserves V3 barcode and supplied-primary currency diagnostics without source facts',()=> {
    const source = newProject(), design = designOf(source);
    const rawBarcode = 'PRIVATE_BARCODE_非ASCII', pointer = '/privateIdentifier';
    design.footer.push({id:'barcode',label:'PRIVATE_LABEL',kind:'barcode',pointer,format:'',
      barcode:{format:'CODE128',moduleWidth:2,height:48,displayValue:true}});
    const project = compileProject(source,design);
    project.sampleData.privateIdentifier = rawBarcode;
    project.manifest.currency = 'MYR';
    project.sampleData.document.currency = 'JPY';
    const validation = bindingValidation(project);
    expect(validation.errors.map(error=>error.code)).toEqual(['SOURCE_CURRENCY_MISMATCH','BARCODE_INVALID']);
    const message = 'PRIVATE_VALIDATOR_MESSAGE';
    const errors = validation.errors.map(error=>({...error,message,value:rawBarcode,sourceData:project.sampleData}));
    for (const input of [{quality:{errors}},{validation:{errors}}]) {
      const diagnostics = safeRunDiagnostics(input,project);
      expect(diagnostics.errors).toEqual(['SOURCE_CURRENCY_MISMATCH','BARCODE_INVALID']);
      const serialized = JSON.stringify(diagnostics);
      for (const secret of [rawBarcode,pointer,message,'PRIVATE_LABEL','MYR','JPY','sourceData',project.sampleData.company.name]) {
        expect(serialized).not.toContain(secret);
      }
    }
  });
  it.each(['BARCODE_PRIVATE_VALUE','BARCODE_INVALID_PRIVATE','SOURCE_CURRENCY_PRIVATE','PRIVATE_CODE'])('does not widen diagnostic prefixes: %s',code=> {
    const diagnostics = safeRunDiagnostics({quality:{errors:[{code,message:'PRIVATE_MESSAGE'}]},
      report:{issues:[{code,path:'/private/source',value:'PRIVATE_BARCODE'}]}});
    expect(diagnostics.errors).toEqual(['VALIDATION_BLOCKED']);
    expect(diagnostics.issues).toEqual([{code:'VALIDATION_BLOCKED',measured:{},available:{}}]);
    expect(JSON.stringify(diagnostics)).not.toMatch(/PRIVATE|private/);
  });
});
