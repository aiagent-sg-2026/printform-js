export function inspectTemplate(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const bindings = Array.from(template.content.querySelectorAll("[data-pf-text],[data-pf-barcode],[data-pf-each],[data-pf-if],[data-pf-href],[data-pf-i18n],[data-pf-asset-slot]")).map((node) => ({
    tag: node.tagName.toLowerCase(),
    id: node.id || null,
    className: node.className || null,
    text: node.getAttribute("data-pf-text"),
    ...(node.hasAttribute("data-pf-barcode") ? {barcode:node.getAttribute("data-pf-barcode")} : {}),
    each: node.getAttribute("data-pf-each"),
    condition: node.getAttribute("data-pf-if"),
    href: node.getAttribute("data-pf-href"),
    i18nKey: node.getAttribute("data-pf-i18n"),
    assetSlot: node.getAttribute("data-pf-asset-slot")
  }));
  return { blocks: template.content.children.length, bindings };
}
