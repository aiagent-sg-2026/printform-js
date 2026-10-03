// Every selector and declaration is authored here, never supplied by a model or file.
// The regular Studio tokens and inline field styles remain editable on these layouts.
const common = `
#pf-mount { --v3-rule:#cbd5df; --v3-soft:#f4f6f9; }
#pf-mount .v3-header { padding:18px 24px;grid-template-columns:minmax(0,1fr) 220px;gap:24px;align-items:start; }
#pf-mount .v3-header .brand-mark { display:none; }
#pf-mount .v3-header img[data-v3-role=logo] { grid-column:1/-1; }
#pf-mount .v3-header h1 { min-width:0;overflow-wrap:anywhere;line-height:1.15; }
#pf-mount .company-fields { min-width:0;gap:9px 18px; }
#pf-mount .company-fields [data-v3-field=header-company] { line-height:1.25; }
#pf-mount .v3-customer { padding:20px 24px;gap:10px 28px; }
#pf-mount .v3-grid { width:calc(100% - 48px);margin:0 24px; }
#pf-mount .v3-grid th { padding-top:10px;padding-bottom:10px; }
#pf-mount .v3-totals { padding:18px 24px 0; }
#pf-mount .summary { width:min(330px,100%); }
#pf-mount .summary .field > [data-v3-role=value] { text-align:right;white-space:normal; }
#pf-mount .v3-notes { padding:22px 24px; }
#pf-mount .v3-notes .field { margin:0; }
#pf-mount .v3-notes [data-v3-field=footer-notes],
#pf-mount .v3-notes [data-v3-field=footer-quotation-terms],
#pf-mount .v3-notes [data-v3-field=footer-claim-basis],
#pf-mount .v3-notes [data-v3-field=footer-scope-note] { grid-column:1/-1; }
#pf-mount .v3-page-number { margin:0 24px;padding:10px 0 12px; }
`;
const layouts = {
  'quotation-letter': `
#pf-mount .v3-header { grid-template-columns:1fr;border-bottom:1px solid var(--v3-rule); }
#pf-mount .v3-header h1 { grid-row:1;text-align:left;color:var(--v3-accent);letter-spacing:.09em; }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr)); }
#pf-mount .company-fields [data-v3-field=header-address] { grid-column:1/3; }
#pf-mount .company-fields [data-v3-field=header-registration] { grid-column:3; }
#pf-mount .v3-customer { border-bottom:1px solid var(--v3-rule);margin:0 24px;padding:20px 0; }
#pf-mount .v3-grid th { background:white;color:var(--v3-accent);border-bottom:2px solid var(--v3-accent); }
#pf-mount .v3-grid td { border-bottom:1px solid #e5e9ee; }
#pf-mount .summary .field:last-child { background:white;border-top:2px solid var(--v3-accent); }
#pf-mount [data-v3-field=footer-quotation-terms] { border-left:3px solid var(--v3-accent);padding-left:12px; }
`,
  'order-register': `
#pf-mount .v3-header { grid-template-columns:1fr;border-top:7px solid var(--v3-accent);border-bottom:0; }
#pf-mount .v3-header h1 { grid-row:1;text-align:left;letter-spacing:.08em; }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr));padding:14px;background:var(--v3-soft); }
#pf-mount .company-fields [data-v3-field=header-company] { grid-column:1/3; }
#pf-mount .company-fields [data-v3-field=header-registration] { grid-column:3; }
#pf-mount .company-fields [data-v3-field=header-address] { grid-column:1/-1; }
#pf-mount .v3-grid th { background:var(--v3-accent);color:white; }
#pf-mount .v3-customer .label { text-transform:uppercase;letter-spacing:.06em; }
#pf-mount .summary { border:1px solid var(--v3-rule); }
#pf-mount .summary .field:last-child { background:var(--v3-soft); }
`,
  'dispatch-manifest': `
#pf-mount .v3-header { grid-template-columns:minmax(0,1fr) 200px;border:0;background:var(--v3-accent);color:white; }
#pf-mount .v3-header .label { color:#e3eaf0; }
#pf-mount .v3-header h1 { border-left:1px solid #ffffff80;padding-left:20px; }
#pf-mount .v3-customer { border-bottom:4px double var(--v3-rule); }
#pf-mount .v3-customer [data-v3-field=customer-ship] { color:var(--v3-accent);font-weight:700;font-size:var(--pf-font-plus-2); }
#pf-mount .v3-grid th { background:white;border-bottom:2px solid var(--v3-accent); }
#pf-mount .v3-grid td { border-bottom:1px dashed var(--v3-rule); }
#pf-mount .v3-grid td:nth-child(5) { font-weight:700; }
#pf-mount .summary { width:200px;border:2px solid var(--v3-accent); }
#pf-mount .summary .field:last-child { border:0;background:white; }
`,
  'invoice-ledger': `
#pf-mount .v3-header { grid-template-columns:minmax(0,1fr) 240px;border-bottom:5px solid var(--v3-accent); }
#pf-mount .v3-header h1 { color:var(--v3-accent);padding-top:6px; }
#pf-mount .company-fields [data-v3-field=header-number],
#pf-mount .company-fields [data-v3-field=header-due] { border-bottom:1px solid var(--v3-rule);padding-bottom:7px; }
#pf-mount .v3-customer { background:var(--v3-soft);margin:16px 24px;padding:14px 18px; }
#pf-mount .v3-grid th { color:var(--v3-accent);background:white;border-bottom:2px solid var(--v3-accent); }
#pf-mount .v3-grid td { border-bottom:1px solid #e6ebf0; }
#pf-mount .summary .field:last-child { background:var(--v3-accent);color:white;border:0;padding:12px; }
#pf-mount .summary .field:last-child .label { color:white; }
`,
  'procurement-order': `
#pf-mount .v3-header { grid-template-columns:1fr;border-bottom:0;gap:18px; }
#pf-mount .v3-header h1 { grid-row:1;text-align:left;border:2px solid var(--v3-accent);padding:12px 16px;color:var(--v3-accent); }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr)); }
#pf-mount .company-fields [data-v3-field=header-address] { grid-column:1/3; }
#pf-mount .company-fields [data-v3-field=header-registration] { grid-column:3; }
#pf-mount .v3-customer { margin:0 24px 18px;padding:14px;border:1px solid var(--v3-rule); }
#pf-mount .v3-grid th { background:#f4f0e9;color:var(--v3-accent); }
#pf-mount .summary .field:last-child { background:#f4f0e9; }
#pf-mount [data-v3-field=footer-approval] { padding-top:12px;border-top:1px solid var(--v3-accent); }
`,
  'payable-voucher': `
#pf-mount .v3-header { grid-template-columns:minmax(0,1fr) 210px;border-bottom:1px solid var(--v3-rule); }
#pf-mount .v3-header h1 { color:var(--v3-accent);border-bottom:6px solid var(--v3-accent);padding-bottom:12px; }
#pf-mount .v3-customer { border-left:4px solid var(--v3-accent);margin:18px 24px;padding:12px 18px;background:var(--v3-soft); }
#pf-mount .v3-grid th { background:white;border-top:1px solid var(--v3-accent);border-bottom:1px solid var(--v3-accent); }
#pf-mount .v3-grid td { border-bottom:1px solid var(--v3-rule); }
#pf-mount .summary { width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px; }
#pf-mount .summary .field { flex-direction:column;align-items:flex-start;border-top:2px solid var(--v3-rule);padding:12px 0; }
#pf-mount .summary .field:last-child { border-color:var(--v3-accent);background:white;color:var(--v3-accent); }
`,
  'receipt-advice': `
#pf-mount .v3-header { grid-template-columns:1fr;text-align:center;border:2px solid var(--v3-accent);gap:18px; }
#pf-mount .v3-header h1 { grid-row:1;text-align:center;color:var(--v3-accent);letter-spacing:.12em; }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr)); }
#pf-mount .v3-customer { border-bottom:1px solid var(--v3-rule); }
#pf-mount .v3-grid th { background:#edf5f1;color:var(--v3-accent);border:0; }
#pf-mount .v3-grid td { border-bottom:1px solid var(--v3-rule); }
#pf-mount .summary { width:100%;display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:18px; }
#pf-mount .summary .field { flex-direction:column;justify-content:flex-start;padding:14px; }
#pf-mount .summary .field > [data-v3-role=value] { text-align:left; }
#pf-mount .summary .field:last-child { background:#edf5f1;border-top:3px solid var(--v3-accent);color:var(--v3-accent); }
`,
  'payment-authority': `
#pf-mount .v3-header { grid-template-columns:1fr;border-left:10px solid var(--v3-accent);border-bottom:0;padding-left:22px;gap:18px; }
#pf-mount .v3-header h1 { grid-row:1;text-align:left;color:var(--v3-accent); }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr)); }
#pf-mount .v3-customer { margin:12px 24px 18px;padding:16px;background:#f7f2f0;border:1px solid #dacfc8; }
#pf-mount .v3-grid th { background:var(--v3-accent);color:white; }
#pf-mount .summary { border:1px solid var(--v3-accent); }
#pf-mount .summary .field:last-child { background:#f7f2f0; }
#pf-mount [data-v3-field=footer-signature],#pf-mount [data-v3-field=footer-approval] { border-top:1px solid var(--v3-accent);padding-top:14px; }
`,
  'project-brief': `
#pf-mount .v3-header { grid-template-columns:1fr;border-top:12px solid var(--v3-accent);border-bottom:1px solid var(--v3-rule);gap:20px; }
#pf-mount .v3-header h1 { grid-row:1;text-align:left;color:var(--v3-accent);letter-spacing:.05em; }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr)); }
#pf-mount .v3-customer [data-v3-field=customer-project-name] { grid-column:1/-1;font-size:var(--pf-font-plus-4);padding-bottom:10px;border-bottom:1px solid var(--v3-rule); }
#pf-mount .v3-customer [data-v3-field=customer-contract-reference] { grid-column:1/-1; }
#pf-mount .v3-grid th { background:white;color:var(--v3-accent);border-bottom:3px solid var(--v3-accent); }
#pf-mount .v3-grid td { border-bottom:1px solid var(--v3-rule); }
#pf-mount .summary { width:100%; }
#pf-mount .summary .field:last-child { padding:16px;background:#eef5f3;border-top:0;border-left:5px solid var(--v3-accent); }
`,
  'progress-certificate': `
#pf-mount .v3-header { grid-template-columns:1fr;border-bottom:4px double var(--v3-accent);gap:18px; }
#pf-mount .v3-header h1 { grid-row:1;text-align:left;letter-spacing:.07em;color:var(--v3-accent); }
#pf-mount .company-fields { grid-template-columns:repeat(3,minmax(0,1fr)); }
#pf-mount .company-fields [data-v3-field=header-contract-value] { grid-column:1/-1;padding-top:10px;border-top:1px solid var(--v3-rule); }
#pf-mount .v3-customer { background:var(--v3-soft);margin:18px 24px;padding:14px; }
#pf-mount .v3-customer [data-v3-field=customer-project-name] { font-weight:700; }
#pf-mount .v3-grid th { color:white;background:var(--v3-accent); }
#pf-mount .summary { width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 16px; }
#pf-mount .summary .field { flex-direction:column;padding:10px 0;border-bottom:1px solid var(--v3-rule); }
#pf-mount .summary .field > [data-v3-role=value] { text-align:left; }
#pf-mount .summary .field:last-child { grid-column:1/-1;flex-direction:row;align-items:center;padding:12px;background:var(--v3-soft); }
`
};
export function a4PresetTheme(design) {
  if(!design.layoutPreset)return '';
  // An explicit header grid must also clear the preset's positioned children.
  // Otherwise registration/address spans create implicit columns in a 1-column grid.
  const headerGrid = '#pf-mount .v3-header.v3-custom-layout .company-fields .field { grid-column:auto;grid-row:auto; }';
  return `#pf-mount { --v3-accent:${design.color}; }\n${common}\n${layouts[design.layoutPreset] || ''}\n${headerGrid}`;
}
