import { AgentHarness, MemorySessionRepo, BACKGROUND_CONTEXT, withAbortSignal } from '@earendil-works/pi-agent-core';
import { createModels, createProvider, createAssistantMessageEventStream, Type } from '@earendil-works/pi-ai';
import { parseProposal, fail } from './ai-edits.js';

// Actual Harness + pi-ai extension. Demo cannot carry native tools:
// one validated text envelope becomes one LOCAL proposal tool invocation.
export async function runLayoutHarness({transport,alias,request,project,signal,onPhase = ()=>{}}) {
  signal.throwIfAborted();
  const context = withAbortSignal(signal,BACKGROUND_CONTEXT);
  let proposal, usage, calls = 0, transportError, toolError;
  const model = {id:alias,name:alias,provider:'printform-demo',api:'printform-demo-envelope',baseUrl:'https://gpt.yapweijun1996.com/demo/v1',reasoning:false,input:['text'],contextWindow:32000,maxTokens:4096,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
  const stream = (_model,_context,options = {}) => {
    const events = createAssistantMessageEventStream();
    const output = {role:'assistant',content:[],api:model.api,provider:model.provider,model:alias,stopReason:'toolUse',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
    void (async () => {
      try {
        if (++calls > 1) throw fail('AI_STEP_LIMIT');
        onPhase('Requesting layout suggestion');
        const reply = await transport.plan(alias,request,options.signal || signal);
        signal.throwIfAborted();
        const parsed = parseProposal(reply.text,project);
        output.content = [{type:'toolCall',id:crypto.randomUUID(),name:'preview_layout',arguments:{envelope:JSON.stringify({summary:parsed.summary,edits:parsed.diff.map(d=>({target:d.target,property:d.property,value:d.after}))})}}];
        for (const [key,wire] of [['input','prompt_tokens'],['output','completion_tokens'],['totalTokens','total_tokens']]) {
          const value = reply.usage?.[wire]; if (Number.isFinite(value) && value >= 0) output.usage[key] = value;
        }
        usage = {input:output.usage.input,output:output.usage.output,total:output.usage.totalTokens};
        events.push({type:'start',partial:output});
        events.push({type:'done',reason:'toolUse',message:output}); events.end();
      } catch (error) {
        transportError = error;
        output.stopReason = signal.aborted ? 'aborted' : 'error'; output.errorMessage = error.code || 'AI_REQUEST_FAILED';
        events.push({type:'error',reason:output.stopReason,error:output}); events.end();
      }
    })();
    return events;
  };
  const models = createModels();
  models.setProvider(createProvider({id:model.provider,models:[model],auth:{apiKey:{name:'Demo managed by transport',resolve:async()=>({auth:{apiKey:'transport-managed'},source:'memory-only Demo'})}},api:{stream,streamSimple:stream}}));
  const sessionRepo = new MemorySessionRepo();
  const session = await sessionRepo.create({},context);
  const tool = {name:'preview_layout',label:'Preview layout',description:'Validate a bounded design proposal locally; never apply.',replay:'never',parameters:Type.Object({envelope:Type.String({maxLength:20000})}),execute:async (_id,args) => {
    signal.throwIfAborted(); onPhase('Validating local proposal');
    try { proposal = parseProposal(args.envelope,project); }
    catch (error) { toolError = error; throw error; }
    return {content:[{type:'text',text:'Proposal ready for human preview and apply.'}],details:{terminal:true},terminate:true};
  }};
  const created = await AgentHarness.create({session,models,model,tools:[tool],activeToolNames:[tool.name],systemPrompt:'Use one local preview tool and stop.',toolExecution:'sequential',retry:{enabled:false,maxRetries:0,baseDelayMs:0}},context);
  const harness = created.harness;
  const off = harness.hooks.on('after_tool',()=>({terminate:true}));
  try {
    signal.throwIfAborted();
    const lane = await harness.lane('layout',context);
    const onAbort = () => { void lane.abort(BACKGROUND_CONTEXT); };
    signal.addEventListener('abort',onAbort,{once:true});
    try {
      const result = await lane.prompt(request,context);
      signal.throwIfAborted();
      if (transportError) throw transportError;
      if (toolError) throw toolError;
      if (!result.ok || !proposal) throw fail('AI_RUN_FAILED');
      return {...proposal,alias,usage};
    } finally { signal.removeEventListener('abort',onAbort); }
  } finally { off(); await harness.close(BACKGROUND_CONTEXT); models.clearProviders(); }
}
