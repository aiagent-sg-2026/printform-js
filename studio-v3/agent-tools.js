import { validateToolArguments } from '@earendil-works/pi-ai';
import { createAgentMemory } from './agent-memory.js';
import { fail } from './ai-edits.js';
import { AGENT_TOOL_DEFINITIONS } from './agent-registry.js';
import { TOOL_HANDLERS } from './agent-handlers.js';
import { createGrant, assertEffect, grantedDefinitions } from './agent-effects.js';
export { AGENT_TOOL_NAMES } from './agent-registry.js';

// Registry metadata owns the model-visible contract; TOOL_HANDLERS own runtime effects and validation.
// `grant` is host-built and frozen. Every registered tool is wrapped so its handler re-checks the grant, even though
// the model is only shown the granted ones (`visible`); a hidden tool never reaches a handler.
export function createAgentTools({draft,context,inspect,signal,outcome,limits,identity,stopRun=()=>{},memory = createAgentMemory(),onStep = () => {},
  definitions = AGENT_TOOL_DEFINITIONS,handlers = TOOL_HANDLERS,grant = createGrant('design'),finalizeAnswer}) {
  const visible = grantedDefinitions(grant,definitions);
  const run = {calls:0,failure:'',repeats:0,inspected:null,evidence:false,draft,context,inspect,signal,outcome,limits,identity,memory,definitions,visible,grant,finalizeAnswer};
  const begin = name => {
    signal.throwIfAborted(); outcome.turns = ++run.calls;
    if (run.calls > limits.maxTurns) {
      outcome.blocked = {code:'AGENT_BUDGET'}; onStep({name,ok:false,code:'AGENT_BUDGET'}); stopRun(); throw fail('AGENT_BUDGET');
    }
  };
  const rejected = (name,args,error) => {
    if (signal.aborted) throw error;
    const code = error.code || 'TOOL_FAILED', signature = `${name}:${code}:${JSON.stringify(args)}`;
    run.repeats = signature === run.failure ? run.repeats + 1 : 1; run.failure = signature;
    onStep({name,ok:false,code});
    if (run.repeats >= limits.maxRepeatedFailures) { outcome.blocked = {code:'AGENT_STALLED'}; stopRun(); throw fail('AGENT_STALLED'); }
    throw Object.assign(new Error(`${code}. Correct the step and try again, or call undo_step.`),{code});
  };
  if (definitions.length !== Object.keys(handlers).length || definitions.some(({name})=>!handlers[name])) throw fail('AGENT_REGISTRY_INVALID');
  return definitions.map(definition=> {
    const {name,description,parameters} = definition;
    let prepared = false;
    return {name,label:name,description,parameters,replay:'never',
      prepareArguments:args=> {
        prepared = false; begin(name);
        try { assertEffect(grant,definition); } catch (error) { return rejected(name,args,error); }
        try {
          const validated = validateToolArguments(definition,{name,id:'schema-check',arguments:args});
          // Pi may coerce primitives or optional nulls; the product accepts only the raw declared types.
          if (JSON.stringify(validated) !== JSON.stringify(args)) throw new Error();
          prepared = true; return args;
        } catch { return rejected(name,args,fail('AGENT_ARGUMENTS_INVALID')); }
      },
      execute:async (_id,args) => {
        if (!prepared) begin(name); prepared = false;
        try {
          assertEffect(grant,definition);
          const result = await handlers[name](args || {},run);
          run.failure = ''; run.repeats = 0; onStep({name,ok:true,detail:result.details?.detail}); return result;
        } catch (error) { return rejected(name,args,error); }
      }
    };
  });
}
