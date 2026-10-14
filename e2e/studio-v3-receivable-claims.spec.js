import { test, expect } from './studio-v3-test.js';
import { demoRecordForKind } from '../studio-v3/demo-catalog.js';
import { pathToFileURL } from 'node:url';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30000 });
const money = value => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);

for (const kind of ['PCAR', 'CCAR']) {
  test(`${kind}: application/certificate provenance and supplied balances survive standalone printing`, async ({ page, context, browserName }, info) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/studio-v3/');
    await ready(page);
    await page.locator('[data-action=new]').click();
    const details = page.locator('#new-dialog details');
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await page.locator(`[data-demo-template=${kind}]`).click();
    await ready(page);
    await page.locator('[data-mode=data]').click();
    const record = demoRecordForKind(kind, 'canopy-period-2');
    await page.locator('#database-choice').selectOption(record.id);
    await ready(page);
    const paper = page.frameLocator('#preview-frame');
    await expect(paper.locator('[data-v3-id=header-title]').first()).toHaveText(record.data.claim.definition.toUpperCase());
    await expect(paper.locator('[data-v3-id=header-claim-source]').first()).toHaveText(record.data.claim.sourceDocumentNumber);
    await expect(paper.locator('[data-v3-id=totals-outstanding]').last()).toHaveText(money(record.data.summary.outstandingAmount));
    const rows = await paper.locator('table.prowitem_processed').evaluateAll(nodes => nodes.map(node => Number(node.dataset.pfRowIndex)));
    expect(rows).toEqual(record.data.items.map((_, index) => index));
    if (kind === 'CCAR') {
      await expect(paper.locator('[data-v3-id=header-certified-by]').first()).toHaveText(record.data.certification.certifiedBy);
      await expect(paper.locator('[data-v3-id=totals-certification-adjustment]').last()).toHaveText(money(record.data.summary.certificationAdjustmentAmount));
    }
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-action=export]').click();
    const download = await downloadPromise;
    const filename = info.outputPath(`${kind}-period-2.html`);
    await download.saveAs(filename);
    const printed = await context.newPage();
    await printed.goto(pathToFileURL(filename).href, { waitUntil: 'domcontentloaded' });
    await expect(printed.locator('html')).toHaveAttribute('data-printform-status', 'ready');
    await expect(printed.locator('table.prowitem_processed')).toHaveCount(record.data.items.length);
    await expect(printed.locator('[data-v3-id=totals-total]').last()).toHaveText(money(record.data.summary.total));
    await expect(printed.locator('[data-v3-id=totals-outstanding]').last()).toHaveText(money(record.data.summary.outstandingAmount));
    const overflows = await printed.locator('.printform_page').evaluateAll(pages => pages.flatMap(page => {
      const bounds = page.getBoundingClientRect();
      return [...page.querySelectorAll('[data-v3-role=value],h1')].filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.right > bounds.right + 1 || rect.left < bounds.left - 1 || rect.bottom > bounds.bottom + 1;
      }).map(node => node.dataset.v3Id);
    }));
    expect(overflows).toEqual([]);
    await printed.screenshot({ path: info.outputPath(`${kind}-period-2.png`), fullPage: true });
    if (browserName === 'chromium') await printed.pdf({ path: info.outputPath(`${kind}-period-2-A4.pdf`), preferCSSPageSize: true, printBackground: true });
    await printed.close();
  });
}
