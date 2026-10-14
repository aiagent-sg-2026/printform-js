// Registration only: each independent cell is fragmented at its rendered width.
export function attachPaddtSegmentMethods(FormatterClass) {
  FormatterClass.prototype.expandPaddtSegments = function expandPaddtSegments() {
    if (this.formEl.dataset.paddtExpanded === "true") return;
    this.formEl.querySelectorAll(".paddt").forEach((row) => {
      if (row.dataset.paddtSegment === "true") return;
      row.classList.add("paddt-rowitem", "paddt_segment");
      row.dataset.paddtSegment = "true";
    });
    this.formEl.dataset.paddtExpanded = "true";
  };
}
