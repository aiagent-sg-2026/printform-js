import { describe, expect, it } from "vitest";
import { analyzeRowIntegrity, inspectRowIntegrity } from "../../studio-v2/core/row-integrity.js";
import { inspectRenderedDocument } from "../../studio-v2/core/acceptance.js";

const options = { expectedRowCount: 2, expectedRowsByRepeat: { invoice: 2 } };

function row({ index = 0, repeat = "invoice", source, fragment, count, text = "", amount } = {}) {
  const node = document.createElement("div");
  node.className = "prowitem_processed";
  const attributes = {
    "data-pf-row-index": index,
    "data-pf-row-repeat": repeat,
    "data-pf-source-row": source,
    "data-pf-fragment-index": fragment,
    "data-pf-fragment-count": count
  };
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  const table = document.createElement("table");
  const body = document.createElement("tbody");
  const line = document.createElement("tr");
  const description = document.createElement("td");
  description.className = "description";
  description.textContent = text;
  line.append(description);
  if (amount !== undefined) {
    const money = document.createElement("td");
    money.className = "amount";
    money.setAttribute("data-pf-format", "currency");
    money.textContent = amount;
    line.append(money);
  }
  body.append(line);
  table.append(body);
  node.append(table);
  return node;
}

function invoiceRows() {
  return [
    row({ source: "opaque/α", fragment: 0, count: 2, text: "Fictional orchard survey — ", amount: "MYR 120.50" }),
    row({ source: "opaque/α", fragment: 1, count: 2, text: "north plot inspection." }),
    row({ index: 1, text: "Fictional pump service.", amount: "MYR 79.50" })
  ];
}

function mount(rows) {
  document.documentElement.lang = "en-MY";
  document.head.innerHTML = "<title>Fictional continuation invoice</title>";
  document.body.innerHTML = `<template id="pf-template"><section class="printform"
    data-papersize-height="500" data-repeat-rowheader="n"></section></template>`;
  // Separate pages keep physical DOM order without assuming a common parent.
  rows.forEach(node => {
    const page = document.createElement("section");
    page.className = "printform_page";
    page.getBoundingClientRect = () => rect(0, 0, 400, 100);
    page.append(node);
    document.body.append(page);
  });
  return Array.from(document.querySelectorAll(".prowitem_processed"));
}

function rect(left, top, width, height) {
  return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height };
}

// Consumer reads every physical fragment, using semantic representatives only
// to delimit legitimate rows. It never rewrites or removes rendered content.
function consume(report, physical) {
  return report.semanticRows.map((node, i) => {
    const start = physical.indexOf(node);
    const next = report.semanticRows[i + 1];
    const pieces = physical.slice(start, next ? physical.indexOf(next) : physical.length);
    return {
      description: pieces.map(piece => piece.querySelector(".description").textContent).join(""),
      amounts: pieces.flatMap(piece => Array.from(piece.querySelectorAll(".amount"), money => money.textContent))
    };
  });
}

const codes = report => report.errors.map(entry => entry.code);

describe("semantic continuation identity", () => {
  it("consumes complete cross-page descriptions and amounts without duplicating semantic rows", () => {
    const physical = mount(invoiceRows());
    const before = physical.map(node => node.outerHTML);
    const result = analyzeRowIntegrity(physical, options);
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({ renderedRows: 2, renderedRowFragments: 3 });
    expect(result.semanticRows).toEqual([physical[0], physical[2]]);
    const consumed = consume(result, physical);
    expect(consumed).toEqual([
      { description: "Fictional orchard survey — north plot inspection.", amounts: ["MYR 120.50"] },
      { description: "Fictional pump service.", amounts: ["MYR 79.50"] }
    ]);
    expect(consumed.flatMap(item => item.amounts).reduce((sum, amount) => sum + Number(amount.slice(4)), 0)).toBe(200);
    expect(physical.map(node => node.outerHTML)).toEqual(before);
    expect(inspectRowIntegrity(physical, options)).toEqual(result.errors);
    const acceptance = inspectRenderedDocument(document, {}, options);
    expect(acceptance.errors.filter(entry => entry.code.startsWith("ROW_"))).toEqual([]);
    expect(acceptance.metrics).toMatchObject({ renderedRows: 2, renderedRowFragments: 3, expectedRows: 2 });
    expect(analyzeRowIntegrity(physical).errors).toEqual([]);
  });

  it("accepts distinct source identities in independent repeat groups with index zero in each", () => {
    const physical = mount([
      ...invoiceRows().slice(0, 2),
      row({ repeat: "fees", source: "fee-token", fragment: 0, count: 2, text: "Fictional fee — ", amount: "MYR 5.00" }),
      row({ repeat: "fees", source: "fee-token", fragment: 1, count: 2, text: "document handling." })
    ]);
    const result = analyzeRowIntegrity(physical, { expectedRowCount: 2, expectedRowsByRepeat: { invoice: 1, fees: 1 } });
    expect(result.errors).toEqual([]);
    expect(consume(result, physical)[1]).toEqual({ description: "Fictional fee — document handling.", amounts: ["MYR 5.00"] });
  });

  it.each([
    ["missing fragment", rows => rows.splice(1, 1), "ROW_IDENTITY_MISMATCH"],
    ["duplicate fragment", rows => rows.splice(1, 0, rows[1].cloneNode(true)), "ROW_IDENTITY_MISMATCH"],
    ["reversed fragment order", rows => rows.reverse(), "ROW_ORDER_MISMATCH"],
    ["interleaved source rows", rows => rows.splice(1, 0, rows.pop()), "ROW_ORDER_MISMATCH"],
    ["wrong fragment order", rows => rows[1].setAttribute("data-pf-fragment-index", "0"), "ROW_ORDER_MISMATCH"],
    ["inconsistent count", rows => rows[1].setAttribute("data-pf-fragment-count", "3"), "ROW_IDENTITY_MISMATCH"],
    ["noninteger count", rows => rows[0].setAttribute("data-pf-fragment-count", "2.5"), "ROW_IDENTITY_MISMATCH"],
    ["noncanonical index", rows => rows[1].setAttribute("data-pf-fragment-index", "01"), "ROW_IDENTITY_MISMATCH"],
    ["missing count", rows => rows[1].removeAttribute("data-pf-fragment-count"), "ROW_IDENTITY_MISMATCH"],
    ["missing source", rows => rows[1].removeAttribute("data-pf-source-row"), "ROW_IDENTITY_MISMATCH"],
    ["inconsistent source", rows => rows[1].setAttribute("data-pf-source-row", "other-token"), "ROW_IDENTITY_MISMATCH"],
    ["inconsistent repeat", rows => rows[1].setAttribute("data-pf-row-repeat", "fees"), "ROW_IDENTITY_MISMATCH"],
    ["inconsistent row index", rows => rows[1].setAttribute("data-pf-row-index", "1"), "ROW_IDENTITY_MISMATCH"],
    ["missing row index", rows => rows[1].removeAttribute("data-pf-row-index"), "ROW_IDENTITY_MISMATCH"],
    ["missing repeat", rows => rows[1].removeAttribute("data-pf-row-repeat"), "ROW_IDENTITY_MISMATCH"],
    ["inconsistent table", rows => rows[1].setAttribute("data-pf-table-id", "other-table"), "ROW_IDENTITY_MISMATCH"],
    ["inconsistent legacy table", rows => rows[1].setAttribute("data-pf-table", "other-table"), "ROW_IDENTITY_MISMATCH"]
  ])("keeps every physical row visible for %s", (_label, mutate, expectedCode) => {
    const rows = invoiceRows();
    mutate(rows);
    const physical = mount(rows);
    const result = analyzeRowIntegrity(physical, options);
    expect(codes(result)).toContain(expectedCode);
    expect(result.semanticRows).toEqual(physical);
    expect(result.renderedRows).toBe(physical.length);
    expect(consume(result, physical).map(item => item.description)).toEqual(physical.map(node => node.querySelector(".description").textContent));
  });

  it("rejects a duplicate complete source set instead of collapsing away the duplicate", () => {
    const originals = invoiceRows();
    const physical = mount([...originals.slice(0, 2), ...originals.slice(0, 2).map(node => node.cloneNode(true)), originals[2]]);
    const result = analyzeRowIntegrity(physical, options);
    expect(result.semanticRows).toEqual(physical);
    expect(codes(result)).toEqual(expect.arrayContaining(["ROW_IDENTITY_MISMATCH", "ROW_DUPLICATE_INDEX", "ROW_COUNT_MISMATCH"]));
    expect(consume(result, physical).flatMap(item => item.amounts)).toEqual(["MYR 120.50", "MYR 120.50", "MYR 79.50"]);
  });

  it("detects actual duplicate rows even with individually valid continuation sets", () => {
    const rows = invoiceRows();
    const copied = rows.slice(0, 2).map(node => {
      const copy = node.cloneNode(true);
      copy.setAttribute("data-pf-source-row", "distinct-copy");
      return copy;
    });
    const result = analyzeRowIntegrity(mount([...rows.slice(0, 2), ...copied, rows[2]]), options);
    expect(result.renderedRows).toBe(3);
    expect(codes(result)).toEqual(expect.arrayContaining(["ROW_DUPLICATE_INDEX", "ROW_ORDER_MISMATCH", "ROW_COUNT_MISMATCH"]));
  });

  it("detects a missing semantic index and swapped complete source rows", () => {
    const missing = analyzeRowIntegrity(mount(invoiceRows()), { expectedRowCount: 3, expectedRowsByRepeat: { invoice: 3 } });
    expect(codes(missing)).toContain("ROW_MISSING_INDEX");
    const rows = invoiceRows();
    const swapped = analyzeRowIntegrity(mount([rows[2], rows[0], rows[1]]), options);
    expect(swapped.renderedRows).toBe(2);
    expect(codes(swapped)).toContain("ROW_ORDER_MISMATCH");
  });

  it("leaves ordinary rows unchanged including source-only and index-only legacy rows", () => {
    const physical = mount([row({ source: "ordinary", text: "First", amount: "MYR 1.00" }), row({ index: 1, repeat: null, text: "Second" })]);
    const result = analyzeRowIntegrity(physical);
    expect(result.semanticRows).toEqual(physical);
    expect(result).toMatchObject({ renderedRows: 2, renderedRowFragments: 2 });
    expect(result.errors).toEqual([]);
    physical.forEach(node => node.removeAttribute("data-pf-row-repeat"));
    expect(inspectRowIntegrity(physical, { expectedRowCount: 2 })).toEqual([]);
  });


  it("rejects a continuation source identity reused by an ordinary physical row", () => {
    const rows = invoiceRows();
    rows[2].setAttribute("data-pf-source-row", "opaque/α");
    const physical = mount(rows);
    const result = analyzeRowIntegrity(physical, options);
    expect(result.semanticRows).toEqual(physical);
    expect(codes(result)).toEqual(expect.arrayContaining(["ROW_IDENTITY_MISMATCH", "ROW_DUPLICATE_INDEX"]));
  });
  it.each([false, true])("collapses legacy/static fragments with matching absent identities (static=%s)", staticRows => {
    const physical = mount(invoiceRows());
    physical.forEach(node => {
      node.removeAttribute("data-pf-row-repeat");
      if (staticRows) node.removeAttribute("data-pf-row-index");
    });
    const result = analyzeRowIntegrity(physical, { expectedRowCount: 2 });
    expect(result.errors).toEqual([]);
    expect(result.renderedRows).toBe(2);
    expect(consume(result, physical)[0]).toEqual({
      description: "Fictional orchard survey — north plot inspection.",
      amounts: ["MYR 120.50"]
    });
  });

  it("never collapses fragments across separate formatter outputs", () => {
    const physical = mount(invoiceRows());
    physical.forEach(node => {
      const output = document.createElement("section");
      output.className = "printform_formatter_processed";
      document.body.append(output);
      output.append(node.closest(".printform_page"));
    });
    const result = analyzeRowIntegrity(physical, options);
    expect(result.semanticRows).toEqual(physical);
    expect(codes(result)).toContain("ROW_IDENTITY_MISMATCH");
  });

  it("does not suppress physical continuation geometry after semantic collapse", () => {
    const physical = mount(invoiceRows());
    const continuation = physical[1].querySelector(".description");
    continuation.getBoundingClientRect = () => rect(350, 0, 100, 20);
    physical[1].closest(".printform_page").getBoundingClientRect = () => rect(0, 0, 400, 520);
    const report = inspectRenderedDocument(document, {}, options);
    expect(report.metrics).toMatchObject({ renderedRows: 2, renderedRowFragments: 3, overflowElements: 1, verticalOverflowPages: 1 });
    expect(codes(report)).toEqual(expect.arrayContaining(["HORIZONTAL_OVERFLOW", "VERTICAL_OVERFLOW"]));
    expect(report.issues.find(entry => entry.code === "HORIZONTAL_OVERFLOW").text).toBe("north plot inspection.");
    expect(continuation.textContent).toBe("north plot inspection.");
  });
});
