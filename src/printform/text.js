/* eslint-disable no-console */

export const ROW_SELECTOR = ".prowitem, .ptac-rowitem, .paddt-rowitem";

export const PTAC_MAX_WORDS_PER_SEGMENT = 200;
export const PADDT_MAX_WORDS_PER_SEGMENT = 200;

// Keep text and comments adjacent to a rendered element so zero-height
// whitespace-only fragments are not discarded by the row renderer.
export function collectHtmlSegments(wrapper, maxWords) {
  const segments = [];
  let pending = "";
  Array.from(wrapper.childNodes).forEach((child) => {
    const serializer = wrapper.ownerDocument.createElement("div");
    serializer.appendChild(child.cloneNode(true));
    if (child.nodeType !== 1) {
      pending += serializer.innerHTML;
      return;
    }
    const chunks = child.tagName.toLowerCase() === "p"
      ? splitParagraphIntoHtmlChunks(child, maxWords) : [serializer.innerHTML];
    chunks[0] = pending + chunks[0];
    pending = "";
    segments.push(...chunks);
  });
  if (pending) {
    if (segments.length) segments[segments.length - 1] += pending;
    else segments.push(pending);
  }
  return segments;
}
function collectWordTokens(node) {
  var tokens = [];
  if (!node || !node.ownerDocument || !node.ownerDocument.createTreeWalker) {
    return tokens;
  }
  var walker = node.ownerDocument.createTreeWalker(node, 4, null, false);
  var current = walker.nextNode();
  while (current) {
    var text = current.nodeValue || "";
    var regex = /\S+/g;
    var match = regex.exec(text);
    while (match) {
      tokens.push({
        node: current,
        start: match.index,
        end: match.index + match[0].length
      });
      match = regex.exec(text);
    }
    current = walker.nextNode();
  }
  return tokens;
}

function buildChunkHtml(node, range) {
  var clone = node.cloneNode(false);
  clone.appendChild(range.cloneContents());
  return clone.outerHTML || "";
}

function splitParagraphIntoHtmlChunks(node, maxWords) {
  if (!node) {
    return [];
  }
  maxWords = Math.floor(Number(maxWords));
  if (!Number.isFinite(maxWords) || maxWords <= 0) {
    return [node.outerHTML || ""];
  }
  var text = (node.textContent || "").trim();
  if (!text) {
    return [node.outerHTML || ""];
  }
  if (!node.ownerDocument || !node.ownerDocument.createRange || !node.ownerDocument.createTreeWalker) {
    return [node.outerHTML || ""];
  }

  var tokens = collectWordTokens(node);
  if (tokens.length === 0) {
    return [node.outerHTML || ""];
  }
  if (tokens.length <= maxWords) {
    return [node.outerHTML || ""];
  }

  var chunks = [];
  for (var startIndex = 0; startIndex < tokens.length; startIndex += maxWords) {
    var endIndex = startIndex + maxWords - 1;
    if (endIndex >= tokens.length) {
      endIndex = tokens.length - 1;
    }
    var range = node.ownerDocument.createRange();
    if (startIndex === 0) {
      range.setStart(node, 0);
    } else {
      var startToken = tokens[startIndex];
      range.setStart(startToken.node, startToken.start);
    }
    if (endIndex + 1 < tokens.length) {
      var nextToken = tokens[endIndex + 1];
      range.setEnd(nextToken.node, nextToken.start);
    } else {
      range.setEnd(node, node.childNodes.length);
    }
    chunks.push(buildChunkHtml(node, range));
  }

  return chunks;
}

function splitPaddtParagraphIntoHtmlChunks(node, maxWords) {
  return splitParagraphIntoHtmlChunks(node, maxWords);
}

export { splitParagraphIntoHtmlChunks, splitPaddtParagraphIntoHtmlChunks };
