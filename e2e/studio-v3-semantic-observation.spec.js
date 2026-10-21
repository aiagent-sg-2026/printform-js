import {test,expect} from './studio-v3-test.js';
import fs from 'node:fs/promises';
import {newProject} from '../studio-v3/model.js';
import {openSharing,closeSettings} from './ai-sharing.js';
test.use({workInSteps:true});
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const steps = [
  ['observe_context'],['get_context'],['finish_answer',{message:'Default text disclosure rejected.'}],
  ['observe_context'],['finish_answer',{message:'Authorized semantic context observed. AUTHORIZED_BROWSER_LABEL AUTHORIZED_BROWSER_STATIC'}],
  ['observe_context'],['get_context'],['finish_answer',{message:'Single-use authorization rejected.'}],
  ['observe_context'],['finish_answer',{message:'Fresh authorization recovered.'}]
];
async function gateway(page) {
  await page.addInitScript(steps=> {
    const original=window.fetch.bind(window), json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    let turn=0; window.__semanticWire=[];
    window.fetch=async(input,init)=> {
      const url=new URL(typeof input==='string' ? input : input.url,location.href);
      if (url.origin!=='https://gpt.yapweijun1996.com') return original(input,init);
      if (url.pathname==='/demo/session') return json({token:'dmo_synthetic123456',expires_in:900},201);
      if (url.pathname.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:false}}]});
      const body=JSON.parse(init.body); window.__semanticWire.push(body);
      const [name,args={}] = steps[turn++];
      const response={status:'completed',output:[{type:'function_call',call_id:`call_${turn}`,name,arguments:JSON.stringify(args)}],usage:{input_tokens:10,output_tokens:2,total_tokens:12}};
      return body.stream ? new Response(`event: response.completed\ndata: ${JSON.stringify({type:'response.completed',response})}\n\n`,{headers:{'content-type':'text/event-stream'}}) : json(response);
    };
  },steps);
}
const send = async(page,message)=> { await page.locator('#ai-prompt').fill(message); await page.locator('[data-ai-send]').click(); };
const answer = (page,message)=>expect(page.locator('.ai-message').filter({hasText:message})).toBeVisible({timeout:60000});
const output = (body,id)=>body.input.find(item=>item.type==='function_call_output' && item.call_id===id);

test('Validate and real AI wire enforce explicit, single-run text authorization and recover',async({page,browser},testInfo)=> {
  test.setTimeout(180000); const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await gateway(page); await page.goto('/studio-v3/'); await ready(page);
  const fixture=newProject(); fixture.manifest.studioV3.header[0].label='AUTHORIZED_BROWSER_LABEL';
  fixture.manifest.studioV3.footer.push({id:'semantic-note',kind:'static',label:'Note',text:'AUTHORIZED_BROWSER_STATIC',pointer:'',format:''});
  fixture.sampleData.company.name='UNKNOWN_BROWSER_VALUE'; fixture.sampleData.privateSecret='SENSITIVE_BROWSER_SECRET';
  fixture.sampleData.signaturePixels='data:image/png;base64,PIXEL_BROWSER_CANARY';
  await page.locator('#open-file').setInputFiles({name:'semantic-fixture.printform.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'printform-studio-v3',version:1,project:fixture}))});
  await ready(page); await page.locator('[data-mode=validate]').click();
  const validate=page.getByRole('button',{name:'Run all synthetic samples',exact:true});
  await validate.click(); await expect(validate).toBeVisible({timeout:120000}); await ready(page);
  await page.locator('[data-ai-toggle]').click();
  const consent=page.locator('#ai-observation-text'); await expect(consent).not.toBeChecked();
  await openSharing(page);await expect(consent).toBeVisible();await expect(consent).not.toBeChecked();await closeSettings(page);
  await send(page,'Describe the form context.'); await answer(page,'Default text disclosure rejected.');
  let wire=await page.evaluate(()=>window.__semanticWire);
  expect(output(wire[1],'call_1').output).toContain('OBSERVATION_DISCLOSURE_REQUIRED');
  expect(JSON.stringify(wire)).not.toMatch(/AUTHORIZED_BROWSER_LABEL|AUTHORIZED_BROWSER_STATIC|UNKNOWN_BROWSER_VALUE|SENSITIVE_BROWSER_SECRET|PIXEL_BROWSER_CANARY/);
  await openSharing(page);await consent.check();await closeSettings(page);await expect(consent).toBeChecked();
  await send(page,'Describe the authorized context.'); await answer(page,'Authorized semantic context observed.');
  wire=await page.evaluate(()=>window.__semanticWire);
  const observed=JSON.parse(output(wire[4],'call_4').output);
  expect(observed.fields.find(field=>field.id==='header-company')).toMatchObject({label:'AUTHORIZED_BROWSER_LABEL',pointer:'/company/name'});
  expect(observed.fields.find(field=>field.id==='footer-semantic-note').text).toBe('AUTHORIZED_BROWSER_STATIC');
  expect(observed).toMatchObject({collection:'/items',scenario:{id:'active',rowCount:45},disclosure:{text:true,values:false,pixels:false},observation:{kind:'semantic-context',baseRevision:0,releaseIdentity:{verified:true}}});
  expect(observed.diagnostics.pages.length).toBeGreaterThan(0); await expect(consent).not.toBeChecked();
  expect(wire[4].input.find(item=>item.type==='function_call' && item.call_id==='call_4').name).toBe('observe_context');
  await send(page,'Describe the context again.'); await answer(page,'Single-use authorization rejected.');
  wire=await page.evaluate(()=>window.__semanticWire);
  expect(output(wire[6],'call_6').output).toContain('OBSERVATION_DISCLOSURE_REQUIRED');
  const replayEvidence=testInfo.outputPath('semantic-history-replay.json');
  await fs.writeFile(replayEvidence,JSON.stringify({browser:testInfo.project.name,version:browser.version(),wire}));
  await testInfo.attach('semantic-history-replay',{path:replayEvidence,contentType:'application/json'});
  expect(JSON.stringify(wire.slice(5,8))).not.toMatch(/AUTHORIZED_BROWSER_LABEL|AUTHORIZED_BROWSER_STATIC/);
  await openSharing(page);await consent.check();await closeSettings(page);await expect(consent).toBeChecked();
  await send(page,'Describe the freshly authorized context.'); await answer(page,'Fresh authorization recovered.');
  wire=await page.evaluate(()=>window.__semanticWire); const fresh=JSON.parse(output(wire[9],'call_9').output);
  expect(fresh.observation.runId).not.toBe(observed.observation.runId); expect(fresh.observation.id).not.toBe(observed.observation.id);
  expect(fresh.observation.candidateDigest).toBe(observed.observation.candidateDigest);
  expect(JSON.stringify(wire)).not.toMatch(/UNKNOWN_BROWSER_VALUE|SENSITIVE_BROWSER_SECRET|PIXEL_BROWSER_CANARY/);
  await expect(page.locator('#revision')).toHaveText('r0'); expect(errors).toEqual([]);
  const evidence=testInfo.outputPath('semantic-provider-wire.json');
  await fs.writeFile(evidence,JSON.stringify({browser:testInfo.project.name,version:browser.version(),wire}));
  await testInfo.attach('semantic-provider-wire',{path:evidence,contentType:'application/json'});
});
