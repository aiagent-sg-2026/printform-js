/* Original geometric line icons, created for PF-057; repository MIT license. */
window.PF057Icon = name => {
  const paths = {
    account: '<path d="M5 15L20 6l15 9M8 16h24M10 19v12m10-12v12m10-12v12M6 34h28"/>',
    income: '<rect x="5" y="10" width="30" height="22" rx="4"/><path d="M10 17h3m14 8h3m-10-9v12m4-10c-6-4-10 4-4 4s2 7-4 4"/>',
    rate: '<path d="M14 9l-7 7v13l8 7 14-6 7-14-7-7zM13 28l14-14"/><circle cx="15" cy="16" r="3"/><circle cx="26" cy="27" r="3"/>',
    time: '<circle cx="19" cy="19" r="13"/><path d="M19 11v9l6 3"/><circle cx="30" cy="30" r="8" fill="#eaf4f0"/><path d="M26 30l3 3 5-6"/>',
    result: '<path d="M8 13l12-7 12 7v12L20 35 8 25zM14 21l4 4 9-10"/>',
    compare: '<rect x="5" y="6" width="12" height="28" rx="3"/><rect x="23" y="6" width="12" height="28" rx="3"/><path d="M9 13h4m-4 7h4m-4 7h4m14-14h4m-4 7h4m-4 7h4"/>',
    calendar: '<rect x="6" y="9" width="28" height="26" rx="4"/><path d="M6 17h28M13 5v8m14-8v8M12 24h5m6 0h5m-16 6h5"/>'
  };
  if (!paths[name]) throw new Error(`Unknown PF057 icon: ${name}`);
  return `<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
};
