# Studio v3 boss demonstration acceptance

## Scope and evidence boundary

This is a production-quality **demonstration**, not acceptance of a production ERP connection, tax compliance, every PDF format, or provider reliability. Keep the existing v3 shell, visual style, explicit binding workflow and Preview → Apply → Undo controls. Existing invoice/purchase/delivery layout families remain compatible.

Source baseline: `3eadf66` (tree equivalent to merged PR9). Do not publish this work until authorized. The presentation day is not confirmed.

## Source audit

- v3 uses Pi AgentHarness with a single locally validated proposal/answer tool and at most three inspection/repair rounds. Provider transport currently accepts text-only chat-completions messages.
- v2 contains a Demo Responses image path and historical synthetic image evidence. This does not establish current v3 image support.
- Existing raster upload embeds logo/field assets locally; it is not AI reference ingestion. No existing v3 PDF input path was found.
- Current seed database has three starter records (invoice, purchase, delivery). IndexedDB has optimistic revision checks, a memory fallback, and explicit persistence.
- Business values are excluded from automatic AI context. An explicit reference must be reviewed separately; ordinary reference upload never implicitly authorizes sending every dataset or business document.
- Demo-session probe from localhost:5173 returned HTTP 403 on 2026-10-02. Current model/image capabilities remain unverified. No credentials or gateway permissions were changed.

## Acceptance matrix

| Area | Required case | Completion evidence |
| --- | --- | --- |
| Existing shell | Desktop/tablet narrow layout, keyboard, fit-page/remembered zoom, no unrelated redesign | Browser checks and screenshots of final source |
| Template catalogue | Every defined business kind has its own heading, suitable fields and explicit base layout family | Schema/compilation tests plus rendered pages |
| Fictional database | Multiple samples, linked sales/procurement/project chains, masters and stable identities | Reference-integrity and arithmetic tests |
| Source selection | Chosen dataset identity/kind/currency visible; switching updates bound values without losing layout | Browser selection and reload |
| Bindings | Available schema paths and row collection explicit; absent pointers fail; no arbitrary DB query or browser secret | Contract tests + UI |
| Natural language | Color, type, spacing, page layout, fields, and one scoped change | Live provider proposal; real Preview, Apply and Undo |
| Image reference | File picker and drop, bytes/dimensions checked, visible local thumbnail and explicit sharing | Live synthetic image read; design result compared with reference |
| PDF reference | Text + positioned layout extracted locally; bounded page images; page count and extraction limits shown | Synthetic multi-page PDF upload through real composer/provider |
| Scanned PDF | Image-only nature identified; never presented as extracted text | Image-capable provider test; otherwise truthful blocker |
| Reference safety | Remove/replace/clear/cancel; stale-document and stale-reference responses blocked; files remain memory-only | Unit + browser interrupted/repeated flows |
| Provider failures | 401/403/429/timeout/malformed output; no silent fallback or unexpected data send | Controlled transport tests |
| Proposal safety | No apply before preview; stale scope/revision rejection; financial data cannot be rewritten by AI | Existing and new regression suites |
| Amounts | Minor-unit arithmetic, currency precision, tax/rounding, partial quantity and cumulative claims | Deterministic fixture assertions; sample values not accounting advice |
| Edge data | 0/1/many rows, long names, multilingual names, negative adjustments, missing optional values | Validation and pagination tests |
| Persistence | Seed upgrade never overwrites user edits; save/reopen/export retains kind and dataset | IndexedDB browser tests |
| Print/export | Native preview, standalone HTML, A4 PDF, repeating headers, no clipping or blank trailing page | Rendered output review; physical printing separate |
| Future integration | Bounded list/read/schema adapter contract, read-only synthetic implementation, no SQL endpoint | Tests + adapter documentation |

All rows begin **not yet verified for this change**. A mocked provider test is not live AI evidence. Parsed PDF text is not visual comprehension. A successful export click is not proof of a completed download or correct printed pages.

## Demonstration dataset policy

Use conspicuously fictional companies, `.example` contact addresses, fixed reproducible dates and explicit synthetic identifiers. Include Sales Quotation, Sales Order, Sales Order Confirmation, Delivery Order, Delivery Order Confirmation, Sales Invoice, Purchase Order, Purchase Invoice, Bank Receipt, Bank Payment, Enterprise Project, Progress Claim, Certified Claim, and neutral Accounts Receivable/Payable Claim examples.

Keep spoken `PCA`, `CCAR`, `PCAP`, `CCAP` as pending definitions. Do not assign business semantics until confirmed. Fixture calculations are generation-time test data; the form renderer continues to consume supplied amounts without silently recomputing business transactions.

## Approvals and external prerequisites

Existing GPTDemo/Pi endpoint reuse is authorized. New credentials, model grants, gateway access changes, customer-document uploads and publication are outside this local preparation. Current provider capabilities and a normal authorized-origin session must be verified before marking image/PDF AI flow complete.

## Implemented local preparation (2026-10-02)

- 15 defined business kinds and 48 fictional records, plus the three retained legacy starters and a separate compact A5 preset record. Shared masters include addresses, parties, salespeople, departments, business units, terms, products, currencies and an explicitly fictional clearing ledger.
- Deterministic integer-minor-unit calculations and tests reconcile tax, discounts, partial deliveries, invoice allocations and three cumulative claim/certificate periods. The independent USD quotation is authored in USD, not a simulated FX conversion.
- Template headings/fields are business-specific. Discount amounts, quotation validity, dispatch/receipt dates and claim tax basis are explicit. Source selection is filtered to the template's business kind; currency changes atomically with its data and participates in Undo.
- The read-only dataset adapter exposes bounded identity listing, revision-aware record reading and value-free schema inspection. A future production adapter needs authenticated server-side authorization and its own deployment acceptance; it must not accept SQL or browser-held database credentials.
- Seed upgrade adds missing catalogue records without replacing retained edits. The normal explicit restore-starters action remains separate.
- Local PNG/JPEG/WebP/PDF processing uses pinned `pdfjs-dist@6.3.289`, local dedicated workers and bounded file/page/text budgets; decoded-pixel budgets apply only to standalone raster images. Encrypted, corrupt, animated and unsupported input is rejected. PDF coordinates are approximate; no OCR is implemented. Some external-font/CMap/resource-dependent PDFs are rejected. Default Text & positions mode does not render PDF pages or decode embedded raster images. Optional Visual pages mode uses a separate local worker, at most 5 MiB input, four pages, 12 million pixels per embedded image, bounded output canvases/encoded previews, sequential page cleanup and timeout/cancellation. These are best-effort controls, not a browser memory sandbox or aggregate embedded-image decoded-pixel guarantee. Over-limit image errors reject rather than silently omit; annotations are not rendered.
- The existing conversation composer accepts file selection and drag/drop. Files and thumbnails stay in memory and are absent from recovery snapshots. Changing the document clears them. Reference changes expire proposals and restore committed paper before print can be enabled.
- PDFs default to text and positions. No-text/scanned PDFs in this mode prompt choosing Visual pages and reattaching. Independently attached PNG/JPEG/WebP and optional visual PDF pages stay send-blocked until the Gateway capability schema and real image behavior are verified. Normal model discovery exposes only bounded sanitized diagnostics, not inferred eligibility. Missing metadata fails closed, with a visible capability label and disabled Send. Historical provider success is never used as a capability flag.
- An adjacent disclosure states that selected demo references accompany Send; no extra consent checkbox is required. Automatic data context remains value-free. Reference text is untrusted content; proposal validation, financial-value protection, Preview/Apply and Undo remain in place.
- PDF workers and dynamic chunks use release-relative paths and are included in the immutable v3 service-worker shell.

## Verification boundary and next gate

Unit tests and local build are valid local evidence only. Parser unit tests use browser/image/PDF mocks for controlled failure cases. The new Playwright suite uses actual synthetic file parsing but controlled provider responses; it deliberately does not claim live provider comprehension.

The current execution environment could not launch Chromium (`socket() Operation not permitted`, including the reviewed escalation path). The supported cloud browser refused the local test URL with `ERR_BLOCKED_BY_CLIENT`. Those routes were stopped without weakening browser security. Normal GitHub PR CI is the intended three-browser acceptance route after review and separate publication authorization.

New CI coverage: catalogue and currency/save; all 15 templates plus 64-line pagination and standalone A4 output; actual synthetic two-page PDF parsing and text-only sharing through the existing proposal flow; image metadata denial/acceptance; corrupt, scanned and over-page-limit inputs; composer drop/remove; retained-data seed migration. Run `npx playwright test e2e/studio-v3-boss-demo.spec.js` for the catalogue/reference/A5 cases across Chromium, Firefox and WebKit. The selected-label regression is in `e2e/studio-v3-element-tags.spec.js`. Test discovery counts are recorded separately; they are not execution evidence.

Still open: exact-head full browser CI, screenshots/printed-page visual review, real current GPTDemo reference comprehension, full raster/scanned-PDF support, actual image-capable model metadata and the boss presentation date. No publication, merge or deployment has been performed by this preparation task.

### Local evidence snapshot

Initial d49b5b8 checkpoint source checks on 2026-10-02:
- `npm run build:site`: **126 test files, 825 tests passed**, then all site bundles and the 15-file immutable v3 shell built successfully.
- `npm run check` and `npm run check:agrun`: passed.
- All three existing v2 sample protocol/attestation validations passed (sales invoice, purchase order, progress claim). Their validators explicitly do not certify browser layout.
- Built PDF runtime uses a worker URL relative to `import.meta.url`; the matching worker exists under the release `chunks/` directory and in the service-worker shell manifest.
- `git diff --check`: passed; all v3 JavaScript files remain at most 300 lines.
- `npx playwright test e2e/studio-v3-boss-demo.spec.js --list`: discovers all 21 planned browser executions. Listing is not execution; no new browser pass is claimed.

These results cover local preparation. Review, authorized PR publication, exact-head CI, live provider and visual output acceptance remain separate gates.

### Selected-label and sharing follow-up

Public baseline testing found that ordinary selected-label wording could produce an out-of-scope proposal; its system example used a parent field ID. The follow-up corrects the example and adds scope-specific semantic target/patch hints. It does not normalize arbitrary targets or change authorization guards. Unit tests cover plain user wording plus exact selected context, parent/sibling/value-edit rejection and explicit multi-reference scope. A controlled-provider browser case verifies the full label-only Preview/Apply/Undo route. Real-model first-attempt behavior still requires a new live check.

Reference review uses the normal Send action and an adjacent disclosure, without another consent checkbox. Negative tests verify that instructions embedded in a PDF cannot grant tool scope, change financial data or cause existing private values to enter the request. Hosted browser coverage now saves the PDF-authored result, captures and parses the actual download, reopens it through the file chooser and re-saves it to compare data, bindings, layout and currency. A save toast alone is not evidence.

Business templates keep the A4 default. An explicitly chosen Compact A5 invoice preset retains every original field, all 45 supplied rows and amounts, 9pt body text, a first-page company header and repeating table headings. Tests require at most six pages, at least two rows on page one, full content/amount preservation and standalone output; actual page count and visual acceptance remain pending CI. No existing user design is changed automatically. Physical printing remains untested.

### Visual PDF acceptance remains OPEN

Full raster/scanned-PDF support is implemented as an optional best-effort local preview candidate, not accepted or enabled for AI sending. The default text-only fallback remains usable when visual processing fails. Reputable PDF.js public APIs do not expose a reliable pre-decode aggregate image inspection pass; per-image limits, canvas limits and cancellation cannot guarantee a hard total memory ceiling. The previous page-point-area accounting is removed from standalone decoded-image pixel budgets. Real JPEG/PNG-style Flate images, scanned pages, multiple images/soft masks, per-image rejection and cancel/retry need the new three-browser CI gates. Model capability and real visual comprehension remain separate open gates. No renderer/backend/dependency replacement was made.

For a future stronger hard-memory design, an audited maintained worker budget would need inline/XObject/masks/JPX/Form/Type3 coverage. A WASM wrapper alone is not a guarantee: the read-only @hyzyla/pdfium investigation found a 2 GiB heap ceiling and runtime memory override rejection, plus a destroy method that waits for RPC before termination. Fixed lower-memory builds, binary imports/memory and licenses would need review before adopting such a renderer.

Gateway metadata field hierarchy remains unverified. The production capability decoder remains disabled until a field hierarchy is verified. Bounded normal discovery diagnostics show actual public boolean/modality facts without secrets; they do not grant image eligibility. A test-injected capability reader exercises the Responses wire contract only. Missing or unverified metadata stays disabled; historical multimodal documentation and model names never enable image requests. Wire limits now cap at four image parts, a conservative base64-length ceiling corresponding to four MiB per image, eight MiB total serialized media and twelve MiB request body (client restrictions can be stricter than the server).

### Frozen candidate 67b695f evidence

`npm run build:site` passed 129 files / 835 tests and produced the complete site. Independent read-only delta review passed 48 focused checks, confirmed that the misleading aggregate-PDF pixel guarantee was removed and the production image capability gate remains closed. A follow-up ensures unsupported PDF text resources fail before either mode can return an attachment. All browser, visual quality, live model and physical printing gates remain open; test discovery is not browser execution.
