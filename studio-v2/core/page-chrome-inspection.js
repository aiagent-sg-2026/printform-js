// Keep this inspector self-contained: Studio v2 also serves core modules
// directly, while the engine source tree is excluded from published assets.
const regionNames = new Set(["pheader_processed", "pdocinfo_processed",
  "pdocinfo002_processed", "pdocinfo003_processed", "pdocinfo004_processed", "pdocinfo005_processed"]);

// Each semantic header / docinfo variant may appear once per logical page.
// Table headings are handled separately by active-table diagnostics and may
// legitimately belong to several tables on the same page.
export function inspectPageChrome(pages) {
  const errors = [];
  pages.forEach((page, index) => {
    const counts = new Map();
    page.querySelectorAll('[class]').forEach(node => {
      for (const name of node.classList) {
        if (!regionNames.has(name)) continue;
        // An inner styled element is part of the same semantic region.
        if (node.parentElement?.closest(`.${name}`)) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });
    for (const [name, count] of counts) if (count > 1) errors.push({
      code: name === 'pheader_processed' ? 'HEADER_DUPLICATE' : 'DOCINFO_DUPLICATE',
      message: `Page ${index + 1} contains ${count} copies of ${name}; expected at most one semantic region`,
      path: `/render/page/${index + 1}`, severity: 'error',
      details: { pageIndex: index, page: index + 1, section: name, count, expected: 1 }
    });
  });
  return errors;
}
