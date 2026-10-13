const issue = (code, message) => ({code,message,path:'/',severity:'error'});
const summarize = values => values.slice(0,20).join(', ') + (values.length > 20 ? ` (+${values.length-20} more)` : '');

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

export function inspectRowIntegrity(rowNodes, options) {
  const errors = [], expected = options.expectedRowCount;
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
  return errors;
}
