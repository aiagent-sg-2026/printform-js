// Print standard: browser margins of 0.25in (24px) on every side at 100% scale.
// The sheet is the design's paper (data-papersize-*) plus that margin, so the printable
// area equals the design page and no row spills onto an extra sheet.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-papersize-width][data-papersize-height]");
  if (!form) return;
  const margin = 24;
  const width = Number(form.dataset.papersizeWidth) + margin * 2;
  const height = Number(form.dataset.papersizeHeight) + margin * 2;
  const style = document.createElement("style");
  style.textContent = `@page { size: ${width}px ${height}px; margin: ${margin}px; }`;
  document.head.appendChild(style);
});
