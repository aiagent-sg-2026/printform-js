// Registration only: physical fragments are measured after page chrome is known.
export function attachPtacSegmentMethods(FormatterClass) {
  FormatterClass.prototype.expandPtacSegments = function expandPtacSegments() {
    if (this.formEl.dataset.ptacExpanded === "true") return;
    this.formEl.querySelectorAll(".ptac").forEach((row) => {
      if (row.dataset.ptacSegment === "true") return;
      row.classList.add("ptac-rowitem", "ptac_segment");
      row.dataset.ptacSegment = "true";
    });
    this.formEl.dataset.ptacExpanded = "true";
  };
}

