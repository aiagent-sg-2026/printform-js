# Opt-in mixed-flow terms (PF-055)

PrintForm's ordinary body stream already preserves DOM order across `.prowitem`
and `.ptac` sections. Give each table's `.prowheader` and its rows the same
`data-pf-table-id`; use a separate ID for terms and
`data-repeat-ptac-rowheader="n"`. Signatures are ordinary body sections and may
be followed by more terms. PADDT is a separate end-of-document page pipeline,
not a replacement for intermediate prose.

## Measured two-column terms

```html
<div class="printform" data-paper-size="A4"
     data-repeat-ptac-rowheader="n" data-repeat-footer="y">
  <div class="pheader">Sample document</div>
  <div class="ptac" data-pf-table-id="terms">Opening paragraph...</div>
  <!-- Any number of ordinary tables/terms can precede this block. -->
  <section class="ptac" data-pf-columns="2" data-pf-table-id="terms"
           style="column-gap:24px">
    <p id="clause-one">First complete clause...</p>
    <p id="clause-two">Next complete clause...</p>
  </section>
  <table class="prowheader" data-pf-table-id="options"
         data-pf-keep-with-next="true">...</table>
  <table class="prowitem" data-pf-table-id="options">...</table>
  <div class="pfooter">Sample footer / Page <b data-page-number></b> of <b data-page-total></b></div>
</div>
```

- `data-pf-columns="2"` is **opt-in**, valid only on recognized PTAC terms rows.
  It does not affect any unmarked document or require a second formatter/API.
- The formatter measures attached output at the real page width, reserving
  repeating document/footer chrome. It fills the current page's remaining
  space, then continues on subsequent pages using the normal page lifecycle.
- Each direct element child is one **indivisible semantic clause**. Children
  flow down the left lane, then down the right lane, then to the next page.
  Final-fragment balancing minimizes the taller lane without reordering text.
  The following ordinary table/terms can start immediately below that fragment.
- Author margins/padding/borders and `column-gap` are measured. Use ordinary
  block prose; no fixed heights, CSS positioning, clipping, nested pagination
  sections, bare non-whitespace text or externally forced child page breaks.
  Keep source and processed-class geometry identical. Fonts/images must be ready
  before calling the public formatting API, as with existing measured rows.
- A clause that cannot fit intact in a fresh continuation column is rejected
  with `RangeError`, including oversized horizontal content. Divide prose into
  meaningful smaller clauses or use the ordinary measured PTAC continuation API.
  This first checkpoint does **not** split one clause across column lanes.
- Terms columns suppress table-header repetition for themselves regardless of
  the legacy PTAC rowheader default. They never borrow a previous table's header.
- Output uses two `.pf-flow-column` lanes and fragment wrappers. Direct child IDs
  and exact text appear once; wrappers may repeat. Generated
  `data-pf-column-fragment` / `data-pf-column-fragments` identify those wrappers.
  Do not use wrapper IDs as per-clause identities.
- On failure the existing formatter rollback removes partial output and keeps
  the actual source DOM object and listeners. No content is silently discarded.

## Keep a repeating table header with its first row

A `.prowheader[data-pf-keep-with-next="true"]` opts into orphan prevention even
when that header repeats. If a page break occurs after inserting the header but
before placing any row of that table, remove that orphan and repeat it on the
next page with its row. Headers on pages containing rows remain unchanged.
Nonrepeating header behavior and all unmarked repeating-header defaults remain
unchanged. Existing row-level keep-with-next behavior is independent.

## PF-055 sample and verification

`gallery/designs/corporate-insurance-proposal-agreement.html` is a fictional
rose/red-pink A4 **Corporate Insurance Proposal and Agreement** in Sales,
not a verified legal contract, official insurer document, insurance policy or offer.
It uses no authentic corporate logo or external assets. Its measured default
is 20 pages in the verified Chromium environment; content, not manual page
containers or breaks, determines boundaries.

The stream contains opening terms, 28 benefit rows, 36 two-column clauses,
22 varied package rows, further terms, 20 supplementary rows, closing terms,
a sample signature, then 60 appendix clauses (about five pages).

```sh
npm run build:assets
node scripts/export-pf055.mjs ../output/pf055-corporate-insurance-proposal-agreement-offline.html
# With an owned repo static server on 4185 and a pre-change baseline:
CHROMIUM_PATH=/path/to/chrome node scripts/verify-gallery-pagination.mjs --baseline ../pf055-baseline.json --output ../pf055-final-gallery.json
npx vitest run tests/column-flow.test.js tests/active-table-context.test.js tests/gallery --maxWorkers=1 --no-file-parallelism
# After building site-dist; use the project's browser configuration or a local
# external configuration pointing to a verified available Chromium executable:
npx playwright test e2e/column-flow.spec.js e2e/pf055-corporate-insurance-proposal-agreement.spec.js e2e/gallery-filters.spec.js --project=chromium --workers=1
```

Browser regressions verify exact ordered content/text, separate per-table
headers, midpage transitions, atomic failure rollback, oversized existing table
row continuations with one price, signature/appendix order, mobile viewing,
print A4 geometry, offline HTML reload, and actual PDF text/page bounds.
Hardware printing and untested browser engines are not certified by these checks.
