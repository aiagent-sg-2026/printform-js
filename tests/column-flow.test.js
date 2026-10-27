// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { columnFlowChildren, packColumnFragment } from "../src/printform/formatter/column-flow.js";
import { DomHelpers } from "../src/printform/dom.js";

const make = (html = '<p id="one">One</p><p id="two">Two</p>') => {
  const row = document.createElement('section');
  row.className = 'ptac'; row.dataset.pfColumns = '2'; row.innerHTML = html;
  return row;
};
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('opt-in measured column flow', () => {
  it('accepts only a two-column PTAC block with element clauses', () => {
    expect(columnFlowChildren(make()).map(n => n.id)).toEqual(['one', 'two']);
    for (const value of ['1', '3', 'auto']) {
      const row = make(); row.dataset.pfColumns = value;
      expect(() => columnFlowChildren(row)).toThrow('requires a PTAC');
    }
    const row = make(); row.className = 'prowitem';
    expect(() => columnFlowChildren(row)).toThrow('requires a PTAC');
    expect(() => columnFlowChildren(make('bare text<p>Clause</p>'))).toThrow('bare text');
    expect(() => columnFlowChildren(make('<div class="prowitem">Nested row</div>'))).toThrow('nested pagination');
  });

  function metrics() {
    vi.spyOn(DomHelpers, 'measureHeightRaw').mockImplementation(node => {
      if (node.classList.contains('pf-flow-column')) return [...node.children].reduce((n, c) => n + Number(c.dataset.height), 0);
      if (node.dataset.pfColumns) return Math.max(...[...node.children].map(c => DomHelpers.measureHeightRaw(c)));
      return Number(node.dataset.used || 0) + [...node.children].reduce((n, c) => n + DomHelpers.measureHeightRaw(c), 0);
    });
  }
  it('fills actual remaining space in left-to-right semantic order', () => {
    metrics();
    const row = make(Array.from({ length: 6 }, (_, i) => `<p id="c${i}" data-height="30">Clause ${i}</p>`).join(''));
    const page = document.createElement('div'); page.dataset.used = '40'; document.body.append(page);
    const result = packColumnFragment(row, columnFlowChildren(row), 0, page, 100, '20px');
    expect(result.end).toBe(4);
    expect([...result.fragment.children].map(lane => [...lane.children].map(n => n.id))).toEqual([['c0', 'c1'], ['c2', 'c3']]);
    expect(row.children).toHaveLength(6);
    expect(result.fragment.style.columnGap).toBe('20px');
  });
  it('balances the final fragment without duplicating or reordering clauses', () => {
    metrics();
    const row = make(Array.from({ length: 4 }, (_, i) => `<p id="c${i}" data-height="20">Clause ${i}</p>`).join(''));
    const page = document.createElement('div'); document.body.append(page);
    const result = packColumnFragment(row, columnFlowChildren(row), 0, page, 120, '24px');
    expect(result.end).toBe(4);
    expect([...result.fragment.children].map(lane => lane.children.length)).toEqual([2, 2]);
    expect([...result.fragment.querySelectorAll('p')].map(n => n.id)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });
  it('removes failed trials when an indivisible clause cannot fit', () => {
    metrics();
    const row = make('<p data-height="200">Oversized</p>');
    const page = document.createElement('div'); document.body.append(page);
    expect(packColumnFragment(row, columnFlowChildren(row), 0, page, 100, '20px')).toBeNull();
    expect(page.children).toHaveLength(0);
    expect(row.textContent).toBe('Oversized');
  });
});
