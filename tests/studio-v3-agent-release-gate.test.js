import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateAgentPackage} from '../scripts/generate-studio-v3-agent.mjs';
import {readReleaseState,assertReleaseReview,draftDispositions,RELEASE_DIR} from '../scripts/studio-v3-agent-review.mjs';
import {fetchPublishedBaseline,writeBaseline} from '../scripts/record-studio-v3-agent-baseline.mjs';

const REL = 'c'.repeat(40), SITE = 'https://example.test/repo';
const page = release => `<html><head><meta name="printform-assets" content="./releases/${release}/"></head></html>`;
const manifest = (release = REL) => ({version:1,release,contractHash:'h',knowledgeHash:'k',packageHash:'p',entries:[{id:'printform.agent.finish',status:'active',hash:'a'.repeat(64)}],files:{}});
function site(routes) {
  return async url => {
    const body = routes[url.replace(SITE,'')];
    if (body === undefined) return {ok:false,status:404,text:async () => ''};
    if (typeof body === 'number') return {ok:false,status:body,text:async () => ''};
    return {ok:true,status:200,text:async () => typeof body === 'string' ? body : JSON.stringify(body)};
  };
}
const routes = (overrides = {}) => ({'/studio-v3/':page(REL),[`/studio-v3/releases/${REL}/agent/agent-manifest.json`]:manifest(),...overrides});

describe('Studio v3 baseline recording (KNO-05)', () => {
  let temp;
  beforeAll(() => { temp = fs.mkdtempSync(path.join(os.tmpdir(),'agent-baseline-')); });
  afterAll(() => fs.rmSync(temp,{recursive:true,force:true}));

  it('records the live release manifest and resets dispositions to that baseline', async () => {
    const result = await fetchPublishedBaseline({site:SITE,fetcher:site(routes())});
    expect(result).toMatchObject({release:REL,index:null,review:{version:1,baseline:{release:REL,packageHash:'p'},dispositions:[]}});
    const withIndex = await fetchPublishedBaseline({site:SITE,fetcher:site(routes({'/studio-v3/agent-index/dependency-index.json':{release:REL,version:1,files:{},entries:{}}}))});
    expect(withIndex.index.release).toBe(REL);
    writeBaseline(withIndex,temp); writeBaseline(result,temp);
    expect(fs.readdirSync(path.join(temp,RELEASE_DIR)).sort()).toEqual(['baseline-manifest.json','review.json']); // a stale index is removed
    expect(readReleaseState(temp)).toMatchObject({baseline:{release:REL},baselineIndex:null,review:{dispositions:[]}});
  });
  it('fails closed on any inconsistency, so a failed or partial deployment cannot advance the baseline', async () => {
    const reject = (overrides,message) => expect(fetchPublishedBaseline({site:SITE,fetcher:site(routes(overrides))})).rejects.toThrow(message);
    await reject({'/studio-v3/':'<html></html>'},'does not name an immutable release');
    await reject({'/studio-v3/':500},'Baseline fetch failed (500)');
    await reject({[`/studio-v3/releases/${REL}/agent/agent-manifest.json`]:404},'Baseline fetch failed (404)');
    await reject({[`/studio-v3/releases/${REL}/agent/agent-manifest.json`]:manifest('d'.repeat(40))},'does not match page release');
    await reject({[`/studio-v3/releases/${REL}/agent/agent-manifest.json`]:{...manifest(),entries:[{id:'x',hash:'short'}]}},'Invalid published agent baseline');
    await reject({'/studio-v3/agent-index/dependency-index.json':{release:'d'.repeat(40)}},'retry after the deployment settles');
    expect(() => readReleaseState(fs.mkdtempSync(path.join(temp,'empty-')))).toThrow('record-studio-v3-agent-baseline');
  });
});

describe('Studio v3 publication gate (KNO-04)', () => {
  it('passes for the committed release state on the current tree', () => {
    const state = readReleaseState(), generated = generateAgentPackage({baseline:state.baseline,baselineIndex:state.baselineIndex});
    expect(state.baseline.release).toMatch(/^[a-f0-9]{40}$/);
    // Full strength: with an index, `reconciled` is rejected and `updated` must cite a file that really changed.
    expect(state.baselineIndex?.release).toBe(state.baseline.release);
    const result = assertReleaseReview(generated,{state});
    expect(result.reviewed).toBe(result.changes);
  });
  it('blocks publication with every unreviewed change and offers digest-bound drafts', () => {
    // Independent of the committed baseline: derive a baseline from the current package, then alter three entries.
    const current = generateAgentPackage({}), tampered = structuredClone(current.manifest);
    tampered.entries[0].hash = 'f'.repeat(64); tampered.entries[1].hash = 'e'.repeat(64); tampered.entries.pop();
    const generated = generateAgentPackage({baseline:tampered,baselineIndex:current.index}), pending = generated.changes.changes.length;
    expect(pending).toBe(3);
    const state = {baseline:tampered,baselineIndex:current.index,review:{version:1,baseline:generated.changes.baseline,dispositions:[]}};
    expect(() => assertReleaseReview(generated,{state})).toThrow(`release review failed (${pending})`);
    const drafts = draftDispositions(generated), digest = id => generated.manifest.entries.find(entry => entry.id === id).hash;
    expect(drafts).toHaveLength(pending);
    for (const draft of drafts) { const [[id,hash]] = Object.entries(draft.entries); expect(hash).toBe(digest(id)); expect(draft.disposition).toMatch(/^TODO/); expect(draft.causes).toBeDefined(); }
  });
});
