# Ten A4 business layouts

The existing New → Business demo templates choices select these layouts automatically.
There is no extra preset picker. Each remains a native Studio v3 design with editable
fields, JSON bindings, supplied business values, save/reopen and standalone HTML export.
The original 15 document kinds and 48 fictional records remain available.

| Business kind | Preset | Distinguishing structure | Business evidence |
| --- | --- | --- | --- |
| SalesQuotation | quotation-letter | Open letterhead, ruled scope, quotation terms | Valid-until, discounts, quotation total; includes empty and USD scenarios |
| SalesOrder | order-register | Top rule, shaded three-column register, boxed summary | Accepted quotation reference, customer order status |
| DeliveryOrder | dispatch-manifest | Dark dispatch masthead, destination, quantity manifest | Ordered / dispatched / remaining quantities, carrier, packages |
| SalesInvoice | invoice-ledger | Split masthead, customer panel, amount ledger | Delivery / order links, due date, supplied invoice face value |
| PurchaseOrder | procurement-order | Framed heading, supplier / receiving panel, approval | Supplier, customer order reference, purchase value |
| PurchaseInvoice | payable-voucher | Underlined voucher heading, supplier rail, horizontal totals | Actual supplier invoice number and purchase order reference |
| BankReceipt | receipt-advice | Centered receipt, allocation ledger, three-part receipt total | Received-from, allocated, unapplied and remaining invoice balance |
| BankPayment | payment-authority | Left payment rail, beneficiary panel, authorization lines | Paid-to, source ledger, invoice allocation and approval |
| EnterpriseProject | project-brief | Project title, programme details, scope / contract value | Contract link, dates, manager and supplied scope values |
| ProgressClaim | progress-certificate | Valuation header, project panel, cumulative summary | Period, previous/current/cumulative work and retention |

All ten default to A4 portrait, 9pt body text, 22px page margins, first-page company
header, repeating item headings, and page numbers. Existing Studio controls and
inline typography stay editable. Explicit section grids override preset grids.
Financial values are formatted from existing data; the layout code never calculates
or rewrites quantities, rates, discounts, tax, claims, allocations or balances.

## Acceptance status

The entries below describe the original A4-only implementation checkpoint. The
combined visual/row-fill acceptance status is in
`acceptance/STUDIO_V3_INTEGRATED_ACCEPTANCE.md`.

- Full unit suite: 131 files / 890 tests passed during implementation.
- Final focused check after the last layout changes: 63 tests passed.
- Asset and static-site builds passed. Playwright discovery found 30 cases across
  Chromium, Firefox and WebKit; discovery does not execute a browser.
- New coverage: 44 layout/schema/binding/data-preservation tests; every existing
  scenario for the ten kinds binds, formats exact supplied amounts and round trips.
- Browser test authored: `e2e/studio-v3-a4-presets.spec.js`, ten parameterized cases.
  Browser execution and visual inspection are **pending hosted PR CI**.
- Existing catalogue tests still cover all 15 kinds / 48 records and relationships.
- Template acceptance does not prove model ability. No real-model acceptance or
  external AI call is included in these results.

## Hosted browser acceptance handoff

Normal repository PR CI builds the static site and runs Chromium, Firefox and
WebKit. Its existing `browser-evidence` artifact captures this spec's output.
To run only this matrix in the same authorized hosted environment:

```sh
npm run build:site
npx playwright test e2e/studio-v3-a4-presets.spec.js --workers=1
```

Each kind must pass these checks:

1. Open its existing Business demo choice; confirm A4. Explicitly select the first
   catalog fixture, assert the active dataset ID/name before Save, and compare the
   complete saved data. New uses a compatible remembered dataset or the first
   title-sorted record, which need not be the first catalog fixture.
2. Edit a field label through the inspector. Select the campus dataset where
   available, assert its active ID/name, and preserve the edited label and exact
   source data. Real 64-row fixtures must span multiple pages in source row order;
   bank campus fixtures retain their two supplied allocation rows.
3. Reopen a long fictional company/customer-name variation after opening another
   form. All financial data and the edited design must survive unchanged.
4. Keep totals and notes once, item headings once on each page carrying rows,
   page numbers on every page, and all body cells free of horizontal overflow.
5. Export standalone HTML. Page text, row sequence and geometry must match preview.
6. Check physical A4 print dimensions, capture PNG and Chromium PDF, and inspect
   the ten layouts visually for clipping, collisions, readable numbers and distinct
   document hierarchy. Automated geometry does not replace this visual review.

Per-kind artifacts use the preset ID: `<preset>.html`, `<preset>.png`,
`<preset>-A4.pdf`, `<preset>-pagination.json`, and original/edited/reopened project
files. Bank and claim fixtures remain their actual short collections; they are not
inflated with duplicated financial rows to manufacture a multipage demonstration.

## Integration notes

`layoutPreset` is an optional, closed enum validated on import and compilation.
Older documents without it compile as before. New modules contain the ten designs
and their CSS; no arbitrary CSS or data is accepted through the enum.

If combining with an explicit table-body fill, theme order must be:
base theme → `a4PresetTheme(d)` → explicit section `grid` → `tableBodyCss(d)`.
This preserves user section controls and makes an explicit row fill win over preset
styling. Preserve both `layoutPreset` and `tableStyle` in the validator's allowed keys.
