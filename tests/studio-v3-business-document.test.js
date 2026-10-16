import { describe, expect, it } from 'vitest';
import { BUSINESS_DOCUMENT_KINDS, normalizeBusinessDocument } from '../studio-v3/business-document-adapter.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { businessDemoInput, BUSINESS_DEMO_TEMPLATES } from '../studio-v3/business-document-demos.js';
import { newDemoProject, setupDemoTemplatePicker } from '../studio-v3/demo-templates.js';
import { designOf } from '../studio-v3/model.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { parseChatReply } from '../studio-v3/ai-chat-protocol.js';
import { protectedBindings } from '../studio-v3/agent-binding-invariants.js';
import { assertCollectionBinding } from '../studio-v3/dataset-schema.js';
import { createBus, designOperations, editProject } from '../studio-v3/controller.js';

function bind(project) {
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const bound = bindTemplate(template, project.sampleData, project.manifest);
  expect(bound.report.errors).toEqual([]); return bound.fragment;
}
const printed = (fragment, id) => [...fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
const proposal = operations => JSON.stringify({ kind: 'proposal', summary: 'Layout edit only', operations });

describe('supplied business documents consumed by the actual Studio lifecycle', () => {
  it.each(BUSINESS_DOCUMENT_KINDS)('%s uses New, binding, save/reopen and human design/undo without inventing invoice facts', async kind => {
    const input = businessDemoInput(kind), original = structuredClone(input), project = createBusinessDocumentProject(input);
    expect(input).toEqual(original);
    expect(project.sampleData.document.kind).toBe(kind);
    expect(project.sampleData).not.toHaveProperty('items');
    expect(project.sampleData).not.toHaveProperty('summary');
    expect(designOf(project).collection).toBe('/printRows');
    expect(() => assertCollectionBinding(project, '/printRows')).not.toThrow();
    const reopened = readProject(saveProject(project));
    expect(reopened.sampleData).toEqual(project.sampleData);
    const paper = bind(reopened);
    for (const key of ['no', 'section', 'description', 'amount', 'direction', 'trace']) {
      expect(printed(paper, `items-${key}`)).toEqual(project.sampleData.printRows.map(row => String(row[key])));
    }
    expect(printed(paper, 'header-source-id')).toEqual([input.source.id]);
    expect(printed(paper, 'header-company-id')).toEqual([input.company.id]);
    expect(printed(paper, 'header-address')).toEqual([input.company.address]);
    expect(printed(paper, 'footer-notes')).toEqual([input.notes]);
    expect(printed(paper, 'footer-boundary')).toEqual([designOf(project).footer.find(field => field.id === 'boundary').text]);
    expect(paper.querySelector('[data-v3-id="totals-total"],[data-v3-id="totals-tax"],[data-v3-id="customer-bill"]')).toBeNull();
    const bus = createBus(reopened), design = designOf(reopened); design.title = `${kind} · edited`;
    await editProject(bus, designOperations(bus.project, design), 'Human supplied-fact layout edit');
    expect(bus.project.sampleData).toEqual(project.sampleData);
    await bus.navigateHistory('undo', bus.revision);
    expect(designOf(bus.project)).toEqual(designOf(reopened));
    expect(bus.project.sampleData).toEqual(project.sampleData);
  });
  it('exposes all three no-code creators through the existing New picker only', () => {
    document.body.innerHTML = '<dialog id="new-dialog"><div class="template-options"></div></dialog>';
    setupDemoTemplatePicker();
    for (const entry of BUSINESS_DEMO_TEMPLATES) {
      const button = document.querySelector(`[data-demo-template="${entry.documentKind}"]`);
      expect(button.disabled).toBe(false); expect(button.textContent).toContain(entry.label);
      expect(newDemoProject(button.dataset.demoTemplate).sampleData.document.kind).toBe(entry.documentKind);
    }
  });
  it('preserves independently supplied debit/credit and unreconciled balance snapshots verbatim', () => {
    const input = businessDemoInput('AccountStatement');
    input.statement.balances[1].amount.amount = '-0007.2300';
    input.statement.balances[1].amount.minorUnitDigits = 2;
    const data = normalizeBusinessDocument(input);
    expect(data.statement.balances[1].amount).toMatchObject({ amount: '-0007.2300', minorUnitDigits: 2, displayAmount: 'SGD -0007.2300' });
    expect(data.statement.entries[0].amounts[0].amount.amount).toBe(input.statement.entries[0].amounts[0].amount.amount);
    expect(data.printRows.find(row => row.id === input.statement.balances[1].id).amount).toBe('SGD -0007.2300');
    expect(data.statement).not.toHaveProperty('aging'); expect(data.statement).not.toHaveProperty('paymentStatus');
  });
  it('does not infer opening/closing balances, running balances, tax or payroll totals', () => {
    const statement = businessDemoInput('AccountStatement'); delete statement.statement.balances;
    const payroll = businessDemoInput('PayrollSlip'); delete payroll.payroll.summary; delete payroll.payroll.payDate;
    const account = createBusinessDocumentProject(statement), salary = createBusinessDocumentProject(payroll);
    expect(account.sampleData.statement).not.toHaveProperty('balances');
    expect(salary.sampleData.payroll).not.toHaveProperty('summary'); expect(salary.sampleData.payroll).not.toHaveProperty('payDate');
    expect(salary.sampleData.printRows.map(row => row.id)).toEqual(payroll.payroll.components.map(row => row.id));
    expect(bind(salary).querySelector('[data-v3-id="customer-pay-date"]')).toBeNull();
  });
  it('prints empty-period statements only when a source balance actually exists', () => {
    const input = businessDemoInput('AccountStatement'); input.statement.entries = [];
    const project = readProject(saveProject(createBusinessDocumentProject(input)));
    expect(printed(bind(project), 'items-amount')).toEqual(input.statement.balances.map(row => `SGD ${row.amount.amount}`));
    delete input.statement.balances;
    expect(() => createBusinessDocumentProject(input)).toThrow(expect.objectContaining({ code: 'BUSINESS_FACTS_ROWS', path: 'statement' }));
  });
  it('keeps stock direction and source UOM explicit, without valuation or quantity conversion', () => {
    const input = businessDemoInput('StockMovement'); input.stock.lines[0].quantity.amount = '-0.000';
    const data = normalizeBusinessDocument(input);
    expect(data.stock.lines[0]).toMatchObject({ direction: input.stock.lines[0].direction, quantity: { amount: '-0.000', uom: input.stock.lines[0].quantity.uom } });
    expect(data.printRows[0].amount).toBe(`-0.000 ${input.stock.lines[0].quantity.uom}`);
    expect(data.document).not.toHaveProperty('currency'); expect(data.stock).not.toHaveProperty('balance');
    expect(data.printRows.map(row => row.id)).toEqual(input.stock.lines.map(row => row.id));
  });
  it('keeps employer contributions separate from deductions and preserves a supplied non-derived net pay', () => {
    const input = businessDemoInput('PayrollSlip'); input.payroll.summary.find(row => row.role === 'netPay').amount.amount = '+0.001';
    const data = normalizeBusinessDocument(input);
    expect(data.payroll.components.find(row => row.role === 'employerContribution').amount.amount).toBe(input.payroll.components.find(row => row.role === 'employerContribution').amount.amount);
    expect(data.payroll.summary.find(row => row.role === 'netPay').amount.displayAmount).toBe('SGD +0.001');
    expect(JSON.stringify(data)).not.toMatch(/"(?:iban|swift|accountNumber|bank)"/);
    expect(data.payroll.employee).toEqual(input.payroll.employee);
  });
  it.each(BUSINESS_DOCUMENT_KINDS)('%s retains optional supplied metadata and multiline notes after portable reopen', kind => {
    const input = businessDemoInput(kind);
    input.document.status = 'Source status only · 未核销';
    input.company.address = 'Fictional office, floor 1\nFictional Demo Street · 非真实地址';
    input.notes = 'Supplied first line.\nSupplied second line: no payment or posting assertion.';
    if (input.statement) input.statement.party.address = 'Fictional customer office\nFictional receiving desk';
    const project = readProject(saveProject(createBusinessDocumentProject(input))), paper = bind(project);
    expect(printed(paper, 'header-status')).toEqual([input.document.status]);
    expect(printed(paper, 'header-address')).toEqual([input.company.address]);
    expect(printed(paper, 'footer-notes')).toEqual([input.notes]);
    if (input.statement) expect(printed(paper, 'customer-address')).toEqual([input.statement.party.address]);
    if (input.payroll) {
      for (const [id, key] of [['department', 'department'], ['job-title', 'jobTitle']]) {
        expect(printed(paper, `customer-${id}`)).toEqual([input.payroll.employee[key]]);
      }
      expect(printed(paper, 'customer-pay-date')).toEqual([input.payroll.payDate]);
    }
  });
  it.each(['AccountStatement', 'PayrollSlip'])('%s rejects model rebinding/static substitution/reformatting/collection changes for its real amount column', kind => {
    const project = newDemoProject(kind);
    project.sampleData.alternateRows = structuredClone(project.sampleData.printRows);
    const baseline = structuredClone(project);
    expect(protectedBindings(designOf(project))).toContainEqual(expect.objectContaining({ id: 'amount', pointer: './amount', financial: true, collection: '/printRows' }));
    for (const patch of [{ pointer: './description' }, { kind: 'static', text: '0' }, { format: 'currency' }]) {
      expect(() => parseChatReply(proposal([{ type: 'set_field', target: 'items-amount', patch }]), project)).toThrow('UNSAFE_PROPOSAL');
    }
    expect(() => parseChatReply(proposal([{ type: 'set_collection', value: '/alternateRows' }]), project, { request: 'Use /alternateRows' })).toThrow('UNSAFE_PROPOSAL');
    const styled = parseChatReply(proposal([{ type: 'set_field', target: 'items-amount', patch: { valueStyle: { bold: true } } }]), project).candidate;
    expect(printed(bind(styled), 'items-amount')).toEqual(project.sampleData.printRows.map(row => row.amount));
    expect(project).toEqual(baseline); expect(styled.sampleData).toEqual(baseline.sampleData);
  });
  it('rejects portable-project collection corruption instead of accepting an untyped print amount', () => {
    const payload = JSON.parse(saveProject(newDemoProject('PayrollSlip')));
    payload.project.sampleData.printRows[0].amount = 0;
    expect(() => readProject(JSON.stringify(payload))).toThrow('Source schema');
  });
});

describe('canonical consumer rejects ambiguous or lossy supplied business inputs', () => {
  const cases = [
    ['AccountStatement', d => { delete d.profile; }, 'profile'],
    ['AccountStatement', d => { delete d.statement.account.debitMeaning; }, 'statement.account.debitMeaning'],
    ['AccountStatement', d => { d.statement.entries[0].amounts[0].amount.amount = 1.23; }, 'statement.entries[0].amounts[0].amount.amount'],
    ['AccountStatement', d => { d.statement.entries[0].amounts[0].amount.amount = '1e3'; }, 'statement.entries[0].amounts[0].amount.amount'],
    ['AccountStatement', d => { d.statement.entries[0].amounts[0].amount.currency = 'USD'; }, 'statement.entries[0].amounts[0].amount.currency'],
    ['AccountStatement', d => { d.statement.entries[0].reference.partyId = 'OTHER'; }, 'statement.entries[0].reference.partyId'],
    ['AccountStatement', d => { d.statement.entries[0].date = '2026-10-31'; }, 'statement.entries[0].date'],
    ['AccountStatement', d => { d.statement.period.to = '2026-02-30'; }, 'statement.period.to'],
    ['AccountStatement', d => { d.statement.entries[0].amounts[0].amount.provenance = {}; }, 'statement.entries[0].amounts[0].amount.provenance.sourcePath'],
    ['StockMovement', d => { delete d.stock.lines[0].direction; }, 'stock.lines[0].direction'],
    ['StockMovement', d => { delete d.stock.lines[0].to; }, 'stock.lines[0].to'],
    ['StockMovement', d => { d.stock.lines[1].to = { id: 'OTHER' }; }, 'stock.lines[1]'],
    ['StockMovement', d => { delete d.stock.lines[0].quantity.uom; }, 'stock.lines[0].quantity.uom'],
    ['StockMovement', d => { d.stock.lines[0].quantity.amount = '1.0001'; }, 'stock.lines[0].quantity.amount'],
    ['StockMovement', d => { delete d.stock.lines[0].quantity.decimalPlaces; }, 'stock.lines[0].quantity.decimalPlaces'],
    ['PayrollSlip', d => { delete d.payroll.employee.id; }, 'payroll.employee.id'],
    ['PayrollSlip', d => { d.payroll.employee.bank = 'NOT-ACCEPTED'; }, 'payroll.employee.bank'],
    ['PayrollSlip', d => { d.payroll.components[0].role = 'taxCalculator'; }, 'payroll.components[0].role'],
    ['PayrollSlip', d => { delete d.payroll.components[0].basis; }, 'payroll.components[0].basis'],
    ['PayrollSlip', d => { d.payroll.components[0].amount.amount = '9007199254740992'; }, 'payroll.components[0].amount.amount'],
    ['PayrollSlip', d => { d.payroll.components[1].id = d.payroll.components[0].id; }, 'payroll.components[1].id'],
    ['PayrollSlip', d => { d.payroll.components = []; }, 'payroll.components'],
    ['PayrollSlip', d => { d.stock = {}; }, 'stock']
  ];
  it.each(cases)('%s refuses invalid source at %s', (kind, change, path) => {
    const input = businessDemoInput(kind); change(input);
    for (const consumer of [normalizeBusinessDocument, createBusinessDocumentProject]) expect(() => consumer(input)).toThrow(expect.objectContaining({ path }));
  });
});
