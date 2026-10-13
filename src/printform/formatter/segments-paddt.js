/* eslint-disable no-console */

import { PADDT_MAX_WORDS_PER_SEGMENT, collectHtmlSegments } from "../text.js";

export function attachPaddtSegmentMethods(FormatterClass) {
  FormatterClass.prototype.expandPaddtSegments = function expandPaddtSegments() {
    if (this.formEl.dataset.paddtExpanded === "true") {
      return;
    }
    const paddtTables = Array.from(this.formEl.querySelectorAll(".paddt"));
    if (paddtTables.length === 0) {
      this.formEl.dataset.paddtExpanded = "true";
      return;
    }

    var maxWords = (this.paddtConfig && this.paddtConfig.paddtMaxWordsPerSegment) || PADDT_MAX_WORDS_PER_SEGMENT;

    paddtTables.forEach((paddtRoot) => {
      if (!paddtRoot || paddtRoot.dataset.paddtSegment === "true") {
        return;
      }

      const contentWrapper = paddtRoot.querySelector("td > div") || paddtRoot.querySelector("td");
      if (!contentWrapper) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const allChildren = Array.from(contentWrapper.childNodes);

      if (allChildren.length === 0) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const segments = collectHtmlSegments(contentWrapper, maxWords);

      if (segments.length === 0) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      contentWrapper.innerHTML = segments[0];
      paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
      paddtRoot.dataset.paddtSegment = "true";

      var lastNode = paddtRoot;
      for (var index = 1; index < segments.length; index += 1) {
        const clone = paddtRoot.cloneNode(true);
        clone.classList.remove("tb_page_break_before");
        clone.dataset.paddtSegment = "true";
        const cloneWrapper = clone.querySelector("td > div") || clone.querySelector("td");
        if (cloneWrapper) {
          cloneWrapper.innerHTML = segments[index];
        }
        lastNode.parentNode.insertBefore(clone, lastNode.nextSibling);
        lastNode = clone;
      }
    });

    this.formEl.dataset.paddtExpanded = "true";
  };
}
