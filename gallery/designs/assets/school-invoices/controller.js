(() => {
  'use strict';
  const data = window.SCHOOL_INVOICE_DATA;
  const style = data.styles.find(item => item.id === document.body.dataset.style);
  const params = new URLSearchParams(location.search);
  const paper = document.querySelector('#paper'), sample = document.querySelector('#sample');
  paper.value = params.get('paper') === 'A5' ? 'A5' : 'A4';
  sample.value = params.get('sample') === 'long' ? 'long' : 'short';
  const root = document.querySelector('#invoice-root'), status = document.querySelector('#status');
  let busy = false, pending = false;
  async function ensureEngine() {
    if (window.PrintForm) return;
    const source = document.querySelector('#school-engine'), script = document.createElement('script');
    if (source.dataset.src) {
      await new Promise((resolve, reject) => {
        script.onload = resolve; script.onerror = () => reject(new Error('Unable to load PrintForm'));
        script.src = source.dataset.src; document.body.append(script);
      });
    } else {
      script.textContent = source.textContent; document.body.append(script);
    }
  }
  function fit() {
    if (!window.SCHOOL_READY) return;
    const width = (paper.value === 'A5' ? 148 : 210) / 25.4 * 96;
    const scale = Math.min(1, (document.documentElement.clientWidth - 24) / width);
    root.querySelectorAll('.physical_page_wrapper').forEach(node => { node.style.zoom = String(scale); });
  }
  async function update() {
    if (busy) { pending = true; return; }
    busy = true; window.SCHOOL_READY = false; window.SCHOOL_ERROR = null;
    document.querySelector('#print').disabled = true;
    status.textContent = 'Measuring invoice with PrintForm…';
    try {
      await Promise.all([document.fonts.load('12px SchoolSans'), document.fonts.load('700 12px SchoolSans'),
        style.id === 'bilingual' ? Promise.all([document.fonts.load('12px DemoSchoolCJK', '示例学校发票'),
          document.fonts.load('700 12px DemoSchoolCJK', '示例学校发票')]) : Promise.resolve()]);
      await document.fonts.ready;
      document.body.dataset.paper = paper.value;
      const mm = paper.value === 'A5' ? [148, 210] : [210, 297];
      document.querySelector('#paper-rule').textContent = `@page { size: ${mm[0]}mm ${mm[1]}mm; margin: 0; }`;
      document.body.style.setProperty('--paper-width', `${mm[0] / 25.4 * 96}px`);
      const rendered = window.SchoolInvoiceTemplate.render(window.SCHOOL_CUSTOM_DATA || data, style, sample.value, paper.value);
      root.replaceChildren(rendered.form);
      await Promise.all([...root.querySelectorAll('img')].map(img => img.decode()));
      await document.fonts.ready;
      // Load the unmodified engine only after source, fonts and QR are ready.
      // This also prevents the gallery from observing an empty auto-format as ready.
      await ensureEngine();
      window.SCHOOL_FORMAT_REPORT = await window.PrintForm.formatAll({ force: true });
      window.SCHOOL_RESULT = { lineIds: rendered.items.map(item => item.id), total: rendered.total,
        paper: paper.value, sample: sample.value, style: style.id };
      const count = root.querySelectorAll('.printform_page').length;
      status.textContent = `${style.title} · ${paper.value} · ${count} page${count === 1 ? '' : 's'} · fictional sample`;
      window.SCHOOL_READY = true;
      fit();
      document.querySelector('#print').disabled = false;
    } catch (error) {
      window.SCHOOL_ERROR = [error.message, ...(error.errors || []).map(e => e.message)].join(': ');
      status.textContent = `Unable to format: ${window.SCHOOL_ERROR}`;
      console.error(error);
    } finally {
      busy = false;
      if (pending) { pending = false; await update(); }
    }
  }
  function change() {
    const url = new URL(location.href);
    url.searchParams.set('paper', paper.value); url.searchParams.set('sample', sample.value);
    history.replaceState(null, '', url);
    update();
  }
  paper.addEventListener('change', change); sample.addEventListener('change', change);
  document.querySelector('#print').addEventListener('click', () => window.print());
  window.addEventListener('resize', fit);
  window.addEventListener('load', update);
  window.SCHOOL_RERENDER = update;
})();
