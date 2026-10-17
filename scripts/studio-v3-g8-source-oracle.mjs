import {canonical,digest} from './studio-v3-g8-corpus.mjs';
import {sha,treeDigest,pathName} from '../coding-runner/policy.mjs';
const same = (a,b) => canonical(a) === canonical(b);
const raw = value => digest(value).slice(7);
function snapshot(tree,errors) {
  if (!tree || !Array.isArray(tree.entries) || !tree.entries.length) { errors.push('missing independent full workspace snapshot'); return null; }
  const names = new Set();
  for (const entry of tree.entries) {
    try { pathName(entry.path); } catch { errors.push('critical unsafe source path'); }
    if (names.has(entry.path)) errors.push('duplicate snapshot path');
    names.add(entry.path);
    if (!['file','directory'].includes(entry.type) || !Number.isInteger(entry.mode)) errors.push('invalid snapshot entry');
    if (entry.type==='file' && (typeof entry.content!=='string' || entry.bytes!==Buffer.byteLength(entry.content) || entry.digest!==raw(entry.content))) errors.push('workspace file bytes/digest mismatch');
    if (entry.type==='directory' && (entry.bytes!==0 || entry.digest!==null)) errors.push('directory digest mismatch');
  }
  const ordered=[...tree.entries].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if (!same(ordered,tree.entries) || tree.treeDigest!==treeDigest(ordered)) errors.push('workspace tree digest/order mismatch');
  return new Map(tree.entries.filter(e=>e.type==='file').map(e=>[e.path,e]));
}
export function checkSource(c,e,profile,errors) {
  const source=e.source;
  if (!source || !Array.isArray(source.calls)) { errors.push('missing independent source/process receipts'); return; }
  const files=snapshot(source.finalTree,errors), baseline=snapshot(source.initialTree,errors);
  if (!files || !baseline) return;
  for (const file of c.input.files) if (baseline.get(file.path)?.content!==file.content) errors.push('source initial fixture not materialized exactly');
  if (baseline.size!==c.input.files.length || [...baseline.keys()].some(path=>!c.input.files.some(file=>file.path===path))) errors.push('critical source initial scope contains unprovided files');
  for (const [path,file] of baseline) if (!c.oracle.requiredFiles.includes(path) && files.get(path)?.content!==file.content) errors.push(`critical source modified outside requested files ${path}`);
  for (const path of [c.oracle.testPath,'build.mjs']) if (files.get(path)?.content!==c.input.files.find(f=>f.path===path)?.content) errors.push(`critical edited frozen oracle/build input ${path}`);
  for (const path of c.oracle.requiredFiles) if (!files.has(path) || (path==='src/form.mjs' && files.get(path).content===baseline.get(path)?.content)) errors.push(`required source implementation absent ${path}`);
  for (const path of files.keys()) if (!baseline.has(path) && !c.oracle.requiredFiles.includes(path) && !path.startsWith('artifacts/')) errors.push(`critical source scope expansion ${path}`);
  const calls = source.calls;
  if (new Set(calls.map(call=>call.receipt?.callId)).size!==calls.length) errors.push('duplicate process call identity');
  for (const call of calls) {
    const r=call.receipt;
    if (!r || r.operation!=='run' || r.status!=='completed' || r.effectUnknown || r.signal || r.imageDigest!==profile.identity.runner_image || typeof r.beforeDigest!=='string' || typeof r.afterDigest!=='string' || !Number.isInteger(r.beforeRevision) || !Number.isInteger(r.afterRevision)) errors.push('missing/invalid actual process completion receipt');
    if (typeof call.args?.command!=='string' || (call.args.cwd ?? '')!=='' || Object.keys(call.args.env || {}).length) errors.push('process dispatch differs from frozen root recipe');
    if (!call.inputTree || call.inputTree.treeDigest!==r?.beforeDigest) errors.push('missing exact process input snapshot');
    else {
      const inputs=snapshot(call.inputTree,errors);
      if (inputs?.get(c.oracle.testPath)?.content!==c.input.files.find(f=>f.path===c.oracle.testPath).content || inputs?.get('build.mjs')?.content!==c.input.files.find(f=>f.path==='build.mjs').content) errors.push('critical process used changed tests/build recipe');
    }
  }
  const test=calls.find(call=>call.args?.command===c.oracle.testCommand.join(' ') && call.receipt?.exitCode===0 && !call.receipt.error);
  const build=calls.find(call=>call.args?.command===c.oracle.buildCommand.join(' ') && call.receipt?.exitCode===0 && !call.receipt.error && call.receipt.afterDigest===source.finalTree.treeDigest);
  if (!test || test.receipt.beforeDigest!==test.receipt.afterDigest) errors.push('missing unchanged successful real test receipt');
  if (!build) errors.push('missing successful real build receipt for final tree');
  if (build && (build.inputTree?.entries.some(entry=>entry.path==='artifacts/form.printform-operations.json') || !build.receipt.changes?.some(change=>change.path==='artifacts/form.printform-operations.json' && change.type==='added' && change.afterDigest===files.get(change.path)?.digest))) errors.push('build did not create a fresh independently captured artifact');
  if (test && build && Array.isArray(test.inputTree?.entries) && Array.isArray(build.inputTree?.entries) && (!same(test.inputTree.entries.filter(f=>!f.path.startsWith('artifacts')),build.inputTree.entries.filter(f=>!f.path.startsWith('artifacts'))) || calls.indexOf(test)>calls.indexOf(build))) errors.push('test and build source snapshots/order differ');
  if (c.oracle.failingBaseline && !calls.some(call=>call.args?.command===c.oracle.testCommand.join(' ') && call.receipt?.exitCode===1 && call.receipt.error?.code==='COMMAND_FAILED' && call.receipt.beforeDigest===source.initialTree.treeDigest && call.receipt.afterDigest===source.initialTree.treeDigest)) errors.push('missing genuine initial failing-test receipt');
  const a=e.artifact, file=files.get('artifacts/form.printform-operations.json');
  if (!a || !file || typeof a.content!=='string') { errors.push('missing actual generated artifact bytes'); return; }
  if (a.content!==file.content || a.contentDigest!==sha(a.content) || a.bytes!==Buffer.byteLength(a.content) || a.mediaType!=='application/json') errors.push('artifact bytes/hash mismatch');
  let value; try { value=JSON.parse(a.content); } catch { errors.push('artifact JSON invalid'); }
  if (!same(value,c.oracle.artifact)) errors.push('artifact independently expected operations/values mismatch');
  if (a.runId!==e.runId || a.documentId!==e.documentId || a.baseRevision!==e.baseRevision || a.workspaceId!==source.workspaceId || a.sourceRevision!==build?.receipt.afterRevision || a.buildCallId!==build?.receipt.callId || a.treeDigest!==source.finalTree.treeDigest || a.imageDigest!==profile.identity.runner_image || !same(a.releaseIdentity,profile.releaseIdentity)) errors.push('artifact stale/foreign source-release-document lineage');
  const id=sha(JSON.stringify([a.workspaceId,a.buildCallId,'artifacts/form.printform-operations.json',a.sourceRevision,a.treeDigest,a.contentDigest,a.imageDigest]));
  if (a.id!==`artifact-${id}`) errors.push('artifact opaque identity mismatch');
  if (!e.events.some(event=>event.type==='tool-result' && event.tool==='import_artifact' && event.artifactId===a.id)) errors.push('missing actual private-draft artifact import receipt');
}
