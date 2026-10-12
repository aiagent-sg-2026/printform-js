import {test,expect} from './studio-v3-test.js';
import {createHash} from 'node:crypto';
import {comparisonFixture,COMPARISON_DEFECTS,observeComparisonDom,checkComparison,FICTIONAL_RUBRIC} from '../tests/support/observation-comparison.js';
test.use({workInSteps:true});
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const expected={'missing-section':'MISSING_SECTION','wrong-text':'TEXT_MISMATCH',width:'WIDTH',alignment:'ALIGNMENT',pagination:'PAGINATION'};
test('OBS-05 frozen fictional rubric detects native defects; actual completion cites latest receipt and rejects wrong receipts',async({page,browser},testInfo)=> {
  test.setTimeout(240000);const errors=[],cases=[];page.on('pageerror',error=>errors.push(error.message));
  await page.exposeBinding('__readFictionalGeometry',async()=>page.frameLocator('#preview-frame').locator('body').evaluate(observeComparisonDom));
  await page.addInitScript(()=> {
    const original=window.fetch.bind(window),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn=0,foreign='observation-unowned-fictional';window.__comparisonWire=[];window.__comparisonSnapshots=[];
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_fictional_comparison',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      const body=JSON.parse(init.body);window.__comparisonWire.push(body);const phase=turn++%5;
      const results=body.input.filter(item=>item.type==='function_call_output').flatMap(item=> {try{return [JSON.parse(item.output)];}catch{return [];}});
      const receipt=results.filter(result=>result.observation).at(-1),pixels=results.find(result=>result.evidence);
      if(pixels && !window.__comparisonSnapshots.some(item=>item.observationId===pixels.observation.id))window.__comparisonSnapshots.push({observationId:pixels.observation.id,snapshot:await window.__readFictionalGeometry()});
      let name,args;
      if(phase===0){name='inspect_draft';args={};}
      if(phase===1){name='retrieve_page';args={observationId:receipt.observation.id,pageIndex:0};}
      if(phase===2){name='finish_answer';args={message:'Old observation rejected.',observationId:pixels.sourceObservationId};}
      if(phase===3){name='finish_answer';args={message:'Foreign observation rejected.',observationId:foreign};}
      if(phase===4){name='finish_answer';args={message:'Fictional comparison complete.'};foreign=pixels.observation.id;}
      const response={status:'completed',output:[{type:'function_call',call_id:`comparison-${turn}`,name,arguments:JSON.stringify(args)}],usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream?new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}):json(response);
    };
  });
  await page.goto('/studio-v3/');await ready(page);
  const matrix=[undefined,...COMPARISON_DEFECTS.flatMap(defect=>[defect,undefined])];
  for(const [index,defect] of matrix.entries()) {
    await page.locator('#open-file').setInputFiles({name:'fictional-comparison.printform.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'printform-studio-v3',version:1,project:comparisonFixture(defect)}))});
    await ready(page);
    if(index===0){await page.locator('[data-mode=validate]').click();await page.getByRole('button',{name:'Run all synthetic samples',exact:true}).click();await ready(page);}
    if(!await page.locator('#ai-prompt').isVisible())await page.locator('[data-ai-toggle]').click();
    await page.locator('#ai-observation-text').check();await page.locator('#ai-observation-pixels').check();
    await page.locator('#ai-prompt').fill('Compare this fictional static form using the current observation.');await page.locator('[data-ai-send]').click();
    await expect.poll(()=>page.evaluate(()=>window.__comparisonWire.length),{timeout:60000}).toBe((index+1)*5);
    const card=page.locator('.ai-message').filter({hasText:'Fictional comparison complete.'}).last();await expect(card).toBeVisible({timeout:60000});
    const recorded=await page.evaluate(()=>({wire:window.__comparisonWire.slice(-5),observed:window.__comparisonSnapshots.at(-1)}));
    const results=recorded.wire.at(-1).input.filter(item=>item.type==='function_call_output');
    const capture=JSON.parse(results.find(item=> {try{return Boolean(JSON.parse(item.output).evidence);}catch{return false;}}).output);
    expect(recorded.observed.observationId).toBe(capture.observation.id);await expect(card).toContainText(capture.observation.id);await expect(card).not.toContainText(capture.sourceObservationId);
    expect(results.filter(item=>item.output.includes('EVIDENCE_STALE'))).toHaveLength(2);
    const oracle=checkComparison(recorded.observed.snapshot);expect(oracle.passed).toBe(!defect);
    if(defect)expect(oracle.failures).toContainEqual(expect.objectContaining({code:expected[defect]}));
    const image=recorded.wire.at(-1).input.flatMap(item=>item.content||[]).find(part=>part.type==='input_image');
    expect(createHash('sha256').update(Buffer.from(image.image_url.split(',')[1],'base64')).digest('hex')).toBe(capture.evidence.contentDigest);
    cases.push({case:defect || (index===0?'baseline':'recovery'),oracle,observation:capture.observation,delivered:await card.innerText(),snapshot:recorded.observed.snapshot,wire:recorded.wire});
    await expect(page.locator('#ai-observation-text')).not.toBeChecked();await expect(page.locator('#ai-observation-pixels')).not.toBeChecked();
  }
  expect(errors).toEqual([]);await testInfo.attach('observation-comparison-evidence',{body:JSON.stringify({browser:testInfo.project.name,version:browser.version(),rubric:FICTIONAL_RUBRIC,cases,errors}),contentType:'application/json'});
});
