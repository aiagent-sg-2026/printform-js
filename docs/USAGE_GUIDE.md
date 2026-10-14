# PrintForm.js Usage Guide

This guide explains how to use PrintForm.js correctly in production HTML.

---

## 1) Required HTML structure

The script only paginates content inside a `.printform` container.

```html
<div class="printform"
     data-papersize-width="750"
     data-papersize-height="1050">

  <div class="pheader">...</div>
  <div class="pdocinfo">...</div>
  <div class="prowheader">...</div>

  <div class="prowitem">Row 1</div>
  <div class="prowitem">Row 2</div>

  <div class="pfooter">...</div>
  <div class="pfooter_pagenum">
    Page <span data-page-number></span> of <span data-page-total></span>
  </div>
</div>
<script src="./dist/printform.js"></script>
```

Key classes (default behavior):
- `.pheader`: repeated every page
- `.pdocinfo`, `.pdocinfo002..005`: repeated every page
- `.prowheader`: repeated every page
- `.prowitem`: smallest pagination unit (never split inside)
- `.pfooter`, `.pfooter002..005`: last page only (repeat is configurable)
- `.pfooter_logo`, `.pfooter_pagenum`: optional footer blocks (repeat configurable)

Important: the formatter replaces class names with a `_processed` suffix
(e.g. `.pheader` -> `.pheader_processed`). If you style these classes,
mirror the styles for both.

---

## 2) Configuration precedence and sizing

Config sources (low -> high priority):
1. Defaults
2. Legacy globals (e.g. `papersize_width` on `window`)
3. `data-*` attributes on `.printform`
4. JS overrides passed to `PrintForm.format*()`

Sizing rules:
- If `data-papersize-width/height` are provided, they are used directly.
- Otherwise, `data-paper-size` + `data-dpi` + `data-orientation` are used
  to compute pixel dimensions.

Common options (full list in `docs/CONFIGURATION.md`):
- `data-papersize-width`, `data-papersize-height`
- `data-paper-size` (A4, A5, LETTER, LEGAL)
- `data-dpi` (default 96)
- `data-repeat-header`, `data-repeat-rowheader`, `data-repeat-footer...`
- `data-n-up`, `data-show-logical-page-number`, `data-show-physical-page-number`
- `data-debug` (verbose console logs)

---

## 3) Auto formatting and JS API

The script auto-runs after the page loads (with a short delay on mobile).
If you render content dynamically, call the API manually:

```javascript
// Format all .printform containers (async).
await PrintForm.formatAll({ force: true });

// Format a single element.
const formEl = document.querySelector(".printform");
PrintForm.format(formEl);
```

Notes:
- `formatAll` processes current source forms, including later additions, and concurrent callers await the same Promise.
- It returns `{formattedCount, failedCount: 0}`; any failure rejects with `AggregateError.errors` and `error.report` counts.
- Successful formatting replaces the source with `.printform_formatter_processed`; a failed form is preserved. See the [ERP contract and limits](ERP_PRINT_SUPPORT.zh-CN.md).
- The public API also exposes `PrintForm.DEFAULT_CONFIG` and
  `PrintForm.DEFAULT_PADDT_CONFIG` for inspection.

---

## 4) Page numbers and N-up

Logical page numbers:
- Use `data-page-number` and `data-page-total` placeholders.
- Toggle with `data-show-logical-page-number`.

Physical page numbers (for N-up):
- Use `data-physical-page-number` and `data-physical-page-total`.
- Toggle with `data-show-physical-page-number`.

N-up:
- `data-n-up="2"` imposes two logical pages in a physical sheet grid with uniform scaling, after validating unscaled content geometry.
- For `nUp > 1`, named `@page` rules scope the configured paper size to that output; host padding/borders reduce usable space. `nUp=1` leaves paper styling to the host.
- See [measured pagination, cell policies, and explicit limits](ERP_COMPLEX_PAGINATION.zh-CN.md); browser PDF proof is not printer certification.

---

## 5) PTAC and PADDT content

PTAC (`.ptac`):
- Intended for long terms/clauses.
- DOM Range measurement splits parallel cells within the actual page budget, preserving inline markup and Unicode grapheme clusters.
- The 200-word PTAC ceiling can shorten a fragment but never overrides width/height checks; unsplittable content fails without clipping.
- Use `data-repeat-ptac-rowheader="n"` to hide `.prowheader` on PTAC pages.
- Use `data-insert-ptac-dummy-row-items="n"` to disable dummy rows on PTAC pages.

PADDT (`.paddt`):
- Similar to PTAC, but rendered after all main pages and footers.
- PADDT pages only include `.pfooter_logo` and `.pfooter_pagenum`.
- Controls: `data-repeat-paddt-rowheader`, `data-insert-paddt-dummy-row-items`,
  and PADDT-only docinfo toggles (`data-repeat-paddt-docinfo*`).
- `paddtMaxWordsPerSegment` remains an additional readability ceiling; physical fit still uses measured geometry.
- `data-repeat-paddt` is read but currently reserved.

---

## 6) Forced page breaks and row header control

- Add `tb_page_break_before` to a row to start a new page before it.
- Add `without_prowheader` or `tb_without_rowheader` to suppress
  `.prowheader` on the page that starts with that row.

---

## 7) Dummy rows and footer spacing

- `data-height-of-dummy-row-item` sets the fixed dummy row height.
- `data-insert-dummy-row-item-while-format-table` inserts repeated dummy rows.
- `data-insert-footer-spacer-while-format-table` inserts a spacer before footers.
- You can override the dummy row markup via:
  - `data-custom-dummy-row-item-content`, or
  - `<template class="custom-dummy-row-item-content">...</template>`
- You can override the page-height spacer via (single root element; height auto-filled):
  - `data-custom-dummy-spacer-content`, or
  - `<template class="custom-dummy-spacer-content">...</template>`

---

## 8) Multiple printforms on one page

If a document contains multiple `.printform` containers, the formatter inserts
`div.div_page_break_before` between them. Use
`data-div-page-break-before-class-append` to add extra classes for styling or
legacy HTML-to-PDF engines.

---

## 9) Mobile and font loading tips

- Keep `text-size-adjust: 100%` to avoid mobile autosizing.
- Wait for fonts/images to load before formatting if layout shifts are expected.
- Re-run `PrintForm.formatAll({ force: true })` after dynamic updates.

---

## 10) Troubleshooting checklist

- A single `.prowitem` must not exceed the page height.
- Do not rely on only the original class names; `_processed` variants are used.
- If pagination looks off on mobile, check viewport and text-size-adjust.
- When using `data-paper-size`, ensure `data-dpi` is set correctly.
