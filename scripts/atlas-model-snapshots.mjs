import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture, defaults} from '../gallery/designs/assets/atlas/fixtures.mjs';
import {model} from '../gallery/designs/assets/atlas/model.mjs';
const root = path.resolve(import.meta.dirname, '..');
const sample = JSON.parse(await fs.readFile(path.join(root, 'gallery/designs/assets/atlas/sample.json')));
const snapshots = [];
for (const containers of [1, 3, 8]) for (const count of [10, 24, 50, 120]) for (const scenario of ['complete', 'missing', 'zero']) for (const basis of ['value', 'quantity', 'weight']) for (const mode of ['estimated', 'actual']) {
  const source = fixture(sample, {...defaults, containers, count, scenario, basis});
  snapshots.push({containers, count, scenario, source, basis, mode, totals:model(source, basis, mode).totals});
}
await fs.writeFile(path.resolve(root, '../artifacts/atlas/model-snapshots.json'), JSON.stringify(snapshots));
console.log(`${snapshots.length} actual JS source/result snapshots written for independent verification.`);
