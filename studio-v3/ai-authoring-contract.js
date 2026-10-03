export const MAX_AUTHORING_OPERATIONS = 24;
export const GLOBAL_STYLE_KEYS = ['color','font','padding','striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore'];
export const AUTHORING_CONTRACT = {
  maxOperations: MAX_AUTHORING_OPERATIONS,
  globalStyleKeys: GLOBAL_STYLE_KEYS,
  typography: { globalProperty:'font', elementProperty:'fontSize' },
  sectionGridTargets: ['header','customer','totals','footer'],
  logo: 'Use an existing asset ID. With no assets, omit set_logo or use value:null; never use assetId:null.',
  planning: 'Use compact section grids, field ordering and global typography for full redesign. Combine properties for the same target in one patch. Omit unchanged operations. Stay within 24 operations; do not restyle every field.'
};
export const contractError = (code, metrics) => Object.assign(new Error(code), {code, ...(metrics ? {metrics} : {})});

export function assertOperationContract(operations, design) {
  const codes = new Set();
  for (const op of operations) {
    if (op?.type === 'set_style' && op.patch && Object.hasOwn(op.patch,'fontSize')) codes.add('GLOBAL_FONT_PROPERTY_UNSUPPORTED');
    if (op?.type === 'set_section' && op.target === 'items' && op.patch?.layout !== undefined) codes.add('TABLE_SECTION_GRID_UNSUPPORTED');
    if (op?.type === 'set_logo' && op.value !== null && !(design.assets || []).some(a=>a.id === op.value?.assetId)) codes.add('LOGO_ASSET_UNAVAILABLE');
  }
  if (codes.size) throw Object.assign(contractError([...codes][0]), {diagnosticCodes:[...codes]});
}
