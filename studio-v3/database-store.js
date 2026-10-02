import { starterRecords } from './database-model.js';

export const DATABASE_NAME = 'printform-studio-v3-demo-db';
const clone = value => structuredClone(value);
function conflict() { return Object.assign(new Error('Saved dataset changed. Reload the saved dataset or save your draft as a new dataset.'),{code:'DATASET_CONFLICT'}); }
export function storageMessage(error) {
  if (error?.name === 'QuotaExceededError') return 'Browser storage is full. Your draft is unchanged; export it or free space, then retry.';
  if (error?.code === 'DATASET_CONFLICT') return error.message;
  return `Local database unavailable (${error?.name || 'storage error'}). Changes are not saved. Export your data before leaving this tab.`;
}
class MemoryDatabase {
  constructor(reason) { this.reason = reason; this.persistent = false; this.records = new Map(); this.preferences = new Map(); }
  async list() { return clone([...this.records.values()]); }
  async preference(key) { return this.preferences.get(key); }
  selected(type) { return this.preference(`active:${type}`); }
  async write(changes, preference = null) {
    for (const change of changes) if ((this.records.get(change.id)?.revision ?? null) !== change.expectedRevision) throw conflict();
    const next = new Map(this.records), saved = [];
    for (const change of changes) {
      if (change.remove) { next.delete(change.id); saved.push(null); }
      else { const record = {...clone(change.record),revision:(change.expectedRevision || 0)+1,updatedAt:new Date().toISOString()}; next.set(change.id,record); saved.push(clone(record)); }
    }
    this.records = next;
    if (preference) this.preferences.set(preference.key,preference.value);
    return saved;
  }
  async select(type,id) { this.preferences.set(`active:${type}`,id); }
  close() {}
}
class IndexedDatabase {
  constructor(database) { this.database = database; this.persistent = true; this.reason = ''; }
  async read(store, operation) {
    return new Promise((resolve,reject) => {
      let tx; try { tx = this.database.transaction(store,'readonly'); } catch (error) { reject(error); return; }
      const request = operation(tx.objectStore(store));
      let result; request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(clone(result));
      tx.onabort = tx.onerror = () => reject(tx.error || request.error || new Error('Database read failed.'));
    });
  }
  list() { return this.read('datasets',store => store.getAll()); }
  async preference(key) { return (await this.read('preferences',store => store.get(key)))?.value; }
  selected(type) { return this.preference(`active:${type}`); }
  async write(changes, preference = null) {
    return new Promise((resolve,reject) => {
      let tx; try { tx = this.database.transaction(['datasets','preferences'],'readwrite'); } catch (error) { reject(error); return; }
      const store = tx.objectStore('datasets'); let failure, pending = changes.length;
      const existing = new Map(), saved = [];
      const fail = error => { failure ||= error; try { tx.abort(); } catch {} };
      const put = () => {
        try {
          for (const change of changes) {
            if ((existing.get(change.id)?.revision ?? null) !== change.expectedRevision) throw conflict();
          }
          for (const change of changes) {
            if (change.remove) { store.delete(change.id); saved.push(null); }
            else {
              const record = {...clone(change.record),revision:(change.expectedRevision || 0)+1,updatedAt:new Date().toISOString()};
              store.put(record); saved.push(clone(record));
            }
          }
          if (preference) tx.objectStore('preferences').put(preference);
        } catch (error) { fail(error); }
      };
      for (const change of changes) {
        const request = store.get(change.id);
        request.onsuccess = () => { existing.set(change.id,request.result); if (--pending === 0) put(); };
        request.onerror = () => fail(request.error);
      }
      if (!pending) put();
      tx.oncomplete = () => resolve(clone(saved));
      tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Database transaction failed.'));
    });
  }
  select(type,id) { return this.write([],{key:`active:${type}`,value:id}); }
  close() { this.database.close(); }
}
async function openDatabase(factory = globalThis.indexedDB) {
  if (!factory) throw new DOMException('IndexedDB is disabled.','SecurityError');
  return new Promise((resolve,reject) => {
    let request, settled = false;
    const finish = (error,database) => {
      if (settled) { database?.close(); return; }
      settled = true; clearTimeout(timer); error ? reject(error) : resolve(new IndexedDatabase(database));
    };
    const timer = setTimeout(() => finish(new DOMException('Database opening was blocked.','TimeoutError')),2500);
    try { request = factory.open(DATABASE_NAME,1); } catch (error) { finish(error); return; }
    request.onupgradeneeded = () => {
      if (settled) { request.transaction.abort(); return; }
      const database = request.result;
      database.createObjectStore('datasets',{keyPath:'id'});
      database.createObjectStore('preferences',{keyPath:'key'});
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      finish(null,request.result);
    };
    request.onerror = () => finish(request.error);
    request.onblocked = () => finish(new DOMException('Close other Studio tabs and retry.','InvalidStateError'));
  });
}
export async function createDatabase() {
  let store;
  try { store = await openDatabase(); } catch (error) { store = new MemoryDatabase(storageMessage(error)); }
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await store.preference('seed:business-demo-v1')) break;
      const records = await store.list();
      const missing = starterRecords().filter(r => !records.some(old => old.id === r.id));
      try { await store.write(missing.map(record => ({id:record.id,record,expectedRevision:null})),{key:'seed:business-demo-v1',value:true}); break; }
      catch (error) { if (error.code !== 'DATASET_CONFLICT' || attempt) throw error; }
    }
  } catch (error) {
    store.close(); store = new MemoryDatabase(storageMessage(error));
    await store.write(starterRecords().map(record => ({id:record.id,record,expectedRevision:null})));
  }
  return store;
}
