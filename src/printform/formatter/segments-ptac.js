/* eslint-disable no-console */

import { PTAC_MAX_WORDS_PER_SEGMENT, collectHtmlSegments } from "../text.js";

export function attachPtacSegmentMethods(FormatterClass) {
  FormatterClass.prototype.expandPtacSegments = function expandPtacSegments() {
    if (this.formEl.dataset.ptacExpanded === "true") {
      return;
    }
    const ptacTables = Array.from(this.formEl.querySelectorAll(".ptac"));
    if (ptacTables.length === 0) {
      this.formEl.dataset.ptacExpanded = "true";
      return;
    }

    ptacTables.forEach((ptacRoot) => {
      if (!ptacRoot || ptacRoot.dataset.ptacSegment === "true") {
        return;
      }

      const contentWrapper = ptacRoot.querySelector("td > div") || ptacRoot.querySelector("td");
      if (!contentWrapper) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const allChildren = Array.from(contentWrapper.childNodes);

      if (allChildren.length === 0) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const segments = collectHtmlSegments(contentWrapper, PTAC_MAX_WORDS_PER_SEGMENT);

      if (segments.length === 0) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      contentWrapper.innerHTML = segments[0];
      ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
      ptacRoot.dataset.ptacSegment = "true";

      var lastNode = ptacRoot;
      for (var index = 1; index < segments.length; index += 1) {
        const clone = ptacRoot.cloneNode(true);
        clone.classList.remove("tb_page_break_before");
        clone.dataset.ptacSegment = "true";
        const cloneWrapper = clone.querySelector("td > div") || clone.querySelector("td");
        if (cloneWrapper) {
          cloneWrapper.innerHTML = segments[index];
        }
        lastNode.parentNode.insertBefore(clone, lastNode.nextSibling);
        lastNode = clone;
      }
    });

    this.formEl.dataset.ptacExpanded = "true";
  };
}

