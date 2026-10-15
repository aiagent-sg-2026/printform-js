import { fail } from './ai-edits.js';
import { isSourceAuthorization } from './source-workspace-run.js';

function workspace(run) {
  if (!isSourceAuthorization(run.workspace)) throw fail('WORKSPACE_UNAVAILABLE');
  return run.workspace;
}
function current(run) { run.signal.throwIfAborted(); run.assertCurrent(); }
export function sourceToolHandlers(reply) {
  const action = operation => async (args,run) => {
    const result = await workspace(run).action(operation,args,run.signal);
    current(run); run.evidence = true;
    return reply({source:'untrusted-workspace',...result},{details:{detail:operation === 'run' ? `process exit ${result.exitCode ?? 'unknown'}` : 'isolated source'}});
  };
  return {
    workspace_list:action('list'),workspace_read:action('read'),workspace_search:action('search'),
    workspace_write:action('write'),workspace_patch:action('patch'),workspace_run:action('run'),workspace_diff:action('diff'),
    workspace_artifacts:async(args,run)=> {
      const artifact = await workspace(run).artifact(args,run.signal);
      current(run); run.evidence = true;
      return reply(artifact,{details:{detail:'source-bound JSON artifact'}});
    },
    import_artifact:async({artifactId},run)=> {
      const {artifact,evidence} = await workspace(run).importArtifact(artifactId,run.signal);
      current(run);
      const step = run.draft.apply(artifact.summary,artifact.operations);
      run.pixels.clear(); run.observations.invalidate(); run.inspected = null;
      run.sourceArtifact = {evidence,draftVersion:run.draft.version};
      run.memory.addStep(artifact.summary,step.diff.length);
      return reply({accepted:true,artifactId,draftVersion:run.draft.version,changes:step.diff.length},{details:{detail:`${step.diff.length} private draft changes`}});
    }
  };
}
