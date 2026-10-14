import { normalizeHeight } from "./helpers.js";

// Template parsing preserves bare table rows as well as a complete custom root.
export function parseDummyRowContent(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const elements = Array.from(template.content.children);
  if (!elements.length) return null;
  if (elements.length === 1 && !["TR", "TD", "TH", "TBODY", "THEAD", "TFOOT"].includes(elements[0].tagName)) {
    return elements[0];
  }
  const table = document.createElement("table");
  table.setAttribute("cellpadding", "0");
  table.setAttribute("cellspacing", "0");
  table.setAttribute("border", "0");
  table.style.width = "100%";
  table.style.tableLayout = "fixed";
  elements.forEach((element) => table.appendChild(element));
  return table;
}

export function createDummyRowItem(config) {
  let node;
  if (config.customDummyRowItemContent) {
    node = parseDummyRowContent(config.customDummyRowItemContent);
    if (!node) throw new Error("customDummyRowItemContent must contain an element");
  } else {
    node = document.createElement("table");
    node.setAttribute("cellspacing", "0");
    node.setAttribute("cellpadding", "0");
    node.style.cssText = "width:100%;border-collapse:separate;border-spacing:0;margin:0;padding:0;line-height:0;font-size:0";
    node.innerHTML = `<tr style="height:${normalizeHeight(config.heightOfDummyRowItem)}px"><td style="border:0;padding:0;margin:0;line-height:0;font-size:0"></td></tr>`;
  }
  node.classList.add("dummy_row_item", "prowitem_dummy");
  return node;
}

// Measure at the actual output width. Each insertion is checked against the
// remaining budget; zero-height or shrinking layout stops without a fake height.
export function appendMeasuredDummyRows(config, target, availableHeight, measure, before = null) {
  if (!config.insertDummyRowItemWhileFormatTable || availableHeight <= 0) return 0;
  const initialHeight = measure(target);
  let usedHeight = 0;
  const template = createDummyRowItem(config);
  let maxRows = 1;
  for (let index = 0; index < maxRows; index += 1) {
    const node = template.cloneNode(true);
    target.insertBefore(node, before);
    const nextHeight = measure(target) - initialHeight;
    const increment = nextHeight - usedHeight;
    if (increment <= 0 || nextHeight > availableHeight) {
      node.remove();
      break;
    }
    usedHeight = nextHeight;
    if (index === 0) maxRows = Math.floor(availableHeight / increment);
  }
  return usedHeight;
}
