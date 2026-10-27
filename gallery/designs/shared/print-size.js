// Make the browser print page exactly as large as the design's paper (data-papersize-*),
// so A5 / custom-height forms are not split across extra sheets by the printer's own paper size.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-papersize-width][data-papersize-height]");
  if (!form) return;
  const style = document.createElement("style");
  style.textContent = `@page { size: ${form.dataset.papersizeWidth}px ${form.dataset.papersizeHeight}px; margin: 0; }`;
  document.head.appendChild(style);
});
