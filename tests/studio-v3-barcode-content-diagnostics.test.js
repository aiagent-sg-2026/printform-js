import { describe,it,expect } from 'vitest';
import { safeRunDiagnostics } from '../studio-v3/ai-inspection.js';
import { newProject } from '../studio-v3/model.js';

// Projection-policy inputs, not DOM geometry or evidence that any barcode fits.
// Real layout regression coverage is in e2e/studio-v3-barcode-overflow.spec.js.
describe('bounded barcode content overflow diagnostics',()=> {
  it('preserves the exact gate code but never forwards private source/messages/selectors',()=> {
    const project=newProject(), secret='PRIVATE-00012345-CONTENT';
    const issue={code:'BARCODE_CONTENT_OVERFLOW',component_id:'items-sku',pageIndex:0,measured_size:{width:242,height:88},available_size:{width:98,height:88},message:secret,text:secret,selector:`[data-secret="${secret}"]`,source:secret};
    const result=safeRunDiagnostics({report:{status:'blocked',validation:{errors:[issue]},issues:[issue],metrics:{barcodeContentOverflows:1,privateValue:secret}}},project);
    expect(result.ready).toBe(false); expect(result.errors).toEqual(['BARCODE_CONTENT_OVERFLOW']);
    expect(result.issues).toEqual([{code:'BARCODE_CONTENT_OVERFLOW',componentId:'items-sku',pageIndex:0,measured:{width:242,height:88},available:{width:98,height:88}}]);
    expect(result.metrics).toEqual({barcodeContentOverflows:1});
    expect(JSON.stringify(result)).not.toContain(secret); expect(JSON.stringify(result)).not.toContain('selector');
  });
  it('does not accept arbitrary diagnostic prefixes or source-owned component IDs',()=> {
    const issue={code:'BARCODE_CONTENT_OVERFLOW_PRIVATE',component_id:'private-source',measured_size:{width:Infinity,height:-1},available_size:{width:'98',height:NaN}};
    const result=safeRunDiagnostics({quality:{ready:false,errors:[issue]},report:{issues:[issue]}},newProject());
    expect(result.errors).toEqual(['VALIDATION_BLOCKED']);
    expect(result.issues).toEqual([{code:'VALIDATION_BLOCKED',measured:{},available:{}}]);
  });
});
