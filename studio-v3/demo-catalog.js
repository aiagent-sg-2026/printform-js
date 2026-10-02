import { DEMO_DOCUMENT_KINDS, PENDING_DEMO_KINDS, demoKind } from './demo-document-kinds.js';
import { buildCommercialRecords, buildEdgeRecords, buildCurrencyRecords } from './demo-records.js';
import { buildProjectRecords, buildClaimRecords } from './demo-claims.js';
export { DEMO_MASTER_DATA, cloneDemoMasters, demoMaster } from './demo-master-data.js';
export { DEMO_DOCUMENT_KINDS, PENDING_DEMO_KINDS } from './demo-document-kinds.js';

function buildAll() {
  const commercial = buildCommercialRecords(),projects = buildProjectRecords(commercial);
  return [...commercial,...projects,...buildClaimRecords(commercial,projects),...buildEdgeRecords(commercial),...buildCurrencyRecords()];
}
// Memoized construction is private. Callers always receive independent, editable JSON clones.
let fixtureCache;
const allRecords = () => fixtureCache ||= buildAll();
export function getDemoCatalog({includePending = true} = {}) {
  const ready = DEMO_DOCUMENT_KINDS.map(entry=>({...entry,scenarioCount:allRecords().filter(record=>record.documentKind === entry.documentKind).length}));
  return structuredClone(includePending ? [...ready,...PENDING_DEMO_KINDS] : ready);
}
export function demoStarterRecords(kind = null) {
  if (kind) demoKind(kind);
  return structuredClone(allRecords().filter(record=>!kind || record.documentKind === kind));
}
export function demoRecordForKind(kind,scenarioIndex = 0) {
  const records = demoStarterRecords(kind);
  const result = typeof scenarioIndex === 'string' ? records.find(record=>record.data.demo.scenario === scenarioIndex || record.id === scenarioIndex) : records[scenarioIndex];
  if (!result) throw new Error(`Unknown demo scenario for ${kind}: ${scenarioIndex}`);
  return result;
}
export const demoDataForKind = (kind,scenarioIndex = 0) => demoRecordForKind(kind,scenarioIndex).data;
export function demoRecordById(id) {
  const record = allRecords().find(entry=>entry.id === id);
  if (!record) throw new Error(`Unknown demo record: ${id}`);
  return structuredClone(record);
}
