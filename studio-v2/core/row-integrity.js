const issue = (code, message) => ({code,message,path:'/',severity:'error'});
const summarize = values => values.slice(0,20).join(', ') + (values.length > 20 ? ` (+${values.length-20} more)` : '');

const fragmentAttributes = ['data-pf-fragment-index', 'data-pf-fragment-count'];
const integer = raw => /^(0|[1-9]\d*)$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : NaN;
const semanticAncestor = node => node.closest('.printform_formatter_processed, .printform_formatter') || node.ownerDocument.body;

// Source identities are opaque, document-wide tokens, not array indices.
// Validate every occurrence before collapsing: a second copy of a complete
// set must remain visible to the ordinary duplicate/count/order checks.
function semanticRowsOf(nodes, errors) {
  const sources = new Map(), fragmented = new Set();
  nodes.forEach((node, position) => {
    const marked = fragmentAttributes.some(attribute => node.hasAttribute(attribute));
    if (marked) fragmented.add(node);
    const source = node.getAttribute('data-pf-source-row');
    if (source) {
      if (!sources.has(source)) sources.set(source, []);
      sources.get(source).push({node, position});
    } else if (marked) {
      errors.push(issue('ROW_IDENTITY_MISMATCH', 'Row continuation has no source identity'));
    }
  });
  const collapsed = new Set();
  for (const entries of sources.values()) {
    if (!entries.some(({node}) => fragmented.has(node))) continue;
    const first = entries[0].node;
    const count = integer(first.getAttribute('data-pf-fragment-count'));
    const index = first.getAttribute('data-pf-row-index');
    const repeat = first.getAttribute('data-pf-row-repeat');
    const table = first.getAttribute('data-pf-table-id');
    const legacyTable = first.getAttribute('data-pf-table');
    const ancestor = semanticAncestor(first);
    const identityValid = (index === null || Number.isSafeInteger(integer(index))) &&
      count >= 1 && entries.length === count && entries.every(({node}) =>
        fragmented.has(node) &&
        node.getAttribute('data-pf-row-index') === index &&
        node.getAttribute('data-pf-row-repeat') === repeat &&
        node.getAttribute('data-pf-table-id') === table &&
        node.getAttribute('data-pf-table') === legacyTable &&
        semanticAncestor(node) === ancestor &&
        integer(node.getAttribute('data-pf-fragment-count')) === count &&
        Number.isSafeInteger(integer(node.getAttribute('data-pf-fragment-index'))));
    if (!identityValid) {
      errors.push(issue('ROW_IDENTITY_MISMATCH', 'Row continuation has incomplete or inconsistent source, repeat, index or fragment identity'));
      continue;
    }
    const ordered = entries.every(({node, position}, i) =>
      position === entries[0].position + i && integer(node.getAttribute('data-pf-fragment-index')) === i);
    if (!ordered) {
      errors.push(issue('ROW_ORDER_MISMATCH', 'Row continuation fragments are not contiguous and in source order'));
      continue;
    }
    entries.slice(1).forEach(({node}) => collapsed.add(node));
  }
  return nodes.filter(node => !collapsed.has(node));
}

function inspectSequence(nodes, expected, label, errors) {
  const occurrences = new Map();
  const sequence = nodes.filter(node => node.hasAttribute('data-pf-row-index')).map(node => {
    const raw = node.getAttribute('data-pf-row-index');
    const index = /^(0|[1-9]\d*)$/.test(raw) ? Number(raw) : NaN;
    occurrences.set(index,(occurrences.get(index) || 0)+1);
    return index;
  });
  if (!sequence.length) return;
  const duplicates = [...occurrences].filter(([,count]) => count > 1).map(([index]) => index);
  if (duplicates.length) errors.push(issue('ROW_DUPLICATE_INDEX', `${label} row index ${summarize(duplicates)} rendered more than once`));
  if (Number.isFinite(expected)) {
    const missing = [];
    for (let index=0; index<expected; index++) if (!occurrences.has(index)) missing.push(index);
    if (missing.length) errors.push(issue('ROW_MISSING_INDEX', `${label} row index ${summarize(missing)} never rendered`));
  }
  if (sequence.some((index,i) => !Number.isInteger(index) || index < 0 || (i > 0 && index <= sequence[i-1]))) {
    errors.push(issue('ROW_ORDER_MISMATCH', `${label} rendered rows are not in the same order as the source data`));
  }
}

export function analyzeRowIntegrity(rowNodes, options = {}) {
  const errors = [], expected = options.expectedRowCount;
  const physicalRows = Array.from(rowNodes);
  rowNodes = semanticRowsOf(physicalRows, errors);
  if (Number.isFinite(expected) && rowNodes.length !== expected) {
    errors.push(issue('ROW_COUNT_MISMATCH', `Rendered ${rowNodes.length} item row(s) but data binding produced ${expected}; pagination may have dropped or duplicated a row`));
  }
  const expectedGroups = options.expectedRowsByRepeat;
  if (expectedGroups) {
    const groups = new Map();
    for (const node of rowNodes) {
      const key = node.getAttribute('data-pf-row-repeat');
      if (!Object.prototype.hasOwnProperty.call(expectedGroups,key) || !node.hasAttribute('data-pf-row-index')) {
        errors.push(issue('ROW_IDENTITY_MISMATCH','Rendered row has missing or unknown repeat identity'));
        continue;
      }
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(node);
    }
    for (const [key,count] of Object.entries(expectedGroups)) {
      const nodes = groups.get(key) || [];
      if (nodes.length !== count) errors.push(issue('ROW_COUNT_MISMATCH', `Repeat ${key} rendered ${nodes.length} row(s), expected ${count}`));
      inspectSequence(nodes,count,`Repeat ${key}`,errors);
    }
  } else if (rowNodes.some(node => node.hasAttribute('data-pf-row-repeat'))) {
    const groups = new Map();
    for (const node of rowNodes) {
      const key = node.getAttribute('data-pf-row-repeat');
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(node);
    }
    for (const [key,nodes] of groups) inspectSequence(nodes,undefined,`Repeat ${key}`,errors);
  } else {
    // Older index-only exports retain their original single-repeat acceptance.
    inspectSequence(rowNodes,expected,'',errors);
  }
  return {
    errors,
    semanticRows: rowNodes,
    renderedRows: rowNodes.length,
    renderedRowFragments: physicalRows.length
  };
}

// Preserve the existing error-array API for acceptance consumers.
export function inspectRowIntegrity(rowNodes, options = {}) {
  return analyzeRowIntegrity(rowNodes, options).errors;
}
