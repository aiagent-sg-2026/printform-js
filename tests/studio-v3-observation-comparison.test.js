import {describe,it,expect} from 'vitest';
import {checkComparison,FICTIONAL_RUBRIC} from './support/observation-comparison.js';
const baseline=()=>({pages:[{width:794,height:1099,nodes:[
  {id:'header',text:'Header',x:0,y:0,width:794,height:120,textX:36,textWidth:722},
  {id:'footer',text:'Footer',x:0,y:900,width:794,height:60,textX:36,textWidth:722},
  {id:'header-title',text:'FICTIONAL PIXEL CANARY',x:400,y:32,width:300,height:30,textX:400,textWidth:300},
  {id:'footer-note',text:'END OF FICTIONAL FORM',x:36,y:920,width:722,height:20,textX:36,textWidth:200}
]}]});
describe('OBS-05 independent deterministic text/geometry rubric',()=> {
  it.each(['MISSING_SECTION','TEXT_MISMATCH','WIDTH','ALIGNMENT','PAGINATION'])('detects %s without model scores and accepts repaired evidence',code=> {
    expect(checkComparison(baseline()).passed).toBe(true);const bad=baseline(),page=bad.pages[0],target=page.nodes.at(-1);
    if(code==='MISSING_SECTION')page.nodes=page.nodes.filter(node=>node.id!=='footer');
    if(code==='TEXT_MISMATCH')target.text='DELIBERATELY WRONG FICTIONAL TEXT';
    if(code==='WIDTH')target.width=355;
    if(code==='ALIGNMENT')target.textX=500;
    if(code==='PAGINATION')bad.pages.push(structuredClone(page));
    bad.modelSimilarity=1;const result=checkComparison(bad);expect(result.passed).toBe(false);expect(result.failures).toContainEqual(expect.objectContaining({code}));
    expect(checkComparison(baseline())).toEqual({passed:true,rubric:FICTIONAL_RUBRIC.id,failures:[]});
  });
  it.each([{}, {pages:[]}, {pages:[{width:NaN,height:1099,nodes:[]}]}, {pages:[{width:794,height:1099,nodes:[]}]}])('never passes incomplete evidence %o',observed=> {
    expect(checkComparison(observed).passed).toBe(false);expect(checkComparison(baseline()).passed).toBe(true);
  });
});
