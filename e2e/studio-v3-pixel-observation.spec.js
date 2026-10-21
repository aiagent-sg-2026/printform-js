import {test,expect} from './studio-v3-test.js';
import {createHash} from 'node:crypto';
import {staticProject} from '../tests/support/static-observation-fixture.js';
import {openSharing,closeSettings} from './ai-sharing.js';
test.use({workInSteps:true});
const ready=page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const steps=[
  ['inspect_draft'],['retrieve_page',{observationId:'$latest',pageIndex:0}],['finish_answer',{message:'Default pixel consent denied.'}],
  ['inspect_draft'],['retrieve_page',{observationId:'$latest',pageIndex:0}],['take_notes',{notes:'Fictional page observed.'}],
  ['retrieve_page',{observationId:'$latest',pageIndex:0,crop:{x:36,y:36,width:360,height:160}}],['take_notes',{notes:'Fictional crop observed.'}],['finish_answer',{message:'Page and crop received.'}],
  ['inspect_draft'],['retrieve_page',{observationId:'$latest',pageIndex:0}],['finish_answer',{message:'Single-use pixel consent denied.'}],
  ['inspect_draft'],['retrieve_page',{observationId:'$latest',pageIndex:999}],['inspect_draft'],
  ['retrieve_page',{observationId:'$latest',pageIndex:0,crop:{x:36,y:36,width:360,height:160}}],['finish_answer',{message:'Fresh receipt recovered.'}]
];
async function gateway(page) {
  await page.addInitScript(steps=> {
    const original=window.fetch.bind(window), json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn=0; window.__pixelWire=[];
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string' ? input : input.url,location.href);
      if(url.origin!=='https://gpt.yapweijun1996.com')return original(input,init);
      if(url.pathname==='/demo/session')return json({token:'dmo_fictional123456',expires_in:900},201);
      if(url.pathname.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      const body=JSON.parse(init.body);window.__pixelWire.push(body);
      const [name,supplied={}] = steps[turn++]; const args=structuredClone(supplied);
      if(args.observationId==='$latest') args.observationId=body.input.filter(item=>item.type==='function_call_output').map(item=> {try{return JSON.parse(item.output).observation?.id;}catch{return null;}}).filter(Boolean).at(-1);
      const response={status:'completed',output:[{type:'function_call',call_id:`call_${turn}`,name,arguments:JSON.stringify(args)}],usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },steps);
}
const send=async(page,message)=> {await page.locator('#ai-prompt').fill(message);await page.locator('[data-ai-send]').click();};
const answer=(page,message)=>expect(page.locator('.ai-message').filter({hasText:message})).toBeVisible({timeout:60000});
const output=(body,id)=>body.input.find(item=>item.type==='function_call_output' && item.call_id===id);
function visual(body,id) {
  const observed=JSON.parse(output(body,id).output), image=body.input.find(item=>item.role==='user' && item.content?.some(part=>part.type==='input_image'));
  expect(body.input.find(item=>item.type==='function_call' && item.call_id===id).name).toBe('retrieve_page');
  expect(JSON.parse(image.content[0].text).hostObservation).toMatchObject({toolCallId:id,observationId:observed.observation.id,evidenceId:observed.evidence.id,contentDigest:observed.evidence.contentDigest});
  const url=image.content.find(part=>part.type==='input_image').image_url;
  expect(createHash('sha256').update(Buffer.from(url.split(',')[1],'base64')).digest('hex')).toBe(observed.evidence.contentDigest);
  expect(observed.observation).toMatchObject({kind:'page-pixels',releaseIdentity:{verified:true},candidateVersion:0,evidenceRefs:[observed.evidence.id]});
  expect(body.stream).toBe(false);return {observed,url};
}
test('Validate/AI panel captures fictional page and crop, denies missing/stale consent, and recovers on actual wire',async({page,browser},testInfo)=> {
  test.setTimeout(180000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await gateway(page);await page.goto('/studio-v3/');await ready(page);
  const fixture=staticProject();
  await page.locator('#open-file').setInputFiles({name:'fictional-static.printform.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'printform-studio-v3',version:1,project:fixture}))});
  await ready(page);await page.locator('[data-mode=validate]').click();await expect(page.locator('.quality-panel')).toBeVisible();
  await page.getByRole('button',{name:'Run all synthetic samples',exact:true}).click();await ready(page);
  await page.locator('[data-ai-toggle]').click();const text=page.locator('#ai-observation-text'),pixels=page.locator('#ai-observation-pixels');
  await expect(text).not.toBeChecked();await expect(pixels).not.toBeChecked();
  await openSharing(page);await expect(text).toBeVisible();await expect(pixels).toBeVisible();await closeSettings(page);
  await send(page,'Inspect the fictional page.');await answer(page,'Default pixel consent denied.');
  let wire=await page.evaluate(()=>window.__pixelWire);expect(output(wire[2],'call_2').output).toContain('OBSERVATION_PIXELS_REQUIRED');
  expect(wire.slice(0,3).some(body=>JSON.stringify(body).includes('data:image/png;base64,'))).toBe(false);
  await openSharing(page);await text.check();await pixels.check();await closeSettings(page);
  await expect(text).toBeChecked();await expect(pixels).toBeChecked();await send(page,'Inspect the fictional page and crop.');await answer(page,'Page and crop received.');
  wire=await page.evaluate(()=>window.__pixelWire);const full=visual(wire[5],'call_5'),crop=visual(wire[7],'call_7');
  expect(crop.observed.sourceObservationId).toBe(full.observed.observation.id);
  expect(crop.observed.observation.candidateDigest).toBe(full.observed.observation.candidateDigest);
  expect(crop.observed.observation.id).not.toBe(full.observed.observation.id);
  expect(crop.observed.evidence).toMatchObject({width:360,height:160,crop:{x:36,y:36,width:360,height:160},scale:1});
  const measured=await page.evaluate(async({full,crop})=> {
    const read=async(url)=> {const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {canvas,ctx};};
    const a=await read(full),b=await read(crop),actual=b.ctx.getImageData(0,0,360,160).data,expected=a.ctx.getImageData(36,36,360,160).data;
    let blue=0,difference=0;for(let i=0;i<actual.length;i+=4){if(actual[i]===17 && actual[i+1]===103 && actual[i+2]===187 && actual[i+3]===255)blue++;for(let j=0;j<4;j++)if(actual[i+j]!==expected[i+j])difference++;}
    return {blue,difference,page:{width:a.canvas.width,height:a.canvas.height}};
  },{full:full.url,crop:crop.url});
  const diagnostic=JSON.parse(output(wire[4],'call_4').output);
  expect(measured.blue).toBeGreaterThan(50);expect(measured.difference).toBe(0);
  expect(measured.page).toEqual({width:Math.round(diagnostic.pages[0].width),height:Math.round(diagnostic.pages[0].height)});
  await expect(text).not.toBeChecked();await expect(pixels).not.toBeChecked();
  await send(page,'Inspect again without renewed consent.');await answer(page,'Single-use pixel consent denied.');
  wire=await page.evaluate(()=>window.__pixelWire);expect(output(wire[11],'call_11').output).toContain('OBSERVATION_PIXELS_REQUIRED');
  expect(wire.slice(9,12).some(body=>JSON.stringify(body).includes('data:image/png;base64,'))).toBe(false);
  await openSharing(page);await text.check();await pixels.check();await closeSettings(page);
  await expect(text).toBeChecked();await expect(pixels).toBeChecked();await page.locator('#document-name').fill('Changed fictional document');await page.locator('#document-name').press('Tab');await ready(page);
  await openSharing(page);await expect(pixels).not.toBeChecked();await text.check();await pixels.check();await closeSettings(page);
  await expect(text).toBeChecked();await expect(pixels).toBeChecked();await send(page,'Recover a fresh fictional crop.');await answer(page,'Fresh receipt recovered.');
  wire=await page.evaluate(()=>window.__pixelWire);expect(output(wire[14],'call_14').output).toContain('OBSERVATION_PIXELS_BOUNDS');
  const recovered=visual(wire[16],'call_16');expect(recovered.observed.observation.runId).not.toBe(full.observed.observation.runId);expect(recovered.observed.observation.baseRevision).toBe(1);
  expect(errors).toEqual([]);await expect(page.locator('#revision')).toHaveText('r1 · unsaved template');
  await testInfo.attach('pixel-provider-wire',{body:JSON.stringify({browser:testInfo.project.name,version:browser.version(),measured,wire}),contentType:'application/json'});
});
