import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fixture, defaults} from '../gallery/designs/assets/lumen/fixtures.mjs';
import {summarize, ratio} from '../gallery/designs/assets/lumen/model.mjs';
const root = path.resolve(import.meta.dirname, '..'), dir = path.join(root, 'gallery/designs/assets/lumen');
const read = async f => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
const sample = await read('sample.json'), snapshots = [];
function capture(name, input, valid = true, expected) {
  if (!valid) {
    let error;
    try { summarize(input); } catch (e) { error = e; }
    assert.ok(error, `${name} should reject`);
    snapshots.push({name, input, valid:false, error:error.message}); return;
  }
  const actual = summarize(input);
  if (expected) assert.deepEqual(actual, expected);
  snapshots.push({name, input, actual, valid:true});
}
capture('default', sample, true, await read('expected.json'));
for (const s of await read('scenarios.json')) capture(`${s.domains}x${s.semesters}`, fixture(sample, {...defaults, domains:s.domains, terms:s.semesters}), true, s.expected);
for (const e of await read('edges.json')) capture(e.name, Object.assign(fixture(sample, {...defaults, domains:4, terms:1}), e.replaceTopLevel), e.valid, e.expected);
const multi = fixture(sample, {...defaults, domains:4, terms:1}); multi.evidence[0].domainIds.push(multi.domains[3].id); capture('multi-domain', multi);
const missing = structuredClone(sample); missing.reflections = []; missing.evidence = []; missing.goals = []; capture('all-evidence-missing', missing);
const explicit = structuredClone(sample); explicit.reflections[0].status = 'not-observed'; capture('explicit-not-observed', explicit);
const out = path.resolve(root, '../artifacts/lumen'); await fs.mkdir(out, {recursive:true});
await fs.writeFile(path.join(out, 'model-snapshots.json'), JSON.stringify({snapshots, ratios:[[1, 16], [1, 32], [1, 3], [0, 0], [0, 7], [10000, 10000]].map(([n, d]) => ratio(n, d))}, null, 2));
console.log(`${snapshots.length} actual JS model snapshots saved`);
