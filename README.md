# PrintForm.js

[English](./README.md) | [简体中文](./README.zh-CN.md)

**PrintForm.js** is a lightweight (zero-dependency Vanilla JS) browser-side pagination script.

Its core function is: **automatically splitting a long HTML container (`.printform`) into multiple pages that fit the print paper size**. It handles headers, footers, repeated table headers, page number updates, and dummy row filling automatically.

## 📚 Documentation Navigator

### 🚀 Getting Started

| I want to... | Read this |
|--------------|-----------|
| **Understand the project** | [Project Overview](PROJECT_OVERVIEW.md) - Architecture, concepts, tech stack |
| **Start using in 5 minutes** | [Quick Start Guide](QUICK_START.md) - Step-by-step tutorial |
| **Use it correctly (full guide)** | [Usage Guide](docs/USAGE_GUIDE.md) - Structure, API, PTAC/PADDT, pitfalls |
| **See all configuration options** | [Configuration Reference](docs/CONFIGURATION.md) - All `data-*` attributes |

### 🎨 PrintForm Studio

Studio v2 is a Production Pilot for ERP engineers. It builds inspectable, self-contained print-form HTML; it is not a no-code freeform canvas.

| I want to... | Read this |
|--------------|-----------|
| **Design, bind and validate an ERP form** | Open [Studio v3](studio-v3/) — structured three-workspace Pilot ([scope and limits](docs/STUDIO_V3.md)) |
| **Build a Pilot single-HTML form** | Open [studio-v2/index.html](studio-v2/index.html) — protocol-based, offline, WebMCP-ready |
| **Understand v2 status and roadmap** | [Studio v2 documentation index](docs/STUDIO_V2_INDEX.zh-CN.md) (authoritative Chinese) |
| **Review architecture and task status** | [GOAL.md](GOAL.md) · [DESIGN.md](DESIGN.md) · [SPEC.md](SPEC.md) · [EPIC.md](EPIC.md) · [ROADMAP.md](ROADMAP.md) · [TASK.md](TASK.md) · [PROGRESS.md](PROGRESS.md) · [GOAL_PROMPT.md](GOAL_PROMPT.md) |
| **Understand the v2 single-HTML contract** | [Studio v2 Protocol](docs/PRINTFORM_V2_PROTOCOL.zh-CN.md) (Chinese) |
| **Connect Codex or Claude Code** | [Agent setup](studio-v2/AGENT_SETUP.md) |
| **Maintain the legacy v1 Studio** | [Studio v1 Design Doc](docs/STUDIO_DESIGN.zh-CN.md) (Chinese) |
| **Bind a template to real data / connect an ERP backend** | [ERP Integration Guide](docs/ERP_INTEGRATION.zh-CN.md) - `{{ }}` placeholders, `PrintFormTemplate.render(data)`, ColdFusion example (Chinese) |

Studio v2 is the intended production path and remains **Production Pilot**. It exports a self-contained HTML with declarative bindings, embedded runtimes and validation records. Versions: runtime 1.0.0 / Studio 0.11.0 / Protocol 2.0.0 / Agent Contract 4.0.0. E14's four-layer panel, change cards, mode controls, history and resizable rail exist; the current worktree includes shared scope/apply/data-policy enforcement and closed Agent projections, while composed release acceptance remains incomplete. See the [production plan](docs/STUDIO_V2_PRODUCTION_PLAN.md) for current evidence, pending requirements and proposed layout. Production Ready has not been declared. Studio v1 remains frozen and independent.

### 💻 Development

| I want to... | Read this |
|--------------|-----------|
| **Understand the code structure** | [Code Structure](CODE_STRUCTURE.md) - File organization, data flow |
| **Develop and extend** | [Developer Handbook](DEVELOPER_BOOK.md) - Development guide |
| **Learn about auto-docs** | [Auto Documentation Guide](docs/AUTO_DOC_GENERATION_GUIDE.md) - How docs are generated |

### 🔧 Reference

| Document | Description |
|----------|-------------|
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Auto-generated config reference (Markdown) |
| [configuration.html](docs/configuration.html) | Auto-generated config reference (HTML, view in browser) |
| [config-reference.json](docs/config-reference.json) | Auto-generated config reference (JSON, for tools) |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes, most recent first |
| [Compatibility matrix](docs/COMPATIBILITY_MATRIX.zh-CN.md) | The four independent version lines and how they combine (Chinese) |
| [LICENSE](LICENSE) | MIT |

---

## Logic Diagram

To help understand how `printform.js` works, please refer to the flowchart below:
See: `docs/LOGIC_DIAGRAM.md`.
Link: [Link to the flowchart image](https://yapweijun1996.github.io/Mermaid-Share-Lite/#pako:eNp1Vl1v2zoM_SuEH4YMXZO12NMe7kXXrGiBNgvS7uHCGQrVUhJvtmRY8rIu6H-_JCV7Uub6IdHH4SF1SNE-ZIWRKvuYbSqzL3aidfAwX2vAx3ZP21Y0O1iJ_eONbjoHOQ7h-uHuFnj-zQPpwY1Lo50otWrzdTZt2lK7jWlrGJbXWYS_VkIG5I6HMPFLbxPY3BQ3emMYJ01R4hhmMIzfvz-fTqcwQVhXK-2AwCnDyuwjX63Z9-4exFOlYMwpmtw4VdveosQJ-hBO0JaFs-l0kVosnSgYjf_IrNrawlK0gvWzR1ghpWMwDWByIWXpSqNF9arJlTEuHGDDQ9bAD3sJPnUWRbY2gEcZbs3WRCyPFc5h4veANseMlmKrdFfHdo1fGkwJAouufoqVVFqu9VElLVtTYIyl3kK-pAq5wgqZfrfkvCwi1_cOK3HCv0AY4RwavYXT03_g869GaHmvtrkfAcs-C3oiqQFMGli1pZKwEetgyTyXpqpU4fLwD_f4g3mw8IbTHNn1CLK6U8J2rcrDf2-FhVRud4m3HuF91Xhf1K14Nh155FmwmbF8b4LcdHSnEueRKZPd6NKRTX7ZKsR68bh8kOcsMu2BbHVrTEPnOtwZDKrGK0ky2X9f-izR04PQAv5T1se-U8WP-0YU6oBbsCmdBdMCXu5CSXjCGH4QyRDvACeSK0ITy0XTYEUgQe5HnCO6WVG8AyYJOI4vJf9EvmdffqqWuhcbXZVVtVJ0Orry866un_mYcAKWzNq4vmOsD1LKlWpQ1HDj-lB5jarWX4A4y0cmTLNQe87POgsZ0moPVcgSXR6YLE6_NlDwruXtZvdseX-PN6VBIkHrSiqZXsrAnYYbOlwSLubGt7pZaJazofmNhe8pXhU-Lox1tjDUc7XC0ILq2L7K3-oOtcxJVoyh1_UEhA9rQ6ARBWNjZuMOyZk-XKMKy4v5_GGo1aSNMohCwoDI8msj8eCkD3aj3M-84Jq7EzjjRGW_vUbTlzyJHPKR-yaUpIgZsf59aEfJ6UHEs1IkQd_x_Sw6D0yMrp6B2_BJEudmrIlHbInqnr-fBX5iG1P5j3ki1h9gspz48e0qckQB_933UnjPUNpdKJlX3w5fOoed7nGlbFe58IIIi3HGgsBnqOggtm99-DL9kEoWWiNh0y45hjo_Rp37e3r0_g4-F3_5X4y9--IPI9aC68nveVl4NTn7Wmfvshq_IkQps4-HzO1UTd9oUm0EbmcvL_8DWI8ieQ)

---

## Quick Start (Short)

### 1. Start Server
You need a static server to preview the effect (to avoid browser local file restrictions).

```bash
# Option A: Python (Recommended)
python3 -m http.server 8000

# Option B: Node/Vite
npm install
npm run dev
```

### 2. Preview
Open in browser:
- `http://localhost:8000/index.html` (Full demo)
- `http://localhost:8000/index001.html` (Basic structure)

---

## How to Use (Essentials)

PrintForm does not require complex build tools, just follow a specific **HTML structure convention**.

### Mobile (iOS/Android) Rendering Notes

Some mobile browsers can auto-adjust font sizes and/or allow user scaling which may change layout measurements and break the expected print-like pagination. For consistent rendering, set these on your HTML page:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<style>
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
</style>
```

If you need to keep pinch-zoom for accessibility, remove `maximum-scale=1, user-scalable=no` and keep `text-size-adjust`.

### 1. Basic Structure
Create a `div` with `class="printform"` and configure the paper size.

```html
<!-- Container: Define paper size (e.g. A4 width 750px height 1050px) -->
<div class="printform"
     data-papersize-width="750"
     data-papersize-height="1050">

    <!-- 1. Header (Repeated at top of every page) -->
    <div class="pheader">...</div>

    <!-- 2. Doc Info (Repeats by default; configurable) -->
    <div class="pdocinfo">...</div>

    <!-- 3. Table Header (Column titles, repeated on new pages) -->
    <div class="prowheader">...</div>

    <!-- 4. Data Rows (Core content, split automatically) -->
    <div class="prowitem">Row 1</div>
    <div class="prowitem">Row 2</div>
    <div class="prowitem">Row 3...</div>

    <!-- 5. Footer (Defaults to last page; configurable) -->
    <div class="pfooter">...</div>

</div>

<!-- Include script -->
<script src="./dist/printform.js"></script>
```

### 2. Key Classes
Note: Do not rely on `data-*` attributes for styling. During formatting, the engine replaces section class names (e.g. `.pheader` → `.pheader_processed`). If you style by class, mirror rules for both original and `_processed` class names.

| Class | Description | Default Behavior |
| :--- | :--- | :--- |
| `.printform` | **Root Container** | The script only processes content inside this container. |
| `.pheader` | **Header** | Repeats on **every page**. |
| `.pdocinfo` | **Doc Info** | Document metadata (e.g. invoice details), repeats on **every page** (configurable). |
| `.prowheader` | **Table Header** | Table column headers, repeats on **every page**. |
| `.prowitem` | **Data Row** | The **smallest unit** for splitting. The script will not split content inside a single `.prowitem`, but decides pagination row by row. |
| `.pfooter` | **Footer** | Defaults to **last page only** (can be configured to repeat). |
| `.ptac` | **Terms/Text** | For legal terms or long text, automatically splits by paragraph. |
| `.paddt` | **Audit/Addendum** | PADDT rows rendered after main pages. |

---

## Configuration (Short)

You can use `data-*` attributes directly on the `.printform` element to control behavior.
For the full list, see [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

### Common Configs

| Attribute | Example | Description |
| :--- | :--- | :--- |
| `data-papersize-width` | `750` | Paper width (px). |
| `data-papersize-height` | `1050` | Paper height budget (px); page container height is intentionally not forced so debug can show actual content height (final fill spacer may be sub-pixel). |
| `data-paper-size` | `A4` | Preset paper size (A4/A5/LETTER/LEGAL). Used when width/height not set. |
| `data-dpi` | `96` | DPI used to convert `data-paper-size` to pixels. |
| `data-orientation` | `portrait` / `landscape` | Paper orientation. |
| `data-repeat-header` | `y` / `n` | Repeat header on every page (Default `y`). |
| `data-repeat-footer` | `y` / `n` | Repeat footer on every page (Default `n`). |
| `data-show-logical-page-number`| `y` / `n` | Show page numbers (e.g. "Page 1 of 3"). |
| `data-show-physical-page-number`| `y` / `n` | Show physical page numbers (for N-up). |
| `data-n-up` | `1` / `2` | **N-Up Printing**: Multiple logical pages per physical sheet. |

### Row / Footer Controls

| Attribute | Example | Description |
| :--- | :--- | :--- |
| `data-height-of-dummy-row-item` | `26` | Height for each dummy row item used to fill remaining space. |
| `data-repeat-docinfo` | `y` / `n` | Repeat `.pdocinfo` on every page. |
| `data-repeat-docinfo002` | `y` / `n` | Repeat `.pdocinfo002` on every page. |
| `data-repeat-docinfo003` | `y` / `n` | Repeat `.pdocinfo003` on every page. |
| `data-repeat-docinfo004` | `y` / `n` | Repeat `.pdocinfo004` on every page. |
| `data-repeat-docinfo005` | `y` / `n` | Repeat `.pdocinfo005` on every page. |
| `data-repeat-rowheader` | `y` / `n` | Repeat `.prowheader` on every page. |
| `data-repeat-ptac-rowheader` | `y` / `n` | Repeat `.prowheader` on PTAC-only pages. |
| `data-repeat-footer` | `y` / `n` | Repeat `.pfooter` on every page (final page always includes all footers). |
| `data-repeat-footer002` | `y` / `n` | Repeat `.pfooter002` on every page. |
| `data-repeat-footer003` | `y` / `n` | Repeat `.pfooter003` on every page. |
| `data-repeat-footer004` | `y` / `n` | Repeat `.pfooter004` on every page. |
| `data-repeat-footer005` | `y` / `n` | Repeat `.pfooter005` on every page. |
| `data-repeat-footer-logo` | `y` / `n` | Repeat `.pfooter_logo` on every page. |
| `data-repeat-footer-pagenum` | `y` / `n` | Repeat `.pfooter_pagenum` on every page. |
| `data-insert-dummy-row-item-while-format-table` | `y` / `n` | Insert repeated dummy row items to fill height. |
| `data-insert-ptac-dummy-row-items` | `y` / `n` | Insert dummy row items on PTAC pages. |
| `data-insert-dummy-row-while-format-table` | `y` / `n` | Insert a single dummy row block to fill remaining space. |
| `data-insert-footer-spacer-while-format-table` | `y` / `n` | Insert a footer spacer to push footers down. |
| `data-insert-footer-spacer-with-dummy-row-item-while-format-table` | `y` / `n` | Use dummy row items as the footer spacer. |
| `data-custom-dummy-row-item-content` | HTML | Custom dummy row item markup (or use `<template class="custom-dummy-row-item-content">`). |
| `data-custom-dummy-spacer-content` | HTML | Custom dummy spacer markup (or use `<template class="custom-dummy-spacer-content">`). |
| `data-div-page-break-before-class-append` | `pagebreak_bf_processed` | Append extra class(es) (space-separated) onto generated `div_page_break_before` nodes (legacy HTML-to-PDF support). |

### PADDT Controls

| Attribute | Example | Description |
| :--- | :--- | :--- |
| `data-repeat-paddt` | `y` / `n` | Reserved toggle for PADDT repeat behavior (currently unused). |
| `data-repeat-paddt-rowheader` | `y` / `n` | Repeat `.prowheader` on PADDT pages. |
| `data-insert-paddt-dummy-row-items` | `y` / `n` | Insert dummy row items on PADDT pages. |
| `data-paddt-max-words-per-segment` | `180` | Max words per PADDT segment when splitting paragraphs. |
| `data-paddt-debug` | `y` / `n` | Enable PADDT debug logs. |
| `data-repeat-paddt-docinfo` | `y` / `n` | Repeat `.pdocinfo` on PADDT pages only. |
| `data-repeat-paddt-docinfo002` | `y` / `n` | Repeat `.pdocinfo002` on PADDT pages only. |
| `data-repeat-paddt-docinfo003` | `y` / `n` | Repeat `.pdocinfo003` on PADDT pages only. |
| `data-repeat-paddt-docinfo004` | `y` / `n` | Repeat `.pdocinfo004` on PADDT pages only. |
| `data-repeat-paddt-docinfo005` | `y` / `n` | Repeat `.pdocinfo005` on PADDT pages only. |

### Example
```html
<div class="printform"
     data-papersize-width="800"
     data-papersize-height="1100"
     data-repeat-footer="y"
     data-show-logical-page-number="y">
     ...
</div>
```

---

## Advanced Features

### 1. Dummy Rows (Filling Empty Space)
If a page is not full, PrintForm automatically inserts empty rows to push the footer to the bottom.
- You can customize the dummy row style:
```html
<template class="custom-dummy-row-item-content">
  <tr style="height:20px;"><td style="border:0;">...</td></tr>
</template>
```
- You can customize the page-height spacer (single root element; height is auto-filled):
```html
<template class="custom-dummy-spacer-content">
  <table style="width:100%; table-layout:fixed;" cellpadding="0" cellspacing="0">
    <tr><td style="border-top:1px solid #000;"></td></tr>
  </table>
</template>
```

### 2. Force Page Break
Add `tb_page_break_before` to the row to start a new page before it.

```html
<div class="prowitem tb_page_break_before">...</div>
```

### 3. Hide Row Header On A Specific Page
If you need a page to start without the repeating `.prowheader`, add `without_prowheader` (or `tb_without_rowheader`) on the row that starts that page.

```html
<table class="prowitem tb_page_break_before without_prowheader">...</table>
```

### 4. JS API
The script runs automatically on load. If you generate content dynamically (e.g. AJAX), trigger formatting manually:

```javascript
// Format all .printform elements
await PrintForm.formatAll({ force: true });

// Or format a specific node
const myForm = document.querySelector('#invoice-1');
PrintForm.format(myForm);
```

Notes:
- `formatAll` is async and only runs once unless `force: true` is supplied.
- The formatter removes the original `.printform` node and inserts a processed container in its place.

### 5. Build for Production
If you modify the source (`src/` directory), rebuild:

```bash
npm run build
```
Output is in `dist/printform.js` (and root `*.html` + `README.md`/`README.zh-CN.md` are copied to `dist/` for `npm run preview`).
## FAQ

**Q: Why is my content cut off?**
A: Check if a single `.prowitem` height exceeds `data-papersize-height` minus header/footer space. If one row is too tall, it won't fit on any page.

**Q: How to hide the header on the first page?**
A: The logic prefers consistency. For special cases, hide the header via CSS using a wrapper selector or split the DOM before formatting.

**Q: Margins are wrong when printing?**
A: Physical margins are controlled by the browser and printer driver. In the print dialog, enable "Background graphics" and set margins to "None" or "Minimum" (PDF viewers at non-100% zoom may show 1px jitter; pin footers via `@media print` absolute positioning if you need visual lock).

## Directory Structure

- `src/printform.js` - Entry point
- `src/printform/formatter/` - **Core Logic** (Pagination calculation)
- `src/printform/config.js` - Configuration definitions
- `src/printform/dom.js` - DOM helpers
- `index.html` - Full test case
