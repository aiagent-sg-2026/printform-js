import { describe, expect, it } from "vitest";
import { cloneContentRange, contentBoundaries } from "../src/printform/text-ranges.js";
import { wordCeilingEnd } from "../src/printform/text.js";

function chunks(root, words) {
  const points = contentBoundaries(root);
  const output = [];
  for (let start = 0; start < points.length - 1;) {
    const end = wordCeilingEnd(points, start, words);
    const node = root.cloneNode(false);
    node.append(cloneContentRange(root, points, start, end));
    output.push(node);
    start = end;
  }
  return output;
}

describe("measured-pagination text ranges", () => {
  it("conserves all text, inline markup and comments under the additional readability ceiling", () => {
    const paragraph = document.createElement("p");
    paragraph.className = "fictional-description";
    paragraph.dataset.note = "authored";
    paragraph.innerHTML = "Alpha <strong>Bravo Charlie</strong> <span>Delta</span><!--note--><a href=\"#\"> Echo Foxtrot</a> Golf ";
    const pieces = chunks(paragraph, 2);
    expect(pieces.map(node => node.textContent).join("")).toBe(paragraph.textContent);
    expect(pieces.every(node => (node.textContent.match(/\S+/g) || []).length <= 2)).toBe(true);
    expect(pieces.every(node => node.className === paragraph.className && node.dataset.note === "authored")).toBe(true);
    expect(pieces.map(node => node.innerHTML).join("")).toContain("<!--note-->");
    expect(pieces.flatMap(node => Array.from(node.querySelectorAll("strong"), strong => strong.textContent)).join("")).toBe("Bravo Charlie");
    expect(pieces.flatMap(node => Array.from(node.querySelectorAll("a"), link => link.textContent)).join("")).toBe(" Echo Foxtrot");
  });

  it("never separates a combining cluster across inline nodes, surrogate pair or emoji ZWJ sequence", () => {
    const root = document.createElement("div");
    root.innerHTML = "甲e<em>\u0301</em>👨‍👩‍👧‍👦乙";
    const points = contentBoundaries(root);
    const fragments = points.slice(1).map((_point, index) => cloneContentRange(root, points, index, index + 1));
    expect(fragments.map(node => node.textContent)).toEqual(["甲", "e\u0301", "👨‍👩‍👧‍👦", "乙"]);
    expect(fragments[1].querySelector("em").textContent).toBe("\u0301");
  });

  it("retains RTL logical character order, isolation markup and combining vowel marks", () => {
    const root = document.createElement("div");
    root.dir = "rtl";
    root.lang = "ar";
    root.innerHTML = "<bdi>مُراجعة</bdi> الحديقة";
    const points = contentBoundaries(root);
    const pieces = points.slice(1).map((_point, index) => cloneContentRange(root, points, index, index + 1));
    expect(pieces.map(node => node.textContent).join("")).toBe(root.textContent);
    expect(pieces[0].textContent).toBe("مُ");
    expect(pieces[0].querySelector("bdi")).not.toBeNull();
    expect(root.dir).toBe("rtl");
  });

  it.each([Infinity, NaN, 0, -2])("keeps non-ceilings harmless: %s", limit => {
    const root = document.createElement("p");
    root.textContent = "one two three";
    expect(chunks(root, limit).map(node => node.textContent).join("")).toBe(root.textContent);
  });
});
