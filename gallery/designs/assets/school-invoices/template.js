/* One semantic source stream per invoice; PrintForm owns all page boundaries. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function render(data, style, mode, paper) {
    const m = window.SchoolInvoiceMath, a = window.SchoolInvoiceArt;
    const items = m.lines(data, mode), total = m.calculate(data, items), bi = style.id === 'bilingual';
    const taxBasisPoints = data.invoice.taxBasisPoints || 0;
    const text = (en, zh) => bi ? `${zh} / ${en}` : en;
    const amount = cents => esc(m.money(cents));
    const meta = (label, value) => `<dt>${label}</dt><dd>${esc(value)}</dd>`;
    const node = (tag, cls, html) => { const n = document.createElement(tag); n.className = cls; n.innerHTML = html; return n; };
    const form = node('article', `printform school-invoice theme-${style.id}`, '');
    form.lang = bi ? 'zh-Hans' : 'en';
    const mm = paper === 'A5' ? [148, 210] : [210, 297];
    Object.assign(form.dataset, { paperSize: paper, dpi: '96', papersizeWidth: String(mm[0] / 25.4 * 96),
      papersizeHeight: String(mm[1] / 25.4 * 96), repeatHeader: 'y', repeatDocinfo: 'y', repeatRowheader: 'y',
      repeatFooter: 'n', repeatFooterPagenum: 'y', showLogicalPageNumber: 'y',
      insertDummyRowItemWhileFormatTable: 'n', insertDummyRowWhileFormatTable: 'n',
      insertPtacDummyRowItems: 'n', insertFooterSpacerWhileFormatTable: 'n' });
    const title = style.id === 'statement' ? 'SCHOOL FEES INVOICE' : style.id === 'enrichment' ? 'TUITION INVOICE' : 'INVOICE';
    form.append(node('header', 'pheader invoice-header', `<div class="brand"><div class="brand-mark">${a.mark(style.id)}</div>
      <div><div class="brand-kicker">FICTIONAL SCHOOL · DEMO</div>${bi ? `<div class="brand-zh">${esc(style.nameZh)}</div>` : ''}<h1>${esc(style.name)}</h1><p>${esc(style.tagline)}</p></div></div>
      <div class="invoice-identity"><h2>${bi ? 'INVOICE / 发票' : title}</h2><dl>${meta(text('Invoice', '发票编号'), data.invoice.id)}${meta(text('Issued', '开票日期'), data.invoice.issued)}${meta(text('Due', '到期日期'), data.invoice.due)}${meta(text('Period', '课程期间'), data.invoice.period)}</dl></div>`));
    form.append(node('section', 'pdocinfo party-section', `<div class="bill-to"><h3>${text('BILL TO', '账单收件人')}</h3><strong>${esc(data.customer.name)}</strong><p>${esc(data.customer.address)}<br>${esc(data.customer.email)}</p></div>
      <div class="student-card"><h3>${text('STUDENT DETAILS', '学生资料')}</h3><strong>${bi && data.student.nameZh ? `${esc(data.student.nameZh)} · ` : ''}${esc(data.student.name)}</strong><p>${esc(data.student.id)} · ${esc(data.student.class)}<br>${text('Programme', '课程')}: ${esc(data.student.program)}</p></div>`));
    const statement = style.id === 'statement';
    const qty = style.id === 'enrichment' ? text('Sessions', '课次') : text('Qty', '数量');
    form.append(node('section', 'prowheader table-heading', `<div class="line-grid"><div>${text('Description', '项目说明')}</div>${statement ? '' : `<div class="numeric">${qty}</div><div class="numeric">${text('Unit price', '单价')}</div>`}<div class="numeric">${text('Amount', '金额')}<span class="currency">${esc(data.invoice.currency)}</span></div></div>`));
    items.forEach((item, i) => {
      const row = node('section', 'prowitem invoice-line', `<div class="line-grid"><div class="description"><span class="line-code">${esc(item.id)}</span>${bi ? `<span class="zh-description">${esc(item.descriptionZh)}</span>` : ''}<span>${esc(item.description)}</span>${statement ? `<small>${esc(item.quantity)} × ${amount(item.unitCents)}</small>` : ''}</div>${statement ? '' : `<div class="numeric">${esc(item.quantity)}</div><div class="numeric">${amount(item.unitCents)}</div>`}<div class="numeric line-amount">${amount(total.amounts[i])}</div></div>`);
      row.dataset.lineId = item.id;
      row.dataset.amountCents = total.amounts[i];
      row.dataset.stripe = i % 2;
      if (i === items.length - 2) row.dataset.pfKeepWithNext = 'true';
      form.append(row);
    });
    const qr = window.SCHOOL_ASSETS?.['demo-qr.svg'] || 'assets/school-invoices/demo-qr.svg';
    form.append(node('section', 'pfooter invoice-final', `<div class="settlement"><div class="payment" data-payment>
      ${statement ? '' : `<img class="demo-qr" src="${qr}" alt="QR: reserved example.org demonstration page, not a payment code">`}
      <div><h3>${text('DEMO PAYMENT INFORMATION', '示例付款说明')}</h3><p>${esc(data.payment.notice)}</p><p class="account">${esc(data.payment.account)}</p><p>${esc(data.payment.email)}</p>${bi ? '<p>仅供示例，请勿付款。二维码不是付款码。</p>' : ''}</div></div>
      <div class="totals" data-totals data-due-cents="${total.due}"><div><span>${text('Line subtotal', '项目小计')}</span><strong>${amount(total.lineSubtotal)}</strong></div>${(data.adjustments || []).map(item => `<div><span>${text(esc(item.label), esc(item.labelZh))}</span><strong>${amount(item.cents)}</strong></div>`).join('')}
      <div><span>${text('Subtotal', '小计')}</span><strong>${amount(total.subtotal)}</strong></div><div><span>${text('Illustrative tax', '示例税额')} ${taxBasisPoints / 100}%</span><strong>${amount(total.tax)}</strong></div>
      <div class="amount-due"><span>${text('AMOUNT DUE', '应付金额')}<small>${esc(data.invoice.currency)}</small></span><strong>${amount(total.due)}</strong></div></div></div>
      <p class="tax-note">${esc(data.invoice.taxNote)}</p>${statement ? `<div class="general-notice"><b>GENERAL PAYMENT NOTICE</b><p>This fictional statement is for layout demonstration only. No payment is requested or accepted. Please contact the demo school office for sample enquiries.</p></div>` : ''}
      <div class="closing"><span>${esc(style.tagline)}</span><span>office@example.org · example.org</span></div>`));
    form.append(node('footer', 'pfooter_pagenum page-foot', `<div class="footer-art">${a.scene(style.id)}</div><div class="safety-line"><strong>SAMPLE — NOT VALID FOR PAYMENT${bi ? '<br>示例 — 不可用于付款' : ''}</strong><span class="page-count">${bi ? '页码 / ' : ''}Page <b data-page-number></b> / <b data-page-total></b><small>PF-${String(style.number).padStart(3, '0')} · ${paper}</small></span></div>`));
    return { form, items, total };
  }
  window.SchoolInvoiceTemplate = { render };
})();
