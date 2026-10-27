# PrintForm Gallery

Designs are standalone HTML files listed in `manifest.json`; each entry names one page-1 thumbnail. After building the local engine, run `node scripts/build-gallery-thumbs.mjs` to render all designs offline, regenerate PNGs, and refresh measured page counts and image dimensions in the manifest.

## PWA

The installable app is scoped to `/printform-js/gallery/`; it uses relative URLs and does not control other site pages. After the first online load, the gallery grid, search and filters, design preview iframes, Open design, and Print work offline. Thumbnails viewed before going offline are available from a bounded cache; never-viewed thumbnails show the browser placeholder with their alt text. The first successful precache reports “Ready to work offline”.

Updates are announced in a banner and only activate after selecting **Update now**; the page then reloads once. To test a version bump, build with a different `GITHUB_SHA` and serve the generated `site-dist/` over localhost. The worker validates `build-info.json` before installing its cache, preserving the active version if validation fails.
