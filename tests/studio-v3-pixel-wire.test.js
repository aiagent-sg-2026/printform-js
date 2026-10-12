import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {createDemoTransport} from '../studio-v3/ai-demo-transport.js';
import {runPanelAgent} from '../studio-v3/ai-agent-run.js';
import {DEMO_CONFIG} from '../studio-v3/ai-gateway-config.js';
import {inputItems,agentBody} from '../studio-v3/agent-wire.js';
import {revokeObservationAuthorization} from '../studio-v3/observation-policy.js';
import {pixelRun,UNIT_PNG} from './support/pixel-observation.js';
import {json,turn,fn} from './support/agent-gateway.js';
const output=(body,id)=>body.input.find(item=>item.type==='function_call_output' && item.call_id===id);
const latestId=body=>body.input.filter(item=>item.type==='function_call_output').map(item=> {try{return JSON.parse(item.output).observation?.id;}catch{return null;}}).filter(Boolean).at(-1);
async function gatewayRun({pixels=true,multimodal=true,capture,mutateDispatch}={}) {
  const fixture=await pixelRun({pixels,...(capture ? {capture} : {})}), bodies=[]; let sessions=0;
  const transport=createDemoTransport({fetchImpl:async(url,init)=> {
    if(url.endsWith('/session')) { sessions++; mutateDispatch?.(fixture,sessions); return json({token:'dmo_synthetic1',expires_in:900},201); }
    if(url.endsWith('/models')) return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal}}]});
    const body=JSON.parse(init.body); bodies.push(body);
    if(bodies.length===1) return turn([fn(1,'inspect_draft',{})]);
    if(bodies.length===2) return turn([fn(2,'retrieve_page',{observationId:latestId(body),pageIndex:0})]);
    return turn([fn(3,'finish_answer',{message:'Fictional observation completed.'})]);
  }});
  const signal=new AbortController().signal; await transport.discover(signal);
  const result=runPanelAgent({transport,alias:'demo-fast',project:fixture.state.project,payload:{request:'Inspect this fictional static form.',scope:{mode:'whole'},references:[],typography:[],conversation:[]},
    media:[],signal,baseRevision:7,runId:fixture.state.runId,observationAuthorization:fixture.authorization,readObservationHost:()=>fixture.state,profile:'read-only',
    assertContext:()=>{},onPhase:()=>{},onStep:()=>{},inspectCandidate:async()=>({report:{status:'ready'}}),capturePixels:fixture.capture});
  return {fixture,bodies,result};
}
function assertWire(body) {
  const result=JSON.parse(output(body,'call_2').output), user=body.input.find(item=>item.role==='user' && item.content?.some(part=>part.type==='input_image'));
  expect(body.input.find(item=>item.type==='function_call' && item.call_id==='call_2').name).toBe('retrieve_page');
  expect(JSON.parse(user.content[0].text).hostObservation).toMatchObject({toolCallId:'call_2',observationId:result.observation.id,evidenceId:result.evidence.id,contentDigest:result.evidence.contentDigest});
  const image=user.content.find(part=>part.type==='input_image');
  expect(image.image_url).toBe(`data:image/png;base64,${UNIT_PNG}`);
  expect(createHash('sha256').update(Buffer.from(image.image_url.split(',')[1],'base64')).digest('hex')).toBe(result.evidence.contentDigest);
  expect(body.stream).toBe(false); return result;
}
describe('OBS-02 actual page-pixel provider payload',()=> {
  it('carries the canary and tool receipt through the real Pi loop and Demo transport',async()=> {
    const run=await gatewayRun(); await run.result; assertWire(run.bodies[2]);
    expect(()=>run.fixture.memory.latestVisual()).not.toThrow();
    expect(()=>revokeObservationAuthorization(run.fixture.authorization)).not.toThrow();
  });
  it('rejects missing permission without transmitting pixels, then recovers with fresh explicit consent',async()=> {
    const denied=await gatewayRun({pixels:false}); await denied.result;
    expect(output(denied.bodies[2],'call_2').output).toContain('OBSERVATION_PIXELS_REQUIRED');
    expect(JSON.stringify(denied.bodies)).not.toContain(UNIT_PNG);
    const recovered=await gatewayRun(); await recovered.result; assertWire(recovered.bodies[2]);
  });
  it('blocks an unsupported negotiated route before any image request, then recovers on a supported route',async()=> {
    const blocked=await gatewayRun({multimodal:false}); await expect(blocked.result).rejects.toMatchObject({code:'DEMO_IMAGE_CAPABILITY_UNVERIFIED'});
    expect(blocked.bodies).toHaveLength(2); expect(JSON.stringify(blocked.bodies)).not.toContain(UNIT_PNG);
    const recovered=await gatewayRun(); await recovered.result; assertWire(recovered.bodies[2]);
  });
  it('pins the exact capture call/result and PNG through actual transport compaction and result folding',async()=> {
    const fixture=await pixelRun(), first=await fixture.inspect(), args={observationId:first.id,pageIndex:0};
    const result=await fixture.execute('retrieve_page',args,'call_2'), context={systemPrompt:'Fictional test.',tools:fixture.tools,messages:[
      {role:'user',content:'Observe fictional pixels'},
      {role:'assistant',content:[{type:'toolCall',id:'call_2',name:'retrieve_page',arguments:args}]},
      {role:'toolResult',toolCallId:'call_2',content:result.content,isError:false}
    ]};
    for(let i=0;i<220;i++) context.messages.push({role:'assistant',content:[{type:'toolCall',id:`note-${i}`,name:'take_notes',arguments:{notes:'n'.repeat(2000)}}]},
      {role:'toolResult',toolCallId:`note-${i}`,content:[{type:'text',text:'Noted.'}]});
    const bodies=[], transport=createDemoTransport({fetchImpl:async(url,init)=> {
      if(url.endsWith('/session'))return json({token:'dmo_synthetic1',expires_in:900},201);
      if(url.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      bodies.push(JSON.parse(init.body));return turn([fn(3,'finish_answer',{message:'Observed.'})]);
    }}), signal=new AbortController().signal;
    await transport.discover(signal); await transport.agentTurn('demo-fast',context,signal,{memory:fixture.memory});
    expect(JSON.stringify(context.messages).length).toBeGreaterThan(DEMO_CONFIG.agent.maxContextChars);
    expect(bodies[0].input.some(item=>item.content?.some(part=>part.text?.includes('older steps were dropped')))).toBe(true);
    expect(bodies[0].input.filter(item=>item.type==='function_call')).toHaveLength(DEMO_CONFIG.agent.keepTurns+1);
    assertWire(bodies[0]);
    const broken={...context,messages:context.messages.filter(message=>message.role!=='toolResult' || message.toolCallId!=='call_2')};
    expect(()=>inputItems(broken,fixture.memory)).toThrow(expect.objectContaining({code:'OBSERVATION_PIXELS_PAIR_REQUIRED'}));
    revokeObservationAuthorization(fixture.authorization);
    await expect(transport.agentTurn('demo-fast',context,signal,{memory:fixture.memory})).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'}); expect(bodies).toHaveLength(1);
  });
  it('rejects a late policy/content change at refreshed-session dispatch before stale pixel bytes leave',async()=> {
    const fixture=await pixelRun(), args={observationId:(await fixture.inspect()).id,pageIndex:0}, result=await fixture.execute('retrieve_page',args,'call_2');
    const context={tools:fixture.tools,messages:[{role:'user',content:'Fictional'},{role:'assistant',content:[{type:'toolCall',name:'retrieve_page',id:'call_2',arguments:args}]},{role:'toolResult',toolCallId:'call_2',content:result.content}]};
    let sessions=0, requests=0; const transport=createDemoTransport({fetchImpl:async(url)=> {
      if(url.endsWith('/session')) { if(++sessions===2) fixture.state.project.sampleData.changed=true; return json({token:'dmo_synthetic1',expires_in:900},201); }
      if(url.endsWith('/models'))return json({data:[{id:'demo-fast',capabilities:{responses:true,multimodal:true}}]});
      requests++;return json({error:{code:'session_expired'}},401);
    }}), signal=new AbortController().signal;
    await transport.discover(signal); await expect(transport.agentTurn('demo-fast',context,signal,{memory:fixture.memory})).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    expect(requests).toBe(1); expect(sessions).toBe(2);
  });
  it('rejects an untracked image tool block instead of silently dropping it',()=> {
    expect(()=>inputItems({messages:[{role:'user',content:'Fictional'},{role:'toolResult',toolCallId:'foreign',content:[{type:'image',data:UNIT_PNG,mimeType:'image/png'}]}]})).toThrow(expect.objectContaining({code:'OBSERVATION_PIXELS_PAIR_REQUIRED'}));
  });
  it('enforces the combined attachment and observation image budget without silently dropping pixels',async()=> {
    const fixture=await pixelRun(), args={observationId:(await fixture.inspect()).id,pageIndex:0}, result=await fixture.execute('retrieve_page',args,'call_2');
    const context={tools:fixture.tools,messages:[{role:'user',content:Array.from({length:4},()=>({type:'image',mimeType:'image/png',data:UNIT_PNG}))},
      {role:'assistant',content:[{type:'toolCall',name:'retrieve_page',id:'call_2',arguments:args}]},{role:'toolResult',toolCallId:'call_2',content:result.content}]};
    expect(()=>agentBody({alias:'demo-fast',context,memory:fixture.memory,stream:false})).toThrow(expect.objectContaining({code:'UNSAFE_PROPOSAL'}));
    context.messages[0].content.pop();expect(JSON.parse(agentBody({alias:'demo-fast',context,memory:fixture.memory,stream:false})).input.filter(item=>item.role==='user').flatMap(item=>item.content).filter(part=>part.type==='input_image')).toHaveLength(4);
  });
});
