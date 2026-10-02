# Studio v3 framework-native authoring contract

The version-1 `manifest.studioV3` design remains the source of truth. Existing
version-1 files without the optional properties below reopen with their original
bindings and appearance. `compileProject` validates a design and projects it to
canonical FormSpec, controlled HTML/CSS, and native PrintForm pagination
attributes. Preview and standalone export use the same projection and runtime.

## Authoring capabilities

| Subject | Declarative authoring surface | Native projection |
| --- | --- | --- |
| Field labels | `label`, `showLabel`, `labelStyle` | Escaped label span with semantic label target |
| Bound field values | `pointer`, `format`, `valueStyle`, `kind: "bound"` | `data-pf-text` and finite ERP number formatting |
| Static text | `kind: "static"`, `text`, empty `pointer` | Escaped literal content, no data lookup |
| Ordinary images | `kind: "image"`, `assetId`, `width`, `height`, `fit` | Embedded raster image in a non-table field |
| Header logo | `logo` referencing an existing asset | Embedded raster image in the header grid |
| Fields | Add, remove, or reorder a section's field array | Stable IDs independent of array position |
| Table columns | Add, remove, reorder, set `width` and styles | Matched native header and row table cells |
| Sections | `blocks[id].enabled`, `label`, `layout`, `sectionOrder` | Native fixed sections or ordered PTAC flow rows |
| Typography | Field label/value, `titleStyle`, `pageNumberStyle` | Validated typed CSS tokens only |
| Pagination | Repeating header/table header, page numbers, body breaks, keep-together | Native framework flags, rows, and diagnostics |
| Paper | `page.paper`, `orientation`, pixel `margins` | Framework paper presets and reserved content geometry |

Amounts, rates, quantities, taxes, rounding, and totals are supplied by the ERP.
Authoring never creates formulas, computes financial values, or changes sample
JSON values. Manual binding changes select the source value to display; they do not
change that value. AI numeric-bound fields cannot become static/image or receive
replacement text/format; existing financial-bound pointers are also protected.
Ordinary source bindings can be changed to a disclosed typed candidate path. Invalid or missing bound values block export until resolved.

## Stable targets

- Section IDs: `header`, `customer`, `items`, `totals`, `footer`
- Field value IDs: `${section}-${field.id}`
- Field label IDs: `label-${section}-${field.id}`
- Built-in element IDs: `header-title`, `header-logo`, `items-header`, `page-number`

Field IDs are lowercase letters, digits, and hyphens, one to sixty characters.
They are unique within their section and must not collide with a built-in ID.
Renaming a label or reordering an array does not change its semantic ID.
`selectionField` accepts both field and label targets and returns the underlying
field. `labelSelection` strips only the reserved `label-` prefix.

## Field properties

Every field has `id` and `label`. `format` is optional and defaults to plain
text; supported formats are `""`, `"number"`, `"currency"`, `"percent"`.

Optional properties:

- `kind`: `"bound"`, `"static"`, `"image"`; absent infers bound if `pointer` is nonempty
- `pointer`: `/absolute/document/path` or `./relative/item/path` inside the items table
- `lastPointer`: a retained manual binding draft, never rendered
- `text`: at most 10,000 literal characters
- `showLabel`: boolean, absent preserves the template's default
- `labelStyle` and `valueStyle`: independent style objects
- Table `width`: 1–100 percent; all column widths together must be at most 100 percent
- Image `assetId`, `width`, `height`, `fit`: existing asset reference, width 8–400px,
  height 8–200px, fit `"contain"` or `"cover"`

Bound fields require a nonempty pointer. Static text and image fields must not
have a binding. Images cannot have text or numeric formatting and are supported
in header/customer/totals/footer, not in repeated table columns. Each section
supports at most thirty fields or columns. Enabled tables need at least one
column. JSON pointers reject wildcards, malformed escapes, and prototype paths.

## Style tokens

`labelStyle`, `valueStyle`, `titleStyle`, and `pageNumberStyle` each accept only:

- `fontSize`: finite number from 6 to 72, in points
- `bold`: boolean
- `color`: six-digit `#RRGGBB`
- `align`: `"left"`, `"center"`, `"right"`

Omitted tokens inherit the controlled template theme. The document base `font`
retains its existing 6–14pt range. To change only a customer label to 12pt bold:

```json
{ "labelStyle": { "fontSize": 12, "bold": true } }
```

The value style and ERP data remain untouched.

## Sections and pagination

`sectionOrder`, when present, is an exact permutation of all five section IDs.
Disabled sections remain in that order but are not rendered. A repeating
header must be first; moving the header elsewhere requires `repeatHeader: false`.
Custom order uses the framework's native PTAC continuation rows rather than
absolute positioning, fixed row counts, or reordered preview-only DOM.

A non-table block can optionally declare `layout: { columns, gap }`: columns
are integers 1–4 and gap is 0–48px. Body blocks can declare boolean `breakBefore`.
`header.breakBefore` is unsupported. `keepTogether` is supported on non-table
blocks; the items collection always paginates per native row and cannot be kept
as one entire table. Repeating header copies are already indivisible and do not
carry split-detection annotations that would incorrectly flag repetition.

`repeatHeader`, `repeatTable`, `pageNumbers`, and the existing items
`breakBefore` remain backward-compatible boolean settings. One-time table
headings are preserved when using custom section order or a forced page break.
The renderer measures actual heights and reports oversized rows or overflow.

## Page geometry

`page` accepts `paper` (`"A4"`, `"A5"`, `"LETTER"`, `"LEGAL"`), `orientation`
(`"portrait"`, `"landscape"`), and optional `margins` with `top`, `right`,
`bottom`, `left` numbers from 0 to 72px. Missing values default to A4 portrait
and zero additional margins. Existing internal section padding is preserved.

Margins reserve the framework's usable logical page dimensions; the physical
wrapper supplies the declared outer whitespace. The print rule declares the
selected paper and orientation. Overflow validation uses the current design,
not a fixed A4 width. `validatePaperReport(report, projectOrDesign)` accepts the
current project or design; its legacy single-argument fallback remains A4.

## Embedded assets and trust

`assets` accepts at most ten `{ id, src, alt }` entries. `src` must be a matching
PNG/JPEG/GIF/WebP base64 data URL with a raster signature. Each image is limited
to 1 MiB. Total portable image content, including repeated template references,
is limited to a 4 MiB budget. `alt` is at most 200 characters. `logo` accepts only
`{ assetId, width, height, fit }`; omit or set null to keep the default brand mark.

No automatic remote image lookup, URL fetch, upload, SVG, raw HTML, arbitrary CSS,
JavaScript, `eval`, or formula execution is permitted. Unknown design, field,
style, section, page, or asset properties fail validation. FormSpec carries
asset metadata, with the bytes kept in the design rather than duplicated in
the registry. Save/reopen retains the design and supplied ERP values.
