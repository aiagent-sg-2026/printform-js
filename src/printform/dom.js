/* eslint-disable no-console */

import { normalizeHeight } from "./helpers.js";
import { appendMeasuredDummyRows } from "./dummy.js";

  function applyTableSizingReset(table) {
    if (!table) return;
    table.style.borderCollapse = "collapse";
    table.style.borderSpacing = "0";
    table.style.margin = "0";
    table.style.padding = "0";
    table.style.lineHeight = "0";
    table.style.fontSize = "0";
  }

  function createDummyRowTable(config, height) {
    const table = document.createElement("table");
    table.className = "dummy_row";
    table.setAttribute("width", `${config.papersizeWidth}px`);
    table.setAttribute("cellspacing", "0");
    table.setAttribute("cellpadding", "0");
    applyTableSizingReset(table);
    table.innerHTML = `<tr style="height:${normalizeHeight(height)}px;"><td style="border:0px solid black;padding:0;margin:0;line-height:0;font-size:0;"></td></tr>`;
    return table;
  }


function appendDummyRow(config, target, diffHeight) {
  const remaining = normalizeHeight(diffHeight);
  if (remaining <= 0) return;
  target.appendChild(createDummyRowTable(config, remaining));
}

function applyDummyRowItemsStep(config, container, heightPerPage, currentHeight, debug) {
  if (!config.insertDummyRowItemWhileFormatTable) {
    if (debug) {
      console.log(`[printform] applyDummyRowItemsStep: SKIPPED (insertDummyRowItemWhileFormatTable=false)`);
    }
    return normalizeHeight(currentHeight);
  }
  const remaining = normalizeHeight(heightPerPage - currentHeight);
  if (debug) {
    console.log(`[printform] applyDummyRowItemsStep:`);
    console.log(`[printform]   heightPerPage: ${heightPerPage}px, currentHeight: ${currentHeight}px`);
    console.log(`[printform]   remaining: ${remaining}px, itemHeight: ${config.heightOfDummyRowItem}px`);
  }
  if (remaining > 0) {
    const addedHeight = appendMeasuredDummyRows(config, container, remaining, measureHeightRaw);
    return normalizeHeight(currentHeight + addedHeight);
  }
  return normalizeHeight(currentHeight);
}

function applyDummyRowStep(config, container, heightPerPage, currentHeight, debug) {
  if (!config.insertDummyRowWhileFormatTable) {
    if (debug) {
      console.log(`[printform] applyDummyRowStep: SKIPPED (insertDummyRowWhileFormatTable=false)`);
    }
    return normalizeHeight(currentHeight);
  }
  const remaining = normalizeHeight(heightPerPage - currentHeight);
  if (debug) {
    console.log(`[printform] applyDummyRowStep:`);
    console.log(`[printform]   heightPerPage: ${heightPerPage}px, currentHeight: ${currentHeight}px`);
    console.log(`[printform]   remaining: ${remaining}px`);
  }
  if (remaining > 0) {
    appendDummyRow(config, container, remaining);
    if (debug) {
      console.log(`[printform]   inserted 1 dummy_row with height: ${remaining}px`);
    }
    return normalizeHeight(currentHeight + remaining);
  }
  return normalizeHeight(currentHeight);
}

function applyFooterSpacerWithDummyStep(config, container, heightPerPage, currentHeight, skipDummyRowItems, debug) {
  if (!config.insertDummyRowItemWhileFormatTable || !config.insertFooterSpacerWithDummyRowItemWhileFormatTable || skipDummyRowItems) {
    if (debug) {
      console.log(`[printform] applyFooterSpacerWithDummyStep: SKIPPED (flag=${config.insertFooterSpacerWithDummyRowItemWhileFormatTable}, skipDummy=${skipDummyRowItems})`);
    }
    return {
      currentHeight: normalizeHeight(currentHeight),
      skipFooterSpacer: false
    };
  }
  const remaining = normalizeHeight(heightPerPage - currentHeight);
  let workingHeight = normalizeHeight(currentHeight);
  if (debug) {
    console.log(`[printform] applyFooterSpacerWithDummyStep:`);
    console.log(`[printform]   heightPerPage: ${heightPerPage}px, currentHeight: ${currentHeight}px`);
    console.log(`[printform]   remaining: ${remaining}px`);
  }
  if (remaining > 0) {
    workingHeight += appendMeasuredDummyRows(config, container, remaining, measureHeightRaw);
  }
  return {
    currentHeight: workingHeight,
    skipFooterSpacer: true
  };
}

function applyFooterSpacerStep(config, container, heightPerPage, currentHeight, footerState, spacerTemplate, debug) {
  if (!config.insertFooterSpacerWhileFormatTable) {
    if (debug) {
      console.log(`[printform] applyFooterSpacerStep: SKIPPED (insertFooterSpacerWhileFormatTable=false)`);
    }
    return;
  }
  const clone = spacerTemplate.cloneNode(true);
  let remaining = normalizeHeight(heightPerPage - currentHeight);
  const nonRepeating = footerState && footerState.nonRepeating ? normalizeHeight(footerState.nonRepeating) : 0;
  if (nonRepeating > 0) {
    remaining -= nonRepeating;
  }
  const spacerHeight = Math.max(0, remaining);
  clone.style.height = `${spacerHeight}px`;
  container.appendChild(clone);
  if (debug) {
    console.log(`[printform] applyFooterSpacerStep:`);
    console.log(`[printform]   heightPerPage: ${heightPerPage}px, currentHeight: ${currentHeight}px`);
    console.log(`[printform]   nonRepeatingFooter: ${nonRepeating}px`);
    console.log(`[printform]   pfooter_spacer height: ${spacerHeight}px`);
  }
}

function markAsProcessed(element, baseClass) {
  if (!element || !baseClass) return;
  if (element.classList.contains(`${baseClass}_processed`)) return;
  element.classList.remove(baseClass);
  element.classList.add(`${baseClass}_processed`);
}

function measureHeight(element) {
  if (!element) return 0;

  // 强制重排以确保获取最新的布局信息 (对移动端特别重要)
  element.offsetHeight; // 触发 reflow

  // 尝试多种方法获取高度
  // iOS/Android 上 offsetHeight 会丢失小数像素，优先使用 getBoundingClientRect() 的 sub-pixel 高度
  const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
  const rectHeight = rect && Number.isFinite(rect.height) ? rect.height : 0;
  let baseHeight = rectHeight > 0 ? rectHeight : element.offsetHeight;

  // 仍然为 0,可能是隐藏元素,尝试临时显示
  if (baseHeight === 0) {
    const originalDisplay = element.style.display;
    const originalVisibility = element.style.visibility;
    const originalPosition = element.style.position;

    element.style.display = 'block';
    element.style.visibility = 'hidden';
    element.style.position = 'absolute';

    const tempRect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
    const tempRectHeight = tempRect && Number.isFinite(tempRect.height) ? tempRect.height : 0;
    baseHeight = tempRectHeight > 0 ? tempRectHeight : (element.offsetHeight || 0);

    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;
    element.style.position = originalPosition;
  }

  const view = (element.ownerDocument && element.ownerDocument.defaultView) || (typeof window !== "undefined" ? window : null);
  if (!view || !view.getComputedStyle) {
    return normalizeHeight(baseHeight);
  }
  const style = view.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;
  return normalizeHeight(baseHeight + marginTop + marginBottom);
}

function measureHeightRaw(element) {
  if (!element) return 0;
  const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
  const baseHeight = rect && Number.isFinite(rect.height) ? rect.height : (element.offsetHeight || 0);
  const view = (element.ownerDocument && element.ownerDocument.defaultView) || (typeof window !== "undefined" ? window : null);
  if (!view || !view.getComputedStyle) {
    return Number.isFinite(baseHeight) ? Math.max(0, baseHeight) : 0;
  }
  const style = view.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;
  const total = baseHeight + marginTop + marginBottom;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

function createPageBreakDivider(extraClassNames) {
  const div = document.createElement("div");
  div.classList.add("div_page_break_before");
  // Some external HTML-to-PDF engines only accept the legacy inline CSS name:
  // `page-break-before: always` (and may reject `break-before: page`).
  // IMPORTANT: do not touch `div.style.*` here, as browsers may normalize the style attribute
  // and rewrite it to `break-before: page` when serializing.
  div.setAttribute("style", "page-break-before: always; font-size: 0pt; height: 0px;");
  const globalScope = typeof window !== "undefined" ? window : globalThis;
  const resolvedClassNames = typeof extraClassNames === "string" && extraClassNames.trim()
    ? extraClassNames
    : (globalScope && typeof globalScope.__printFormDividerClassAppend === "string"
      ? globalScope.__printFormDividerClassAppend
      : "");
  if (resolvedClassNames) {
    resolvedClassNames
      .split(/\s+/)
      .filter(Boolean)
      .forEach((className) => div.classList.add(className));
  }
  return div;
}

function appendClone(target, element, logFn, label) {
  if (!element) return null;
  const clone = element.cloneNode(true);
  target.appendChild(clone);
  if (logFn) logFn(`append ${label}`);
  return clone;
}

function appendRowItem(target, element, logFn, index, label) {
  if (!element) return null;
  const clone = element.cloneNode(true);
  target.appendChild(clone);
  if (logFn) {
    const resolvedLabel = label || "prowitem";
    logFn(`append ${resolvedLabel} ${index}`);
  }
  return clone;
}

export const DomHelpers = {
  markAsProcessed,
  measureHeight,
  measureHeightRaw,
  createPageBreakDivider,
  appendClone,
  appendRowItem,
  createDummyRowTable
};

export { applyDummyRowItemsStep, applyDummyRowStep, applyFooterSpacerWithDummyStep, applyFooterSpacerStep };
