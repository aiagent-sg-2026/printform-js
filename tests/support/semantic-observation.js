import {authorizeObservation} from '../../studio-v3/observation-policy.js';
import {createAgentTools} from '../../studio-v3/agent-tools.js';
import {createDraft} from '../../studio-v3/agent-draft.js';
import {newProject} from '../../studio-v3/model.js';

const diagnostics = {report:{status:'ready',metrics:{logicalPages:1,rows:45},pageGeometry:[{pageIndex:0,width:794,height:1123}]}};
export async function semanticRun({text = false,policy = null,mutate = () => {}} = {}) {
  const project = newProject(); project.manifest.studioV3.header[0].label = 'AUTHORIZED_LABEL_CANARY';
  project.manifest.studioV3.footer.push({id:'semantic-note',kind:'static',label:'Note',text:'AUTHORIZED_STATIC_CANARY',pointer:'',format:''});
  project.sampleData.company.name = 'BOUND_VALUE_CANARY'; project.sampleData.privateSecret = 'UNASSIGNED_SECRET_CANARY';
  project.sampleData.signaturePixels = 'data:image/png;base64,PIXEL_CANARY';
  mutate(project);
  const state = {project,baseRevision:7,runId:'semantic-run',dataPolicy:typeof policy === 'function' ? policy(project.manifest.documentId) : policy,selectedTargets:['label-header-company','items']};
  const authorization = await authorizeObservation(state,{text}), draft = createDraft(project), outcome = {};
  let render = async()=>diagnostics;
  const tools = createAgentTools({draft,outcome,context:()=>'',inspect:()=>render(),signal:new AbortController().signal,
    identity:{release:'test',verified:true},limits:{maxTurns:100,maxRepeatedFailures:10},runId:state.runId,baseRevision:state.baseRevision,
    observationAuthorization:authorization,readObservationHost:()=>state});
  const execute = (name,args = {})=>tools.find(tool=>tool.name === name).execute('semantic-test',args);
  const observe = async()=>JSON.parse((await execute('observe_context')).content[0].text);
  return {state,draft,authorization,observe,execute,setRender:value=> { render = value; }};
}
