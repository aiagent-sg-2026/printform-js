import { PRINT_TYPOGRAPHY_CSS } from "../core/typography.js";
import { buildBrandColorBlock } from "../core/branding.js";
import { LOGO_PLACEHOLDER_DATA_URL } from "../core/logo-placeholder.js";

export const PROGRESS_CLAIM_THEME = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #eef1f5; }
${PRINT_TYPOGRAPHY_CSS}
${buildBrandColorBlock("#102f63")}
#pf-mount { color: #15233c; font-family: Arial, sans-serif; line-height: 1.2; }
#pf-mount .printform,
#pf-mount .printform_formatter_processed,
#pf-mount .printform_page { width: 750px; background: #fff; }
#pf-mount .pf-pad { padding-left: 24px; padding-right: 24px; }
#pf-mount .pf-header { padding-top: 18px; padding-bottom: 8px; }
#pf-mount .pf-header-grid { display: grid; grid-template-columns: 190px 1fr 104px; gap: 10px; align-items: start; }
#pf-mount .pf-lockup { display: grid; grid-template-columns: 58px 1fr; gap: 8px; align-items: center; }
#pf-mount .pf-logo { display: block; width: 58px; height: 42px; object-fit: contain; opacity: .08; }
#pf-mount .pf-mountain { position: absolute; width: 58px; height: 42px; margin-top: -42px; pointer-events: none; }
#pf-mount .pf-mountain::before { content: ""; position: absolute; inset: 2px 2px 5px; background: #102f63; clip-path: polygon(0 100%, 31% 26%, 48% 57%, 63% 0, 100% 100%, 81% 100%, 62% 31%, 49% 75%, 35% 48%, 19% 100%); }
#pf-mount .pf-company { margin: 0; color: var(--pf-brand-color); font-size: 15pt; font-weight: 800; line-height: 1; }
#pf-mount .pf-company-sub { margin-top: 4px; color: var(--pf-brand-color); font-size: 8pt; font-weight: 700; line-height: 1; }
#pf-mount .pf-heading { color: var(--pf-brand-color); text-align: center; }
#pf-mount .pf-heading h1 { margin: 2px 0 3px; font-size: 25pt; letter-spacing: .03em; line-height: 1; }
#pf-mount .pf-heading p { margin: 0; color: #1a58a6; font-size: 10pt; font-weight: 700; }
#pf-mount .pf-heading strong { display: block; margin-top: 7px; font-size: 12pt; }
#pf-mount .pf-demo { padding: 8px 5px; border: 2px solid var(--pf-brand-color); border-radius: 10px; outline: 1px solid #9fb6d8; outline-offset: -5px; color: var(--pf-brand-color); font-size: 12pt; font-weight: 800; line-height: 1.2; text-align: center; }
#pf-mount .pf-rule { border-bottom: 2px solid var(--pf-brand-color); }
#pf-mount .pdocinfo { padding-top: 9px; }
#pf-mount .pf-meta-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--pf-brand-color); }
#pf-mount .pf-meta-col { padding: 7px 10px; }
#pf-mount .pf-meta-col + .pf-meta-col { border-left: 1px solid var(--pf-brand-color); }
#pf-mount .pf-meta-row { display: grid; grid-template-columns: 126px 1fr; gap: 8px; margin: 0; font-size: 8.5pt; line-height: 1.65; }
#pf-mount .pf-meta-row strong { color: #111d31; }
#pf-mount .pf-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-top: 10px; }
#pf-mount .pf-box { border: 1px solid #7890b0; }
#pf-mount .pf-box-title, #pf-mount .pf-section-title { padding: 4px 7px; background: var(--pf-brand-color); color: #fff; font-size: 9pt; font-weight: 800; text-align: center; }
#pf-mount .pf-kv-row { display: grid; grid-template-columns: 1fr auto; gap: 6px; padding: 3px 9px; border-bottom: 1px solid #c0c9d5; font-size: 8pt; }
#pf-mount .pf-kv-row:last-child { border-bottom: 0; }
#pf-mount .pf-kv-row strong { text-align: right; font-variant-numeric: tabular-nums; }
#pf-mount .pf-kv-row.is-total { background: #e5edf8; color: #0e2e62; font-size: 9pt; font-weight: 800; }
#pf-mount .pf-section-gap { height: 9px; }
#pf-mount table { width: 100%; border-collapse: collapse; table-layout: fixed; }
#pf-mount .pf-table { border: 1px solid #7890b0; }
#pf-mount .pf-table th, #pf-mount .pf-table td { border: 1px solid #b5c0cf; padding: 4px 6px; font-size: 7.7pt; }
#pf-mount .pf-table th { background: #e6edf7; color: #132d59; font-weight: 800; text-align: center; }
#pf-mount .pf-table td { line-height: 1.2; }
#pf-mount .pf-table .pf-num { text-align: right; font-variant-numeric: tabular-nums; }
#pf-mount .pf-table .pf-center { text-align: center; }
#pf-mount .pf-valuation-title th { padding: 4px; background: var(--pf-brand-color); color: #fff; font-size: 9pt; }
#pf-mount .pf-valuation-row td { height: 25px; }
#pf-mount .pf-total-row td { background: #e5edf8; color: #102f63; font-weight: 800; }
#pf-mount .pf-settlement { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-top: 9px; }
#pf-mount .pf-settlement .pf-box { padding-bottom: 4px; }
#pf-mount .pf-settlement .pf-kv-row { border-bottom: 0; padding-top: 3px; padding-bottom: 3px; }
#pf-mount .pf-settlement .pf-kv-row:nth-last-child(3) { border-top: 1px solid #15233c; margin-top: 2px; padding-top: 5px; font-weight: 800; }
#pf-mount .pf-total-claim { margin: 5px 10px 4px; padding-top: 5px; border-top: 2px solid #15233c; color: #102f63; text-align: center; }
#pf-mount .pf-total-claim span { display: block; font-size: 11pt; font-weight: 800; }
#pf-mount .pf-total-claim strong { display: block; font-size: 22pt; line-height: 1.2; }
#pf-mount .pf-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 9px; }
#pf-mount .pf-signature { border: 1px solid #7890b0; }
#pf-mount .pf-signature h3 { margin: 0; padding: 4px; background: var(--pf-brand-color); color: #fff; font-size: 8pt; text-align: center; }
#pf-mount .pf-signature-body { padding: 7px 9px 6px; font-size: 7.5pt; }
#pf-mount .pf-signature-line { display: grid; grid-template-columns: 42px 1fr; gap: 5px; margin: 6px 0; }
#pf-mount .pf-signature-line span:last-child { border-bottom: 1px solid #5c6674; }
#pf-mount .pfooter { padding-top: 8px; }
#pf-mount .pf-footer { padding: 5px 24px 8px; color: #102f63; font-size: 7.5pt; font-weight: 700; text-align: center; }
#pf-mount .pf-disclaimer { display: block; margin-top: 4px; color: #15233c; font-weight: 400; }
#pf-mount .pfooter_pagenum { padding-top: 3px; }
@media print { body { background: #fff; } }
`;

export const PROGRESS_CLAIM_TEMPLATE = `
<section class="printform" data-papersize-width="750" data-papersize-height="1050"
  data-height-of-dummy-row-item="22" data-repeat-header="y" data-repeat-docinfo="n"
  data-repeat-rowheader="y" data-repeat-footer="n" data-repeat-footer-pagenum="y"
  data-insert-footer-spacer-while-format-table="y">
  <header class="pheader pf-pad pf-header pf-rule">
    <div class="pf-header-grid">
      <div class="pf-lockup"><img class="pf-logo" data-pf-asset-slot="letterhead-logo" src="${LOGO_PLACEHOLDER_DATA_URL}" alt="Northpeak Buildworks logo"><span class="pf-mountain" aria-hidden="true"></span><div><p class="pf-company" data-pf-text="/company/name"></p><p class="pf-company-sub" data-pf-text="/company/subtitle"></p></div></div>
      <div class="pf-heading"><h1>PROGRESS CLAIM</h1><p>DEMO / SAMPLE DOCUMENT</p><strong><span data-pf-text="/documentNo"></span> · CLAIM #<span data-pf-text="/claimNo"></span></strong></div>
      <div class="pf-demo">DEMO /<br>SAMPLE</div>
    </div>
  </header>
  <section class="pdocinfo pf-pad">
    <div class="pf-meta-grid">
      <div class="pf-meta-col">
        <p class="pf-meta-row"><strong>Document No.:</strong><span data-pf-text="/documentNo"></span></p>
        <p class="pf-meta-row"><strong>Claim No.:</strong><span data-pf-text="/claimNo"></span></p>
        <p class="pf-meta-row"><strong>Claim Date:</strong><span data-pf-text="/claimDate"></span></p>
        <p class="pf-meta-row"><strong>Project Code:</strong><span data-pf-text="/projectCode"></span></p>
      </div>
      <div class="pf-meta-col">
        <p class="pf-meta-row"><strong>Project:</strong><span data-pf-text="/project"></span></p>
        <p class="pf-meta-row"><strong>Customer:</strong><span data-pf-text="/customer"></span></p>
        <p class="pf-meta-row"><strong>Contract Ref:</strong><span data-pf-text="/contractRef"></span></p>
        <p class="pf-meta-row"><strong>Currency:</strong><span data-pf-text="/currency"></span></p>
      </div>
    </div>
  <section class="pf-pad pf-summary-grid">
    <div class="pf-box"><div class="pf-box-title">CONTRACT SUMMARY</div>
      <p class="pf-kv-row"><span>Original Contract Sum:</span><strong data-pf-text="/contractSummary/original" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Approved Variation Orders:</span><strong data-pf-text="/contractSummary/approvedVariations" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Revised Contract Sum:</span><strong data-pf-text="/contractSummary/revised" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Previous Certified Amount:</span><strong data-pf-text="/contractSummary/previousCertified" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Current Claim:</span><strong data-pf-text="/contractSummary/currentClaim" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Cumulative Claim to Date:</span><strong data-pf-text="/contractSummary/cumulative" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Balance to Complete:</span><strong data-pf-text="/contractSummary/balance" data-pf-monetary="currency"></strong></p>
    </div>
    <div class="pf-box"><div class="pf-box-title">CLAIM SUMMARY</div>
      <p class="pf-kv-row"><span>Physical Progress:</span><strong data-pf-text="/claimSummary/physicalProgress"></strong></p>
      <p class="pf-kv-row"><span>POC %:</span><strong data-pf-text="/claimSummary/poc"></strong></p>
      <p class="pf-kv-row"><span>Cumulative Work Done:</span><strong data-pf-text="/claimSummary/cumulativeWork" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Materials On Site:</span><strong data-pf-text="/claimSummary/materials" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Variation Work:</span><strong data-pf-text="/claimSummary/variationWork" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Retention:</span><strong data-pf-text="/claimSummary/retention" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row"><span>Advance Recovery:</span><strong data-pf-text="/claimSummary/advanceRecovery" data-pf-monetary="currency"></strong></p>
      <p class="pf-kv-row is-total"><span>Net Claim:</span><strong data-pf-text="/claimSummary/netClaim" data-pf-monetary="currency"></strong></p>
    </div>
  </section>
  <div class="pf-section-gap"></div>
  </section>
  <table class="prowheader pf-table pf-valuation-title"><thead><tr><th colspan="7">VALUATION</th></tr><tr><th style="width:6%">No.</th><th style="width:27%">Description</th><th style="width:15%">Contract Amount</th><th style="width:14%">Previous</th><th style="width:14%">This Claim</th><th style="width:14%">Cumulative</th><th style="width:10%">% Complete</th></tr></thead></table>
  <table class="prowitem pf-table pf-valuation-row" data-pf-each="/valuationRows"><tbody><tr><td class="pf-center" data-pf-text="./no"></td><td data-pf-text="./description"></td><td class="pf-num" data-pf-text="./contractAmount" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="./previous" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="./thisClaim" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="./cumulative" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="./percentComplete"></td></tr></tbody></table>
  <table class="pf-table"><tbody><tr class="pf-total-row"><td style="width:33%">TOTAL</td><td class="pf-num" data-pf-text="/valuationTotal/contractAmount" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="/valuationTotal/previous" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="/valuationTotal/thisClaim" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="/valuationTotal/cumulative" data-pf-monetary="currency"></td><td class="pf-num" data-pf-text="/valuationTotal/percentComplete"></td></tr></tbody></table>
  <footer class="pfooter">
  <div class="pf-section-gap"></div>
  <table class="pf-table"><thead><tr><th colspan="5" class="pf-section-title">APPROVED / PENDING VARIATIONS</th></tr><tr><th style="width:11%">VO No.</th><th style="width:35%">Description</th><th style="width:16%">Status</th><th style="width:19%">Approved Amount</th><th style="width:19%">This Claim / Cumulative</th></tr></thead><tbody>
    <tr><td class="pf-center" data-pf-text="/variations/0/number"></td><td data-pf-text="/variations/0/description"></td><td class="pf-center" data-pf-text="/variations/0/status"></td><td class="pf-num" data-pf-text="/variations/0/approvedAmount" data-pf-monetary="currency"></td><td class="pf-num"><span data-pf-text="/variations/0/thisClaim" data-pf-monetary="currency"></span> / <span data-pf-text="/variations/0/cumulative" data-pf-monetary="currency"></span></td></tr>
    <tr><td class="pf-center" data-pf-text="/variations/1/number"></td><td data-pf-text="/variations/1/description"></td><td class="pf-center" data-pf-text="/variations/1/status"></td><td class="pf-num" data-pf-text="/variations/1/approvedAmount" data-pf-monetary="currency"></td><td class="pf-num"><span data-pf-text="/variations/1/thisClaim" data-pf-monetary="currency"></span> / <span data-pf-text="/variations/1/cumulative" data-pf-monetary="currency"></span></td></tr>
    <tr><td class="pf-center" data-pf-text="/variations/2/number"></td><td data-pf-text="/variations/2/description"></td><td class="pf-center" data-pf-text="/variations/2/status"></td><td class="pf-num" data-pf-text="/variations/2/approvedAmount" data-pf-monetary="currency"></td><td class="pf-num"><span data-pf-text="/variations/2/thisClaim" data-pf-monetary="currency"></span> / <span data-pf-text="/variations/2/cumulative" data-pf-monetary="currency"></span></td></tr>
    <tr class="pf-total-row"><td colspan="3">TOTAL APPROVED / PENDING VARIATIONS</td><td class="pf-num" data-pf-text="/variationTotal/approvedAmount" data-pf-monetary="currency"></td><td class="pf-num"><span data-pf-text="/variationTotal/thisClaim" data-pf-monetary="currency"></span> / <span data-pf-text="/variationTotal/cumulative" data-pf-monetary="currency"></span></td></tr>
  </tbody></table>
  <section class="pf-pad pf-settlement">
    <div class="pf-box"><p class="pf-kv-row"><span>Gross Work Done:</span><strong data-pf-text="/settlement/grossWorkDone" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>Add Materials On Site:</span><strong data-pf-text="/settlement/materialsOnSite" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>Add Approved Variations:</span><strong data-pf-text="/settlement/approvedVariations" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>Gross Claim:</span><strong data-pf-text="/settlement/grossClaim" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>Less Retention (10%):</span><strong data-pf-text="/settlement/retention" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>Less Advance Payment Recovery:</span><strong data-pf-text="/settlement/advanceRecovery" data-pf-monetary="currency"></strong></p></div>
    <div class="pf-box"><p class="pf-kv-row"><span>Less Other Deductions:</span><strong data-pf-text="/settlement/otherDeductions" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>Net Before GST:</span><strong data-pf-text="/settlement/netBeforeGst" data-pf-monetary="currency"></strong></p><p class="pf-kv-row"><span>GST 9%:</span><strong data-pf-text="/settlement/gst" data-pf-monetary="currency"></strong></p><div class="pf-total-claim"><span>TOTAL CLAIM:</span><strong data-pf-text="/settlement/totalClaim" data-pf-monetary="currency"></strong></div></div>
  </section>
  <section class="pf-pad pf-signatures"><div class="pf-signature"><h3>PREPARED BY</h3><div class="pf-signature-body"><p class="pf-signature-line"><span>Name:</span><span></span></p><p class="pf-signature-line"><span>Date:</span><span></span></p><p class="pf-signature-line"><span>Signature:</span><span></span></p></div></div><div class="pf-signature"><h3>PROJECT MANAGER</h3><div class="pf-signature-body"><p class="pf-signature-line"><span>Name:</span><span></span></p><p class="pf-signature-line"><span>Date:</span><span></span></p><p class="pf-signature-line"><span>Signature:</span><span></span></p></div></div><div class="pf-signature"><h3>APPROVED BY</h3><div class="pf-signature-body"><p class="pf-signature-line"><span>Name:</span><span></span></p><p class="pf-signature-line"><span>Date:</span><span></span></p><p class="pf-signature-line"><span>Signature:</span><span></span></p></div></div></section>
  </footer>
  <footer class="pfooter_logo"><img class="pf-logo" data-pf-asset-slot="footer-logo" src="${LOGO_PLACEHOLDER_DATA_URL}" alt="Northpeak Buildworks footer logo"></footer>
  <footer class="pfooter_pagenum pf-footer"><span data-pf-text="/documentNo"></span> | <span data-pf-text="/project"></span> | Printed: <span data-pf-text="/printedAt"></span> | Page <span data-page-number></span> of <span data-page-total></span><span class="pf-disclaimer">DEMO / SAMPLE DOCUMENT — All companies, projects, document numbers, quantities, amounts and transactions shown are fictional.</span></footer>
</section>`;
