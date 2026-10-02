// Runs only inside our trusted print-preview bridge. No document text or data.
export function measureTypography() {
  const facts = [], seen = new Set();
  function add(id,role,node) {
    if (!node || !node.getClientRects().length || facts.length >= 80) return;
    const pt = Math.round(parseFloat(getComputedStyle(node).fontSize)*75)/100;
    const key = `${id}:${role}:${pt}`;
    if (!Number.isFinite(pt) || pt <= 0 || pt > 200 || seen.has(key)) return;
    seen.add(key); facts.push({id,role,pt});
  }
  for (const page of document.querySelectorAll('.printform_page')) {
    for (const node of page.querySelectorAll('[data-v3-field] [data-v3-id],td [data-v3-id]')) add(node.dataset.v3Id,'value',node);
    for (const [selector,role,id] of [['h1','title','header'],['.brand-mark','brand mark','header'],['.company-fields .label','label','header'],['.label','label',null],['thead th','column heading','items'],['tbody td','table cell','items']]) {
      for (const node of page.querySelectorAll(selector)) add(id || node.closest('[data-v3-field]')?.dataset.v3Field || node.closest('[data-v3-id]')?.dataset.v3Id || 'document',role,node);
    }
  }
  return facts;
}
export function validateTypography(facts) {
  if (!Array.isArray(facts) || facts.length > 80) return [];
  return facts.filter(f=>typeof f.id === 'string' && /^[a-z0-9-]{1,100}$/i.test(f.id) && ['value','title','brand mark','label','column heading','table cell'].includes(f.role) && Number.isFinite(f.pt) && f.pt > 0 && f.pt <= 200).map(({id,role,pt})=>({id,role,pt}));
}
