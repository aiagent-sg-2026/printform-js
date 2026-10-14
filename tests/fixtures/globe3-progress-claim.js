// Authored fictional records only; no copied customer/project/document IDs or amounts.
export function progressWorkRow(documentId, salesHeaderId, lineGroupKey, measure, gross, percent, lastMeasure = '0', lastGross = '0', lastPercent = '0') {
  return {
    companyfn: 'company:fictional', uniquenum_pri: documentId, tag_tab_type: 'wd_detail_soc',
    var_50_001: salesHeaderId, var_25_001: lineGroupKey, var_50_002: lineGroupKey,
    num_20_4_d0_001: measure, num_20_4_d0_002: gross,
    num_20_2_d0_001: percent, num_20_2_d0_002: lastPercent, num_20_2_d0_003: lastGross, num_20_2_d0_004: lastMeasure
  };
}
const header = (id, kind, number, date) => ({
  uniquenum_pri: id, companyfn: 'company:fictional', cslsegm: kind, tag_table_usage: kind,
  dnum_auto: number, date_trans: date, party_unique: 'customer:fictional', entprojfn: 'project:fictional',
  curr_short_forex: 'SGD', curr_decimal: '3', tag_deleted_yn: 'n', tag_void_yn: 'n'
});
export function rawProgressClaimInput() {
  const salesHeaders = [header('so:fictional-a', 'sal_soc', 'SOC-FICTIONAL-A', '2026-06-02'), header('so:fictional-b', 'sal_soc', 'SOC-FICTIONAL-B', '2026-07-03')];
  const salesLines = [
    { idcode: 101, companyfn: 'company:fictional', uniquenum_pri: 'so:fictional-a', uniquenum_uniq: 'line:shared-group', tag_table_usage: 'sal_soc', entprojfn: 'project:fictional', tag_deleted_yn: 'n', stkcode_code: 'FICTIONAL-PANEL', stkcode_desc: 'Fictional lighting control panel', qnty_total: '10.0000', price_unitrate_forex: '200.5000', extnamt_orig_forex: '2005.000', extnamt_dist_forex: '17.000' },
    { idcode: 102, companyfn: 'company:fictional', uniquenum_pri: 'so:fictional-b', uniquenum_uniq: 'line:shared-group', tag_table_usage: 'sal_soc', entprojfn: 'project:fictional', tag_deleted_yn: 'n', stkcode_code: 'FICTIONAL-BRACKET', stkcode_desc: 'Fictional mounting bracket revision', qnty_total: '10.0000', price_unitrate_forex: '50.0000', extnamt_orig_forex: '500.000', extnamt_dist_forex: '19.000' }
  ];
  const current = [progressWorkRow('claim:fictional', 'so:fictional-a', 'line:shared-group', '8.0000', '1250.1250', '80.00', '7.00', '1100.00', '70.00'), progressWorkRow('claim:fictional', 'so:fictional-b', 'line:shared-group', '4.0000', '200.0000', '40.00', '4.00', '200.00', '40.00')];
  const older = { header: { ...header('cert:older', 'entp_pcar', 'CCAR-FICTIONAL-OLD', '2026-07-20'), tag_wflow_app_yn: 'y' }, workDoneMeasureKind: 'quantity', workDoneRows: [progressWorkRow('cert:older', 'so:fictional-a', 'line:shared-group', '4.0000', '600.0000', '40.00'), progressWorkRow('cert:older', 'so:fictional-b', 'line:shared-group', '2.0000', '100.0000', '20.00')] };
  const latest = { header: { ...header('cert:latest', 'entp_pcar', 'CCAR-FICTIONAL-LATEST', '2026-08-10'), tag_wflow_app_yn: 'y' }, workDoneMeasureKind: 'quantity', workDoneRows: [progressWorkRow('cert:latest', 'so:fictional-a', 'line:shared-group', '6.0000', '900.3750', '60.00'), progressWorkRow('cert:latest', 'so:fictional-b', 'line:shared-group', '5.0000', '250.0000', '50.00')] };
  return {
    header: { ...header('claim:fictional', 'entp_pbill', 'PCAR-FICTIONAL-8', '2026-08-20'), dnum_reference: '', creditterm_desc: 'Fictional claim-snapshot terms', nettot_forex: '266.470', salestaxamt_forex: '5.001', amount_forex: '271.471' },
    workDoneRows: current, salesHeaders, salesLines, previousCertificates: [latest, older],
    context: { company: { id: 'company:fictional', name: 'Aster Engineering (Fictional)' }, customer: { id: 'customer:fictional', name: 'Fictional Beacon Facilities' }, project: { id: 'project:fictional', name: 'Fictional Beacon controls upgrade' }, period: { from: '2026-08-01', to: '2026-08-15' }, basisProfile: 'globe3-prior-certified', linkProfile: 'ar-soc-line25', workDoneMeasureKind: 'quantity', numericSlotVariant: 'd0' }
  };
}
export function fractionalProgressClaimInput() {
  const input = rawProgressClaimInput();
  input.context.basisProfile = 'globe3-stored-last-claim'; input.context.linkProfile = 'view113-line50'; input.context.workDoneMeasureKind = 'fraction';
  input.workDoneRows[0].num_20_4_d0_001 = '0.8000'; input.workDoneRows[1].num_20_4_d0_001 = '0.4000';
  delete input.workDoneRows[0].var_25_001; delete input.workDoneRows[1].var_25_001;
  return input;
}
