import { describe, expect, it } from "vitest";
import { bindTemplate, safeUrl } from "../../studio-v2/core/binding.js";

describe("PrintForm v2 declarative binding", () => {
  it("expands rows, formats values and writes text safely", () => {
    const template = document.createElement("template");
    template.innerHTML = `<div><p data-pf-text="/title"></p><div data-pf-each="/items"><span data-pf-text="./name"></span><b data-pf-text="./price" data-pf-format="currency"></b></div></div>`;
    const result = bindTemplate(template, { title: "<script>unsafe</script>", items: [{ name: "A", price: 12 }, { name: "B", price: 3 }] }, { locale: "en-MY", currency: "MYR" });
    const host = document.createElement("div");
    host.append(result.fragment);
    expect(host.querySelectorAll("span")).toHaveLength(2);
    expect(host.querySelector("p").innerHTML).toContain("&lt;script&gt;");
    expect(host.querySelector("b").textContent).toContain("12.00");
    expect(result.report.rows).toBe(2);
  });

  it("tags each expanded row with its source-array position for downstream order/identity checks", () => {
    const template = document.createElement("template");
    template.innerHTML = `<div><div data-pf-each="/items"><span data-pf-text="./name"></span></div></div>`;
    const result = bindTemplate(template, { items: [{ name: "A" }, { name: "B" }, { name: "C" }] }, {});
    const host = document.createElement("div");
    host.append(result.fragment);
    const rows = Array.from(host.querySelectorAll("[data-pf-each], [data-pf-row-index]"));
    // data-pf-each is removed from the clone; data-pf-row-index replaces it as
    // the row's stable identity going into pagination.
    expect(rows.every((row) => !row.hasAttribute("data-pf-each"))).toBe(true);
    expect(rows.map((row) => row.getAttribute("data-pf-row-index"))).toEqual(["0", "1", "2"]);
  });

  it("accepts only the supported URL protocols", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com");
    expect(safeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });

  it("treats unresolved pointers as hard binding errors", () => {
    const template = document.createElement("template");
    template.innerHTML = `<span data-pf-text="/missing"></span>`;
    expect(bindTemplate(template, {}, {}).report.errors[0].code).toBe("MISSING_BINDING");
  });
});

it.each(['not json','null','[]','{\"minimumFractionDigits\":5,\"maximumFractionDigits\":2}'])('returns a located formatting error for invalid options %s',raw=>{
  const template=document.createElement('template');
  template.innerHTML='<span data-pf-component-id="total" data-pf-text="/amount" data-pf-format="number">Original content</span>';
  template.content.firstChild.setAttribute('data-pf-format-options',raw);
  const bound=bindTemplate(template,{amount:12});
  expect(bound.report.errors).toContainEqual(expect.objectContaining({code:'FORMAT_CONFIG',path:'/amount',component:'total'}));
  expect(bound.fragment.firstChild.textContent).toBe('Original content');
});

it('counts reserved-key table identities without prototype inheritance in the exported row report', () => {
  const template = document.createElement('template');
  template.innerHTML = ['constructor', '__proto__'].map(id =>
    `<div class="prowitem" data-pf-table-id="${id}" data-pf-each="/items"><span data-pf-text="./name"></span></div>`
  ).join('');
  const { report, fragment } = bindTemplate(template, { items: [{ name: 'A' }, { name: 'B' }] },
    { acceptance: { maxRowsPerTable: 2, maxRows: 4 } });
  expect(report.errors).toEqual([]);
  const exported = JSON.parse(JSON.stringify(report.tableRowsByTable));
  expect(Object.hasOwn(exported, '__proto__')).toBe(true);
  expect(exported.constructor).toBe(2);
  expect(exported.__proto__).toBe(2);
  expect(report.tableRows).toBe(4);
  expect([...fragment.querySelectorAll('span')].map(node => node.textContent)).toEqual(['A', 'B', 'A', 'B']);
});
