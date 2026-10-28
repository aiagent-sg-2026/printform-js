import {calculate, money} from './model.mjs';
import {renderBarcode} from '../../../../studio-v2/core/barcode.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const node = (tag, cls, html = '') => {
  const n = document.createElement(tag); n.className = cls; n.innerHTML = html; return n;
};
const atomic = n => { n.dataset.pfKeepTogether = 'true'; return n; };
function barcode(value, height) {
  const svg = renderBarcode(document, value, {moduleWidth:1, height, displayValue:false});
  // Remove only the encoder's vertical white padding, never horizontal quiet zones.
  // Viewport matches bar height exactly: no module rescaling and no new encoder.
  svg.setAttribute('viewBox', `0 10 ${svg.getAttribute('width')} ${height}`);
  svg.setAttribute('height', String(height));
  const background = svg.querySelector('rect');
  background.setAttribute('y', '10');
  background.setAttribute('height', String(height));
  svg.style.height = `${height}px`;
  return svg;
}
const field = (label, value) => `<div><b>${label}</b><span>${esc(value)}</span></div>`;
const terms = [
  ['General', 'This fictional purchase order demonstrates document layout only. It is not an offer, acceptance, invoice or request for payment. No goods or services are ordered by this sample.'],
  ['Delivery', 'For a real order, the parties would agree a delivery schedule and location in writing. In this demonstration, the date and warehouse are illustrative. Notify the sample buyer of any proposed change before dispatch.'],
  ['Goods and inspection', 'Supply descriptions and quantities would be checked against an agreed specification. A real buyer would have a reasonable opportunity to inspect packaging, quantity and condition and report discrepancies.'],
  ['Prices and sample tax', 'All figures are shown in Singapore dollars. Line discounts are applied before the illustrative GST calculation. Each net line is rounded to cents; GST is rounded on the net subtotal. This sample does not assert any tax registration or tax treatment.'],
  ['Documents and payment', 'A real delivery note would quote the agreed purchase-order number. Payment timing would follow the signed commercial agreement after receipt of a valid invoice. No bank account, payment link or payment instruction is supplied here.'],
  ['Changes and returns', 'Any real substitution, quantity change or return would require written agreement. The parties would agree a proportionate remedy for damaged or nonconforming goods. Do not ship against this demonstration.'],
  ['Information and intellectual property', 'Only fictional identifiers are used. Each party would retain its pre-existing intellectual property and handle legitimate business information with appropriate care. The original Meridian mark is demonstration artwork.'],
  ['Resolution and status', 'Real disputes would be discussed promptly and governed by a separately agreed contract. These original sample clauses are not legal advice and do not establish contractual rights.']
];
export function render(data, logo) {
  const total = calculate(data);
  const form = node('article', 'printform meridian');
  // 10 mm CSS page margins; PrintForm owns the remaining 190 x 277 mm content.
  Object.assign(form.dataset, {papersizeWidth: String(190 * 96 / 25.4), papersizeHeight: String(277 * 96 / 25.4),
    repeatHeader: 'y', repeatDocinfo: 'n', repeatRowheader: 'y', repeatFooterPagenum: 'y',
    insertDummyRowItemWhileFormatTable: 'n', insertDummyRowWhileFormatTable: 'n',
    insertFooterSpacerWhileFormatTable: 'n', fillPageHeightAfterFooter: 'y'});
  const header = node('header', 'pheader po-header', `<div class="company"><div class="brand"><img alt="Original Meridian monogram" src="${logo}"><div><h1>MERIDIAN</h1><b>OFFICE SUPPLIES PTE. LTD.</b></div></div><p>18 Pioneer Crescent, Singapore 628557</p><span class="sample-label">FICTIONAL SAMPLE · NOT VALID FOR ORDER</span></div>
    <div class="identity"><h2>PURCHASE ORDER</h2><div class="po-id">${esc(data.poNumber)}</div><div class="po-barcode"></div><div class="identity-bottom"><span>${esc(data.date)}</span><span>Page <b data-page-number></b> of <b data-page-total></b></span></div></div>`);
  header.querySelector('.po-barcode').append(barcode(data.poNumber, 22));
  form.append(header);
  form.append(node('section', 'pdocinfo po-details', `<div class="parties"><div><h3>Supplier</h3><div class="party-body"><b>${esc(data.supplier.name)}</b><p>${esc(data.supplier.address)}</p><p>${esc(data.supplier.email)}</p></div></div><div><h3>Deliver To</h3><div class="party-body"><b>${esc(data.deliverTo.name)}</b><p>${esc(data.deliverTo.address)}</p></div></div></div><div class="metadata">${field('Supplier Code',data.supplierCode)}${field('Delivery Date',data.deliveryDate)}${field('Payment Terms',data.paymentTerms)}${field('Currency','SGD')}${field('Our Ref.',data.reference)}</div>`));
  const labels = ['S/N', 'Item Code / Barcode', 'Description', 'Qty', 'UOM', 'Unit Price (SGD)', 'Disc (%)', 'Amount (SGD)'];
  form.append(node('section', 'prowheader line-grid headings', labels.map(s => `<div>${s}</div>`).join('')));
  data.items.forEach((item, i) => {
    const row = atomic(node('section', 'prowitem line-grid item-row', `<div>${i + 1}</div><div class="item-code"><b>${esc(item.code)}</b></div><div class="description">${esc(item.description)}</div><div class="numeric">${item.quantity}</div><div>${esc(item.uom)}</div><div class="numeric">${money(Math.round(item.unitPrice * 100))}</div><div class="numeric">${item.discount}</div><div class="numeric">${money(total.amounts[i])}</div>`));
    row.dataset.itemId = item.code;
    row.querySelector('.item-code').append(barcode(item.barcode, 18), node('span', 'barcode-value', esc(item.barcode)));
    form.append(row);
  });
  if (!data.items.length) form.append(atomic(node('section', 'prowitem empty-items', 'No items. This is an empty fictional purchase order.')));
  const summary = atomic(node('section', 'prowitem without_prowheader order-summary', `<div class="remarks"><b>Remarks</b><p>${esc(data.remarks)}</p></div><div class="totals">${field('Subtotal (SGD)',money(total.beforeDiscount))}${field('Line discount',money(total.discount))}${field('Net subtotal (SGD)',money(total.subtotal))}${field(`GST ${data.taxRate}%`,money(total.tax))}<div class="grand-total"><b>Grand Total (SGD)</b><strong>${money(total.grand)}</strong></div></div>`));
  form.append(summary);
  form.append(atomic(node('section', 'prowitem without_prowheader closing', `<div class="signatures">${['Prepared By', 'Authorised By', 'Approved By'].map(s => `<div><b>${s}</b><div class="signature-space"></div><span>Signature / Date</span></div>`).join('')}</div>`)));
  form.append(atomic(node('section', 'prowitem tb_page_break_before without_prowheader terms', `<h2>TERMS AND CONDITIONS OF PURCHASE</h2><p class="terms-notice">Original fictional clauses · demonstration only · not a binding contract</p>${terms.map(([title, body],i) => `<section><h3>${i + 1}. ${title}</h3><p>${esc(body)}</p></section>`).join('')}`)));
  form.append(node('footer', 'pfooter_pagenum safety-footer', '<span>MERIDIAN · FICTIONAL SAMPLE · NO PAYMENT OR ORDER · PF-064</span><span>Page <b data-page-number></b> of <b data-page-total></b></span>'));
  return {form, total};
}
