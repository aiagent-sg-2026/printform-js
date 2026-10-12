import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {runPanelAgent} from '../studio-v3/ai-agent-run.js';
import {createDemoTransport} from '../studio-v3/ai-demo-transport.js';
import {stableStringify} from '../studio-v2/core/json.js';
import {classifySyntheticDocument,classifyImportedDocument} from '../studio-v2/core/data-policy.js';
import {scriptedGateway,turn,fn,json} from './support/agent-gateway.js';
import {semanticRun} from './support/semantic-observation.js';
import {assertObservationAuthorization} from '../studio-v3/observation-policy.js';

const run = (fixture,transport,inspect = async()=>({report:{status:'ready',metrics:{rows:45,logicalPages:1},pageGeometry:[{width:794,height:1123}]}}))=>runPanelAgent({
  transport,alias:'demo-fast',payload:{request:'Describe the authorized form context.',scope:{mode:'whole'},references:[],typography:[],conversation:[]},
  media:[],project:fixture.state.project,baseRevision:7,runId:fixture.state.runId,observationAuthorization:fixture.authorization,
  readObservationHost:()=>fixture.state,profile:'read-only',signal:new AbortController().signal,assertContext:()=>{},onPhase:()=>{},onStep:()=>{},inspectCandidate:inspect});
const output = body=>body.input.find(item=>item.type==='function_call_output' && item.call_id==='call_1');
const turns = ()=>[turn([fn(1,'observe_context',{})]),turn([fn(2,'finish_answer',{message:'Observed the authorized context.'})])];

describe('OBS-01 actual semantic provider wire',()=> {
  it.each([false,true])('enforces text authorization %s in the actual outgoing request, with receipt pairing',async text=> {
    const fixture = await semanticRun({text});
    const gateway = scriptedGateway({agent:text ? turns() : [turn([fn(1,'observe_context',{})]),turn([fn(2,'get_context',{})]),turn([fn(3,'finish_answer',{message:'Text disclosure is unavailable.'})])]});
    await run(fixture,gateway.transport);
    expect(()=>assertObservationAuthorization(fixture.authorization,fixture.state)).toThrow(expect.objectContaining({code:'OBSERVATION_AUTHORIZATION_STALE'}));
    const serialized = JSON.stringify(gateway.bodies);
    expect(serialized.includes('AUTHORIZED_LABEL_CANARY')).toBe(text);
    expect(serialized.includes('AUTHORIZED_STATIC_CANARY')).toBe(text);
    expect(serialized).not.toMatch(/BOUND_VALUE_CANARY|UNASSIGNED_SECRET_CANARY|PIXEL_CANARY/);
    const toolOutput = output(gateway.bodies[1]);
    if (!text) { expect(toolOutput.output).toContain('OBSERVATION_DISCLOSURE_REQUIRED'); return; }
    expect(gateway.bodies[1].input.find(item=>item.type==='function_call' && item.call_id==='call_1').name).toBe('observe_context');
    const {observation,...content} = JSON.parse(toolOutput.output);
    expect(content.fields.find(f=>f.id==='header-company')).toMatchObject({label:'AUTHORIZED_LABEL_CANARY',pointer:'/company/name'});
    expect(observation.contentDigest).toBe(createHash('sha256').update(stableStringify(content,0)).digest('hex'));
    expect(observation).toMatchObject({kind:'semantic-context',baseRevision:7,runId:fixture.state.runId});
  });
  it('transmits authorized synthetic values independently, while labels and pixels stay blocked',async()=> {
    const fixture = await semanticRun({policy:classifySyntheticDocument}), gateway = scriptedGateway({agent:turns()});
    await run(fixture,gateway.transport); const body = JSON.stringify(gateway.bodies);
    expect(body).toContain('BOUND_VALUE_CANARY'); expect(body).not.toMatch(/AUTHORIZED_LABEL_CANARY|AUTHORIZED_STATIC_CANARY|UNASSIGNED_SECRET_CANARY|PIXEL_CANARY/);
    expect(JSON.parse(output(gateway.bodies[1]).output).disclosure).toEqual({text:false,values:true,pixels:false});
  });
  it('rejects encoded pixel values even with synthetic value permission, and recovers with clean authorized content',async()=> {
    const fixture=await semanticRun({text:true,policy:classifySyntheticDocument,mutate:project=> { project.sampleData.preparedBy='data:image/png;base64,PIXEL_BOUND_CANARY'; }});
    const gateway=scriptedGateway({agent:[turn([fn(1,'observe_context',{})]),turn([fn(2,'get_context',{})]),turn([fn(3,'finish_answer',{message:'Pixel content is unavailable.'})])]});
    await run(fixture,gateway.transport);
    expect(output(gateway.bodies[1]).output).toContain('OBSERVATION_CONTENT_UNSUPPORTED');
    expect(JSON.stringify(gateway.bodies)).not.toMatch(/BOUND_VALUE_CANARY|PIXEL_BOUND_CANARY/);
    const clean=await semanticRun({text:true,policy:classifySyntheticDocument}), recovered=scriptedGateway({agent:turns()});
    await run(clean,recovered.transport); expect(JSON.stringify(recovered.bodies)).toContain('BOUND_VALUE_CANARY');
  });
  it('rejects policy changes during render before sending stale context; a newly authorized run recovers',async()=> {
    const fixture = await semanticRun({text:true}), gateway = scriptedGateway({agent:turns()});
    await expect(run(fixture,gateway.transport,async()=> { fixture.state.dataPolicy=classifyImportedDocument(fixture.state.project.manifest.documentId); return {report:{status:'ready'}}; })).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    expect(gateway.bodies).toHaveLength(1); expect(JSON.stringify(gateway.bodies)).not.toContain('AUTHORIZED_LABEL_CANARY');
    const recovery = await semanticRun({text:true}), next = scriptedGateway({agent:turns()});
    await run(recovery,next.transport); expect(JSON.stringify(next.bodies)).toContain('AUTHORIZED_LABEL_CANARY');
  });
  it('rechecks policy after a 401 session refresh at the actual fetch boundary',async()=> {
    const fixture = await semanticRun({text:true}), bodies = []; let sessions = 0;
    const transport = createDemoTransport({fetchImpl:async(url,init)=> {
      if (url.endsWith('/session')) {
        if (++sessions===2) fixture.state.dataPolicy = classifyImportedDocument(fixture.state.project.manifest.documentId);
        return json({token:'dmo_synthetic1',expires_in:900},201);
      }
      const body = JSON.parse(init.body); bodies.push(body);
      if (bodies.length===1) return turn([fn(1,'observe_context',{})]);
      return json({error:{code:'session_expired'}},401);
    }});
    await expect(run(fixture,transport)).rejects.toMatchObject({code:'OBSERVATION_AUTHORIZATION_STALE'});
    expect(sessions).toBe(2); expect(bodies).toHaveLength(2);
    expect(JSON.stringify(bodies[1])).toContain('AUTHORIZED_LABEL_CANARY');
    expect(JSON.stringify(bodies)).not.toMatch(/BOUND_VALUE_CANARY|PIXEL_CANARY/);
  });
});
