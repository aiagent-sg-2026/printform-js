import { describe, expect, it } from "vitest";
import { cloneContentRange, contentBoundaries } from "../src/printform/text-ranges.js";

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
});
