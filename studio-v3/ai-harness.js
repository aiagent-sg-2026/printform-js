import { AgentHarness, MemorySessionRepo, BACKGROUND_CONTEXT, withAbortSignal } from '@earendil-works/pi-agent-core';
import { createModels, createProvider, createAssistantMessageEventStream, Type } from '@earendil-works/pi-ai';
import { fail } from './ai-edits.js';
import { parseChatReply } from './ai-chat-protocol.js';
import { safeRunDiagnostics, repairRequest } from './ai-inspection.js';

// Actual Harness + pi-ai extension. Demo cannot carry native tools:
// one validated text envelope becomes one LOCAL proposal tool invocation.
async function runStepHarness({transport,alias,request,project,signal,chat={},media=[],inspectCandidate,assertContext=()=>{},onPhase = ()=>{}}) {
  signal.throwIfAborted();
  const context = withAbortSignal(signal,BACKGROUND_CONTEXT);
  let proposal, usage, inspection, envelope, calls = 0, transportError, toolError;
  const model = {id:alias,name:alias,provider:'printform-demo',api:'printform-demo-envelope',baseUrl:'https://gpt.yapweijun1996.com/demo/v1',reasoning:false,input:media.length ? ['text','image'] : ['text'],contextWindow:32000,maxTokens:4096,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
  const stream = (_model,_context,options = {}) => {
    const events = createAssistantMessageEventStream();
    const output = {role:'assistant',content:[],api:model.api,provider:model.provider,model:alias,stopReason:'toolUse',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
    void (async () => {
      try {
        if (++calls > 1) throw fail('AI_STEP_LIMIT');
        assertContext();
        onPhase('Requesting layout suggestion');
        const reply = await transport.plan(alias,request,options.signal || signal,media);
        envelope = reply.text;
        signal.throwIfAborted();
        const parsed = parseChatReply(reply.text,project,chat);
        output.content = [{type:'toolCall',id:crypto.randomUUID(),name:parsed.kind === 'answer' ? 'answer_layout' : 'preview_layout',arguments:{envelope:reply.text}}];
        for (const [key,wire] of [['input','prompt_tokens'],['output','completion_tokens'],['totalTokens','total_tokens']]) {
          const value = reply.usage?.[wire]; if (Number.isFinite(value) && value >= 0) output.usage[key] = value;
        }
        usage = Object.fromEntries([['input','prompt_tokens'],['output','completion_tokens'],['total','total_tokens']].map(([key,wire])=>[key,Number.isFinite(reply.usage?.[wire]) && reply.usage[wire] >= 0 ? reply.usage[wire] : null]));
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
  const tools = ['preview_layout','answer_layout'].map(name=>({name,label:name === 'preview_layout' ? 'Preview layout' : 'Answer layout',description:'Validate a bounded result locally; never apply.',replay:'never',parameters:Type.Object({envelope:Type.String({maxLength:20000})}),execute:async (_id,args) => {
    signal.throwIfAborted(); onPhase(name === 'preview_layout' ? 'Validating local proposal' : 'Reading current layout');
    try {
      proposal = parseChatReply(args.envelope,project,chat);
      if (proposal.kind === 'proposal' && inspectCandidate) {
        onPhase('Inspecting real print preview');
        inspection = safeRunDiagnostics(await inspectCandidate(proposal),proposal.candidate);
        signal.throwIfAborted();
      }
    }
    catch (error) { toolError = error; throw error; }
    return {content:[{type:'text',text:proposal.kind === 'answer' ? 'Read-only answer ready.' : 'Candidate authored and locally inspected; human Apply required.'}],details:{terminal:true,...(inspection ? {inspection} : {})},terminate:true};
  }}));
  const created = await AgentHarness.create({session,models,model,tools,activeToolNames:tools.map(t=>t.name),systemPrompt:'Use one local answer or preview tool and stop.',toolExecution:'sequential',retry:{enabled:false,maxRetries:0,baseDelayMs:0}},context);
  const harness = created.harness;
  const off = harness.hooks.on('after_tool',()=>({terminate:true}));
  try {
    signal.throwIfAborted();
    assertContext();
    const lane = await harness.lane('layout',context);
    const onAbort = () => { void lane.abort(BACKGROUND_CONTEXT); };
    signal.addEventListener('abort',onAbort,{once:true});
    try {
      const result = await lane.prompt(request,context);
      signal.throwIfAborted();
      if (transportError) { transportError.proposalEnvelope = envelope; throw transportError; }
      if (toolError) { toolError.proposalEnvelope = envelope; throw toolError; }
      if (!result.ok || !proposal) throw fail('AI_RUN_FAILED');
      return {...proposal,alias,usage,inspection,envelope};
    } finally { signal.removeEventListener('abort',onAbort); }
  } finally { off(); await harness.close(BACKGROUND_CONTEXT); models.clearProviders(); }
}

export async function runLayoutHarness(options) {
  const {signal,onPhase=()=>{},inspectCandidate,request,project} = options;
  const totals = {input:0,output:0,total:0}; let previous, diagnostics, unknown = new Set();
  const limit = inspectCandidate ? 3 : 1;
  for (let attempt=1;attempt<=limit;attempt++) {
    signal.throwIfAborted();
    const currentRequest = attempt === 1 ? request : repairRequest(request,{attempt,envelope:previous?.envelope,diagnostics});
    if (currentRequest.length > 65000) throw fail('AI_CONTEXT_LIMIT');
    try {
      const result = await runStepHarness({...options,request:currentRequest});
      for (const key of Object.keys(totals)) {
        if (Number.isFinite(result.usage?.[key])) totals[key] += result.usage[key]; else unknown.add(key);
      }
      previous = result; diagnostics = result.inspection;
      if (result.kind === 'answer' || !diagnostics || diagnostics.ready || attempt === limit) {
        return {...result,iterations:attempt,usage:Object.fromEntries(Object.keys(totals).map(key=>[key,unknown.has(key) ? null : totals[key]]))};
      }
    } catch (error) {
      if (signal.aborted || !['LOGO_ASSET_UNAVAILABLE','TABLE_SECTION_GRID_UNSUPPORTED','AUTHORING_OPERATION_LIMIT','GLOBAL_FONT_PROPERTY_UNSUPPORTED','MALFORMED_PROPOSAL','UNSAFE_PROPOSAL','UNSAFE_SCOPE','COLUMN_WIDTH_LIMIT','NO_CHANGES','TABLE_BACKGROUND_INTENT'].includes(error.code) || attempt === limit) throw error;
      // Failed completions have unavailable usage; never report zero consumption.
      for (const key of Object.keys(totals)) unknown.add(key);
      previous = {envelope:error.proposalEnvelope};
      diagnostics = safeRunDiagnostics({errors:(error.diagnosticCodes || [error.code]).map(code=>({code})),metrics:error.metrics},project);
    }
    signal.throwIfAborted(); onPhase(`Repairing inspected candidate (${attempt+1}/${limit})`);
  }
  throw fail('AI_RUN_FAILED');
}
