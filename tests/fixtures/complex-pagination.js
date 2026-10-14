// Fictional authored content only; no ERP/customer extraction or printer attestation.
export const CJK_DESCRIPTION = "虚构园区设备巡检：确认管线、标识与维护说明。".repeat(36);
export const RTL_DESCRIPTION = "مُراجعة مرافق الحديقة الخيالية وتوثيق الصيانة بعناية. ".repeat(28);
export const INLINE_CLUSTER = "甲e\u0301👨‍👩‍👧‍👦乙";

export function complexPaginationFixture(kind = "prowitem", width = 260) {
  const rtlWidth = Math.round(width * 0.27);
  const left = width - rtlWidth - 100;
  return {
    width,
    height: 180,
    descriptions: [CJK_DESCRIPTION + INLINE_CLUSTER, RTL_DESCRIPTION],
    html: `<div class="pheader" style="height:15px">Fictional maintenance</div>
      <div class="pdocinfo" style="height:10px">Authored fixture only</div>
      <table class="prowheader" data-pf-table-id="maintenance" style="width:100%;height:20px"><tr><th>Fictional scope</th></tr></table>
      <table class="${kind}" data-pf-table-id="maintenance" data-pf-row-repeat="maintenance" data-pf-row-index="0"
        style="width:100%;table-layout:fixed;border-collapse:collapse">
        <tr><td data-fixture-cell="cjk" style="width:${left}px;box-sizing:border-box;padding:2px;vertical-align:top"><p style="margin:0"><strong>${CJK_DESCRIPTION}</strong>甲e<em>\u0301</em>👨‍👩‍👧‍👦乙<!--authored-marker--></p></td>
        <td data-fixture-cell="rtl" dir="rtl" lang="ar" style="width:${rtlWidth}px;box-sizing:border-box;padding:2px;vertical-align:top"><span>${RTL_DESCRIPTION}</span></td>
        <td data-fixture-cell="quantity" style="width:25px;box-sizing:border-box;padding:2px;vertical-align:top"><span>2</span></td>
        <td data-fixture-cell="amount" style="width:75px;box-sizing:border-box;padding:2px;vertical-align:top"><span data-pf-format="currency" style="white-space:nowrap">MYR 123.45</span><small>Scope fee</small></td></tr>
      </table>
      <div class="pfooter_pagenum" style="height:18px"><span data-page-number>?</span>/<span data-page-total>?</span> · <span data-physical-page-number>?</span>/<span data-physical-page-total>?</span></div>`
  };
}

export const CELL_POLICY_FIXTURE = `<table class="prowitem" data-pf-row-index="0" data-pf-row-repeat="policies" style="width:260px;table-layout:fixed;border-collapse:collapse"><tr>
  <td data-fixture-cell="description" style="width:155px;padding:0"><p style="margin:0">${CJK_DESCRIPTION}</p></td>
  <td data-fixture-cell="first" data-pf-cell-policy="first" style="width:25px;padding:0">Q1</td>
  <td data-fixture-cell="last" data-pf-cell-policy="last" style="width:30px;padding:0">END</td>
  <td data-fixture-cell="repeat" data-pf-cell-policy="repeat" style="width:50px;padding:0">REF-A</td>
</tr></table>`;

export function autoLayoutPaginationFixture() {
  return {
    width: 260, height: 180,
    html: `<table class="prowitem" data-pf-row-repeat="maintenance" data-pf-row-index="0"
      style="width:100%;border-collapse:separate;border-spacing:2px"><tr>
      <td data-fixture-cell="cjk" style="padding:2px">${CJK_DESCRIPTION}</td>
      <td data-fixture-cell="rtl" dir="rtl" lang="ar" style="padding:2px">${RTL_DESCRIPTION}</td>
      <td data-fixture-cell="quantity" style="padding:2px">2</td>
      <td data-fixture-cell="amount" style="padding:2px"><span data-pf-format="currency" style="white-space:nowrap">MYR 123.45</span><small>Scope fee</small></td>
      </tr></table><div class="pfooter_pagenum" style="height:18px"><span data-page-number>?</span>/<span data-page-total>?</span></div>`
  };
}

export function multirowPaginationFixture({ rowspan = true, zeroSpan = false, spanningText = false, packedRows = false } = {}) {
  const span = rowspan ? ` rowspan="${zeroSpan ? 0 : 3}"` : "";
  const identity = rowspan ? `<th${span} data-fixture-cell="identity" scope="rowgroup">${spanningText ? CJK_DESCRIPTION : "CLAIM-A"}</th>` : "";
  const description = (key, text) => `<td data-fixture-cell="${key}"${key === "scope-b" ? ' dir="rtl" lang="ar"' : ""}><p style="margin:0"><a href="https://example.invalid/claim">${text}</a>甲e<em>\u0301</em>👨‍👩‍👧‍👦乙<!--authored-marker--></p></td>`;
  return {
    width: 320, height: 180, expectedRows: 2,
    html: `<div class="pheader" style="height:15px">Fictional multirow claim</div>
      <table class="prowheader" data-pf-table-id="maintenance" style="width:100%;height:20px"><tr><th>Claim detail</th></tr></table>
      <table class="prowitem" data-pf-table-id="maintenance" data-pf-row-repeat="maintenance" data-pf-row-index="0"
        style="width:100%;table-layout:fixed;border-collapse:collapse">
        <colgroup>${rowspan ? '<col style="width:65px">' : ""}<col style="width:160px"><col style="width:95px"></colgroup>
        <tbody>
        <tr>${identity}${description("scope-a", packedRows ? "Approval details" : CJK_DESCRIPTION.slice(0, 380))}<td data-fixture-cell="amount-a" data-pf-monetary="currency" style="white-space:nowrap">MYR 123.45</td></tr>
        <tr>${description("scope-b", packedRows ? "Inspection metadata" : RTL_DESCRIPTION.slice(0, 450))}<td data-fixture-cell="amount-b" data-pf-format="currency" data-pf-cell-policy="last" style="white-space:nowrap">MYR 67.89</td></tr>
        <tr><td data-fixture-cell="scope-c">${packedRows ? CJK_DESCRIPTION : "Final inspection"} <strong>ready</strong></td><td data-fixture-cell="reference" data-pf-cell-policy="repeat">REF-C</td></tr>
        </tbody>
      </table>
      <table class="prowitem" data-pf-table-id="maintenance" data-pf-row-repeat="maintenance" data-pf-row-index="1"
        style="width:100%;table-layout:fixed"><tbody><tr><td data-fixture-cell="next-description">Next business item.</td><td data-fixture-cell="next-amount" data-pf-format="currency">MYR 10.00</td></tr></tbody></table>
      <div class="pfooter_pagenum" style="height:18px"><span data-page-number>?</span>/<span data-page-total>?</span></div>`
  };
}
