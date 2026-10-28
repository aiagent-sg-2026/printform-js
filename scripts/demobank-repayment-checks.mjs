import assert from 'node:assert/strict';

const labels = ['Monthly instalment', 'Repayment Period', 'Total Interest Incurred', 'Total Amount to be settled'];
const money = text => {
  assert.match(text, /^RM\d{1,3}(?:,\d{3})*\.\d{2}$/, `Currency must be attached: ${text}`);
  return Number(text.replace(/RM|[,.]/g, ''));
};
const scenario = (text, i) => {
  const prefix = `Scenario ${String.fromCharCode(65 + i)} — `;
  assert.ok(text.startsWith(prefix), `Missing scenario header: ${text}`);
  return money(text.slice(prefix.length));
};
const reconcile = (headers, rows, data) => headers.map((header, i) => {
  const principal = scenario(header, i);
  const period = rows[1][i];
  assert.match(period, /^\d+ months$/);
  const months = Number(period.split(' ')[0]);
  const regular = money(rows[0][i * 2]), final = money(rows[0][i * 2 + 1]);
  const interest = money(rows[2][i]), total = money(rows[3][i]);
  // Independently derive from displayed values; do not call the production calculator.
  assert.equal(principal, data.repayment.principalMinor);
  assert.equal(months, data.repayment.months[i]);
  assert.equal(interest, Math.round(principal * data.repayment.annualBasisPoints * months / 120000));
  assert.equal(total, principal + interest);
  assert.equal(regular, Math.floor(total / months));
  assert.equal((months - 1) * regular + final, total);
  return {principal, months, regular, final, interest, total};
});

export async function inspectRepaymentDOM(page) {
  return page.locator('.printform_page .repayment').evaluateAll(tables => tables.map(table => ({
    rows: [...table.rows].map(row => [...row.cells].map(cell => ({
      text: cell.innerText.replace(/\s+/g, ' ').trim(), tag: cell.tagName,
      span: cell.colSpan, rowSpan: cell.rowSpan, scope: cell.getAttribute('scope')
    }))),
    headRows: table.tHead?.rows.length,
    groups: [...table.querySelectorAll('colgroup')].map(group => group.children.length)
  })));
}

export function assertRepaymentDOM(tables, data) {
  assert.equal(tables.length, 1, 'Exactly one rendered repayment table');
  const {rows, headRows, groups} = tables[0];
  assert.equal(headRows, 2, 'Scenario and regular/final column headers required');
  assert.deepEqual(groups, [1, 2, 2, 2], 'Three semantic column groups');
  assert.equal(rows.length, 6);
  assert.equal(rows[0][0].text, 'Principal / scenario');
  assert.equal(rows[0][0].rowSpan, 2);
  assert.equal(rows[0][0].tag, 'TH');
  assert.equal(rows[0][0].scope, 'col');
  assert.equal(rows[0].length, 4);
  rows[0].slice(1).forEach(cell => {
    assert.equal(cell.tag, 'TH'); assert.equal(cell.scope, 'colgroup'); assert.equal(cell.span, 2);
  });
  assert.deepEqual(rows[1].map(cell => cell.text), Array(3).fill(['Regular (n−1)', 'Final']).flat());
  rows[1].forEach(cell => {
    assert.equal(cell.tag, 'TH'); assert.equal(cell.scope, 'col'); assert.equal(cell.span, 1);
  });
  rows.slice(2).forEach((row, i) => {
    assert.equal(row[0].text, labels[i]); assert.equal(row[0].tag, 'TH'); assert.equal(row[0].scope, 'row');
    assert.equal(row.length, i === 0 ? 7 : 4);
    row.slice(1).forEach(cell => {
      assert.equal(cell.tag, 'TD'); assert.equal(cell.span, i === 0 ? 1 : 2);
    });
  });
  for (const row of rows) for (const cell of row) assert.ok(!/^(DEMO|RM)$/.test(cell.text), 'No filler cells');
  return reconcile(rows[0].slice(1).map(cell => cell.text), rows.slice(2).map(row => row.slice(1).map(cell => cell.text)), data);
}

export function assertRepaymentPDF(page, data) {
  const anchor = page.items.find(item => item.text === 'Principal / scenario');
  assert.ok(anchor, 'PDF must display the scenario header');
  // Chromium may emit kerning pairs as separate PDF runs ("T" + "otal ...").
  // Reassemble only the row-header column on one baseline, never arbitrary page text.
  const findLabel = label => {
    const column = page.items.filter(item => item.x >= anchor.x - 1 && item.x < anchor.x + 110);
    for (const candidate of column) {
      const parts = column.filter(item => Math.abs(item.y - candidate.y) < 1).sort((a, b) => a.x - b.x);
      const normalize = text => text.normalize('NFKC').replace(/\s+/g, '');
      if (normalize(parts.map(item => item.text).join('')) === normalize(label)) return { y: candidate.y, parts };
    }
    return null;
  };
  const end = findLabel(labels.at(-1));
  assert.ok(end, 'PDF repayment total row');
  const items = page.items.filter(item => item.y >= anchor.y - 15 && item.y <= end.y + 1);
  assert.ok(!items.some(item => /^(DEMO|RM)$/.test(item.text)), 'No PDF filler');
  const at = y => items.filter(item => Math.abs(item.y - y) < 1).sort((a, b) => a.x - b.x);
  const headers = items.filter(item => item.text.startsWith('Scenario ')).sort((a, b) => a.x - b.x);
  assert.equal(headers.length, 3, 'Three displayed PDF scenarios');
  const subheads = items.filter(item => /^(Regular \(n−1\)|Final)$/.test(item.text)).sort((a, b) => a.x - b.x);
  assert.deepEqual(subheads.map(item => item.text), Array(3).fill(['Regular (n−1)', 'Final']).flat());
  const rows = labels.map((label, i) => {
    const row = findLabel(label);
    assert.ok(row, `Missing PDF row ${label}`);
    const values = at(row.y).filter(item => !row.parts.includes(item));
    assert.equal(values.length, i === 0 ? 6 : 3, `PDF grouped values: ${label}`);
    values.forEach((item, index) => {
      const group = i === 0 ? Math.floor(index / 2) : index;
      // Values must be under their own scenario, not merely elsewhere on the page.
      assert.ok(item.x > anchor.x + 110 + group * 135 && item.x < anchor.x + 118 + (group + 1) * 137);
    });
    return values.map(item => item.text);
  });
  return reconcile(headers.map(item => item.text), rows, data);
}
