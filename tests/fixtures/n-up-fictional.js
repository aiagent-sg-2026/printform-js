// Authored fictional values only; no customer or production documents.
export const fictionalNUpRows = [
  ["LANTERN-01", "MYR 17.25"], ["LANTERN-02", "MYR 28.50"],
  ["LANTERN-03", "MYR 39.75"], ["LANTERN-04", "MYR 41.00"],
  ["LANTERN-05", "MYR 52.25"], ["LANTERN-06", "MYR 63.50"],
  ["LANTERN-07", "MYR 74.75"]
];

export const fictionalNUpHtml =
  '<div class="pheader" style="height:16px">Fictional Lantern Workshop · <span data-page-number>?</span>/<span data-page-total>?</span></div>' +
  fictionalNUpRows.map(([id, amount]) => `<div class="prowitem" style="height:80px"><b>${id}</b> <span>${amount}</span></div>`).join("") +
  '<div class="pfooter" style="height:16px">Sheet <span data-physical-page-number>?</span></div>';

export const fictionalNUpConfig = {
  papersizeWidth: 240, papersizeHeight: 120,
  insertDummyRowItemWhileFormatTable: false,
  insertDummyRowWhileFormatTable: false,
  insertFooterSpacerWhileFormatTable: false,
  insertFooterSpacerWithDummyRowItemWhileFormatTable: false,
  fillPageHeightAfterFooter: true,
  repeatFooter: true,
  showPhysicalPageNumber: true
};
