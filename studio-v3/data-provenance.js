import { resolvePointer } from '../studio-v2/core/json.js';
const labels = {'builtin-demo':'Built-in demo','local-demo':'Local demo dataset','imported-data':'Imported data','validation-sample':'Validation sample'};
export function dataSource(kind,name = '') { return {kind:Object.hasOwn(labels,kind) ? kind : 'imported-data',name}; }
export function sourceLabel(project) {
  const source = project.studioV3Session?.source || dataSource('imported-data');
  const rows = resolvePointer(project.sampleData,project.manifest?.studioV3?.collection || '/items');
  return `${labels[source.kind] || labels['imported-data']}${source.name ? ` · ${source.name}` : ''} · ${Array.isArray(rows) ? rows.length : '—'} rows`;
}
