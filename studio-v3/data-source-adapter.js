import { validateDataset, scalarFields } from './database-model.js';

// Bounded, read-only application contract. Production implements this contract
// on an authenticated server; a browser never receives SQL or DB credentials.
const idValue = value => typeof value === 'string' && value.length > 0 && value.length <= 120;
export function createLocalDatasetSource(store) {
  if (!store || typeof store.list !== 'function') throw new Error('A local dataset repository is required.');
  const records = async () => await store.list();
  return Object.freeze({
    id:'local-demo', label:'Fictional demo · this browser', persistent:Boolean(store.persistent),
    async list({type,documentKind,limit=100}={}) {
      if (type !== undefined && !['invoice','purchase','delivery'].includes(type)) throw new Error('Unsupported source family.');
      if (documentKind !== undefined && !idValue(documentKind)) throw new Error('Invalid document kind.');
      if (!Number.isInteger(limit) || limit < 1 || limit > 250) throw new Error('List limit must be 1–250.');
      return (await records()).filter(r=>(!type || r.type === type) && (!documentKind || r.data.document?.kind === documentKind)).slice(0,limit).map(r=>({
        id:r.id,title:r.title,type:r.type,documentKind:r.data.document?.kind || null,revision:r.revision,
        currency:r.data.document?.currency || null,rows:r.data.items.length,origin:r.origin
      }));
    },
    async read(id,{revision}={}) {
      if (!idValue(id)) throw new Error('Select a dataset identity.');
      const record = (await records()).find(r=>r.id === id);
      if (!record) throw new Error('The selected dataset is unavailable.');
      if (revision !== undefined && record.revision !== revision) throw new Error('Dataset changed. Refresh before reading.');
      return {...record,data:validateDataset(record.data)};
    },
    async schema(id) {
      const record = await this.read(id);
      const root = scalarFields(record.data).map(({pointer,type})=>({pointer,type}));
      const fields = new Map();
      for (const row of record.data.items) for (const f of scalarFields(row)) {
        const pointer = `.${f.pointer}`, previous = fields.get(pointer);
        fields.set(pointer,{pointer,type:previous && previous.type !== f.type ? 'mixed' : f.type});
      }
      return {sourceId:'local-demo',datasetId:id,revision:record.revision,fields:root,collections:[{pointer:'/items',fields:[...fields.values()]}]};
    }
  });
}
