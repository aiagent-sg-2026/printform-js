import {node, esc} from './dom.mjs';
import {summary} from './summary.mjs';
import {schedule} from './schedule.mjs';
import {reviews, sources} from './closing.mjs';
export function render(report, state, logo) {
  const form = node('article', 'printform aster');
  Object.assign(form.dataset, {
    papersizeWidth:String(273 * 96 / 25.4), papersizeHeight:String(190 * 96 / 25.4),
    repeatHeader:'y', repeatDocinfo:'n', repeatRowheader:'y', repeatFooterPagenum:'y',
    insertDummyRowItemWhileFormatTable:'n', insertDummyRowWhileFormatTable:'n',
    insertFooterSpacerWhileFormatTable:'n', fillPageHeightAfterFooter:'y'
  });
  form.append(node('header', 'pheader running-header', `<b>ASTER <span>/ THREE-WAY MATCH REVIEW</span></b><span>${esc(report.data.document.id)} · ${esc(report.data.document.asOfDate)}</span>`));
  summary(form, report, logo);
  const display = schedule(form, report, state);
  reviews(form, report, state);
  sources(form, report);
  form.append(node('footer', 'pfooter_pagenum running-footer', '<span>SAMPLE · fictional data · not an approval or payment instruction</span><span>PF-065 · ASTER-REVIEW-DEMO-001</span><span>Page <b data-page-number></b> / <b data-page-total></b></span>'));
  return {form, display};
}
