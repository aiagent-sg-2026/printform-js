import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { SPECIAL_PAPER_FIELDS } from '../tests/fixtures/special-paper.js';

export async function openPaperScenario(page, context, fixture, mode, info) {
  // Use the same isolated public-runtime host as the claim consumers, not the
  // unrelated legacy index001 invoice, CSS and automatic formatting workload.
  await page.route('**/erp-paper-fixture.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"><script src="/dist/printform.js"></script></head><body></body></html>'
  }));
  await page.goto('/erp-paper-fixture.html');
  await page.waitForFunction(() => window.__printFormProcessed === true && window.__printFormProcessing === false);
  const exported = await page.evaluate(async ({ fixture, mode }) => {
    const { createEmptyProject } = await import('/studio-v2/core/project-model.js');
    const project = createEmptyProject();
    project.manifest.title = `Fictional ${fixture.profile.name}`;
    project.manifest.locale = 'zh-CN';
    project.spec = null;
    project.sampleData = fixture.sampleData;
    project.templateHtml = fixture.templateHtml;
    project.themeCss = fixture.themeCss;
    const fields = ['id', 'date', 'amount', 'cjk', 'rtl', 'barcode'];
    project.schema.properties.rows = {
      type: 'array', items: { type: 'object', additionalProperties: false,
        properties: Object.fromEntries(fields.map(field => [field, { type: 'string' }])), required: fields }
    };
    project.schema.required = ['rows'];
    if (mode === 'standalone') {
      const { createStandaloneHtml } = await import('/studio-v2/core/exporter.js');
      const { runtimeSources } = await import('/studio-v3/runtime-assets.js');
      const result = await createStandaloneHtml(project, {
        runtimeSources: await runtimeSources(), networkDisabled: true, requireTrusted: true
      });
      return result.html;
    }
    const { bindTemplate } = await import('/studio-v2/core/binding.js');
    const { validateProject } = await import('/studio-v2/core/acceptance.js');
    const validation = validateProject(project);
    if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
    document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(node => node.remove());
    document.body.replaceChildren();
    const theme = document.createElement('style');
    theme.textContent = fixture.themeCss;
    document.head.append(theme);
    const mount = document.createElement('main');
    mount.id = 'pf-mount';
    const template = document.createElement('template');
    template.innerHTML = fixture.templateHtml;
    const bound = bindTemplate(template, project.sampleData, project.manifest);
    if (bound.report.errors.length) throw new Error(JSON.stringify(bound.report.errors));
    mount.append(bound.fragment);
    document.body.append(mount);
    // Start font use/layout before awaiting ready; WebKit may otherwise return
    // the already-resolved promise from the previous document content.
    mount.getBoundingClientRect();
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    window.PrintForm.format(mount.querySelector('.printform'), fixture.config);
    return null;
  }, { fixture, mode });
  if (mode === 'direct') return page;
  const path = info.outputPath(`${fixture.profile.id}-offline.html`);
  await writeFile(path, exported, 'utf8');
  const offline = await context.newPage();
  await offline.addInitScript(() => {
    window.addEventListener('printform:rendered', event => {
      window.__specialPaperRuntimeReport = event.detail;
    });
  });
  await offline.route(/^https?:/, route => route.abort());
  await offline.goto(pathToFileURL(path).href);
  await offline.waitForFunction(() => ['ready', 'blocked'].includes(document.documentElement.dataset.printformStatus));
  await info.attach(`${fixture.profile.id}-standalone-runtime.json`, {
    body: Buffer.from(JSON.stringify(await offline.evaluate(() => ({
      url: location.href,
      report: window.__specialPaperRuntimeReport,
      templateHtml: document.getElementById('pf-template')?.innerHTML,
      sampleData: JSON.parse(document.getElementById('pf-sample-data').textContent)
    })), null, 2)),
    contentType: 'application/json'
  });
  return offline;
}

export async function inspectPaperScenario(page) {
  return page.evaluate(fields => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const inside = (inner, outer) => inner.left >= outer.left - 1 && inner.top >= outer.top - 1 &&
      inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
    const output = document.querySelector('#pf-mount .printform_formatter_processed');
    if (!output) throw new Error('No real PrintForm output');
    const rows = [...output.querySelectorAll('.prowitem_processed')];
    const values = {};
    for (const row of rows) {
      const index = row.dataset.pfRowIndex;
      values[index] ||= Object.fromEntries(fields.map(field => [field, '']));
      for (const field of fields) values[index][field] += row.querySelector(`[data-paper-field="${field}"]`)?.textContent || '';
    }
    const pages = [...output.querySelectorAll('.printform_page')].map(logical => {
      const bounds = rect(logical), sheet = logical.closest('.physical_page_wrapper');
      const overflow = [];
      for (const node of logical.querySelectorAll('*')) {
        if (!inside(rect(node), bounds)) overflow.push(`element:${node.tagName}`);
        for (const child of node.childNodes) {
          if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const fragment of range.getClientRects()) if (!inside(fragment, bounds)) overflow.push('text-range');
        }
      }
      const checked = [sheet, logical, ...logical.querySelectorAll('*')];
      return {
        rect: bounds, sheet: rect(sheet), contained: inside(bounds, rect(sheet)),
        scrollWidth: logical.scrollWidth, scrollHeight: logical.scrollHeight, overflow,
        clipping: checked.some(node => {
          const style = getComputedStyle(node);
          return [style.overflowX, style.overflowY].some(value => ['hidden', 'clip'].includes(value));
        }),
        scaled: checked.some(node => {
          const style = getComputedStyle(node);
          return style.transform !== 'none' || Number(style.zoom || 1) !== 1;
        }),
        fields: Object.fromEntries(fields.map(field => [field,
          [...logical.querySelectorAll(`[data-paper-field="${field}"]`)].map(node => node.textContent).join('')])),
        fonts: [...logical.querySelectorAll('[data-paper-field]')].map(node => getComputedStyle(node).fontSize),
        rtl: [...logical.querySelectorAll('[data-paper-field="rtl"]')].map(node => getComputedStyle(node).direction),
        assets: [...logical.querySelectorAll('[data-paper-asset]')].map(image => ({
          src: image.getAttribute('src'), complete: image.complete, width: image.naturalWidth, height: image.naturalHeight,
          rect: rect(image)
        }))
      };
    });
    return { status: document.documentElement.dataset.printformStatus || null, values, pages,
      fragments: rows.length, rowOrder: rows.map(row => Number(row.dataset.pfRowIndex)) };
  }, SPECIAL_PAPER_FIELDS);
}
