# PF-067 — Lumen Learning Progress Portfolio

Fictional, teacher-authored A4 portrait learning records. Not an assessment,
ranking, diagnosis, automated ability judgment or institutional approval.
Every page carries `FICTIONAL LEARNING PORTFOLIO — DEMO ONLY`.

## Local authoring

- Approved `sample.json`, `schema.json`, `expected.json`, `scenarios.json`,
  `edges.json`, independent `oracle-generator.py`, and original `grove.svg` are
  copied without content changes from the approved Lumen transfer.
- `validate.mjs` validates the approved schema subset without coercion, followed
  by calendar, chronology, uniqueness, reference and attendance conservation
  checks. `model.mjs` derives counts and BigInt half-up ratios, never scores.
- `fixtures.mjs` changes the fictional sample scale only on scale selection;
  otherwise the bound source remains authoritative. Long comments affect one
  source reflection, not a hidden repeated decorative paragraph.
- `overview.mjs`, `domains.mjs`, `closing.mjs` build clean source DOM using the
  real PrintForm classes and cell continuation policies. Concise term cards may
  be paired; long source records switch to full-width measured continuation.
  Fonts are never shrunk to force a page count. Default currently measures nine
  pages, not a fixed nine-page layout.
- `controller.mjs` serializes selection changes, waits for fonts/images and calls
  actual `PrintForm.formatAll({force:true})`. Errors remove output and disable
  Print. No fabricated page containers, core modifications or PWA changes.
- Existing Gallery JSON binding convention: replace `#sample-data` before load,
  or update its text and dispatch a control change. Reset restores selectors;
  it does not silently replace invalid bound JSON with fabricated source.
  A one-term imported source cannot invent a missing second term. Correct or
  rebind a two-term source before choosing two terms.
- English/bilingual controls switch editorial labels only. All original English
  and Chinese source strings remain visible and printable in either presentation.

## Semantics

Observed records count once globally. A multi-domain record may cover multiple
configured domain×term cells; it is printed once under its first domain, with
references in other domains. Planned records are excluded. Teacher categories
are descriptive source labels; missing reflection is Not recorded, not Not
observed. Missing evidence does not imply ability zero.

Known attendance is Present/(Present+Absent); recording coverage is
(Present+Absent)/Scheduled. Unknown stays unknown. All-null is Not recorded;
zero denominator is Not applicable. No whole-portfolio attendance average.
All scalar source values are bound/escaped; `data-source-key` supports exact
per-field conservation through physical fragments. Repeated page chrome and
reference labels are intentionally distinct from unique record bodies.

## Build and verification

```sh
node scripts/build-lumen.mjs
node scripts/lumen-model-snapshots.mjs
python3 scripts/verify-lumen-model.py
# Owned local repo server on 4268, full Chromium executable in CHROMIUM_PATH:
node scripts/verify-lumen.mjs
node scripts/verify-lumen.mjs --standalone
node scripts/verify-lumen-pdf.mjs
python3 scripts/lumen-visuals.py
node scripts/verify-lumen-packaging.mjs
# Serve ../artifacts/lumen/site-after on owned port 4269:
node scripts/verify-lumen-pwa.mjs
```

Artifacts are outside the repository in `../artifacts/lumen/` and optional
self-contained HTML in `../artifacts/standalone/`. Gallery uses unchanged
`assets/fonts/aster-v1` files; standalone never enters Gallery/precache.
Build provenance records readable and embedded actual-source runtime hashes.
`verify-lumen-packaging.mjs` protects all 66 accepted entries and accepted files
except narrowly listed additive catalogue/tests and Atlas historical guard.
See `docs/ATLAS_HISTORICAL_AUDIT.md` for the distinct historical Atlas audit.

Browser/PDF/pixel evidence is local Chromium evidence, not a hardware printer,
Safari/Firefox or legal/institutional certification. Lumen awaits independent
review; see `../LUMEN_RESULT.md` in the task workspace for final results.
