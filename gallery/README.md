# PrintForm Gallery

Designs are standalone HTML files listed in `manifest.json`; each entry names one page-1 thumbnail. After building the local engine, run `node scripts/build-gallery-thumbs.mjs` to render all designs offline, regenerate PNGs, and refresh measured page counts and image dimensions in the manifest.

PF-057 adds a two-page A4 **DemoBank Bilingual Financing Placemat** in Finance, English then Malay. It uses original vector artwork, shared fictional data and integer basis-point rebate calculations. Every page states SAMPLE and NOT A FINANCIAL OFFER. Run `node scripts/verify-pf057.mjs` after building for the offline HTML, PDF, screenshots and machine-readable checks in `../output/pf057`. See [PF-057](../docs/PF057_PLACEMAT.md) for reproduction and print limits.

PF-058–063 add six fictional **school invoices** in Sales: modern blue, nature preschool, monochrome statement, coral enrichment, navy/gold premium and plum/rose bilingual. Each has native A4/A5 and Single-page/Multi-page controls, shared integer-cent data, original SVG art, final-only demo payment/totals and a sample warning on every page. PF-063 embeds licensed static CJK fonts. Run `node scripts/verify-school-invoices.mjs` after building with a local server on port 4185 for all 24 PDF cases, six offline HTMLs and actual PDF raster proofs; then `node scripts/package-school-invoices.mjs` for ZIPs/contact sheets. See [implementation](../docs/SCHOOL_INVOICES.md) and [verification](../docs/SCHOOL_INVOICES_VERIFICATION.md).

## PWA

The installable app is scoped to `/printform-js/gallery/`; it uses relative URLs and does not control other site pages. After the first online load, the gallery grid, search and filters, design preview iframes, Open design, and Print work offline. Thumbnails viewed before going offline are available from a bounded cache; never-viewed thumbnails show the browser placeholder with their alt text. The first successful precache reports “Ready to work offline”.

Updates are announced in a banner and only activate after selecting **Update now**; close an open preview first, then the page reloads once. The footer shows the loaded build and a real **Check for updates** action. Builds pin their resources to immutable release URLs; installation validates build identity and every asset hash. To test a version bump, build with a different `GITHUB_SHA` and serve the generated `site-dist/` over localhost. See [preview/release contract and tests](PWA.md) for scrolling, accessibility, multi-tab, offline and retention details.

## Business categories and filters

Seven business categories live in `js/categories.js`, keyed by stable English IDs and PF numbers, independently of the generated manifest. Current coverage is Sales (18), Purchasing (6), Inventory & logistics (10), Finance (12), Retail & e-commerce (8), Customer management (5), and HR & administration (4). PF-010 Service Work Order belongs to HR & administration (administrative services). When adding a design, add its number to exactly one category and run the coverage test; never edit the thumbnail generator's manifest contract for categorization.

Category counts show catalogue totals, while the result counter shows matching/total designs. Search matches both languages, PF number, name, style and tags. Category, exact document type, paper and search combine; selecting another category resets an incompatible type. Clear filters resets all four values. Keyboard-native selects and persistent category buttons preserve focus during filtering.

The catalogue defaults to newest-first by descending numeric PF number, the explicit addition-order convention because the manifest has no creation dates. Filtering, reset, locale and history retain this order without mutating the manifest.

Share a filtered view using `?category=sales&type=Quotation&paper=A4&q=green`. Unknown category/type/paper values are reset safely. Back/Forward restores filters; typing is grouped into one history entry per search focus session. Loading, invalid-manifest and request-error states are distinct from an empty result, with a retry button. New gallery modules must also be listed in `scripts/gallery-pwa-build.mjs` for offline use.

PF-053 adds a green A4 SANYO Singapore sales quotation design sample with entirely fictional transaction/contact details. Its five-item default is one measured print page; `?overflow=1` is a bounded 35-item pagination QA fixture.

PF-054 adds a separate navy-blue, five-page A4 variant with fictional supply lines and automatic PrintForm pagination. The original PF-053 green design remains unchanged. Build the engine, then run `node scripts/export-sanyo-blue-quotation.mjs` to create a self-contained offline HTML copy; the total and acceptance area appears only on the last page.

PF-055 adds a rose/red-pink A4 **Corporate Insurance Proposal and Agreement** sample in Sales under the fictional Rose Assurance Studio brand. It is not an insurance policy or an endorsement. Its naturally measured 20-page stream alternates terms, three distinct schedules, continuous two-column terms, a signature and about five pages of post-signature appendix. Build the engine, then run `node scripts/export-pf055.mjs` for a standalone offline HTML in `../output`. See [mixed-flow semantics and limits](../docs/MIXED_FLOW.md); no pages are manually authored.

PF-056 adds a fictional **DemoBank Four-page Statement** in Finance: summary, two automatically paginated transaction pages and illustrative information. All four pages carry a banking-use prohibition. The 17 synthetic transactions reconcile in integer cents. No real bank identity or source font is included. Run `node scripts/export-demobank.mjs` after building for a standalone offline HTML. See [implementation and verification](../docs/DEMOBANK_STATEMENT.md) for assets, reproduction steps, measurement limits and test commands.
