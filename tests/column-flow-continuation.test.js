// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renderColumnFlow } from '../src/printform/formatter/column-flow.js';
import { DomHelpers } from '../src/printform/dom.js';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

function scenario({ first = 204, continuation = 24, footer = 24, clauses = [100] } = {}) {
  vi.spyOn(DomHelpers, 'measureHeightRaw').mockImplementation(node => {
    if (node.classList.contains('pf-flow-column')) {
      return [...node.children].reduce((sum, child) => sum + Number(child.dataset.height), 0);
    }
    if (node.dataset.pfColumns) return Math.max(...[...node.children].map(DomHelpers.measureHeightRaw));
    return Number(node.dataset.used || 0) + [...node.children].reduce((sum, child) => sum + DomHelpers.measureHeightRaw(child), 0);
  });
  const row = document.createElement('section');
  row.className = 'ptac'; row.dataset.pfColumns = '2';
  row.innerHTML = clauses.map((height, i) => `<p id="clause-${i}" data-height="${height}">Clause ${i}</p>`).join('');
  const outputContainer = document.createElement('div'); document.body.append(outputContainer);
  const addPage = used => {
    const page = document.createElement('div'); page.dataset.used = String(used);
    outputContainer.append(page); return page;
  };
  let current = addPage(first);
  const formatter = {
    config: { papersizeHeight: 300 },
    getCurrentPageContainer: () => current,
    prepareNextPage: vi.fn(() => { current = addPage(continuation); }),
    measureContentHeight: (page, repeating) => DomHelpers.measureHeightRaw(page) - repeating,
    refreshPageContextForRow: vi.fn(),
    computeRepeatingHeightForPage: vi.fn(() => continuation)
  };
  const state = { row, outputContainer, sections: {}, heights: {}, footerState: { repeating: footer },
    footerSpacerTemplate: null, logFn: null,
    pageContext: { limit: 300 - continuation - footer, repeatingHeight: 24, tableId: 'terms' } };
  return { formatter, state, run: () => renderColumnFlow(formatter, state) };
}

it('measures a real continuation when first-page-only chrome leaves no room for the first body clause', () => {
  const { formatter, state, run } = scenario();
  expect(run()).toBe(100);
  expect(formatter.prepareNextPage).toHaveBeenCalledTimes(1);
  expect([...state.outputContainer.children].map(page => [...page.querySelectorAll('p')].map(p => p.id)))
    .toEqual([[], ['clause-0']]);
  expect(state.pageContext.repeatingHeight).toBe(24);
  expect(formatter.refreshPageContextForRow).toHaveBeenCalledWith(state.pageContext, state.row, state.heights, state.sections);
  expect(formatter.prepareNextPage.mock.calls[0].slice(7)).toEqual([true, true, 24, 'terms']);
});

it.each([
  ['empty page', { first: 0, continuation: 0, clauses: [301] }],
  ['repeated docinfo', { continuation: 204 }],
  ['repeated footer', { footer: 180 }]
])('rejects without repeated empty-page advances: %s', (_, options) => {
  const { formatter, state, run } = scenario(options);
  expect(run).toThrow('column clause exceeds continuation budget (clause-0)');
  expect(formatter.prepareNextPage).toHaveBeenCalledTimes(1);
  expect(state.outputContainer.querySelectorAll('[data-pf-columns]')).toHaveLength(0);
  expect(state.row.children).toHaveLength(1);
});

it('uses the actual repeating footer budget at an exact continuation boundary', () => {
  const { formatter, run } = scenario({ footer: 176 });
  expect(run()).toBe(100);
  expect(formatter.prepareNextPage).toHaveBeenCalledTimes(1);
});

it('does not retry a fresh continuation after earlier clauses made progress', () => {
  const { formatter, run } = scenario({ first: 24, clauses: [150, 500] });
  expect(run).toThrow('column clause exceeds continuation budget (clause-1)');
  expect(formatter.prepareNextPage).toHaveBeenCalledTimes(1);
});
