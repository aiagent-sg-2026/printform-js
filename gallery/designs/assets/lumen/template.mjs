import {node, esc} from './dom.mjs';
import {overview} from './overview.mjs';
import {domains} from './domains.mjs';
import {closing} from './closing.mjs';
export function render(data, summary, state, artwork) {
  const form = node('article', 'printform lumen');
  Object.assign(form.dataset, {papersizeWidth:String(186 * 96 / 25.4), papersizeHeight:String(273 * 96 / 25.4),
    repeatHeader:'y', repeatDocinfo:'n', repeatRowheader:'y', repeatPtacRowheader:'n', repeatFooterPagenum:'y',
    insertDummyRowItemWhileFormatTable:'n', insertDummyRowWhileFormatTable:'n', insertFooterSpacerWhileFormatTable:'n', fillPageHeightAfterFooter:'y'});
  form.append(node('header', 'pheader running-header', '<b>LUMEN / LEARNING PORTFOLIO</b><span>FICTIONAL FIELDNOTES · PF-067</span>'));
  overview(form, data, summary, state, artwork);
  domains(form, data, state);
  closing(form, data, summary, state);
  form.append(node('footer', 'pfooter_pagenum running-footer', `<div>FICTIONAL LEARNING PORTFOLIO — DEMO ONLY</div><span>${esc(data.document.id)}</span><span>Page <b data-page-number></b> of <b data-page-total></b></span>`));
  return form;
}
