import { createEmptyProject } from '../studio-v2/core/project-model.js';
import { createEmptyFormSpec } from '../studio-v2/core/form-spec.js';
import { compileTemplate, documentTheme } from './template.js';

export const STUDIO_V3_VERSION = '0.2.0';
export const BLOCKS = ['header', 'customer', 'items', 'totals', 'footer'];
const field = (id, label, pointer, format = '') => ({ id, label, pointer, format });
export function defaultDesign(type = 'invoice', blank = false) {
  const title = { invoice: 'INVOICE', purchase: 'PURCHASE ORDER', delivery: 'DELIVERY NOTE' }[type] || 'PRINT FORM';
  return {
    version: 1, title, type, color: '#1763dc', font: 9, padding: 7, striped: true, borders: true,
    repeatHeader: true, repeatTable: true, pageNumbers: true, breakBefore: false,
    blocks: Object.fromEntries(BLOCKS.map(id => [id, { enabled: !blank, label: { header: 'Header', customer: 'Customer', items: 'Items table', totals: 'Totals', footer: 'Footer' }[id] }])),
    header: [field('company', 'Company', '/company/name'), field('registration','Registration','/company/registration'), field('address', 'Company address', '/company/address'), field('number', 'Document no.', '/document/number'), field('date', 'Date', '/document/date'), field('due',type === 'invoice' ? 'Due date' : 'Delivery date','/document/dueDate'), field('reference','Reference','/document/reference')],
    customer: [field('bill', type === 'purchase' ? 'Supplier' : 'Bill to', '/customer/name'), field('bill-address', 'Address', '/customer/address'), field('ship', 'Ship to', '/shipTo/name'), field('ship-address', 'Delivery address', '/shipTo/address')],
    collection: '/items',
    columns: [
      { ...field('no', '#', './no'), width: 6 }, { ...field('sku', 'Item code', './sku'), width: 15 },
      { ...field('description', 'Description', './description'), width: 37 },
      { ...field('quantity', 'Qty', './quantity', 'number'), width: 10 },
      { ...field('rate', 'Unit price', './rate', 'currency'), width: 15 },
      { ...field('amount', 'Amount', './amount', 'currency'), width: 17 }
    ].filter(c => type !== 'delivery' || !['rate', 'amount'].includes(c.id)),
    totals: type === 'delivery' ? [field('packages', 'Packages', '/summary/packages')] : [field('subtotal', 'Subtotal', '/summary/subtotal', 'currency'), field('tax', 'Tax', '/summary/tax', 'currency'), field('total', 'Total due', '/summary/total', 'currency')],
    footer: [field('notes', 'Notes & terms', '/notes'), field('signature', type === 'delivery' ? 'Received by' : 'Prepared by', '/preparedBy'), ...(type === 'purchase' ? [field('approval','Approved by','/approvedBy')] : [])]
  };
}

export function sampleData(type = 'invoice', count = 45, long = false) {
  // Synthetic supplied ERP fixture values. Studio never recomputes amounts or taxes.
  return {
    company: { name: 'ACME Industrial Supply', registration:'202601234567', address: '123 Innovation Drive · Kuala Lumpur, Malaysia\n+60 3 5550 0100 · accounts@acme.example' },
    document: { number: `${{ invoice: 'INV', purchase: 'PO', delivery: 'DN' }[type] || 'FORM'}-2026-1043`, date: '2026-10-01',dueDate:type === 'invoice' ? '2026-10-31' : '2026-10-15',reference:'PO-2026-0087' },
    customer: { name: 'Sterling Manufacturing Sdn. Bhd.', address: '455 Western Avenue\nJohor Bahru, Malaysia' },
    shipTo: { name: 'Sterling Manufacturing · Receiving', address: '789 Logistics Boulevard\nJohor Bahru, Malaysia' },
    items: Array.from({ length: count }, (_, i) => ({ no: i + 1, sku: `ASM-${String(i + 1).padStart(4, '0')}`, description: long ? `工业控制组件 / Industrial control assembly ${i + 1}. 安全检查与安装说明。 ` .repeat(i === 0 ? 8 : 2) : ['Modular Control Unit', 'Safety Bracket Kit', 'Shielded Signal Cable 5m', 'Proximity Sensor', '24V Power Supply'][i % 5], quantity: 2, rate: 125, amount: 250 })),
    summary: { subtotal: count * 250, tax: count * 20, total: count * 270, packages: String(count) },
    notes: type === 'delivery' ? 'Please check the quantity and condition of goods upon receipt. 收货时请检查数量及状态。' : type === 'purchase' ? 'Quote the PO number on every delivery note and invoice. Delivery subject to quantity and quality inspection.' : 'Thank you for your business. Payment due within 30 days. 请于30天内付款。',
    preparedBy: type === 'delivery' ? '________________  Date: ________________' : 'Alicia Tan',approvedBy:'Marcus Lim'
  };
}

export function designOf(project) { return structuredClone(project.manifest.studioV3); }
export function compileProject(project, design) {
  const next = structuredClone(project);
  next.manifest.studioV3 = structuredClone(design);
  next.templateHtml = compileTemplate(design);
  next.themeCss = documentTheme(design);
  const spec = createEmptyFormSpec(design.type);
  spec.tokens = { brand: design.color, fontPt: design.font };
  spec.pagination = { ...spec.pagination, repeatDocumentHeader: design.blocks.header.enabled && design.repeatHeader, repeatTableHeader: design.repeatTable, pageNumbers: design.pageNumbers };
  const add = (id, label, type, role, binding, parent = null) => spec.components.push({ id, label, type, role, parent, sourceSelector: `[data-v3-id="${id}"]`, binding, tableId: role?.startsWith('table') ? 'items' : null });
  BLOCKS.filter(id => design.blocks[id].enabled).forEach(id => {
    add(id, design.blocks[id].label, { header: 'DocumentHeader', customer: 'ProjectInfo', items: 'DataTable', totals: 'MoneySummary', footer: 'PageFooter' }[id], id === 'items' ? 'table-row' : id === 'header' ? 'document-header' : id, id === 'items' ? { each: design.collection } : null);
    const fields = id === 'items' ? design.columns : design[id];
    fields.forEach(f => add(`${id}-${f.id}`, f.label, 'DocumentMeta', 'field', f.pointer ? { text: f.pointer } : null, id));
    if (id === 'items') add('items-header','Table header','DataTable','table-header',null,'items');
    spec.sections.push({ id, componentIds: spec.components.filter(c => c.id === id || c.parent === id).map(c => c.id) });
  });
  next.spec = spec;
  return next;
}

export function newProject(type = 'invoice', blank = false) {
  const project = createEmptyProject();
  project.manifest.title = blank ? 'Untitled form' : `${{ invoice: 'Invoice', purchase: 'Purchase order', delivery: 'Delivery note' }[type]} template`;
  project.manifest.documentId = `v3-${crypto.randomUUID()}`;
  project.manifest.i18n = undefined;
  project.schema = { type: 'object', additionalProperties: true };
  project.sampleData = sampleData(type);
  return compileProject(project, defaultDesign(type, blank));
}

export function selectionField(design, id) {
  for (const block of BLOCKS) {
    const fields = block === 'items' ? design.columns : design[block];
    const index = fields.findIndex(f => `${block}-${f.id}` === id);
    if (index !== -1) return { block, field: fields[index], index };
  }
  return null;
}
