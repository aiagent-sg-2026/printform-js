// DOM ranges keep markup and Unicode logical order; layout remains the browser's job.
const ATOMIC_TAGS = new Set(["IMG", "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME", "INPUT", "TEXTAREA", "SELECT", "BR", "WBR", "TABLE"]);
const segmenters = new Map();

function segmenter(locale) {
  if (typeof Intl.Segmenter !== "function") {
    throw new RangeError("Measured pagination requires Intl.Segmenter grapheme support");
  }
  if (!segmenters.has(locale)) segmenters.set(locale, new Intl.Segmenter(locale || undefined, { granularity: "grapheme" }));
  return segmenters.get(locale);
}

export function hasGeneratedContent(node) {
  const view = node.ownerDocument.defaultView;
  return !!view && ["::before", "::after"].some((pseudo) => {
    const content = view.getComputedStyle(node, pseudo).content;
    return content && !["none", "normal", '""', "''"].includes(content);
  });
}
export function isKeepTogetherContent(node, includeDescendants = false) {
  if (node.nodeType !== 1) return false;
  const selector = '[data-pf-keep-together="true"],[data-pf-component-type="signature"],.signature-block,.pfsign';
  return node.matches(selector) || Boolean(includeDescendants && node.querySelector(selector));
}


export function isAtomicContent(node) {
  if (node.nodeType !== 1) return false;
  if (ATOMIC_TAGS.has(node.localName.toUpperCase()) || isKeepTogetherContent(node) ||
    node.dataset.pfFormat === "currency" || node.dataset.pfMonetary === "currency") return true;
  const view = node.ownerDocument.defaultView;
  const style = view?.getComputedStyle(node);
  if (!style) return false;
  return /^(inline-block|inline-flex|inline-grid)$/.test(style.display) ||
    /^(absolute|fixed)$/.test(style.position) || /avoid/.test(style.breakInside) || hasGeneratedContent(node);
}

function completedBoundary(root, node, offset) {
  // A text-end point inside a completed block would make the next Range clone
  // its empty wrapper (including fixed height/margins). Use the outer gap instead.
  while (node !== root && offset === (node.nodeType === 3 ? node.length : node.childNodes.length)) {
    const parent = node.parentNode;
    offset = Array.prototype.indexOf.call(parent.childNodes, node) + 1;
    node = parent;
    while (offset < node.childNodes.length && node.childNodes[offset].nodeType === 8) offset += 1;
  }
  return { node, offset };
}

export function contentBoundaries(root) {
  const units = [];
  let text = "";
  function visit(node) {
    if (node.nodeType === 3) {
      const value = node.nodeValue || "";
      if (value) {
        units.push({ node, start: text.length, end: text.length + value.length, atomic: false });
        text += value;
      }
    } else if (isAtomicContent(node)) {
      units.push({ node, start: text.length, end: text.length + 1, atomic: true });
      text += "\uFFFC";
    } else Array.from(node.childNodes).forEach(visit);
  }
  Array.from(root.childNodes).forEach(visit);
  const points = [{ node: root, offset: 0, wordCount: 0 }];
  const wordStarts = Array.from(text.matchAll(/\S+/g), (match) => match.index);
  let wordIndex = 0;
  let unitIndex = 0;
  const locale = root.closest("[lang]")?.lang || root.ownerDocument.documentElement.lang;
  for (const part of segmenter(locale).segment(text)) {
    const end = part.index + part.segment.length;
    while (wordIndex < wordStarts.length && wordStarts[wordIndex] < end) wordIndex += 1;
    while (units[unitIndex].end < end) unitIndex += 1;
    const unit = units[unitIndex];
    if (unit.atomic) {
      const parent = unit.node.parentNode;
      points.push({ ...completedBoundary(root, parent, Array.prototype.indexOf.call(parent.childNodes, unit.node) + 1), wordCount: wordIndex });
    } else points.push({ ...completedBoundary(root, unit.node, end - unit.start), wordCount: wordIndex });
    points[points.length - 1].inWord = /\S/.test(text[end - 1] || "") && /\S/.test(text[end] || "");
  }
  const final = { node: root, offset: root.childNodes.length, wordCount: wordStarts.length };
  if (points.length === 1) points.push(final);
  else points[points.length - 1] = final;
  return points;
}

export function cloneContentRange(root, points, start, end) {
  const range = root.ownerDocument.createRange();
  range.setStart(points[start].node, points[start].offset);
  range.setEnd(points[end].node, points[end].offset);
  return range.cloneContents();
}
