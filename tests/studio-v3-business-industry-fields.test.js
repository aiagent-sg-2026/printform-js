import { describe, expect, it } from 'vitest';
import { normalizeBusinessDocument } from '../studio-v3/business-document-adapter.js';
import { businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { parseChatReply } from '../studio-v3/ai-chat-protocol.js';
import { createDraft } from '../studio-v3/agent-draft.js';
import { designOf } from '../studio-v3/model.js';

const provenance = (sourcePath, meaning) => ({ sourcePath, meaning });
function roundtrip(input) {
  const original = structuredClone(input), project = createBusinessDocumentProject(input);
  const reopened = readProject(saveProject(project));
  expect(input).toEqual(original);
  expect(reopened.sampleData).toEqual(project.sampleData);
  const template = document.createElement('template'); template.innerHTML = reopened.templateHtml;
  const bound = bindTemplate(template, reopened.sampleData, reopened.manifest);
  expect(bound.report.errors).toEqual([]);
  const values = id => [...bound.fragment.querySelectorAll(`[data-v3-id="items-${id}"]`)].map(node => node.textContent);
  for (const column of ['description', 'amount', 'direction', 'trace']) expect(values(column)).toEqual(project.sampleData.printRows.map(row => row[column]));
  return { data: reopened.sampleData, values };
}

describe('explicit industry facts use the supplied-business-v1 consumer contract', () => {
  it('prints source lot, serial list, expiry and both location traces without replacing legacy batch/quantity/reference facts', () => {
    const input = businessDemoInput('StockMovement'), line = input.stock.lines[0];
    line.tracking = { lot: 'LOT/α-001', serialNumbers: ['000012', 'S/β-002'], expiryDate: '2026-01-01',
      provenance: provenance('warehouse/movement-001/tracking', 'Supplied tracking record, not an expiry-status assertion') };
    line.to.provenance = provenance('warehouse/movement-001/to', 'Supplied destination warehouse and bin');
    const { data, values } = roundtrip(input), actual = data.stock.lines[0];
    expect(actual.tracking).toEqual(line.tracking);
    expect(actual.from).toEqual(line.from); expect(actual.to).toEqual(line.to);
    expect(actual.reference).toEqual(line.reference); expect(actual.item).toEqual(line.item);
    expect(actual.batch).toBe(line.batch); expect(actual.quantity).toEqual(line.quantity);
    for (const value of [line.description, line.batch, line.tracking.lot, ...line.tracking.serialNumbers, line.tracking.expiryDate]) expect(values('description')[0]).toContain(value);
    for (const location of [line.from, line.to]) {
      for (const key of ['id', 'name', 'bin']) expect(values('direction')[0]).toContain(location[key]);
      expect(values('trace')[0]).toContain(location.provenance.sourcePath);
      expect(values('trace')[0]).toContain(location.provenance.meaning);
    }
    expect(values('trace')[0]).toContain(line.tracking.provenance.sourcePath);
    expect(values('trace')[0]).toContain(line.tracking.provenance.meaning);
    expect(values('trace')[0]).toContain(line.reference.id);
    expect(values('amount')[0]).toBe(`${line.quantity.amount} ${line.quantity.uom}`);
    expect(actual.tracking).not.toHaveProperty('expired'); expect(data.stock).not.toHaveProperty('balance');
  });

  it('prints independent supplied hour/rate bases for earnings and deductions without deriving money or net pay', () => {
    const input = businessDemoInput('PayrollSlip'), [earning, , deduction] = input.payroll.components;
    earning.hours.amount = '-0000.000'; earning.hourlyRate.amount = '+00111.000';
    deduction.hours = { amount: '1.25', decimalPlaces: 2, uom: 'hour', provenance: provenance('payroll/deduction/hours', 'Source supplied deduction hours only') };
    deduction.hourlyRate = { ...structuredClone(earning.hourlyRate), amount: '3.456', provenance: provenance('payroll/deduction/rate', 'Source supplied deduction hourly basis only') };
    input.payroll.summary.find(row => row.role === 'netPay').amount.amount = '+0.001';
    const { data, values } = roundtrip(input);
    expect(data.payroll.employee).toEqual(input.payroll.employee);
    expect(data.payroll.components.map(row => row.amount.amount)).toEqual(input.payroll.components.map(row => row.amount.amount));
    for (const component of [earning, deduction]) {
      const index = input.payroll.components.indexOf(component), actual = data.payroll.components[index];
      expect(actual.hours).toEqual(component.hours);
      expect(actual.hourlyRate).toMatchObject(component.hourlyRate);
      expect(values('description')[index]).toContain(`Hours: ${component.hours.amount} hour`);
      expect(values('description')[index]).toContain(`Hourly rate: SGD ${component.hourlyRate.amount} / hour`);
      for (const source of [component.hours.provenance, component.hourlyRate.provenance]) {
        expect(values('trace')[index]).toContain(source.sourcePath); expect(values('trace')[index]).toContain(source.meaning);
      }
      expect(values('amount')[index]).toBe(`SGD ${component.amount.amount}`);
    }
    expect(data.payroll.summary.find(row => row.role === 'netPay').amount.amount).toBe('+0.001');
    expect(data.payroll).not.toHaveProperty('paymentStatus'); expect(data.payroll).not.toHaveProperty('calculatedNetPay');
  });

  it.each(['hours', 'hourlyRate'])('accepts an independently supplied %s without inventing its counterpart', field => {
    const input = businessDemoInput('PayrollSlip'), entry = input.payroll.components[0];
    const absent = field === 'hours' ? 'hourlyRate' : 'hours'; delete entry[absent];
    const { data } = roundtrip(input);
    expect(data.payroll.components[0]).not.toHaveProperty(absent);
    expect(data.payroll.components[0][field]).toMatchObject(entry[field]);
  });

  it('retains statement source identities and prints explicit due dates without inferring aging or payment status', () => {
    const input = businessDemoInput('AccountStatement'), entry = input.statement.entries[0];
    Object.assign(entry.reference, { date: '2026-10-02', companyId: input.company.id, partyId: input.statement.party.id, currency: input.document.currency });
    entry.dueDate = '2026-01-01';
    const { data, values } = roundtrip(input);
    expect(data.statement.entries[0].reference).toEqual(entry.reference);
    expect(data.statement.entries[0].dueDate).toBe(entry.dueDate);
    expect(values('description')[0]).toContain(`Due: ${entry.dueDate}`);
    for (const key of ['system', 'documentType', 'id', 'number']) expect(values('trace')[0]).toContain(entry.reference[key]);
    expect(data.statement).not.toHaveProperty('aging'); expect(data.statement).not.toHaveProperty('paymentStatus');
  });

  it('keeps legacy inputs valid and absent fields absent', () => {
    const stock = businessDemoInput('StockMovement'), payroll = businessDemoInput('PayrollSlip');
    for (const line of stock.stock.lines) {
      delete line.tracking;
      for (const key of ['from', 'to']) if (line[key]) delete line[key].provenance;
    }
    for (const entry of payroll.payroll.components) { delete entry.hours; delete entry.hourlyRate; }
    const stockData = roundtrip(stock).data, payrollData = roundtrip(payroll).data;
    expect(stockData.stock.lines[0].batch).toBe('FICTIONAL-LOT-1');
    expect(stockData.stock.lines.map(row => row.quantity.amount)).toEqual(['12.500', '2.250', '7.000']);
    expect(payrollData.payroll.components.map(row => row.amount.amount)).toEqual(['2,000.000', '123.456', '45.678', '88.001']);
    for (const line of stockData.stock.lines) expect(line).not.toHaveProperty('tracking');
    for (const entry of payrollData.payroll.components) { expect(entry).not.toHaveProperty('hours'); expect(entry).not.toHaveProperty('hourlyRate'); }
  });

  it.each([
    ['PayrollSlip','description',{kind:'static',text:'0'}],
    ['AccountStatement','section',{pointer:'./amount'}],
    ['StockMovement','direction',{pointer:'./amount'}],
    ['StockMovement','trace',{kind:'static',text:'untracked'}]
  ])('%s preserves supplied %s when a model attempts to replace its facts', (kind,id,patch) => {
    const project = createBusinessDocumentProject(businessDemoInput(kind)), before = structuredClone(project);
    const operations = [{type:'set_field',target:`items-${id}`,patch}];
    expect(()=>parseChatReply(JSON.stringify({kind:'proposal',summary:'Replace supplied facts',operations}),project)).toThrow('UNSAFE_PROPOSAL');
    const draft = createDraft(project);
    expect(()=>draft.apply('Replace supplied facts',operations)).toThrow('UNSAFE_PROPOSAL');
    expect(draft.project).toEqual(before); expect(project).toEqual(before);
  });

  it('retains source-basis protection across removal/re-addition while allowing a pure style change', () => {
    const project = createBusinessDocumentProject(businessDemoInput('PayrollSlip')), before = structuredClone(project);
    const original = designOf(project).columns.find(field => field.id === 'description'), draft = createDraft(project);
    const styled = draft.apply('Emphasize supplied basis',[{type:'set_field',target:'items-description',patch:{valueStyle:{bold:true}}}]);
    expect(styled.candidate.sampleData).toEqual(before.sampleData);
    draft.apply('Remove basis column',[{type:'remove_field',target:'items-description'}]);
    expect(()=>draft.apply('Substitute source basis',[{type:'add_field',section:'items',field:{...original,pointer:'./amount'}}])).toThrow('UNSAFE_PROPOSAL');
    const restored = draft.apply('Restore source basis',[{type:'add_field',section:'items',field:original}]);
    expect(designOf(restored.candidate).columns.find(field=>field.id==='description').pointer).toBe('./description');
    expect(restored.candidate.sampleData).toEqual(before.sampleData); expect(project).toEqual(before);
  });

});

describe('both public business consumers reject unmapped industry fields', () => {
  const cases = [
    ['StockMovement', d => { d.stock.lines[0].tracking.lot = 123; }, 'stock.lines[0].tracking.lot', 'TEXT'],
    ['StockMovement', d => { d.stock.lines[0].tracking.serialNumbers = 'SERIAL-1'; }, 'stock.lines[0].tracking.serialNumbers', 'ROWS'],
    ['StockMovement', d => { d.stock.lines[0].tracking.serialNumbers = []; }, 'stock.lines[0].tracking.serialNumbers', 'ROWS'],
    ['StockMovement', d => { d.stock.lines[0].tracking.serialNumbers = Array(501).fill('S'); }, 'stock.lines[0].tracking.serialNumbers', 'ROWS'],
    ['StockMovement', d => { d.stock.lines[0].tracking.serialNumbers = ['S', 2]; }, 'stock.lines[0].tracking.serialNumbers[1]', 'TEXT'],
    ['StockMovement', d => { d.stock.lines[0].tracking.expiryDate = '2026-02-30'; }, 'stock.lines[0].tracking.expiryDate', 'DATE'],
    ['StockMovement', d => { d.stock.lines[0].tracking.expiryDate = '30/04/2027'; }, 'stock.lines[0].tracking.expiryDate', 'DATE'],
    ['StockMovement', d => { d.stock.lines[0].tracking.expiryDate = 20270430; }, 'stock.lines[0].tracking.expiryDate', 'TEXT'],
    ['StockMovement', d => { delete d.stock.lines[0].tracking.provenance; }, 'stock.lines[0].tracking.provenance', 'SHAPE'],
    ['StockMovement', d => { d.stock.lines[0].tracking = { provenance: provenance('x', 'y') }; }, 'stock.lines[0].tracking', 'ROWS'],
    ['StockMovement', d => { d.stock.lines[0].tracking.shelfLifeDays = 30; }, 'stock.lines[0].tracking.shelfLifeDays', 'FIELD'],
    ['StockMovement', d => { d.stock.lines[0].serials = ['RAW']; }, 'stock.lines[0].serials', 'FIELD'],
    ['StockMovement', d => { d.stock.lines[0].from.bin = 1; }, 'stock.lines[0].from.bin', 'TEXT'],
    ['StockMovement', d => { d.stock.lines[0].from.provenance = {}; }, 'stock.lines[0].from.provenance.sourcePath', 'TEXT'],
    ['StockMovement', d => { d.stock.lines[0].to.warehouseCode = 'RAW'; }, 'stock.lines[0].to.warehouseCode', 'FIELD'],
    ['PayrollSlip', d => { d.payroll.components[0].hours.amount = 7.5; }, 'payroll.components[0].hours.amount', 'TEXT'],
    ['PayrollSlip', d => { d.payroll.components[0].hours.amount = '7.0001'; }, 'payroll.components[0].hours.amount', 'AMOUNT_PRECISION'],
    ['PayrollSlip', d => { d.payroll.components[0].hours.uom = 'day'; }, 'payroll.components[0].hours.uom', 'SEMANTICS'],
    ['PayrollSlip', d => { d.payroll.components[0].hours.decimalPlaces = 'three'; }, 'payroll.components[0].hours.decimalPlaces', 'PRECISION'],
    ['PayrollSlip', d => { d.payroll.components[0].hours.provenance = {}; }, 'payroll.components[0].hours.provenance.sourcePath', 'TEXT'],
    ['PayrollSlip', d => { d.payroll.components[0].hours.multiplier = '1.5'; }, 'payroll.components[0].hours.multiplier', 'FIELD'],
    ['PayrollSlip', d => { d.payroll.components[0].hourlyRate.amount = 111; }, 'payroll.components[0].hourlyRate.amount', 'TEXT'],
    ['PayrollSlip', d => { d.payroll.components[0].hourlyRate.currency = 'USD'; }, 'payroll.components[0].hourlyRate.currency', 'CURRENCY'],
    ['PayrollSlip', d => { delete d.payroll.components[0].hourlyRate.provenance; }, 'payroll.components[0].hourlyRate.provenance', 'SHAPE'],
    ['PayrollSlip', d => { d.payroll.components[0].hourlyRate.taxRate = '0.06'; }, 'payroll.components[0].hourlyRate.taxRate', 'FIELD'],
    ['PayrollSlip', d => { d.payroll.components[0].overtimeMultiplier = '1.5'; }, 'payroll.components[0].overtimeMultiplier', 'FIELD'],
    ['PayrollSlip', d => { d.payroll.summary[0].hours = structuredClone(d.payroll.components[0].hours); }, 'payroll.summary[0].hours', 'FIELD'],
    ['AccountStatement', d => { d.statement.entries[0].dueDate = '2026-02-30'; }, 'statement.entries[0].dueDate', 'DATE'],
    ['AccountStatement', d => { d.statement.entries[0].dueDate = 20261103; }, 'statement.entries[0].dueDate', 'TEXT'],
    ['AccountStatement', d => { d.statement.entries[0].reference.date = '2026-04-31'; }, 'statement.entries[0].reference.date', 'DATE'],
    ['AccountStatement', d => { d.statement.entries[0].reference.invoiceNumber = 'RAW'; }, 'statement.entries[0].reference.invoiceNumber', 'FIELD'],
    ['AccountStatement', d => { d.statement.entries[0].agingDays = 30; }, 'statement.entries[0].agingDays', 'FIELD']
  ];
  it.each(cases)('%s refuses the invalid mapping at %s', (kind, change, path, code) => {
    const input = businessDemoInput(kind); change(input);
    for (const consumer of [normalizeBusinessDocument, createBusinessDocumentProject]) {
      expect(() => consumer(input)).toThrow(expect.objectContaining({ code: `BUSINESS_FACTS_${code}`, path }));
    }
  });
});
