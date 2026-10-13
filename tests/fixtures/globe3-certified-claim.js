// Entirely fictional inputs: no copied customer, project, certificate or amount.
export const summaryKeys = ['contractValue', 'workDone', 'variation', 'subtotalA', 'retention', 'subtotalB', 'previousCertified', 'subtotalC', 'tax', 'total'];
export const mainAmounts = ['12345.67', '4567.89', '-12.34', '4500.01', '321.09', '4199.00', '700.05', '3501.23', '280.10', '3790.47'];
export const mainLabels = ['Contract Sum', 'Measured Work', 'Variation as supplied', 'Sub-Total A', 'Less Retention', 'Sub-Total B', 'Previous Certificate', 'Sub-Total C', 'Tax as supplied', 'Total Due'];

export function financialBlock(section, pairs) {
  const row = { uniquenum_pri: 'cert:fictional', companyfn: 'company:fictional', documentId: 'cert:fictional', tag_table_usage: 'entp_pcar', tag_tab_type: section };
  pairs.forEach(([label, amount], index) => {
    const suffix = String(index + 1).padStart(3, '0');
    row[`var_100_${suffix}`] = label;
    row[`num_20_2_d0_${suffix}`] = amount;
  });
  return row;
}

export function globe3ClaimInput() {
  return {
    header: {
      uniquenum_pri: 'cert:fictional', companyfn: 'company:fictional',
      tag_table_usage: 'entp_pcar', cslsegm: 'entp_pcar',
      dnum_auto: 'CCAR-FICTIONAL-42', dnum_master: '4', dnum_reference: 'Fictional Orchard Works',
      date_trans: '2026-08-18', curr_short_forex: 'SGD', curr_decimal: '2',
      party_unique: 'customer:fictional', entprojfn: 'project:fictional'
    },
    tabData: [
      financialBlock('entp_pcar', mainLabels.map((label, index) => [label, mainAmounts[index]])),
      financialBlock('entp_pcar_mb', [['Extra work as supplied', '35.25'], ['Zero detail retained', '0.00']]),
      financialBlock('entp_pcar_mc', [['Advance signed by source', '-61.20']]),
      financialBlock('entp_pcar_mk', [['Contract omission', '10.75']]),
      financialBlock('entp_pcar_mm', [['Contract variation', '42.00']]),
      financialBlock('entp_pcar_mn', [['Work omission', '-2.50']]),
      financialBlock('entp_pcar_mp', [['On hold', '7.75']])
    ],
    context: {
      company: { id: 'company:fictional', name: 'Orchard Systems (Fictional)' },
      customer: { id: 'customer:fictional', name: 'Harbor Theatre (Fictional)' },
      project: { id: 'project:fictional', name: 'Fictional Orchard Works' },
      period: { from: '2026-08-01', to: '2026-08-15' }
    }
  };
}
