# PrintForm Gallery

Designs are standalone HTML files listed in `manifest.json`; each entry names one page-1 thumbnail. After building the local engine, run `node scripts/build-gallery-thumbs.mjs` to render all designs offline, regenerate PNGs, and refresh measured page counts and image dimensions in the manifest.

## PWA

The installable app is scoped to `/printform-js/gallery/`; it uses relative URLs and does not control other site pages. After the first online load, the gallery grid, search and filters, design preview iframes, Open design, and Print work offline. Thumbnails viewed before going offline are available from a bounded cache; never-viewed thumbnails show the browser placeholder with their alt text. The first successful precache reports “Ready to work offline”.

Updates are announced in a banner and only activate after selecting **Update now**; the page then reloads once. To test a version bump, build with a different `GITHUB_SHA` and serve the generated `site-dist/` over localhost. The worker validates `build-info.json` before installing its cache, preserving the active version if validation fails.

## Business categories and filters

Seven business categories live in `js/categories.js`, keyed by stable English IDs and PF numbers, independently of the generated manifest. Current coverage is Sales (9), Purchasing (6), Inventory & logistics (10), Finance (10), Retail & e-commerce (8), Customer management (5), and HR & administration (4). PF-010 Service Work Order belongs to HR & administration (administrative services). When adding a design, add its number to exactly one category and run the coverage test; never edit the thumbnail generator's manifest contract for categorization.

Category counts show catalogue totals, while the result counter shows matching/total designs. Search matches both languages, PF number, name, style and tags. Category, exact document type, paper and search combine; selecting another category resets an incompatible type. Clear filters resets all four values. Keyboard-native selects and persistent category buttons preserve focus during filtering.

Share a filtered view using `?category=sales&type=Quotation&paper=A4&q=green`. Unknown category/type/paper values are reset safely. Back/Forward restores filters; typing is grouped into one history entry per search focus session. Loading, invalid-manifest and request-error states are distinct from an empty result, with a retry button. New gallery modules must also be listed in `scripts/gallery-pwa-build.mjs` for offline use.
