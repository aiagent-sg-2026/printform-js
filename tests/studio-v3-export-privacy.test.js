import { expect, it } from 'vitest';
import { createBus, replaceData } from '../studio-v3/controller.js';
import { createImportReview, previewImport } from '../studio-v3/structured-import-model.js';
import { importReceipt } from '../studio-v3/structured-import-receipt.js';
import { exportProject, projectForSharing, readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { generalImportProject } from './fixtures/structured-import-general.js';

const source='code,quantity,uom,private\n00007,-001.250,kg,PRIVATE_UNMAPPED_CANARY_8391\n';
const filename='PRIVATE_SOURCE_FILENAME_2841.csv';
const mappings={
  '/code':{source:'/code',conversion:'preserve'},
  '/quantity':{source:'/quantity',conversion:'preserve'},
  '/uom':{source:'/uom',conversion:'preserve'}
};
async function imported() {
  const bus=createBus(generalImportProject()), review=createImportReview(bus.project,source,filename);
  review.targetPointer='/records'; review.mappings=mappings;
  const preview=previewImport(bus.project,review), receipt=importReceipt(review,preview);
  await replaceData(bus,preview.data,'erp',null,{kind:'imported-data',name:`Local file: ${filename}`},undefined,undefined,receipt);
  return bus;
}
function printed(project) {
  const template=document.createElement('template'); template.innerHTML=project.templateHtml;
  return bindTemplate(template,project.sampleData,project.manifest).fragment.textContent;
}
const snapshot = bus => ({project:structuredClone(bus.project),entries:structuredClone(bus.history.entries),cursor:bus.history.cursor,revision:bus.revision});
function expectPrivateFree(text) {
  expect(text).not.toContain('PRIVATE_UNMAPPED_CANARY_8391'); expect(text).not.toContain(filename);
}

it('keeps ordinary Save/Open source-preserving while an explicit share copy reopens with exact mapped/live data',async()=> {
  const bus=await imported(), before=snapshot(bus), portable=saveProject(bus.project), shared=saveProject(bus.project,{omitSource:true});
  expect(portable).toContain('PRIVATE_UNMAPPED_CANARY_8391'); expect(portable).toContain(filename);
  expect(readProject(portable).manifest.localImport.sourceText).toBe(source);
  expect(readProject(portable).manifest.localImport.filename).toBe(filename);
  expectPrivateFree(shared);
  const copy=readProject(shared), ordinary=readProject(portable);
  expect(copy.manifest.localImport).toBeUndefined();
  expect(copy.sampleData).toEqual(ordinary.sampleData); expect(copy.schema).toEqual(ordinary.schema);
  expect(copy.sampleData.records[0]).toEqual({code:'00007',quantity:'-001.250',uom:'kg'});
  expect(printed(copy)).toContain('00007'); expect(printed(copy)).toContain('-001.250');
  expect(copy.sampleData.workOrder.instruction).toBe(before.project.sampleData.workOrder.instruction);
  expect(snapshot(bus)).toEqual(before);
  await bus.navigateHistory('undo',bus.revision); expect(bus.project.manifest.localImport).toBeFalsy();
  await bus.navigateHistory('redo',bus.revision); expect(bus.project.manifest.localImport.sourceText).toBe(source);
});
it('omits the receipt/session only, never deleting source-like strings that are actual live data or printed text',async()=> {
  const bus=await imported(); bus.project.sampleData.workOrder.instruction=`Live authorized text: ${filename}`;
  const before=structuredClone(bus.project), copy=projectForSharing(bus.project);
  expect(copy.manifest.localImport).toBeUndefined(); expect(copy.studioV3Session).toBeUndefined();
  expect(copy.sampleData).toEqual(before.sampleData); expect(copy.manifest.studioV3).toEqual(before.manifest.studioV3);
  expect(printed(copy)).toContain(filename); expect(bus.project).toEqual(before);
});
it('does not bypass the current render validation gate for share HTML',async()=> {
  const bus=await imported(), before=snapshot(bus);
  await expect(exportProject(bus.project,null,{omitSource:true})).rejects.toThrow('Render and resolve');
  expect(snapshot(bus)).toEqual(before);
});
