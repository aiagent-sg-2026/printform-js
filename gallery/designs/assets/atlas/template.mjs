import {node, esc} from './dom.mjs';
import {overview} from './overview.mjs';
import {inventory} from './inventory.mjs';
import {ledger, allocation} from './charges.mjs';
import {bridge, sources} from './closing.mjs';
export function render(report, state, artwork) {
  const form = node('article', 'printform atlas');
  Object.assign(form.dataset, {papersizeWidth:String(273 * 96 / 25.4), papersizeHeight:String(190 * 96 / 25.4),
    repeatHeader:'y', repeatDocinfo:'n', repeatRowheader:'y', repeatFooterPagenum:'y',
    insertDummyRowItemWhileFormatTable:'n', insertDummyRowWhileFormatTable:'n', insertFooterSpacerWhileFormatTable:'n', fillPageHeightAfterFooter:'y'});
  const d = report.data.document, s = report.data.shipment;
  form.append(node('header', 'pheader running-header', `<b>ATLAS / LOGISTICS COSTING</b><span>${esc(d.id)} · ${esc(s.id)} · ${esc(d.asOfDate)}</span>`));
  overview(form, report, state, artwork);
  inventory(form, report);
  ledger(form, report);
  allocation(form, report, state);
  bridge(form, report);
  sources(form, report, state);
  form.append(node('footer', 'pfooter_pagenum running-footer', `<span>Demo only · fictional costing · ${esc(d.currency)} · ${esc(report.mode)} / ${esc(report.basis)}</span><span>PF-066 · ${esc(d.id)}</span><span>Page <b data-page-number></b> / <b data-page-total></b></span>`));
  return form;
}
