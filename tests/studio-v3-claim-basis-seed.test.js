import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedCertifiedClaimBasis } from '../studio-v3/claim-basis-seed.js';
import { createDatabase } from '../studio-v3/database-store.js';
import { createLocalDatasetSource } from '../studio-v3/data-source-adapter.js';
import { DemoDatabase } from '../studio-v3/database-controller.js';
import { datasetMatchesProject } from '../studio-v3/database-model.js';
import { demoStarterRecords } from '../studio-v3/demo-catalog.js';
import { newDemoProject } from '../studio-v3/demo-templates.js';
import { createGlobe3CertifiedClaimProject, createGlobe3ProgressClaimProject } from '../studio-v3/globe3-claim-project.js';
import { globe3ClaimInput } from './fixtures/globe3-certified-claim.js';

const migrationKey = 'seed:certified-claim-basis-v1';
const correctedId = id => `${id}:certified-basis-v1`;
const stores = [];
afterEach(() => { stores.forEach(store => store.close()); stores.length = 0; vi.unstubAllGlobals(); });

async function memoryStore() {
  vi.stubGlobal('indexedDB', undefined);
  const store = await createDatabase();
  stores.push(store);
  expect(store.persistent).toBe(false);
  return store;
}

async function makeLegacy(store, records) {
  const current = new Map((await store.list()).map(record => [record.id, record]));
  const changes = records.map((record, index) => {
    const legacy = structuredClone(current.get(record.id));
    delete legacy.data.claim.basisProfile;
    legacy.title = `Fictional user-edited legacy ${index + 1}`;
    legacy.data.summary.previousClaim = 876.543 + index;
    legacy.data.summary.total = -42.123 - index;
    legacy.data.items[0].previousWork = 321.987 + index;
    legacy.data.notes = 'Fictional user annotation retained across basis migration';
    legacy.data.document.revision = `USER-REVISION-${index + 1}`;
    return { id: legacy.id, record: legacy, expectedRevision: legacy.revision };
  });
  return store.write(changes, { key: migrationKey, value: false });
}

describe('claim basis migration preserves actual saved transactions', () => {
  it('adds distinct corrected PCAR/CCAR copies, preserving every legacy edit, stored revision and selected identity', async () => {
    const store = await memoryStore();
    const originals = [...demoStarterRecords('PCAR'), ...demoStarterRecords('CCAR')];
    const legacy = await makeLegacy(store, originals);
    const edited = structuredClone(legacy[0]);
    edited.data.summary.total = -17.891;
    const [savedEdit] = await store.write([{ id: edited.id, record: edited, expectedRevision: edited.revision }]);
    legacy[0] = savedEdit;
    expect(savedEdit.revision).toBe(3);
    await store.select(savedEdit.type, savedEdit.id);
    const before = await store.list(), source = createLocalDatasetSource(store);
    await seedCertifiedClaimBasis(store);
    const after = await store.list(), byId = new Map(after.map(record => [record.id, record]));
    expect(after).toHaveLength(before.length + originals.length);
    expect(await store.preference(migrationKey)).toBe(true);
    expect(await store.selected(savedEdit.type)).toBe(savedEdit.id);
    for (const [index, original] of originals.entries()) {
      const preserved = byId.get(original.id), corrected = byId.get(correctedId(original.id));
      expect(preserved).toEqual(legacy[index]);
      expect(preserved.data.claim).not.toHaveProperty('basisProfile');
      expect(await source.read(preserved.id, { revision: preserved.revision })).toEqual(preserved);
      expect(corrected).toMatchObject({ id: correctedId(original.id), revision: 1, data: original.data });
      expect(corrected.title).toContain('certified basis');
      expect(corrected.data.claim.basisProfile).toBe('globe3-prior-certified');
      expect(corrected.data.summary.total).not.toBe(preserved.data.summary.total);
      const currentProject = newDemoProject(original.documentKind);
      expect(datasetMatchesProject(preserved, currentProject)).toBe(false);
      expect(datasetMatchesProject(corrected, currentProject)).toBe(true);
    }
    await expect(source.read(savedEdit.id, { revision: savedEdit.revision - 1 })).rejects.toThrow('Dataset changed');
    const database = new DemoDatabase({});
    database.store = store;
    await database.refresh();
    for (const kind of ['PCAR', 'CCAR']) {
      const selected = legacy.find(record => record.documentKind === kind);
      await store.select(selected.type, selected.id);
      database.selected[selected.type] = await store.selected(selected.type);
      const starting = database.starting(newDemoProject(kind));
      expect(await store.selected(selected.type)).toBe(selected.id);
      expect(starting.reference.id).not.toBe(selected.id);
      expect(starting.reference.id).toContain(':certified-basis-v1');
      expect(starting.project.sampleData.claim.basisProfile).toBe('globe3-prior-certified');
    }
    const migrated = await store.list();
    await seedCertifiedClaimBasis(store);
    expect(await store.list()).toEqual(migrated);
    const removed = migrated.find(record => record.id === correctedId(savedEdit.id));
    await store.write([{ id: removed.id, remove: true, expectedRevision: removed.revision }]);
    await seedCertifiedClaimBasis(store);
    expect((await store.list()).some(record => record.id === removed.id)).toBe(false);
    expect(await store.preference(migrationKey)).toBe(true);
  });

  it('does not overwrite or duplicate an existing corrected copy when the migration preference is not set', async () => {
    const store = await memoryStore(), original = demoStarterRecords('PCAR')[1];
    const [legacy] = await makeLegacy(store, [original]);
    const existing = { ...structuredClone(original), id: correctedId(original.id), title: 'Fictional edited corrected-basis copy' };
    existing.data.summary.total = 0;
    const [saved] = await store.write([{ id: existing.id, record: existing, expectedRevision: null }]);
    await seedCertifiedClaimBasis(store);
    const records = await store.list();
    expect(records.filter(record => record.id === existing.id)).toEqual([saved]);
    expect(records.find(record => record.id === original.id)).toEqual(legacy);
    expect(await store.preference(migrationKey)).toBe(true);
  });

  it('real CAS rejects a stale multi-record write without partial updates or committing the migration marker', async () => {
    const store = await memoryStore(), originals = demoStarterRecords('PCAR').slice(0, 2);
    const legacy = await makeLegacy(store, originals), before = await store.list();
    const changes = legacy.map((record, index) => ({
      id: record.id, record: { ...record, title: 'Fictional rejected stale edit' },
      expectedRevision: index ? record.revision - 1 : record.revision
    }));
    await expect(store.write(changes, { key: migrationKey, value: true })).rejects.toMatchObject({ code: 'DATASET_CONFLICT' });
    expect(await store.list()).toEqual(before);
    expect(await store.preference(migrationKey)).toBe(false);
    await seedCertifiedClaimBasis(store);
    const records = await store.list();
    for (const record of legacy) {
      expect(records.find(saved => saved.id === record.id)).toEqual(record);
      expect(records.find(saved => saved.id === correctedId(record.id)).revision).toBe(1);
    }
    expect(await store.preference(migrationKey)).toBe(true);
  });
});

describe('claim datasets must match both financial collection and exact business basis', () => {
  it('rejects a same-kind CCAR commodity dataset for the raw financialRows project and accepts its real supplied ledger', async () => {
    const store = await memoryStore(), project = createGlobe3CertifiedClaimProject(globe3ClaimInput());
    const commodity = (await store.list()).find(record => record.id === demoStarterRecords('CCAR')[0].id);
    expect(commodity.data.document.kind).toBe(project.sampleData.document.kind);
    expect(commodity.type).toBe(project.manifest.studioV3.type);
    expect(datasetMatchesProject(commodity, project)).toBe(false);
    const supplied = { id: 'import:fictional-ccar-ledger', type: 'invoice', title: 'Fictional supplied financial ledger', data: project.sampleData, origin: 'imported-data' };
    const [saved] = await store.write([{ id: supplied.id, record: supplied, expectedRevision: null }]);
    expect(datasetMatchesProject(saved, project)).toBe(true);
    const records = await store.list();
    expect(records.find(record => record.id === saved.id).data).toEqual(project.sampleData);
    const malformed = structuredClone(saved);
    malformed.data.financialRows = {};
    expect(datasetMatchesProject(malformed, project)).toBe(false);
    const otherKind = structuredClone(saved);
    otherKind.data.document.kind = 'PCAR';
    expect(datasetMatchesProject(otherKind, project)).toBe(false);
  });

  it('never silently relabels stored Last Claim data as prior-certified or vice versa', () => {
    const data = demoStarterRecords('PCAR')[1].data;
    data.document.sourceType = 'entp_pbill';
    const prior = createGlobe3ProgressClaimProject(data);
    const storedData = structuredClone(data);
    storedData.claim.basisProfile = 'globe3-stored-last-claim';
    const stored = createGlobe3ProgressClaimProject(storedData);
    const priorRecord = { type: 'invoice', data }, storedRecord = { type: 'invoice', data: storedData };
    expect(datasetMatchesProject(priorRecord, prior)).toBe(true);
    expect(datasetMatchesProject(storedRecord, stored)).toBe(true);
    expect(datasetMatchesProject(priorRecord, stored)).toBe(false);
    expect(datasetMatchesProject(storedRecord, prior)).toBe(false);
    const missing = structuredClone(priorRecord);
    delete missing.data.claim.basisProfile;
    expect(datasetMatchesProject(missing, prior)).toBe(false);
    expect(datasetMatchesProject(missing, stored)).toBe(false);
  });
});
