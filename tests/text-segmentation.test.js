import { describe, expect, it } from "vitest";
import { cloneContentRange, contentBoundaries } from "../src/printform/text-ranges.js";
import { wordCeilingEnd } from "../src/printform/text.js";

describe("atomic content in Unicode ranges", () => {
  it("copies an authored asset and currency token once while retaining surrounding text", () => {
    const root = document.createElement("div");
    root.innerHTML = '前<!--note--><svg aria-label="authored icon"><title>Fixture</title></svg><span data-pf-format="currency">MYR 123.45</span>後';
    const points = contentBoundaries(root);
    const pieces = points.slice(1).map((_point, index) => {
      const chunk = document.createElement("div");
      chunk.append(cloneContentRange(root, points, index, index + 1));
      return chunk;
    });
    expect(pieces.map(node => node.textContent).join("")).toBe(root.textContent);
    expect(pieces.flatMap(node => Array.from(node.querySelectorAll("svg")))).toHaveLength(1);
    expect(pieces.flatMap(node => Array.from(node.querySelectorAll('[data-pf-format="currency"]'), money => money.textContent))).toEqual(["MYR 123.45"]);
    expect(pieces.map(node => node.innerHTML).join("")).toContain("<!--note-->");
  });
  it("does not carry an exhausted fixed-height block into the next physical fragment", () => {
    const root = document.createElement("div");
    root.innerHTML = '<p style="height:80px;margin:0"><b>Fictional appendix A</b><!--kept--></p><p style="height:80px;margin:0">Fictional appendix B</p>';
    const points = contentBoundaries(root);
    const cut = points.findIndex((_point, index) => index > 0 &&
      cloneContentRange(root, points, 0, index).textContent === "Fictional appendix A");
    const first = cloneContentRange(root, points, 0, cut);
    const last = cloneContentRange(root, points, cut, points.length - 1);
    expect(Array.from(first.querySelectorAll("p"), node => node.textContent)).toEqual(["Fictional appendix A"]);
    expect(Array.from(last.querySelectorAll("p"), node => node.textContent)).toEqual(["Fictional appendix B"]);
    expect(first.querySelector("b").textContent).toBe("Fictional appendix A");
    expect(first.querySelector("p").innerHTML).toContain("<!--kept-->");
    expect(first.textContent + last.textContent).toBe(root.textContent);
  });
  it("keeps ERP monetary display strings indivisible without parsing or reformatting them", () => {
    const root = document.createElement("div");
    root.innerHTML = 'Claim <strong data-pf-monetary="currency">(645,650.00)</strong> 支付';
    const points = contentBoundaries(root);
    const chunks = points.slice(1).map((_point, index) => cloneContentRange(root, points, index, index + 1));
    expect(chunks.map(node => node.textContent).join("")).toBe(root.textContent);
    expect(chunks.flatMap(node => Array.from(node.querySelectorAll("[data-pf-monetary]"), money => money.textContent))).toEqual(["(645,650.00)"]);
    expect(chunks.filter(node => node.textContent.includes("645"))).toHaveLength(1);
  });
  it.each(['class="signature-block"', 'class="pfsign"', 'data-pf-component-type="signature"'])("keeps complete signature label/value blocks as one Range unit: %s", attributes => {
    const root = document.createElement("div");
    root.innerHTML = `Before <section ${attributes}><small>Authorised by</small><strong>Fictional Reviewer</strong><span>2026-10-16</span></section> After`;
    const signature = root.querySelector("section").outerHTML;
    const points = contentBoundaries(root);
    const chunks = points.slice(1).map((_point, index) => cloneContentRange(root, points, index, index + 1));
    expect(chunks.map(node => node.textContent).join("")).toBe(root.textContent);
    expect(chunks.flatMap(node => Array.from(node.querySelectorAll("section"), section => section.outerHTML))).toEqual([signature]);
  });
  it("keeps a consumed cell at its terminal Range boundary under a finite word budget", () => {
    const root = document.createElement("div");
    root.textContent = "ID-001";
    const points = contentBoundaries(root), terminal = points.length - 1;
    const end = wordCeilingEnd(points, terminal, 2);
    expect(end).toBe(terminal);
    expect(cloneContentRange(root, points, terminal, end).textContent).toBe("");
  });
});
