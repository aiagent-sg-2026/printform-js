import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../src/printform.js';
import { PrintFormFormatter } from '../src/printform/formatter.js';

function addForm(title) {
  const form = document.createElement('div');
  form.className = 'printform';
  form.innerHTML = `<div class="pheader">${title}</div>`;
  document.body.append(form);
  return form;
}

beforeEach(async () => {
  await api.formatAll();
  document.body.replaceChildren();
});
afterEach(() => vi.restoreAllMocks());

describe('batch pagination completion', () => {
  it('formats documents appended after an empty or completed batch', async () => {
    expect(await api.formatAll()).toEqual({ formattedCount: 0, failedCount: 0 });
    addForm('FIRST-INVOICE');
    await api.formatAll();
    addForm('SECOND-RECEIPT');
    await api.formatAll();
    expect(document.querySelectorAll('.printform')).toHaveLength(0);
    expect(document.body.textContent).toContain('FIRST-INVOICE');
    expect(document.body.textContent).toContain('SECOND-RECEIPT');
  });

  it('concurrent callers wait for the same batch completion', async () => {
    addForm('SHARED-COMPLETION');
    const first = api.formatAll(), second = api.formatAll();
    expect(second).toBe(first);
    await second;
    expect(window.__printFormProcessing).toBe(false);
    expect(document.querySelectorAll('.printform_formatter_processed')).toHaveLength(1);
  });

  it('reports a failed document, completes peers and allows retry', async () => {
    const failed = addForm('RETRY-INVOICE');
    addForm('SUCCESSFUL-PEER');
    const original = PrintFormFormatter.prototype.format;
    const injected = new Error('Injected measurement failure');
    const spy = vi.spyOn(PrintFormFormatter.prototype, 'format').mockImplementation(function () {
      if (this.formEl === failed) throw injected;
      return original.call(this);
    });
    let failure;
    try { await api.formatAll(); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toEqual([injected]);
    expect(failure.report).toEqual({ formattedCount: 1, failedCount: 1 });
    expect(window.__printFormProcessed).toBe(false);
    expect(failed.isConnected).toBe(true);
    expect(document.body.textContent).toContain('SUCCESSFUL-PEER');
    spy.mockRestore();
    expect(await api.formatAll()).toEqual({ formattedCount: 1, failedCount: 0 });
    expect(document.querySelectorAll('.printform')).toHaveLength(0);
    expect(document.body.textContent).toContain('RETRY-INVOICE');
  });
});
