import fs from 'node:fs';
import path from 'node:path';
import {describe, it, expect} from 'vitest';
import {reconcile} from '../../gallery/designs/assets/aster/reconcile.mjs';
import {render} from '../../gallery/designs/assets/aster/template.mjs';
const sample = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../gallery/designs/assets/aster/sample.json')));
const oracle = reconcile(sample).totals;
const state = {detail:'all', notes:'standard'};
const sourceRows = form => [...form.querySelectorAll('[data-pf-table-id="sources"].prowitem')];
const scope = (form, id) => sourceRows(form).find(r => r.querySelector('td').textContent.startsWith(`${id} / `)).querySelectorAll('td')[2].textContent;
function custom() {
  const data = structuredClone(sample);
  data.document.id = 'PACK-42 <b> & "literal"';
  data.receipts[2].lines[1].returnReference = 'RET-42 <img src=x onerror=alert(1)> & "literal"';
  return data;
}
function draw(data) {
  // Exercise actual JSON metadata and production schema/semantic validation.
  const report = reconcile(JSON.parse(JSON.stringify(data)));
  return {report, form:render(report, state, '').form};
}
describe('Aster actual document and receipt metadata bindings', () => {
  it('escapes the actual ID in both header and footer, without changing any totals', () => {
    const data = custom(), {form, report} = draw(data);
    expect(form.querySelector('.running-header').textContent).toContain(data.document.id);
    expect(form.querySelector('.running-footer').textContent).toContain(`PF-065 · ${data.document.id}`);
    expect(scope(form, data.receipts[2].id)).toContain(data.receipts[2].lines[1].returnReference);
    expect(form.textContent).not.toContain('ASTER-REVIEW-DEMO-001');
    expect(form.textContent).not.toContain('RET-DEMO-018');
    expect(form.querySelectorAll('[onerror],.running-footer b:not([data-page-number],[data-page-total])')).toHaveLength(0);
    expect(report.totals).toEqual(oracle);
  });
  it('lists distinct actual return references per receipt, not non-return rows or other receipts', () => {
    const data = custom(), receipt = data.receipts[2];
    receipt.lines.push(
      {...receipt.lines[1], id:'CUSTOM-RETURN-A', receivedQty:1, returnedQty:1},
      {...receipt.lines[1], id:'CUSTOM-RETURN-B', receivedQty:1, returnedQty:1, returnReference:'RET-SECOND & <b>literal</b>'}
    );
    receipt.lines[0].returnReference = 'NOT-A-RETURN';
    data.receipts[0].lines[0].returnedQty = 1;
    data.receipts[0].lines[0].returnReference = 'OTHER-RECEIPT';
    const {form, report} = draw(data), text = scope(form, receipt.id);
    expect(text.split(receipt.lines[1].returnReference)).toHaveLength(2);
    expect(text).toContain('RET-SECOND & <b>literal</b>');
    expect(text).not.toContain('NOT-A-RETURN');
    expect(text).not.toContain('OTHER-RECEIPT');
    expect(scope(form, data.receipts[0].id)).toContain('OTHER-RECEIPT');
    expect(form.querySelectorAll('[onerror]')).toHaveLength(0);
    expect(report.totals.invoiceCanonicalTotalCents).toBe(oracle.invoiceCanonicalTotalCents);
    expect(report.totals.poOrderValueCents).toBe(oracle.poOrderValueCents);
  });
  it.each([null, ''])('accepts schema-permitted missing reference %j without inventing one', reference => {
    const data = custom(); data.receipts[2].lines[1].returnReference = reference;
    const {form, report} = draw(data);
    expect(scope(form, data.receipts[2].id)).toContain('references: not supplied');
    expect(form.textContent).not.toContain('RET-DEMO-018');
    expect(report.totals).toEqual(oracle);
  });
  it('retains known references and signals partially missing references', () => {
    const data = custom(), receipt = data.receipts[2];
    receipt.lines.push({...receipt.lines[1], id:'UNREFERENCED', receivedQty:1, returnedQty:1, returnReference:null});
    const {form} = draw(data), text = scope(form, receipt.id);
    expect(text).toContain(receipt.lines[1].returnReference);
    expect(text).toContain('(some not supplied)');
    expect(text).not.toContain('RET-DEMO-018');
  });
  it('does not claim a return from a reference on a zero-return line', () => {
    const data = custom(); data.receipts[2].lines[1].returnedQty = 0;
    const {form} = draw(data);
    expect(scope(form, data.receipts[2].id)).toBe('Gross receipt quantities, with attached return summary fields.');
    expect(scope(form, data.receipts[2].id)).not.toContain('RET-42');
  });
  it('still rejects an omitted required reference property', () => {
    const data = custom(); delete data.receipts[2].lines[1].returnReference;
    expect(() => draw(data)).toThrow(/returnReference.*required/);
  });
});
