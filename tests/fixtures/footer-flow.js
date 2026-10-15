const item = (record, index, height) => `<div class="prowitem" style="height:${height}px" data-pf-row-repeat="supplied" data-pf-row-index="${index}"><span data-record="${record.id}">${record.id}</span><span data-pf-format="currency">${record.amount}</span></div>`;
export const FOOTER_RECORDS = [
  { id: "REF-NORTH", amount: "MYR 12.30" },
  { id: "REF-SOUTH", amount: "MYR -2.05" },
  { id: "REF-WEST", amount: "MYR 0.00" }
];
export const SIGNATURE_TEXT = "Prepared by Fictional Reviewer · approved by Fictional Authoriser";

export function fractionalFooterFixture(height = 148) {
  return {
    width: 260, height, records: FOOTER_RECORDS,
    html: `<header class="pheader" style="height:25.25px">Fictional workshop</header>${FOOTER_RECORDS.map((record, index) => item(record, index, 20.25)).join("")}<footer class="pfooter" style="height:60.25px"><div data-pf-component-type="signature">${SIGNATURE_TEXT}</div></footer>`
  };
}

export function flowFooterFixture({ height = 150, explicitBreak = false, repeat = false, oversized = false } = {}) {
  return {
    width: 260, height, records: FOOTER_RECORDS,
    html: `<header class="pheader" style="height:12px;font:8px/12px Arial">Fictional workshop</header>${FOOTER_RECORDS.map((record, index) => item(record, index, 25)).join("")}<footer class="ptac-rowitem without_prowheader" data-pf-table-id="summary" data-pf-keep-together="true" data-pf-keep-with-next="true" style="height:30px" data-summary><span data-pf-format="currency">MYR 10.25</span></footer><footer class="ptac-rowitem without_prowheader${explicitBreak ? " tb_page_break_before" : ""}" data-pf-table-id="signoff" style="height:${oversized ? 120 : 50}px" data-pf-keep-together="true"><div data-pf-component-type="signature">${SIGNATURE_TEXT}</div></footer>${repeat ? '<footer class="pfooter" style="height:8px;font:6px/8px Arial">Fictional repeated disclaimer</footer>' : ""}<footer class="pfooter_pagenum" style="height:10px;font:8px/10px Arial"><span data-page-number></span>/<span data-page-total></span></footer>`
  };
}

export const FOOTER_OVERRIDES = {
  repeatHeader: false, repeatRowheader: false, repeatFooter: false, repeatFooterPagenum: true,
  insertDummyRowItemWhileFormatTable: false, insertDummyRowWhileFormatTable: false,
  insertFooterSpacerWithDummyRowItemWhileFormatTable: false, insertFooterSpacerWhileFormatTable: false,
  fillPageHeightAfterFooter: false
};
