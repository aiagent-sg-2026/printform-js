import { createModels, createProvider, createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import { progressText } from './ai-response-reader.js';
import { assistantContent } from './agent-wire.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';
import { fail } from './ai-edits.js';
import { agentUsage, addAgentUsage } from './agent-usage.js';

const ZERO = {input:0,output:0,cacheRead:0,cacheWrite:0};
// A Pi provider that sends each model turn through the Demo transport. The model, its tools and its history are Pi's;
// this only turns a turn into a request and the answer back into an assistant message. Keys never enter: the transport
// holds the short-lived session. `failure()` is the error of a failed turn, so the loop can report its real code.
export function createGatewayModel({transport,alias,signal,assertContext = () => {},maxTokens = DEMO_CONFIG.agent.maxRunTokens,memory,onTurn = () => {},onPhase = () => {}}) {
  const model = {id:alias,name:alias,provider:'printform-demo',api:'printform-demo-agent',baseUrl:'https://gpt.yapweijun1996.com/demo/v1',reasoning:true,input:transport.supportsImages?.(alias) ? ['text','image'] : ['text'],contextWindow:128000,maxTokens:16384,cost:{...ZERO}};
  const totals = {input:0,output:0,total:0};
  let failed = null, turns = 0;
  const stream = (_model,context,options = {}) => {
    const events = createAssistantMessageEventStream();
    const output = {role:'assistant',content:[],api:model.api,provider:model.provider,model:alias,stopReason:'stop',timestamp:Date.now(),usage:{...ZERO,totalTokens:0,cost:{...ZERO,total:0}}};
    void (async () => {
      try {
        const activeSignal = options.signal || signal;
        activeSignal?.throwIfAborted();
        assertContext();
        if (totals.total === null) throw fail('AGENT_USAGE_UNAVAILABLE');
        if (totals.total >= maxTokens) throw fail('AGENT_TOKEN_BUDGET');
        onPhase('Waiting for the AI service');
        const turn = await transport.agentTurn(alias,context,activeSignal,{memory,assertCurrent:assertContext,onProgress:progress=>onPhase(progressText(progress),{progress:true})});
        const usage = agentUsage(turn.usage);
        addAgentUsage(totals,usage);
        onTurn({turn:++turns,totals:{...totals}});
        if (totals.total === null) throw fail('AGENT_USAGE_UNAVAILABLE');
        activeSignal?.throwIfAborted();
        assertContext();
        output.content = assistantContent(turn.output);
        output.stopReason = output.content.some(block=>block.type === 'toolCall') ? 'toolUse' : 'stop';
        // Pi requires numeric message fields; the host usage projection preserves unavailable components as null.
        Object.assign(output.usage,{input:usage.input ?? 0,output:usage.output ?? 0,totalTokens:usage.total});
        events.push({type:'start',partial:output}); events.push({type:'done',reason:output.stopReason,message:output}); events.end();
      } catch (error) {
        failed = error;
        output.stopReason = (options.signal || signal)?.aborted ? 'aborted' : 'error'; output.errorMessage = error.code || 'AI_REQUEST_FAILED';
        events.push({type:'error',reason:output.stopReason,error:output}); events.end();
      }
    })();
    return events;
  };
  const models = createModels();
  models.setProvider(createProvider({id:model.provider,models:[model],auth:{apiKey:{name:'Demo managed by transport',resolve:async()=>({auth:{apiKey:'transport-managed'},source:'memory-only Demo'})}},api:{stream,streamSimple:stream}}));
  return {models,model,usage:() => ({...totals}),failure:() => failed};
}
