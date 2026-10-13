import { describe, it, expect } from "vitest";
import { PrintFormFormatter } from "../src/printform/formatter/PrintFormFormatter.js";
import { getPrintformConfig } from "../src/printform/config.js";
import { applyDummyRowItemsStep } from "../src/printform/dom.js";

// jsdom has no layout. Model each actual custom/default DOM root's declared
// height; browser regressions exercise the same consumers with real geometry.
function target() {
  const container = document.createElement("div");
  container.getBoundingClientRect = () => ({ height: Array.from(container.children).reduce((sum, child) => {
    const height = child.style.height || child.querySelector("tr")?.style.height || "0";
    return sum + Number.parseFloat(height);
  }, 0) });
  return container;
}

function formatter(overrides) {
  const form = document.createElement("div");
  return new PrintFormFormatter(form, getPrintformConfig(form, overrides), overrides);
}

const templates = [
  '<table class="custom" style="height:30px"><tr><td class="pad">padding</td><td>amount</td></tr></table>',
  '<tr style="height:30px"><td class="pad">padding</td><td>amount</td></tr><tr><td>second</td></tr>',
  '<tr style="height:30px"><td class="pad">padding</td><td>amount</td></tr>'
];

describe("dummy row consumers", () => {
  it.each(templates)("uses the same HTML contract and actual height for both filler paths: %s", (html) => {
    const instance = formatter({ customDummyRowItemContent: html, heightOfDummyRowItem: 10 });
    const special = target();
    const ordinary = target();
    const context = { limit: 100, repeatingHeight: 0 };
    const specialHeight = instance.insertFooterDummyRows(special, context, 0, 10);
    const ordinaryHeight = applyDummyRowItemsStep(instance.config, ordinary, 90, 0, false);
    expect(specialHeight).toBe(90);
    expect(ordinaryHeight).toBe(90);
    expect(special.children).toHaveLength(3);
    expect(ordinary.innerHTML).toBe(special.innerHTML);
    expect(special.firstElementChild.querySelector(".pad").textContent).toBe("padding");
    expect(special.firstElementChild.tagName).toBe("TABLE");
  });

  it("honors the global switch for special and ordinary fillers", () => {
    const instance = formatter({ insertDummyRowItemWhileFormatTable: "false" });
    const container = target();
    instance.insertFooterDummyRows(container, { limit: 100 }, 0, 10);
    applyDummyRowItemsStep(instance.config, container, 100, 0, false);
    expect(container.children).toHaveLength(0);
  });

  it("does not keep a zero-height or too-tall custom dummy", () => {
    for (const height of [0, 120]) {
      const instance = formatter({ customDummyRowItemContent: `<div style="height:${height}px"></div>` });
      const container = target();
      expect(instance.insertFooterDummyRows(container, { limit: 100, repeatingHeight: 0 }, 0, 10)).toBe(0);
      expect(container.children).toHaveLength(0);
    }
  });

  it("uses the default row height only for the actual default DOM", () => {
    const instance = formatter({ heightOfDummyRowItem: 20 });
    const container = target();
    expect(instance.insertFooterDummyRows(container, { limit: 75, repeatingHeight: 0 }, 0, 10)).toBe(60);
    expect(container.children).toHaveLength(3);
  });
});
