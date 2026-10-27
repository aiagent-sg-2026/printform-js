import { test, expect } from '@playwright/test';

async function host(page) {
  await page.goto('/gallery/index.html');
  await page.addScriptTag({ url: '/dist/printform.js' });
  await page.evaluate(() => {
    document.body.replaceChildren();
    window.makeContinuationTest = ({ info = 180, footer = 24, height = 100, width = '',
      repeatInfo = 'n', repeatHeader = 'y', repeatFooter = 'y' } = {}) => {
      const form = document.createElement('div'); form.className = 'printform';
      Object.assign(form.dataset, { papersizeWidth: '420', papersizeHeight: '300', repeatHeader,
        repeatDocinfo: repeatInfo, repeatFooter, insertDummyRowItemWhileFormatTable: 'n',
        insertDummyRowWhileFormatTable: 'n' });
      form.innerHTML = `<div class="pheader" style="height:24px">HEADER</div>
        <div class="pdocinfo" style="height:${info}px">FIRST INFO</div>
        <section class="ptac" data-pf-columns="2"><p id="first-clause" style="height:${height}px;${width}margin:0">CLAUSE</p></section>
        <div class="pfooter" style="height:${footer}px">FOOTER</div>`;
      document.body.append(form); return form;
    };
  });
}

for (const [name, options, expected] of [
  ['first-page-only docinfo', {}, [[1, 1, 0, 1], [1, 0, 1, 1]]],
  ['nonrepeating header', { repeatHeader: 'n' }, [[1, 1, 0, 1], [0, 0, 1, 1]]],
  ['repeated docinfo with first-page-only header', { info: 40, repeatInfo: 'y', repeatHeader: 'n', height: 236 }, [[1, 1, 0, 1], [0, 1, 1, 1]]],
  ['exact repeated-footer boundary', { info: 100, footer: 176 }, [[1, 1, 0, 1], [1, 0, 1, 1]]],
  ['nonrepeating footer', { info: 0, footer: 120, height: 180, repeatFooter: 'n' }, [[1, 1, 1, 0], [1, 0, 0, 1]]],
  ['no-docinfo control', { info: 0 }, [[1, 1, 1, 1]]]
]) {
  test(`first column body respects actual continuation chrome: ${name}`, async ({ page }) => {
    await host(page);
    const result = await page.evaluate(options => {
      const form = window.makeContinuationTest(options);
      const output = window.PrintForm.format(form);
      return [...output.querySelectorAll('.printform_page')].map(p => {
        const box = p.getBoundingClientRect(), clause = p.querySelector('#first-clause');
        const footer = p.querySelector('.pfooter_processed');
        return { counts: ['.pheader_processed', '.pdocinfo_processed', '#first-clause', '.pfooter_processed']
          .map(selector => p.querySelectorAll(selector).length), height: box.height,
          overflow: p.scrollWidth > p.clientWidth + 1,
          outside: [...p.querySelectorAll('#first-clause,.pfooter_processed')].some(n => {
            const r = n.getBoundingClientRect(); return r.top < box.top - .01 || r.bottom > box.bottom + .01;
          }), collision: !!(clause && footer && clause.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + .01) };
      });
    }, options);
    expect(result.map(p => p.counts)).toEqual(expected);
    for (const p of result) {
      expect(p.height).toBeCloseTo(300, 1);
      expect(p).toMatchObject({ overflow: false, outside: false, collision: false });
    }
  });
}

for (const [name, options] of [
  ['indivisible too tall on empty continuation', { info: 0, height: 301 }],
  ['indivisible too wide', { width: 'width:500px;' }],
  ['repeated docinfo leaves insufficient capacity', { repeatInfo: 'y' }],
  ['repeated footer leaves insufficient capacity', { footer: 180 }]
]) {
  test(`column failure rolls back DOM and cleans debug listeners: ${name}`, async ({ page }) => {
    await host(page);
    const result = await page.evaluate(options => {
      const form = window.makeContinuationTest(options); form.dataset.debug = 'y';
      let clicked = 0; form.addEventListener('click', () => clicked++);
      const original = form.innerHTML, sourceClause = form.querySelector('p');
      const add = window.addEventListener, remove = window.removeEventListener;
      const watched = new Map(), added = [], removed = [];
      const consoleLog = console.log;
      window.addEventListener = function(type, listener, ...args) {
        if (['error', 'unhandledrejection'].includes(type)) { watched.set(listener, type); added.push(type); }
        return add.call(this, type, listener, ...args);
      };
      window.removeEventListener = function(type, listener, ...args) {
        if (watched.get(listener) === type) { watched.delete(listener); removed.push(type); }
        return remove.call(this, type, listener, ...args);
      };
      const errors = [];
      try {
        for (let i = 0; i < 2; i++) {
          try { window.PrintForm.format(form); } catch (e) { errors.push(e.message); }
          form.click();
        }
        return { errors, connected: form.isConnected, same: form.innerHTML === original,
          sameClause: form.querySelector('p') === sourceClause, clicked,
          partial: document.querySelectorAll('.printform_formatter,.printform_formatter_processed').length,
          forms: document.querySelectorAll('.printform').length, active: watched.size, added, removed,
          consoleRestored: console.log === consoleLog };
      } finally { window.addEventListener = add; window.removeEventListener = remove; }
    }, options);
    expect(result.errors).toHaveLength(2);
    for (const error of result.errors) expect(error).toContain('column clause exceeds continuation budget');
    expect(result).toMatchObject({ connected: true, same: true, sameClause: true, clicked: 2,
      partial: 0, forms: 1, active: 0, consoleRestored: true });
    expect(result.added.sort()).toEqual(['error', 'error', 'unhandledrejection', 'unhandledrejection']);
    expect(result.removed.sort()).toEqual(result.added);
  });
}
