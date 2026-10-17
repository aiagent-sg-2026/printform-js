const MAX_ISSUES = 20;
const TOLERANCE = 1;
const round = value => Math.round(value * 100) / 100;

function selectorWithinPage(node) {
  const parts = [];
  for (let current = node; current && !current.classList.contains('printform_page'); current = current.parentElement) {
    const tag = current.tagName.toLowerCase();
    const siblings = Array.from(current.parentElement?.children || []).filter(child => child.tagName === current.tagName);
    parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
  }
  return parts.join(' > ');
}

function contentBox(container, view) {
  const rect = container.getBoundingClientRect();
  // A DOM without layout (including jsdom) is not evidence of a barcode fit.
  if (rect.width <= 0 || rect.height <= 0) return null;
  const style = view.getComputedStyle(container);
  const px = property => parseFloat(style[property]) || 0;
  const left = rect.left + px('borderLeftWidth') + px('paddingLeft');
  const top = rect.top + px('borderTopWidth') + px('paddingTop');
  const right = Math.max(left, rect.right - px('borderRightWidth') - px('paddingRight'));
  const bottom = Math.max(top, rect.bottom - px('borderBottomWidth') - px('paddingBottom'));
  return {left, top, right, bottom, width:right - left, height:bottom - top};
}

function geometry(rect, pageRect) {
  return {x:round(rect.left - pageRect.left), y:round(rect.top - pageRect.top), width:round(rect.width), height:round(rect.height)};
}
function failingContainer(svg, page, rect, view) {
  // An expanded inner .field cannot grant more space than an enclosing cell
  // or field. Check every containing allocation, stopping at this page.
  for (let container = svg.parentElement; container && container !== page; container = container.parentElement) {
    if (!container.matches('td,th,.field')) continue;
    const available = contentBox(container, view);
    if (!available) continue;
    const overflow = {
      left:Math.max(0, available.left - rect.left), right:Math.max(0, rect.right - available.right),
      top:Math.max(0, available.top - rect.top), bottom:Math.max(0, rect.bottom - available.bottom)
    };
    if (Object.values(overflow).some(value => value > TOLERANCE)) return {container, available, overflow};
  }
  return null;
}

export function inspectBarcodeContent(doc) {
  const issues = [];
  let count = 0;
  const view = doc.defaultView;
  if (!view?.getComputedStyle) return {count, issues};
  Array.from(doc.querySelectorAll('.printform_page')).forEach((page, pageIndex) => {
    const pageRect = page.getBoundingClientRect();
    page.querySelectorAll('[data-pf-barcode-svg]').forEach(svg => {
      if (svg.closest('.printform_page') !== page) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const failure = failingContainer(svg, page, rect, view);
      if (!failure) return;
      const {container, available, overflow} = failure;
      count++;
      if (issues.length >= MAX_ISSUES) return;
      const component = svg.closest('[data-pf-component-id],[data-v3-id],[data-pf-table-id]');
      issues.push({
        code:'BARCODE_CONTENT_OVERFLOW', pageIndex, page:pageIndex + 1,
        component_id:component?.getAttribute('data-pf-component-id') || component?.getAttribute('data-v3-id') || component?.getAttribute('data-pf-table-id') || null,
        selector:selectorWithinPage(svg), container_selector:selectorWithinPage(container),
        measured_size:{width:round(rect.width), height:round(rect.height)},
        available_size:{width:round(available.width), height:round(available.height)},
        rect:geometry(rect, pageRect), content_rect:geometry(available, pageRect),
        overflow:Object.fromEntries(Object.entries(overflow).map(([side, value]) => [side, round(value)])),
        reason:'Barcode exceeds an enclosing cell or field content box',
        recommended_action:'Allocate enough content width and height for the complete barcode, including quiet zones; never scale or clip the symbol or change its source'
      });
    });
  });
  return {count, issues};
}
