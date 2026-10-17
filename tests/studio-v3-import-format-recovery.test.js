import { afterEach, expect, it } from 'vitest';
import { newProject } from '../studio-v3/model.js';
import { createBus } from '../studio-v3/controller.js';
import { createImportReview, previewImport } from '../studio-v3/structured-import-model.js';
import { importReviewSnapshot, restoreImportReview } from '../studio-v3/structured-import-recovery.js';
import { importReceipt } from '../studio-v3/structured-import-receipt.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { createUpdateWork, RECOVERY_KEY } from '../studio-v3/update-work.js';

afterEach(()=> { sessionStorage.clear(); document.body.innerHTML=''; });
function headerReview(project,text,filename,source='/{code}') {
  const review=createImportReview(project,text,filename);
  review.targetPointer=''; review.mappings={'/customer/name':{source,conversion:'preserve'}};
  review.preview=previewImport(project,review);
  return review;
}

it('recovers suffix-truncated CSV whose literal header conflicts with JSON sniffing, then previews and saves exact data',()=> {
  const project=newProject(), before=structuredClone(project), filename='a'.repeat(241)+'.csv', text='{code}\n00007\n';
  const review=headerReview(project,text,filename), snapshot=importReviewSnapshot(review);
  expect(review.source.format).toBe('csv'); expect(review.source.filename).toBe(filename.slice(0,240));
  const restored=restoreImportReview(project,JSON.parse(JSON.stringify(snapshot)));
  expect(restored.source.format).toBe('csv'); expect(restored.source.filename).toBe(filename.slice(0,240));
  expect(restored.source.filename).not.toBe('local.csv'); expect(restored.source.text).toBe(text);
  expect(restored.source.data).toEqual([{'{code}':'00007'}]); expect(restored.preview).toBeNull();
  const preview=previewImport(project,restored), receipt=importReceipt(restored,preview);
  const candidate={...project,sampleData:preview.data,manifest:{...project.manifest,localImport:receipt}};
  const reopened=readProject(saveProject(candidate));
  expect(reopened.sampleData.customer.name).toBe('00007');
  expect(reopened.manifest.localImport).toMatchObject({format:'csv',filename:filename.slice(0,240),sourceText:text});
  expect(project).toEqual(before);
});
it.each([
  ['csv','\uFEFF{code}\r\n00007.500\r\n','a'.repeat(241)+'.csv','/{code}','00007.500'],
  ['json','\uFEFF{"code":9007199254740993,"decimal":1.2300}','b'.repeat(241)+'.json','/code','9007199254740993']
])('retains %s original BOM/text and numeric spelling through review recovery and portable receipt', (format,text,filename,source,expected)=> {
  const project=newProject(), review=headerReview(project,text,filename,source);
  const restored=restoreImportReview(project,JSON.parse(JSON.stringify(importReviewSnapshot(review))));
  expect(restored.source.format).toBe(format); expect(restored.source.text).toBe(text); expect(restored.preview).toBeNull();
  const preview=previewImport(project,restored), receipt=importReceipt(restored,preview);
  expect(preview.data.customer.name).toBe(expected);
  if (format==='json') expect(restored.source.data.decimal).toBe('1.2300');
  const reopened=readProject(saveProject({...project,sampleData:preview.data,manifest:{...project.manifest,localImport:receipt}}));
  expect(reopened.manifest.localImport.sourceText).toBe(text); expect(reopened.manifest.localImport.format).toBe(format);
  expect(reopened.sampleData.customer.name).toBe(expected);
});
it.each(['yaml','CSV','JSON','',null,7,undefined])('rejects unsupported or missing saved formats without changing committed source: %s',format=> {
  const project=newProject(), before=structuredClone(project), snapshot=importReviewSnapshot(headerReview(project,'{code}\n00007\n','a'.repeat(241)+'.csv'));
  if (format===undefined) delete snapshot.format; else snapshot.format=format;
  expect(()=>restoreImportReview(project,snapshot)).toThrow('Invalid import review recovery'); expect(project).toEqual(before);
});
it('does not fall back to filename sniffing when the saved format is changed to the wrong supported parser',()=> {
  const project=newProject(), before=structuredClone(project), snapshot=importReviewSnapshot(headerReview(project,'{code}\n00007\n','a'.repeat(241)+'.csv'));
  snapshot.format='json';
  expect(()=>restoreImportReview(project,snapshot)).toThrow('JSON object keys must be quoted'); expect(project).toEqual(before);
});
it('retains a rejected Keep backup and current project instead of installing or auto-applying its tampered review',async()=> {
  document.body.innerHTML='<textarea id="ai-prompt"></textarea><input id="document-name"><p id="update-status"></p><button id="recovery-download" hidden></button><button id="recovery-discard" hidden></button><dialog id="update-dialog"></dialog>';
  let bus=createBus(newProject()); const original=bus, before=structuredClone(bus.project);
  const snapshot=importReviewSnapshot(headerReview(bus.project,'{code}\n00007\n','a'.repeat(241)+'.csv')); snapshot.format='yaml';
  const record={file:saveProject(bus.project),id:bus.project.manifest.documentId,session:bus.project.studioV3Session};
  const backup=JSON.stringify({version:1,project:record,history:{cursor:0,entries:[{revision:0,project:record}]},ui:{mode:'design'},forms:[],database:{importReview:snapshot}});
  sessionStorage.setItem(RECOVERY_KEY,backup);
  const database={draft:null,importReview:null}, work=createUpdateWork({getBus:()=>bus,state:{dataDraft:null},database,drafts:{drafts:new Map()},ai:{},
    install:project=> { bus=createBus(project); },renderPanels:()=>{},syncControls:()=>{},render:async()=>{},settle:async()=>{}});
  expect(await work.restore()).toBe(false);
  expect(sessionStorage.getItem(RECOVERY_KEY)).toBe(backup); expect(bus).toBe(original); expect(bus.project).toEqual(before);
  expect(database.importReview).toBeNull(); expect(document.getElementById('recovery-download').hidden).toBe(false);
});
