import fs from 'node:fs';
import {readCorpus,validateCorpus,digest,publicInput,projectForCase,canonical} from './studio-v3-g8-corpus.mjs';
import {evaluateEvidence,profileErrors} from './studio-v3-g8-evaluator.mjs';
import {saveProject} from '../studio-v3/file-io.js';
import {readRegister} from './studio-v3-task-register.mjs';
import {readInventory} from './studio-v3-g8-inventory.mjs';
import {preflight} from './studio-v3-g8-preflight.mjs';

// Offline only: no model calls, execution scheduling, automatic attempts or Pass rows.
const [command,...args] = process.argv.slice(2);
try {
  const corpus=readCorpus();
  if (command==='validate') {
    const errors=validateCorpus(corpus);
    console.log(JSON.stringify({tasks:corpus.length,holdout:corpus.filter(c=>c.holdout).length,corpusDigest:digest(corpus),errors},null,2));
    if (errors.length) process.exitCode=1;
  } else if (command==='input' || command==='project') {
    const c=corpus.find(item=>item.id===args[0]);
    if (!c) throw new Error('Unknown corpus task ID');
    const input=publicInput(c,{qualification:args.includes('--qualification')});
    console.log(command==='project'?saveProject(projectForCase(c)):JSON.stringify(input,null,2));
  } else if (command==='profile') {
    const identity=JSON.parse(fs.readFileSync(args[0],'utf8'));
    const collectorPublicKey=fs.readFileSync(args[1],'utf8');
    const profile={schema:'studio-g8-profile-v1',profile:args[2],modelAlias:identity.modelAlias,identity:identity.identity,releaseIdentity:identity.releaseIdentity,budgets:identity.budgets,corpusDigest:digest(corpus),collectorPublicKey};
    const errors=profileErrors(profile,corpus);
    if (errors.length) throw new Error(errors.join('; '));
    console.log(JSON.stringify(profile,null,2));
  } else if (command==='evaluate') {
    const profile=JSON.parse(fs.readFileSync(args[0],'utf8')), envelope=JSON.parse(fs.readFileSync(args[1],'utf8'));
    const c=corpus.find(item=>item.id===envelope.evidence?.taskId);
    if (!c) throw new Error('Unknown evidence task ID');
    const result=evaluateEvidence(c,envelope,profile,{corpus});
    console.log(JSON.stringify(result,null,2));
    if (result.outcome!=='Pass') process.exitCode=1;
  } else if (command==='preflight') {
    if (!args[0] || args.length>2) throw new Error('Usage: studio-v3-g8.mjs preflight PROFILE_JSON [EVIDENCE_INDEX_JSON]');
    const profile=JSON.parse(fs.readFileSync(args[0],'utf8'));
    const result=preflight({corpus,register:readRegister(),profile,inventory:readInventory(args[1])});
    console.log(JSON.stringify(result,null,2));
    if (!result.qualified) process.exitCode=1;
  } else if (command==='canonical') console.log(canonical(JSON.parse(fs.readFileSync(args[0],'utf8'))));
  else throw new Error('Usage: studio-v3-g8.mjs validate | input TASK [--qualification] | project TASK [--qualification] | profile IDENTITY_JSON COLLECTOR_PUBLIC_PEM PROFILE_NAME | evaluate PROFILE_JSON SIGNED_EVIDENCE_JSON | preflight PROFILE_JSON [EVIDENCE_INDEX_JSON] | canonical EVIDENCE_JSON');
} catch (error) {
  console.error(JSON.stringify({outcome:'Fail',errors:[error.message]}));
  process.exitCode=1;
}
