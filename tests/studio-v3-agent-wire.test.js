import {describe,it,expect} from 'vitest';
import {Type} from '@earendil-works/pi-ai';
import {toolSpecs,inputItems,agentBody,agentOutput,assistantContent,usesImages} from '../studio-v3/agent-wire.js';
import {createAgentMemory} from '../studio-v3/agent-memory.js';
import {DEMO_CONFIG} from '../studio-v3/ai-gateway-config.js';

const tools = [{name:'get_context',description:'Read it.',parameters:Type.Object({}),execute:()=>{}},{name:'finish',description:'Done.',parameters:Type.Object({summary:Type.String()}),execute:()=>{}}];
const reasoning = {id:'rs_1',type:'reasoning',content:[],encrypted_content:'enc-1',summary:[]};
const user = text => ({role:'user',content:text,timestamp:1});
const assistant = (content,responseId = 'resp_1') => ({role:'assistant',content,api:'x',provider:'x',model:'demo-fast',responseId,usage:{},stopReason:'toolUse',timestamp:2});
const call = (id,name,args = {}) => ({type:'toolCall',id,name,arguments:args});
const thinking = item => ({type:'thinking',thinking:'',thinkingSignature:JSON.stringify(item),redacted:true});
const result = (id,name,text,isError = false) => ({role:'toolResult',toolCallId:id,toolName:name,content:[{type:'text',text}],isError,timestamp:3});
const code = work => { try { work(); } catch (error) { return error.code; } return null; };

describe('agent wire: requests',()=> {
  it('describes the tools as function specs and nothing else',()=> {
    const specs = toolSpecs(tools);
    expect(specs.map(spec=>spec.name)).toEqual(['get_context','finish']);
    for (const spec of specs) expect(Object.keys(spec).sort()).toEqual(['description','name','parameters','type']);
    expect(specs[0].type).toBe('function'); expect(JSON.parse(JSON.stringify(specs[1].parameters)).properties.summary.type).toBe('string');
  });

  it('replays the conversation as Responses items, reasoning and calls included',()=> {
    const items = inputItems({systemPrompt:'SYSTEM',messages:[
      user('Tidy it'),
      assistant([thinking(reasoning),{type:'text',text:'Reading.'},call('call_1','get_context')]),
      result('call_1','get_context','{"layout":1}')
    ]});
    expect(items).toEqual([
      {role:'system',content:[{type:'input_text',text:'SYSTEM'}]},
      {role:'user',content:[{type:'input_text',text:'Tidy it'}]},
      {type:'reasoning',id:'rs_1',summary:[],encrypted_content:'enc-1'},
      {type:'message',role:'assistant',content:[{type:'output_text',text:'Reading.'}]},
      {type:'function_call',call_id:'call_1',name:'get_context',arguments:'{}'},
      {type:'function_call_output',call_id:'call_1',output:'{"layout":1}'}
    ]);
  });

  it('sends a failed tool result as text the model can read',()=> {
    const items = inputItems({messages:[user('x'),assistant([call('c','finish',{summary:'s'})]),result('c','finish','NO_CHANGES. Correct the step.',true)]});
    expect(items.at(-1)).toEqual({type:'function_call_output',call_id:'c',output:'NO_CHANGES. Correct the step.'});
  });

  it('refuses to replay a reasoning item that has lost its encrypted content',()=> {
    const damaged = {type:'thinking',thinking:'',thinkingSignature:JSON.stringify({type:'reasoning',id:'rs_1',summary:[]}),redacted:true};
    expect(code(()=>inputItems({messages:[user('go'),assistant([damaged,call('c','get_context')])]}))).toBe('MALFORMED_PROPOSAL');
  });

  it('folds older tool results so a long run does not resend everything',()=> {
    const messages = [user('go')];
    for (let i = 0; i < 10; i++) messages.push(assistant([call(`c${i}`,'get_context')],`r${i}`),result(`c${i}`,'get_context',`BIG-${i}`));
    const outputs = inputItems({messages}).filter(item=>item.type === 'function_call_output');
    expect(outputs).toHaveLength(10);
    const kept = DEMO_CONFIG.agent.keepToolResults;
    expect(outputs.slice(-kept).map(item=>item.output)).toEqual(Array.from({length:kept},(_,i)=>`BIG-${10 - kept + i}`));
    expect(outputs.slice(0,10 - kept).every(item=>!item.output.includes('BIG') && item.output.length < 80)).toBe(true);
  });

  it('does not request server-side persistence or unsupported execution options',()=> {
    const body = JSON.parse(agentBody({alias:'demo-fast',context:{systemPrompt:'S',messages:[user('go')],tools},stream:true}));
    for (const key of ['previous_response_id','store','max_output_tokens','background','metadata']) expect(body).not.toHaveProperty(key);
  });

  it('refuses a request that has grown past the gateway body limit',()=> {
    const huge = 'x'.repeat(DEMO_CONFIG.maxBodyBytes);
    expect(code(()=>agentBody({alias:'demo-fast',context:{messages:[user(huge)],tools},stream:true}))).toBe('AGENT_CONTEXT_LIMIT');
  });
});

describe('agent wire: answers',()=> {
  const message = text => ({id:'msg_1',type:'message',status:'completed',content:[{type:'output_text',annotations:[],text}],phase:'final_answer',role:'assistant'});
  const fnCall = (id,name,args) => ({id:`fc_${id}`,type:'function_call',status:'completed',call_id:id,name,arguments:args});

  it('turns a completed answer into reasoning, text and tool calls',()=> {
    const content = assistantContent(agentOutput({status:'completed',output:[reasoning,message('Looking.'),fnCall('call_9','apply_operations','{"summary":"s","operations":[]}')]}));
    expect(content).toEqual([
      {type:'thinking',thinking:'',thinkingSignature:JSON.stringify({type:'reasoning',id:'rs_1',summary:[],encrypted_content:'enc-1'}),redacted:true},
      {type:'text',text:'Looking.'},
      {type:'toolCall',id:'call_9',name:'apply_operations',arguments:{summary:'s',operations:[]}}
    ]);
  });

  it('rejects an answer that is not complete, has bad tool arguments, or uses a server-side tool',()=> {
    expect(code(()=>agentOutput({status:'incomplete',output:[]}))).toBe('MALFORMED_PROPOSAL');
    expect(code(()=>assistantContent(agentOutput({status:'completed',output:[fnCall('c','finish','{not json')]})))).toBe('MALFORMED_PROPOSAL');
    expect(code(()=>agentOutput({status:'completed',output:[{type:'web_search_call',id:'w'}]}))).toBe('MALFORMED_PROPOSAL');
    expect(code(()=>agentOutput({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}))).toBe('MALFORMED_PROPOSAL');
  });

  it('ignores benign unknown items',()=> {
    expect(assistantContent(agentOutput({status:'completed',output:[{type:'something_new',id:'z'},message('Hi')]}))).toEqual([{type:'text',text:'Hi'}]);
  });
});

describe('agent wire: long runs',()=> {
  const small = {keepToolResults:2,maxContextChars:3000,keepTurns:2};
  const turns = count => { const messages = [user('go')]; for (let i = 0; i < count; i++) messages.push(assistant([call(`c${i}`,'get_context')],`r${i}`),result(`c${i}`,'get_context','x'.repeat(900))); return messages; };

  it('shows the notes on every turn, right after the request',()=> {
    const memory = createAgentMemory(); memory.note('Header is a two-column grid.');
    const items = inputItems({systemPrompt:'S',messages:turns(1)},memory);
    expect(items[2]).toEqual({role:'user',content:[{type:'input_text',text:expect.stringContaining('Header is a two-column grid.')}]});
    expect(items.map(item=>item.type || item.role).slice(0,3)).toEqual(['system','user','user']);
  });

  it('adds nothing while there is nothing to remember and the request is small',()=> {
    expect(inputItems({systemPrompt:'S',messages:turns(1)},createAgentMemory())).toEqual(inputItems({systemPrompt:'S',messages:turns(1)}));
  });

  it('replaces the oldest turns with a summary when the request grows past its budget, keeping calls and results paired',()=> {
    const memory = createAgentMemory(); memory.addStep('Add a footer note',2); memory.note('Footer still needs a signature line.');
    const items = inputItems({systemPrompt:'S',messages:turns(8)},memory,small);
    const summary = items.find(item=>item.role === 'user' && JSON.stringify(item).includes('Earlier work'));
    expect(summary).toBeDefined(); expect(JSON.stringify(summary)).toContain('1. Add a footer note (2 changes)'); expect(JSON.stringify(summary)).toContain('Footer still needs a signature line.');
    const calls = items.filter(item=>item.type === 'function_call').map(item=>item.call_id), outputs = items.filter(item=>item.type === 'function_call_output').map(item=>item.call_id);
    expect(calls).toEqual(['c6','c7']); expect(outputs).toEqual(calls);
    expect(JSON.stringify(items).length).toBeLessThan(JSON.stringify(inputItems({systemPrompt:'S',messages:turns(8)},memory,{...small,maxContextChars:Infinity})).length);
  });

  it('does not summarise a request that is still within its budget',()=> {
    const items = inputItems({systemPrompt:'S',messages:turns(2)},createAgentMemory(),{...small,maxContextChars:100000});
    expect(JSON.stringify(items)).not.toContain('Earlier work'); expect(items.filter(item=>item.type === 'function_call')).toHaveLength(2);
  });
});

describe('agent wire: reference images',()=> {
  const image = {type:'image',data:'AAAA',mimeType:'image/png'};
  const limits = {...DEMO_CONFIG.agent,imageTurns:2};
  const asked = turnsTaken => { const messages = [{role:'user',content:[{type:'text',text:'Copy this layout'},image],timestamp:1}]; for (let i = 0; i < turnsTaken; i++) messages.push(assistant([call(`c${i}`,'get_context')],`r${i}`),result(`c${i}`,'get_context','ok')); return messages; };

  it('sends the images with the request on the first turns',()=> {
    const items = inputItems({messages:asked(1)},undefined,limits);
    expect(items[0]).toEqual({role:'user',content:[{type:'input_text',text:'Copy this layout'},{type:'input_image',image_url:'data:image/png;base64,AAAA'}]});
    expect(usesImages({messages:asked(1)},limits)).toBe(true);
  });

  it('stops resending them once the model has had its turns with them, and says so',()=> {
    const items = inputItems({messages:asked(2)},undefined,limits);
    expect(items[0].content.map(part=>part.type)).toEqual(['input_text','input_text']);
    expect(items[0].content[1].text).toContain('no longer attached');
    expect(JSON.stringify(items)).not.toContain('AAAA'); expect(usesImages({messages:asked(2)},limits)).toBe(false);
  });

  it('has no images to send when the request had none',()=> {
    expect(usesImages({messages:[user('go')]},limits)).toBe(false);
  });
});
