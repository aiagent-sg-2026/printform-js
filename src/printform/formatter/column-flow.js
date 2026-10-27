import { DomHelpers } from "../dom.js";

// Opt-in prose flow. Direct children are semantic, indivisible clauses; the
// engine chooses physical column/page boundaries, never the document author.
export function columnFlowChildren(row) {
  if (row.dataset.pfColumns !== "2" || !row.matches(".ptac, .ptac-rowitem, .ptac-rowitem_processed")) {
    throw new TypeError('data-pf-columns="2" requires a PTAC terms block');
  }
  if (Array.from(row.childNodes).some(node => node.nodeType === 3 && node.textContent.trim())) {
    throw new TypeError("Column flow requires element children, not bare text");
  }
  if (row.querySelector(".prowitem, .ptac, .ptac-rowitem, .prowheader, .paddt")) {
    throw new TypeError("Column flow cannot contain nested pagination sections");
  }
  return Array.from(row.children);
}

function createFragment(row, gap) {
  const fragment = row.cloneNode(false);
  DomHelpers.markAsProcessed(fragment, "ptac-rowitem");
  // CSS columns alone balance before a physical page budget is known. Use two
  // real lanes so every source clause is assigned once in reading order.
  Object.assign(fragment.style, {
    display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    columnCount: "auto", columnGap: gap, alignItems: "start"
  });
  for (let index = 0; index < 2; index += 1) {
    const lane = row.ownerDocument.createElement("div");
    lane.className = "pf-flow-column";
    lane.style.display = "flow-root";
    lane.style.minWidth = "0";
    fragment.append(lane);
  }
  return fragment;
}

function contained(fragment) {
  const bounds = fragment.getBoundingClientRect();
  return Array.from(fragment.querySelectorAll(".pf-flow-column")).every(lane => {
    const box = lane.getBoundingClientRect();
    return lane.scrollWidth <= lane.clientWidth + 1 && box.left >= bounds.left - .01 && box.right <= bounds.right + .01;
  });
}

// Greedy page packing, with an ordered final-fragment balance. All trials are
// attached at their actual output width and removed on failure/rollback.
export function packColumnFragment(row, children, start, page, limit, gap) {
  const fragment = createFragment(row, gap);
  page.append(fragment);
  const fits = () => DomHelpers.measureHeightRaw(page) <= limit + .01 && contained(fragment);
  let end = start;
  for (const lane of fragment.children) {
    while (end < children.length) {
      const clone = children[end].cloneNode(true);
      lane.append(clone);
      if (!fits()) { clone.remove(); break; }
      end += 1;
    }
    // Do not skip an overheight first clause into the right lane.
    if (end === start) break;
  }
  if (end === start) { fragment.remove(); return null; }
  if (end === children.length) {
    const [left, right] = fragment.children;
    const count = end - start;
    let best = count, bestHeight = Infinity;
    for (let split = 1; split <= count; split += 1) {
      left.replaceChildren(...children.slice(start, start + split).map(node => node.cloneNode(true)));
      right.replaceChildren(...children.slice(start + split, end).map(node => node.cloneNode(true)));
      const height = DomHelpers.measureHeightRaw(fragment);
      if (fits() && height < bestHeight) { best = split; bestHeight = height; }
    }
    left.replaceChildren(...children.slice(start, start + best).map(node => node.cloneNode(true)));
    right.replaceChildren(...children.slice(start + best, end).map(node => node.cloneNode(true)));
  }
  return { fragment, end };
}

export function renderColumnFlow(formatter, state) {
  const { row, outputContainer, sections, heights, footerState, footerSpacerTemplate, logFn, pageContext } = state;
  const children = columnFlowChildren(row);
  const gap = getComputedStyle(row).columnGap;
  const fragments = [];
  let cursor = 0;
  let movedWithoutProgress = false;
  const advance = () => {
    const page = formatter.getCurrentPageContainer(outputContainer);
    formatter.prepareNextPage(outputContainer, sections, logFn, pageContext.limit,
      formatter.measureContentHeight(page, pageContext.repeatingHeight), footerState,
      footerSpacerTemplate, true, true, pageContext.repeatingHeight, pageContext.tableId);
    formatter.refreshPageContextForRow(pageContext, row, heights, sections);
    pageContext.repeatingHeight = formatter.computeRepeatingHeightForPage(sections, heights, true, pageContext.tableId);
  };
  if (row.classList.contains("tb_page_break_before") && formatter.getCurrentPageContainer(outputContainer)
    .querySelector(".prowitem_processed, .ptac-rowitem_processed")) advance();
  while (cursor < children.length) {
    const page = formatter.getCurrentPageContainer(outputContainer);
    const result = packColumnFragment(row, children, cursor, page,
      formatter.config.papersizeHeight - footerState.repeating, gap);
    if (!result) {
      if (movedWithoutProgress || !page.querySelector(".prowitem_processed, .ptac-rowitem_processed")) {
        throw new RangeError(`Printform column clause exceeds continuation budget (${children[cursor].id || cursor})`);
      }
      advance();
      movedWithoutProgress = true;
      continue;
    }
    fragments.push(result.fragment);
    cursor = result.end;
    movedWithoutProgress = false;
    if (cursor < children.length) advance();
  }
  fragments.forEach((fragment, index) => {
    fragment.dataset.pfColumnFragment = String(index);
    fragment.dataset.pfColumnFragments = String(fragments.length);
    if (index) { fragment.removeAttribute("id"); fragment.classList.remove("tb_page_break_before"); }
  });
  pageContext.isPtacPage = true;
  return formatter.measureContentHeight(formatter.getCurrentPageContainer(outputContainer), pageContext.repeatingHeight);
}
