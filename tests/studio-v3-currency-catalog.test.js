import { describe, expect, it } from 'vitest';
import { isSupportedCurrency } from '../studio-v3/currency-catalog.js';
import { currency, money } from '../studio-v3/erp-settlement-validation.js';
import { validateDataset } from '../studio-v3/database-model.js';
import { businessDemoInput } from '../studio-v3/business-document-demos.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { readProject, saveProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { formatBindingValue } from '../studio-v2/core/binding-format.js';
import { createBus, editProject, replaceData } from '../studio-v3/controller.js';
import { newProject } from '../studio-v3/model.js';
import { createErpSettlementProject } from '../studio-v3/erp-settlement-project.js';
import { fictionalMixedReceipt } from './fixtures/erp-settlement.js';
import { bindingValidation } from '../studio-v3/validation.js';

const raw = '-0007.2300';
function statement(code) {
  const input = businessDemoInput('AccountStatement'); input.document.currency = code;
  for (const entry of input.statement.entries) for (const fact of entry.amounts) fact.amount.currency = code;
  for (const fact of input.statement.balances) fact.amount.currency = code;
  input.statement.balances[1].amount.amount = raw; input.statement.balances[1].amount.minorUnitDigits = 2;
  return input;
}
const formatNode = options => {
  const node = document.createElement('span'); node.setAttribute('data-pf-format', 'currency');
  if (options) node.setAttribute('data-pf-format-options', JSON.stringify(options));
  return node;
};
describe('one explicit maintained currency subset across real consumers', () => {
  it.each(['GBP','VND'])('%s preserves supplied financial spelling and precision across project/Open/print', code => {
    const input = statement(code), before = structuredClone(input), project = createBusinessDocumentProject(input);
    const reopened = readProject(saveProject(project));
    expect(input).toEqual(before); expect(reopened.manifest.currency).toBe(code);
    expect(reopened.sampleData).toEqual(project.sampleData);
    expect(reopened.sampleData.statement.balances[1].amount).toMatchObject({ amount: raw, currency: code, minorUnitDigits: 2, amountMinor: -723, displayAmount: `${code} ${raw}` });
    const template = document.createElement('template'); template.innerHTML = reopened.templateHtml;
    const bound = bindTemplate(template, reopened.sampleData, reopened.manifest);
    expect(bound.report.errors).toEqual([]);
    expect([...bound.fragment.querySelectorAll('[data-v3-id="items-amount"]')].map(node => node.textContent)).toContain(`${code} ${raw}`);
  });
  it.each(['GBP','VND'])('%s is accepted by dataset selection without changing supplied values or precision', async code => {
    const project = newProject('invoice'), data = structuredClone(project.sampleData);
    data.document.currency = code; data.summary.currency = code; const before = structuredClone(data);
    expect(validateDataset(data)).toEqual(before);
    const bus = createBus(project); await replaceData(bus, data, 'erp', undefined, null, `Supplied ${code}`);
    expect(bus.project.manifest.currency).toBe(code); expect(bus.project.sampleData).toEqual(before);
    expect(data).toEqual(before);
    // Currency metadata is descriptive, never permission to replace supplied precision.
    expect(money({ amount: '+0001.250', currency: code, minorUnitDigits: 3 }, 'fact')).toMatchObject({ amount: '+0001.250', amountMinor: 1250, minorUnitDigits: 3 });
  });
  it.each(['ZZZ','XXX','usd',' GBP','GBP ', '', null, 123])('rejects unsupported primary currency %j without accepting arbitrary three-letter labels', code => {
    expect(isSupportedCurrency(code)).toBe(false);
    expect(() => currency(code, 'currency')).toThrow(expect.objectContaining({ code: 'ERP_SETTLEMENT_CURRENCY', path: 'currency' }));
    const dataset = structuredClone(newProject('invoice').sampleData); dataset.document.currency = code;
    expect(() => validateDataset(dataset)).toThrow('currency');
    expect(() => createBusinessDocumentProject(statement(code))).toThrow();
    const payload = JSON.parse(saveProject(newProject('invoice'))); payload.project.manifest.currency = code;
    expect(() => readProject(JSON.stringify(payload))).toThrow('currency');
  });
  it.each(['ZZZ','gbp'])('rejects an invalid explicit primary-currency label %j without changing the active project', async code => {
    const bus = createBus(newProject('invoice')), before = structuredClone(bus.project), data = structuredClone(bus.project.sampleData);
    data.document.currency = code;
    await expect(replaceData(bus, data)).rejects.toThrow('currency');
    expect(bus.project).toEqual(before);
  });
  it('retains valid foreign facts outside the authoring subset without FX or precision changes', () => {
    const input = fictionalMixedReceipt();
    input.cashMovement.sourceAmount = {amount:'+0009.8760',currency:'BHD',minorUnitDigits:3};
    const allocation = input.allocations[0];
    allocation.sourceReference.currency = 'AED';
    for (const key of ['invoiceAppliedAmount','invoiceClearedAmount','invoiceBalanceBefore','invoiceRemainingBalance']) allocation[key].currency = 'AED';
    const before = structuredClone(input), project = createErpSettlementProject(input), reopened = readProject(saveProject(project));
    expect(input).toEqual(before);
    expect(reopened.manifest.currency).toBe('MYR');
    expect(reopened.sampleData.cashMovement.sourceAmount).toMatchObject({amount:'+0009.8760',currency:'BHD',minorUnitDigits:3,amountMinor:9876});
    expect(reopened.sampleData.allocations[0].invoiceAppliedAmount).toMatchObject({amount:'100.000',currency:'AED',amountMinor:100000});
    expect(reopened.sampleData.cashMovement.amount).toMatchObject({amount:'1150.000',currency:'MYR'});
    const template = document.createElement('template'); template.innerHTML = reopened.templateHtml;
    const bound = bindTemplate(template,reopened.sampleData,reopened.manifest);
    expect(bound.report.errors).toEqual([]);
    expect(bound.fragment.textContent).toContain('BHD +9.876');
    expect(bound.fragment.textContent).toContain('AED 100.000');
  });
  it('keeps the general core formatter independent of the Studio primary-currency picker', () => {
    const node = formatNode({currency:'BHD',currencyDisplay:'code'});
    expect(formatBindingValue(node,1.25,{locale:'en-US',currency:'MYR'}).replace(/\u00a0/g,' ')).toBe('BHD 1.250');
  });
  it('refuses to relabel an explicitly supplied source currency through display settings',async()=> {
    const project = newProject('invoice'); project.sampleData.document.currency = 'MYR';
    const bus = createBus(project), before = structuredClone(bus.project);
    await expect(editProject(bus,[{type:'set_manifest_value',path:'/currency',value:'GBP'}],'currency settings')).rejects.toMatchObject({code:'SOURCE_CURRENCY_MISMATCH'});
    expect(bus.project).toEqual(before); expect(bus.revision).toBe(0);
  });
  it('keeps a mismatched existing file saveable for repair but blocks readiness until source and display agree',async()=> {
    const source = newProject('invoice'); source.sampleData.document.currency = 'MYR'; source.manifest.currency = 'GBP';
    const project = readProject(saveProject(source)), before = structuredClone(project.sampleData);
    expect(bindingValidation(project).errors).toContainEqual(expect.objectContaining({code:'SOURCE_CURRENCY_MISMATCH'}));
    const bus = createBus(project);
    await editProject(bus,[{type:'set_manifest_value',path:'/currency',value:'MYR'}],'source currency repair');
    expect(bindingValidation(bus.project).valid).toBe(true);
    expect(bus.project.sampleData).toEqual(before);
  });
  it('does not mistake an ordinary object-valued currency property for a primary-currency declaration',async()=> {
    const project = newProject('invoice'); project.schema = {type:'object',additionalProperties:true};
    const bus = createBus(project), data = structuredClone(bus.project.sampleData);
    data.document.currency = {code:'USD',description:'A supplied nested value, not a primary-currency tag'};
    await replaceData(bus,data);
    expect(bus.project.manifest.currency).toBe('MYR');
    expect(bus.project.sampleData.document.currency).toEqual(data.document.currency);
  });
});
