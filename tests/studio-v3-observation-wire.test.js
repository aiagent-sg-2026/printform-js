import {it,expect} from 'vitest';
import {runPanelAgent} from '../studio-v3/ai-agent-run.js';
import {newProject} from '../studio-v3/model.js';
import {scriptedGateway,turn,fn,colour} from './support/agent-gateway.js';

it('OBS-02 receipt reaches the real outgoing transport body with its tool-call pairing',async()=> {
  const {transport,bodies} = scriptedGateway({agent:[
    turn([fn(1,'apply_operations',{summary:'Navy',operations:[colour('#163a65')]})]),
    turn([fn(2,'inspect_draft',{})]),turn([fn(3,'finish',{summary:'Done'})])
  ]});
  const result = await runPanelAgent({transport,alias:'demo-fast',payload:{request:'Use navy accents.',scope:{mode:'whole'},references:[],typography:[],conversation:[]},
    media:[],project:newProject(),baseRevision:17,signal:new AbortController().signal,assertContext:()=>{},onPhase:()=>{},onStep:()=>{},
    inspectCandidate:async()=>({report:{status:'ready',metrics:{logicalPages:1}}})});
  const output = bodies.at(-1).input.find(item=>item.type === 'function_call_output' && item.call_id === 'call_2');
  const observed = JSON.parse(output.output);
  expect(observed.observation).toEqual(result.inspection.observation);
  expect(observed.observation).toMatchObject({baseRevision:17,kind:'print-diagnostics',candidateVersion:1});
  expect(bodies.at(-1).input.find(item=>item.type === 'function_call' && item.call_id === 'call_2').name).toBe('inspect_draft');
  expect(result.inspection.observation.contentDigest).toMatch(/^[a-f0-9]{64}$/);
});
