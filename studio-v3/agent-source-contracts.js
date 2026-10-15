import { Type } from '@earendil-works/pi-ai';
import { SOURCE_TOOL_FEATURES } from './agent-source-definitions.js';
import { SOURCE_ERROR_CONTRACTS } from './source-workspace-errors.js';

const open = properties => Type.Object(properties,{additionalProperties:true});
const digest = Type.String({pattern:'^[a-f0-9]{64}$'});
const receipt = open({callId:Type.String(),status:Type.Literal('completed'),beforeRevision:Type.Integer({minimum:0}),afterRevision:Type.Integer({minimum:0}),beforeDigest:digest,afterDigest:digest,imageDigest:Type.String()});
const descriptor = open({id:Type.String(),mediaType:Type.Literal('application/json'),bytes:Type.Integer({minimum:1,maximum:64000}),contentDigest:digest,
  workspaceId:Type.String(),sourceRevision:Type.Integer({minimum:0}),buildCallId:Type.String(),treeDigest:digest,imageDigest:Type.String(),releaseIdentity:open({}),documentId:Type.String(),baseRevision:Type.Integer({minimum:0}),runId:Type.String()});
const examples = {
  workspace_list:{},workspace_read:{path:'src/form.mjs'},workspace_search:{pattern:'buildForm',literal:true},
  workspace_write:{path:'src/additional.mjs',expectedDigest:null,content:'export const fictional = true;\n'},
  workspace_patch:{changes:[{path:'src/additional.mjs',expectedDigest:null,content:'export const fictional = true;\n'}]},
  workspace_run:{command:'node --test test/form.test.mjs',timeoutMs:10000},workspace_diff:{},
  workspace_artifacts:{callId:'fictional-call',path:'artifacts/form.printform-operations.json'},import_artifact:{artifactId:'fictional-artifact'}
};

// Default build conformance deliberately exercises missing-session denials, not a
// mock shell/filesystem. Positive process/file/artifact proof requires real Docker
// and an actual browser-origin pairing, recorded separately from these examples.
export function sourceToolContracts(authoringErrors) {
  return Object.fromEntries(SOURCE_TOOL_FEATURES.map(({name})=>[name,{
    outputSchema:name === 'workspace_artifacts' ? descriptor : name === 'import_artifact' ? open({accepted:Type.Literal(true),artifactId:Type.String(),draftVersion:Type.Integer(),changes:Type.Integer()}) : receipt,
    errors:[...new Set(['AGENT_ARGUMENTS_INVALID','GRANT_DENIED','TOOL_FAILED',...Object.keys(SOURCE_ERROR_CONTRACTS),...(name === 'import_artifact' ? authoringErrors : [])])],
    availability:'Explicit paired fictional-source host grant; no default source authority',
    limits:{sourceBytes:4194304,fileBytes:262144,files:128,commandMs:60000,rawOutputBytes:64000,artifactBytes:64000},
    examples:[{args:examples[name],sourceFixture:'missing-session',error:'WORKSPACE_UNAVAILABLE'}],
    invalid:[{args:{...examples[name],extraAuthority:true},sourceFixture:'missing-session',error:'AGENT_ARGUMENTS_INVALID'},
      {args:examples[name],grant:'design',error:'GRANT_DENIED'}]
  }]));
}
