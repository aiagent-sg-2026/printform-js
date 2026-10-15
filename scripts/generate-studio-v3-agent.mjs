import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { capabilityCatalog, validateRegistry, AGENT_TOMBSTONES } from '../studio-v3/agent-registry.js';
import { AGENT_SKILLS } from '../studio-v3/agent-knowledge.js';
import { checkAgentConformance } from './studio-v3-agent-conformance.mjs';
import { fileHash, importClosure, dependencyIndex, entryFileHashes, explainChanges } from './studio-v3-agent-impact.mjs';
import { readReleaseState, assertReleaseReview } from './studio-v3-agent-review.mjs';
import { runnerSourceHash } from '../coding-runner/identity.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const json = value => JSON.stringify(canonical(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const revisionPattern = /^(?:[a-f0-9]{40}|local)$/;
export function capabilityChanges(previous,current) {
  if (previous && (previous.version!==1 || !revisionPattern.test(previous.release) || !Array.isArray(previous.entries) ||
      new Set(previous.entries.map(e=>e.id)).size!==previous.entries.length || previous.entries.some(e=>typeof e.id!=='string' || !/^[a-f0-9]{64}$/.test(e.hash)))) throw new Error('Invalid published agent baseline.');
  const before=new Map((previous?.entries || []).map(entry=>[entry.id,entry])), after=new Map(current.entries.map(entry=>[entry.id,entry])), changes=[];
  for (const entry of current.entries) {
    const old=before.get(entry.id);
    if (!old || old.hash!==entry.hash) changes.push({id:entry.id,kind:!old ? 'added' : entry.status==='deprecated' && old.status!=='deprecated' ? 'deprecated' : 'changed',reviewRequired:true,
      ...(entry.status==='deprecated' ? {replacementId:entry.replacementId} : {})});
  }
  // A removal reports its tombstone advice; tombstone:false marks a removal the release gate must reject.
  const stones=new Map((current.tombstones || []).map(stone=>[stone.id,stone]));
  for (const entry of before.values()) if (!after.has(entry.id)) {
    const stone=stones.get(entry.id);
    changes.push({id:entry.id,kind:'removed',reviewRequired:true,...(stone ? {tombstone:true,replacementId:stone.replacementId,advice:stone.advice} : {tombstone:false})});
  }
  return {version:1,baseline:previous ? {release:previous.release,packageHash:previous.packageHash} : null,current:{release:current.release,packageHash:current.packageHash},changes};
}
// Runtime/build code whose change alters the package identity even when no capability contract changes.
const RUNTIME_ROOTS=['studio-v3/agent-loop.js','studio-v3/agent-release.js','studio-v3/ai-agent-run.js','scripts/build-studio-v3.mjs','scripts/studio-v3-pwa.mjs'];
const skillEntry=skill=>({id:`printform.knowledge.${skill.id}`,sources:[...new Set(['studio-v3/agent-knowledge.js',...skill.sources])],evaluations:skill.evaluations,skills:[skill.id]});
export function generateAgentPackage({root=process.cwd(),output,revision=process.env.GITHUB_SHA || 'local',baseline=null,baselineIndex=null}={}) {
  if (!revisionPattern.test(revision)) throw new Error('Invalid agent package revision.');
  const capabilities=validateRegistry(), catalog=JSON.parse(json(capabilityCatalog()));
  delete catalog.identity; delete catalog.run;
  for (const skill of AGENT_SKILLS) if (!/^[a-z0-9-]{1,80}$/.test(skill.id) || !skill.description || skill.content.length>16000 || !skill.sources.length || !skill.evaluations.length) throw new Error('Invalid bundled agent skill.');
  // Each entry is hashed over its contract, its sources' full import closure and its evaluations (KNO-01/03).
  const index={release:revision,...dependencyIndex(root,[...capabilities,...AGENT_SKILLS.map(skillEntry)])};
  if (index.untracked.length) throw new Error(`Untracked dynamic agent dependency: ${index.untracked.join(', ')}`);
  const entries=capabilities.map(entry=>({id:entry.id,status:entry.status || 'active',...(entry.status==='deprecated' ? {replacementId:entry.replacementId} : {}),
    hash:hash(json({...entry,fileHashes:entryFileHashes(index,entry.id)}))}));
  const skills=AGENT_SKILLS.map(skill=>({id:skill.id,description:skill.description,resource:`resources/${skill.id}.md`,hash:hash(skill.content),
    sourceHashes:Object.fromEntries(skillEntry(skill).sources.map(name=>[name,fileHash(root,name)])),evaluations:skill.evaluations}));
  const knowledge={version:1,skills}, contractHash=hash(json({catalog,entries})), knowledgeHash=hash(json(knowledge));
  const runtime=importClosure(root,RUNTIME_ROOTS).files, sourceRunnerHash=runnerSourceHash(path.join(root,'coding-runner'));
  const packageHash=hash(json({release:revision,contractHash,knowledgeHash,sourceRunnerHash,runtimeHashes:Object.fromEntries(runtime.map(name=>[name,fileHash(root,name)]))}));
  entries.push(...skills.map(skill=>({id:`printform.knowledge.${skill.id}`,status:'active',hash:hash(json({...skill,fileHashes:entryFileHashes(index,`printform.knowledge.${skill.id}`)}))})));
  const identity={release:revision,contractHash,knowledgeHash,packageHash,sourceRunnerHash};
  const documents={'capabilities.json':json({...catalog,version:1,contractHash,entries})+'\n','knowledge-index.json':json(knowledge)+'\n',
    ...Object.fromEntries(AGENT_SKILLS.map(skill=>[`resources/${skill.id}.md`,skill.content]))};
  const tombstones=AGENT_TOMBSTONES.map(({id,name,replacementId,removedIn,advice})=>({id,name,replacementId,removedIn,advice}));
  const manifest={version:1,...identity,entries,tombstones,files:Object.fromEntries(Object.entries(documents).map(([name,content])=>[name,hash(content)]))};
  const report=capabilityChanges(baseline,manifest), changes={...report,changes:explainChanges(report.changes,baselineIndex,index)};
  if (output) {
    // The dependency index is for release review; it is published outside the release folder, so the offline shell does not cache it.
    const files={...Object.fromEntries(Object.entries({...documents,'agent-manifest.json':json(manifest)+'\n','capability-changes.json':json(changes)+'\n'}).map(([name,content])=>[`agent/${name}`,content])),
      'agent-index/dependency-index.json':json(index)+'\n'};
    for (const [name,content] of Object.entries(files)) {
      const target=path.resolve(output,'studio-v3',name); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content);
    }
  }
  return {identity,manifest,catalog,knowledge,changes,index};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2), baselinePath=args.includes('--baseline') ? args[args.indexOf('--baseline')+1] : null;
  const output=args.includes('--output') ? args[args.indexOf('--output')+1] : undefined;
  const indexPath=args.includes('--baseline-index') ? args[args.indexOf('--baseline-index')+1] : null;
  const conformance=await checkAgentConformance();
  const read=file=>file ? JSON.parse(fs.readFileSync(file,'utf8')) : null;
  // Without an explicit baseline, compare with the committed last publication and enforce the release review.
  const state=baselinePath ? null : readReleaseState();
  const result=generateAgentPackage({output,baseline:state ? state.baseline : read(baselinePath),baselineIndex:state ? state.baselineIndex : read(indexPath)});
  if (state) assertReleaseReview(result,{state});
  console.log(`Studio v3 agent package checked: ${result.catalog.tools.length} tools, ${result.catalog.operations.length} operations, ${result.knowledge.skills.length} skill, ${conformance.examples} contract examples; ${result.changes.changes.length} changes since ${result.changes.baseline?.release.slice(0,12) || 'no baseline'}${state ? ', all reviewed' : ''}.`);
}
