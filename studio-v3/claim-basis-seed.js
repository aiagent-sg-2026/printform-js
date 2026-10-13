import { demoStarterRecords } from './demo-catalog.js';

// Preserve legacy/user-edited records; add separately identified fictional replacements.
export async function seedCertifiedClaimBasis(store) {
  const key = 'seed:certified-claim-basis-v1';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await store.preference(key)) return;
    const records = await store.list(), byId = new Map(records.map(record => [record.id, record]));
    const changes = [];
    for (const kind of ['PCAR', 'CCAR']) for (const record of demoStarterRecords(kind)) {
      const old = byId.get(record.id);
      if (!old || old.data.claim?.basisProfile === record.data.claim.basisProfile) continue;
      const id = `${record.id}:certified-basis-v1`;
      if (byId.has(id)) continue;
      const replacement = { ...record, id, title: `${record.title} · certified basis`.slice(0, 100) };
      changes.push({ id, record: replacement, expectedRevision: null });
    }
    try { await store.write(changes, { key, value: true }); return; }
    catch (error) { if (error.code !== 'DATASET_CONFLICT' || attempt) throw error; }
  }
}
