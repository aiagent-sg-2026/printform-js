import { test, expect } from '@playwright/test';

async function host(page) {
  await page.goto('/gallery/index.html');
  await page.addScriptTag({ url: '/dist/printform.js' });
  await page.evaluate(() => {
    document.body.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `body { margin:0; } .flow-test {font:12px/16px Arial;width:420px}
      .flow-test .pheader,.flow-test .pheader_processed {height:24px}
      .flow-test .pfooter,.flow-test .pfooter_processed {height:24px}
      .flow-test .clause {margin:0;padding:0 0 8px} .flow-test .columns {column-gap:20px}
      .flow-test table {width:100%;table-layout:fixed;border-collapse:collapse} .flow-test td {vertical-align:top}
      .flow-test .prowheader,.flow-test .prowheader_processed {height:24px}`;
    document.head.append(style);
    window.makeFlowTest = html => {
      const form = document.createElement('div'); form.className = 'printform flow-test';
      Object.assign(form.dataset, { papersizeWidth:'420',papersizeHeight:'300',repeatHeader:'y',repeatFooter:'y',
        repeatPtacRowheader:'n',insertDummyRowItemWhileFormatTable:'n',insertDummyRowWhileFormatTable:'n' });
      form.innerHTML = '<div class="pheader">SAMPLE HEADER</div>' + html + '<div class="pfooter">SAMPLE FOOTER</div>';
      document.body.append(form); return form;
    };
  });
}

test('opt-in columns start midpage, continue left-to-right and hand space back to a distinct table', async ({ page }) => {
  await host(page);
  const report = await page.evaluate(() => {
    const prose = Array.from({ length:14 }, (_,i) => `<p class="clause" data-id="c${i}">Clause ${i}. ${'Fictional demonstration terms. '.repeat(i%3+1)}</p>`).join('');
    const form = window.makeFlowTest(`<div class="ptac" data-id="before" style="height:100px">Before terms</div>
      <section class="ptac columns" data-pf-columns="2" data-pf-table-id="terms">${prose}</section>
      <div class="prowheader" data-pf-table-id="later" data-pf-keep-with-next="true">LATER TABLE HEADER</div>
      <div class="prowitem" data-pf-table-id="later" data-id="after">Later table row</div>`);
    const source = [...form.querySelectorAll('[data-id]')].map(n => ({id:n.dataset.id,text:n.textContent}));
    const output = window.PrintForm.format(form);
    return { source, output:[...output.querySelectorAll('[data-id]')].map(n => ({id:n.dataset.id,text:n.textContent})),
      pages:[...output.querySelectorAll('.printform_page')].map(p => ({
        ids:[...p.querySelectorAll('[data-id]')].map(n => n.dataset.id),
        lanes:[...p.querySelectorAll('.pf-flow-column')].map(n => [...n.children].map(c => c.dataset.id)),
        headers:p.querySelectorAll('.prowheader_processed').length,
        height:p.getBoundingClientRect().height, scroll:p.scrollWidth,width:p.clientWidth
      })) };
  });
  expect(report.output).toEqual(report.source);
  expect(report.pages.length).toBeGreaterThan(1);
  expect(report.pages[0].ids).toContain('before'); expect(report.pages[0].ids).toContain('c0');
  expect(report.pages[0].headers).toBe(0);
  expect(report.pages.some(p => p.ids.includes('c13') && p.ids.includes('after'))).toBe(true);
  for (const p of report.pages) { expect(p.height).toBeCloseTo(300, 0); expect(p.scroll).toBeLessThanOrEqual(p.width); }
});

test('overheight column clauses fail safely and retain the actual source and listeners', async ({ page }) => {
  await host(page);
  const result = await page.evaluate(() => {
    const form = window.makeFlowTest('<div class="ptac" style="height:100px">Prior content</div><section class="ptac columns" data-pf-columns="2"><p id="oversized" style="height:500px">Indivisible clause</p></section>');
    let clicked = 0; form.addEventListener('click', () => clicked++);
    const original = form.innerHTML;
    let error; try { window.PrintForm.format(form); } catch (e) { error = e.message; }
    form.click();
    return { error, connected:form.isConnected, same:form.innerHTML===original, clicked, partial:document.querySelectorAll('.printform_formatter,.printform_formatter_processed').length };
  });
  expect(result.error).toContain('column clause exceeds continuation budget');
  expect(result).toMatchObject({connected:true,same:true,clicked:1,partial:0});
});

test('existing oversized variable table rows conserve descriptions and emit each price once', async ({ page }) => {
  await host(page);
  const result = await page.evaluate(() => {
    const description = Array.from({length:110},(_,i)=>`Coverage-${i}: fictional expense and conditions. `).join('');
    const form = window.makeFlowTest(`<div class="prowheader" data-pf-table-id="big" data-pf-keep-with-next="true">BIG TABLE HEADER</div>
      <table class="prowitem" data-pf-table-id="big" data-id="oversized-row"><colgroup><col style="width:75%"><col style="width:25%"></colgroup><tbody><tr><td data-description>${description}</td><td data-price data-pf-cell-policy="first" data-pf-monetary="currency">SGD 128.75</td></tr></tbody></table>
      <div class="ptac" data-pf-table-id="terms" data-id="after">Terms after oversized row.</div>`);
    const output = window.PrintForm.format(form);
    return { description, actual:[...output.querySelectorAll('[data-description]')].map(n=>n.textContent).join(''),
      prices:[...output.querySelectorAll('[data-price]')].map(n=>n.textContent).filter(Boolean),
      fragments:[...output.querySelectorAll('[data-pf-source-row]')].map(n=>({index:n.dataset.pfFragmentIndex,count:n.dataset.pfFragmentCount})),
      pages:[...output.querySelectorAll('.printform_page')].map(p=>({height:p.getBoundingClientRect().height,headers:p.querySelectorAll('.prowheader_processed').length,rows:p.querySelectorAll('.prowitem_processed').length,after:p.querySelectorAll('[data-id="after"]').length})) };
  });
  expect(result.actual).toBe(result.description); expect(result.prices).toEqual(['SGD 128.75']);
  expect(result.fragments.length).toBeGreaterThan(1);
  expect(result.fragments.map(f=>Number(f.index))).toEqual(result.fragments.map((_,i)=>i));
  expect(result.fragments.every(f=>Number(f.count)===result.fragments.length)).toBe(true);
  for (const p of result.pages) { expect(p.height).toBeCloseTo(300, 0); expect(p.headers).toBe(p.rows ? 1 : 0); }
  expect(result.pages.reduce((n,p)=>n+p.after,0)).toBe(1);
});
