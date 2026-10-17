import { describe, expect, it } from 'vitest';
import { normalizeBusinessDocument } from '../studio-v3/business-document-adapter.js';
import { businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { parseChatReply } from '../studio-v3/ai-chat-protocol.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { designOf } from '../studio-v3/model.js';

function consume(input) {
  const before = structuredClone(input), created = createBusinessDocumentProject(input);
  const project = readProject(saveProject(created));
  expect(input).toEqual(before); expect(project.sampleData).toEqual(created.sampleData);
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const bound = bindTemplate(template, project.sampleData, project.manifest);
  expect(bound.report.errors).toEqual([]);
  const values = id => [...bound.fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
  for (const key of ['no', 'section', 'description', 'amount', 'direction', 'trace']) {
    expect(values(`items-${key}`)).toEqual(project.sampleData.printRows.map(row => String(row[key])));
  }
  expect(designOf(project).totals).toEqual([]);
  expect(bound.fragment.querySelector('[data-v3-id="totals-total"],[data-v3-id="totals-tax"]')).toBeNull();
  return { project, data: project.sampleData, values };
}
function assertContext(values, branch, group, input) {
  for (const [key, value] of Object.entries(input)) {
    if (key === 'provenance') {
      expect(values(`customer-${branch}-${group}-source`)).toEqual([value.sourcePath]);
      expect(values(`customer-${branch}-${group}-meaning`)).toEqual([value.meaning]);
    } else expect(values(`customer-${branch}-${group}-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)).toEqual([value]);
  }
}
const assertTrace = (text, fact) => {
  expect(text).toContain(fact.provenance.sourcePath); expect(text).toContain(fact.provenance.meaning);
};

describe('nonfinancial service and packing canonical consumers', () => {
  it('preserves job/customer/asset/status and independent work facts through actual portable bindings', () => {
    const input = businessDemoInput('ServiceReport');
    input.service.observations[1].quantity.amount = '-0000.000';
    input.service.status.value = 'Source says pending review · 待复核';
    const { data, values } = consume(input);
    expect(data.service).toEqual(input.service);
    for (const key of ['job', 'customer', 'asset', 'status']) assertContext(values, 'service', key, input.service[key]);
    expect(data.printRows.map(row => row.id)).toEqual(input.service.observations.map(row => row.id));
    input.service.observations.forEach((row, i) => {
      expect(values('items-description')[i]).toBe(row.description);
      expect(values('items-direction')[i]).toBe(row.category);
      expect(values('items-amount')[i]).toBe(row.quantity ? `${row.quantity.amount} ${row.quantity.uom}` : '');
      assertTrace(values('items-trace')[i], row);
      if (row.quantity) assertTrace(values('items-trace')[i], row.quantity);
    });
    for (const key of ['completed', 'accepted', 'paid', 'signature', 'approval', 'total']) expect(data.service).not.toHaveProperty(key);
    expect(data.document).not.toHaveProperty('currency'); expect(data.document).not.toHaveProperty('status');
  });
  it('prints each package and item independently with exact weights, quantities and location provenance', () => {
    const input = businessDemoInput('PackingList'), [first, second] = input.packing.packages;
    first.netWeight.amount = '+0099.000'; // Deliberately not derived from gross or item quantity.
    first.items[0].quantity.amount = '-0000.000';
    const { data, values } = consume(input);
    expect(data.packing).toEqual(input.packing);
    for (const key of ['shipment', 'from', 'to', 'status']) assertContext(values, 'packing', key, input.packing[key]);
    expect(values('items-amount')).toEqual([
      '', `${first.grossWeight.amount} kg`, '+0099.000 kg', '-0000.000 set', '', `${second.grossWeight.amount} lb`, `${second.items[0].quantity.amount} m`
    ]);
    let index = 0;
    for (const pack of input.packing.packages) {
      expect(values('items-description')[index]).toBe(`${pack.type}\n${pack.marks}`);
      expect(values('items-direction')[index]).toBe(pack.id); assertTrace(values('items-trace')[index], pack);
      expect(values('items-amount')[index]).toBe('');
      index++;
      for (const key of ['grossWeight', 'netWeight']) if (pack[key]) {
        const label = key === 'grossWeight' ? 'Gross weight' : 'Net weight';
        expect(values('items-section')[index]).toBe(label);
        expect(values('items-description')[index]).toBe(`Supplied ${label.toLowerCase()}`);
        expect(values('items-amount')[index]).toBe(`${pack[key].amount} ${pack[key].uom}`);
        expect(values('items-direction')[index]).toBe(pack.id);
        expect(values('items-trace')[index]).toContain(pack.id);
        assertTrace(values('items-trace')[index], pack[key]); index++;
      }
      for (const item of pack.items) {
        expect(values('items-description')[index]).toBe(`${item.description}\n${item.item.name}`);
        expect(values('items-direction')[index]).toBe(pack.id);
        expect(values('items-trace')[index]).toContain(item.item.id);
        assertTrace(values('items-trace')[index], item); assertTrace(values('items-trace')[index], item.quantity); index++;
      }
    }
    for (const key of ['totalWeight', 'packageCount', 'totalQuantity', 'prices', 'delivered']) expect(data.packing).not.toHaveProperty(key);
    expect(data.packing.packages[1]).not.toHaveProperty('netWeight'); expect(data.document).not.toHaveProperty('currency');
  });
  it('uses deterministic output-only packing row identities even when source IDs resemble generated weight rows', () => {
    const input = businessDemoInput('PackingList');
    const expected = normalizeBusinessDocument(input).printRows.map(row => row.id);
    input.packing.packages[0].id = 'packing:weight:1:grossWeight';
    input.packing.packages[0].items[0].id = 'packing:package:1';
    input.packing.packages[1].id = 'packing:item:1:1';
    input.packing.packages[1].items[0].id = 'packing:weight:2:grossWeight';
    const { data, values } = consume(input);
    expect(data.printRows.map(row => row.id)).toEqual(expected);
    expect(new Set(data.printRows.map(row => row.id)).size).toBe(data.printRows.length);
    expect(data.packing).toEqual(input.packing);
    expect(values('items-trace')[0]).toContain(input.packing.packages[0].id);
    expect(values('items-trace')[1]).toContain(input.packing.packages[0].id);
    expect(values('items-trace')[3]).toContain(input.packing.packages[0].items[0].id);
    expect(normalizeBusinessDocument(input).printRows.map(row => row.id)).toEqual(expected);
  });
  it.each(['ServiceReport', 'PackingList'])('%s leaves absent source status and optional measures absent', kind => {
    const input = businessDemoInput(kind), branch = input.service || input.packing;
    delete branch.status;
    if (input.service) delete input.service.observations[1].quantity;
    else for (const pack of input.packing.packages) { delete pack.grossWeight; delete pack.netWeight; }
    const { data, values } = consume(input), actual = data.service || data.packing;
    expect(actual).toEqual(branch); expect(actual).not.toHaveProperty('status');
    if (data.service) expect(values('items-amount')).toEqual(['', '', '']);
    else expect(values('items-amount')).toEqual(['', '0012.500 set', '', '0007.125 m']);
  });
  it.each(['ServiceReport', 'PackingList'])('%s rejects model replacement of source facts and collection while allowing style edits', kind => {
    const project = createBusinessDocumentProject(businessDemoInput(kind)), before = structuredClone(project);
    for (const key of ['section', 'description', 'amount', 'direction', 'trace']) {
      for (const patch of [{ pointer: './no' }, { kind: 'static', text: 'invented' }, { format: 'number' }]) {
        const operations = [{ type: 'set_field', target: `items-${key}`, patch }];
        expect(() => parseChatReply(JSON.stringify({ kind: 'proposal', summary: 'Replace source', operations }), project)).toThrow('UNSAFE_PROPOSAL');
        expect(() => createDraft(project).apply('Replace source', operations)).toThrow('UNSAFE_PROPOSAL');
      }
    }
    project.sampleData.alternateRows = structuredClone(project.sampleData.printRows);
    expect(() => createDraft(project).apply('Rebind rows', [{ type: 'set_collection', value: '/alternateRows' }])).toThrow('UNSAFE_PROPOSAL');
    const styled = createDraft(project).apply('Emphasize trace', [{ type: 'set_field', target: 'items-trace', patch: { valueStyle: { bold: true } } }]);
    expect(styled.candidate.sampleData).toEqual(project.sampleData);
    expect(project.templateHtml).toBe(before.templateHtml);
  });
  it.each(['ServiceReport', 'PackingList'])('%s preserves provenance-bearing context and source status instead of inventing approvals', kind => {
    const project = createBusinessDocumentProject(businessDemoInput(kind)), original = structuredClone(project);
    for (const field of designOf(project).customer) {
      for (const patch of [{kind:'static',text:'Accepted and paid'}, {pointer:'/document/number'}, {format:'number'}]) {
        const operations = [{type:'set_field',target:`customer-${field.id}`,patch}];
        expect(()=>parseChatReply(JSON.stringify({kind:'proposal',summary:'Rewrite context',operations}),project)).toThrow('UNSAFE_PROPOSAL');
        expect(()=>createDraft(project).apply('Rewrite context',operations)).toThrow('UNSAFE_PROPOSAL');
      }
    }
    const branch = kind === 'ServiceReport' ? 'service' : 'packing', target = `customer-${branch}-status-value`;
    const styled = createDraft(project).apply('Emphasize source status',[{type:'set_field',target,patch:{label:'Supplied status',valueStyle:{bold:true}}}]).candidate;
    const template = document.createElement('template'); template.innerHTML = styled.templateHtml;
    const bound = bindTemplate(template,styled.sampleData,styled.manifest);
    expect(bound.fragment.querySelector(`[data-v3-id="${target}"]`).textContent).toBe(original.sampleData[branch].status.value);
    expect(project).toEqual(original); expect(styled.sampleData).toEqual(original.sampleData);
  });
  it.each(['ServiceReport', 'PackingList'])('%s refuses portable numeric substitution in the exact source cell', kind => {
    const payload = JSON.parse(saveProject(createBusinessDocumentProject(businessDemoInput(kind))));
    payload.project.sampleData.printRows[0].amount = 0;
    expect(() => readProject(JSON.stringify(payload))).toThrow('Source schema');
  });
});

describe('both public consumers reject unmapped or lossy service/logistics input', () => {
  const cases = [
    ['ServiceReport', d => { delete d.service.job.id; }, 'service.job.id'],
    ['ServiceReport', d => { delete d.service.customer.provenance; }, 'service.customer.provenance'],
    ['ServiceReport', d => { d.service.asset.serialNumber = 123; }, 'service.asset.serialNumber'],
    ['ServiceReport', d => { d.service.status = 'completed'; }, 'service.status'],
    ['ServiceReport', d => { delete d.service.status.provenance; }, 'service.status.provenance'],
    ['ServiceReport', d => { d.document.status = 'accepted'; }, 'document.status'],
    ['ServiceReport', d => { d.document.currency = 'SGD'; }, 'document.currency'],
    ['ServiceReport', d => { d.service.observations = []; }, 'service.observations'],
    ['ServiceReport', d => { d.service.observations[0].category = 'completed'; }, 'service.observations[0].category'],
    ['ServiceReport', d => { d.service.observations[0].provenance = {}; }, 'service.observations[0].provenance.sourcePath'],
    ['ServiceReport', d => { d.service.observations[1].quantity.amount = 1.25; }, 'service.observations[1].quantity.amount'],
    ['ServiceReport', d => { d.service.observations[1].quantity.amount = '-1.250'; }, 'service.observations[1].quantity.amount'],
    ['ServiceReport', d => { d.service.observations[1].id = d.service.observations[0].id; }, 'service.observations[1].id'],
    ['ServiceReport', d => { d.service.signature = 'fake'; }, 'service.signature'],
    ['ServiceReport', d => { d.service.observations[1].hourlyRate = '50'; }, 'service.observations[1].hourlyRate'],
    ['ServiceReport', d => { d.service.work_order = 'raw ERP'; }, 'service.work_order'],
    ['ServiceReport', d => { d.packing = {}; }, 'packing'],
    ['PackingList', d => { delete d.packing.from; }, 'packing.from'],
    ['PackingList', d => { delete d.packing.to.provenance; }, 'packing.to.provenance'],
    ['PackingList', d => { delete d.packing.shipment.number; }, 'packing.shipment.number'],
    ['PackingList', d => { d.packing.status.provenance.meaning = ''; }, 'packing.status.provenance.meaning'],
    ['PackingList', d => { d.source.currency = 'SGD'; }, 'source.currency'],
    ['PackingList', d => { d.packing.packages = []; }, 'packing.packages'],
    ['PackingList', d => { d.packing.packages[0].items = []; }, 'packing.packages[0].items'],
    ['PackingList', d => { d.packing.packages[0].items[0].id = d.packing.packages[0].id; }, 'packing.packages[0].items[0].id'],
    ['PackingList', d => { d.packing.packages[1].id = d.packing.packages[0].id; }, 'packing.packages[1].id'],
    ['PackingList', d => { d.packing.packages[0].grossWeight.amount = '1e3'; }, 'packing.packages[0].grossWeight.amount'],
    ['PackingList', d => { d.packing.packages[0].grossWeight.amount = '-1.000'; }, 'packing.packages[0].grossWeight.amount'],
    ['PackingList', d => { d.packing.packages[0].grossWeight.amount = '1.0001'; }, 'packing.packages[0].grossWeight.amount'],
    ['PackingList', d => { delete d.packing.packages[0].grossWeight.provenance; }, 'packing.packages[0].grossWeight.provenance'],
    ['PackingList', d => { delete d.packing.packages[0].items[0].quantity.uom; }, 'packing.packages[0].items[0].quantity.uom'],
    ['PackingList', d => { delete d.packing.packages[0].items[0].item.name; }, 'packing.packages[0].items[0].item.name'],
    ['PackingList', d => { d.packing.packages[0].items[0].rate = '50'; }, 'packing.packages[0].items[0].rate'],
    ['PackingList', d => { d.packing.totalWeight = '100'; }, 'packing.totalWeight'],
    ['PackingList', d => { d.packing.packed_items = []; }, 'packing.packed_items'],
    ['PackingList', d => { d.packing.approval = true; }, 'packing.approval']
  ];
  it.each(cases)('%s rejects the supplied mutation at %s', (kind, mutate, path) => {
    const input = businessDemoInput(kind); mutate(input);
    for (const consumer of [normalizeBusinessDocument, createBusinessDocumentProject]) expect(() => consumer(input)).toThrow(expect.objectContaining({ path }));
  });
});
