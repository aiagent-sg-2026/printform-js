import {generateKeyPairSync,sign} from 'node:crypto';
import {readCorpus,canonical,digest} from '../../scripts/studio-v3-g8-corpus.mjs';
import {expectedState} from '../../scripts/studio-v3-g8-evaluator.mjs';
import {treeDigest,sha,changesBetween} from '../../coding-runner/policy.mjs';
import {sourceWorkspaceStarter} from '../../studio-v3/source-workspace-starter.js';

// SYNTHETIC UNIT INPUTS ONLY. Never exported to attempts.csv or claimed as model/process execution.
export const corpus=readCorpus();
const keys=generateKeyPairSync('ed25519');
const budgets={unitOnly:true};
export const profile={schema:'studio-g8-profile-v1',profile:'synthetic-unit-only',modelAlias:'unit-no-provider',
  identity:{source_commit:digest('unit-source').slice(7,47),app_digest:digest('unit-app'),knowledge_digest:digest('unit-knowledge'),runner_image:'unit-image',provider_route:'unit-no-network',model_version:'unit-no-model',browser_os:'unit-no-browser',budgets_digest:digest(budgets)},
  releaseIdentity:{release:digest('unit-source').slice(7,47),contractHash:digest('unit-contract').slice(7),knowledgeHash:digest('unit-knowledge').slice(7),packageHash:digest('unit-app').slice(7)},budgets,corpusDigest:digest(corpus),collectorPublicKey:keys.publicKey.export({format:'pem',type:'spki'})};
export const seal = evidence => ({evidence,signature:sign(null,Buffer.from(canonical(evidence)),keys.privateKey).toString('base64')});
export function fixture(id='T-qa-01') {
  const c=corpus.find(item=>item.id===id),state=structuredClone(c.input.state);
  const body=JSON.stringify({model:profile.modelAlias,input:c.input.prompt});
  const evidence={schema:'studio-g8-evidence-v1',taskId:c.id,inputDigest:digest(c.input),profileDigest:digest(profile),identity:structuredClone(profile.identity),attempt:1,
    runId:'unit-run',documentId:'unit-document',finalDocumentId:'unit-document',baseRevision:0,finalRevision:0,startedAt:100,endedAt:200,usage:'unavailable',before:state,after:structuredClone(state),
    answer:JSON.stringify(c.oracle.exact || {}),events:[{type:'ui-send',promptDigest:digest(c.input.prompt)},{type:'ui-complete',runId:'unit-run'}],providerBodies:[{route:profile.identity.provider_route,body,digest:digest(body)}]};
  if (c.oracle.kind==='answer') {
    const calls=[{type:'function_call',call_id:'unit-capabilities',name:'get_capabilities',arguments:'{}'},{type:'function_call',call_id:'unit-context',name:'get_context',arguments:'{}'}];
    const catalog={version:1,identity:profile.releaseIdentity,tools:[{name:'get_context'},{name:'finish_answer'}]};
    const context={request:c.input.prompt,layout:{style:{font:state.design.font,padding:state.design.padding,repeatTable:state.design.repeatTable,pageNumbers:state.design.pageNumbers},columns:state.design.columns.map(f=>({id:`items-${f.id}`,width:f.width}))},run:{identity:profile.releaseIdentity}};
    const replay=JSON.stringify({model:profile.modelAlias,input:[{role:'user',content:c.input.prompt},...calls,{type:'function_call_output',call_id:'unit-capabilities',output:JSON.stringify(catalog)},{type:'function_call_output',call_id:'unit-context',output:JSON.stringify(context)}]});
    evidence.providerBodies.push({route:profile.identity.provider_route,body:replay,digest:digest(replay)});
    evidence.providerResponses=[{requestDigest:digest(body),body:JSON.stringify({status:'completed',output:calls})},{requestDigest:digest(replay),body:JSON.stringify({status:'completed',output:[{type:'function_call',call_id:'unit-finish',name:'finish_answer',arguments:JSON.stringify({message:evidence.answer})}]})}].map(response=>({...response,digest:digest(response.body)}));
  }
  return {c,evidence};
}
export function geometry(c) {
  const state=expectedState(c),page=state.design.page || {paper:'A4',orientation:'portrait'};
  let [width,height]=({A4:[210,297],A5:[148,210],LETTER:[215.9,279.4],LEGAL:[215.9,355.6]}[page.paper]).map(v=>v*96/25.4);
  if(page.orientation==='landscape')[width,height]=[height,width];
  const rows=state.design.blocks.items.enabled?state.data.items.map((r,i)=>{
    const cells=state.design.columns.map(f=>{const value=r[f.pointer.slice(2)];return {fieldId:`items-${f.id}`,text:f.format?new Intl.NumberFormat(state.locale,f.format==='currency'?{style:'currency',currency:state.currency}:f.format==='percent'?{style:'percent'}:{}).format(value):String(value)};});
    return {sourceIndex:i,cells,text:cells.map(cell=>cell.text).join(' ')};
  }):[];
  return {pages:[{width,height,rects:[{text:[state.design.title,...(c.oracle.text || []),...rows.map(r=>r.text)].join(' '),x:60,y:60,width:300,height:100}]}],rows,measured:{...(c.oracle.geometry || {})}};
}
function tree(files) {
  const entries=files.map(f=>({path:f.path,type:'file',mode:420,content:f.content,bytes:Buffer.byteLength(f.content),digest:sha(f.content)}));
  for(const file of files) {
    const parts=file.path.split('/');parts.pop();
    while(parts.length){const path=parts.join('/');if(!entries.some(e=>e.path===path))entries.push({path,type:'directory',mode:493,bytes:0,digest:null});parts.pop();}
  }
  entries.sort((a,b)=>a.path<b.path?-1:1);
  return {entries,treeDigest:treeDigest(entries)};
}
export function sourceFixture(id='T-source-artifact-01') {
  const {c,evidence:e}=fixture(id),sourceFiles=structuredClone(c.input.files);
  sourceFiles.find(f=>f.path==='src/form.mjs').content=sourceWorkspaceStarter()[0].content.replace('GENERATED FORM',c.oracle.heading).replace("      {type:'set_heading',value:title}","      {type:'set_heading',value:title}"+c.oracle.artifact.operations.slice(2).map(op=>`,\n      ${JSON.stringify(op)}`).join(''));
  if(c.family==='source-implement') {
    sourceFiles.push({path:'src/title.mjs',content:`export const defaultTitle=${JSON.stringify(c.oracle.heading)};\n`});
    sourceFiles.find(f=>f.path==='src/form.mjs').content=`import {defaultTitle} from './title.mjs';\n`+sourceFiles.find(f=>f.path==='src/form.mjs').content.replace(`'${c.oracle.heading}'`, 'defaultTitle');
  }
  const initialTree=tree(c.input.files),testTree=tree(sourceFiles),content=JSON.stringify(c.oracle.artifact),finalTree=tree([...sourceFiles,{path:'artifacts/form.printform-operations.json',content}]);
  const call=(id,command,input,output,exitCode,revision)=>({args:{command,cwd:'',env:{}},inputTree:input,receipt:{callId:id,operation:'run',status:'completed',beforeRevision:revision,afterRevision:revision+(input.treeDigest!==output.treeDigest?1:0),beforeDigest:input.treeDigest,afterDigest:output.treeDigest,imageDigest:profile.identity.runner_image,exitCode,changes:changesBetween(input.entries,output.entries),stdout:'synthetic unit fixture, not executed',...(exitCode?{error:{code:'COMMAND_FAILED'}}:{})}});
  const calls=[...(c.oracle.failingBaseline?[call('baseline','node --test test/form.test.mjs',initialTree,initialTree,1,0)]:[]),call('test','node --test test/form.test.mjs',testTree,testTree,0,1),call('build','node build.mjs',testTree,finalTree,0,1)];
  e.source={workspaceId:'unit-workspace',initialTree,finalTree,calls};
  const a={mediaType:'application/json',content,contentDigest:sha(content),bytes:Buffer.byteLength(content),workspaceId:e.source.workspaceId,sourceRevision:2,buildCallId:'build',treeDigest:finalTree.treeDigest,imageDigest:profile.identity.runner_image,releaseIdentity:profile.releaseIdentity,documentId:e.documentId,baseRevision:e.baseRevision,runId:e.runId};
  a.id=`artifact-${sha(JSON.stringify([a.workspaceId,a.buildCallId,'artifacts/form.printform-operations.json',a.sourceRevision,a.treeDigest,a.contentDigest,a.imageDigest]))}`;
  e.artifact=a;e.candidate=expectedState(c);e.geometry=geometry(c);e.events.push({type:'tool-result',tool:'import_artifact',artifactId:a.id});
  return {c,evidence:e};
}
