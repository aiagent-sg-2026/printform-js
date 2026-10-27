(() => {
  const data = window.PF055_DATA;
  const mount = document.querySelector('#pf055-content');
  const expected = [];
  const content = (node, id) => { node.dataset.contentId = id; expected.push(id); return node; };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const heading = (id, label) => {
    const node = content(element('section', 'ptac section-title', label), id);
    node.dataset.pfTableId = 'terms';
    node.dataset.pfKeepWithNext = 'true';
    mount.append(node);
  };
  const clause = (prefix, index, offset = 0, inColumns = false) => {
    const [title, text] = data.clauses[(index + offset) % data.clauses.length];
    const id = `${prefix}-${String(index + 1).padStart(3, '0')}`;
    const node = content(element(inColumns ? 'p' : 'section', inColumns ? 'clause' : 'ptac clause'), id);
    node.dataset.pfTableId = 'terms';
    node.append(element('strong', '', `${id.toUpperCase()} / ${title}. `), document.createTextNode(text));
    return node;
  };
  const terms = (prefix, count, offset = 0) => {
    for (let index = 0; index < count; index += 1) mount.append(clause(prefix, index, offset));
  };
  const table = (id, label, count, variant) => {
    const header = element('table', `prowheader schedule schedule-${variant}`);
    header.dataset.pfTableId = id;
    header.dataset.pfKeepWithNext = 'true';
    const widths = variant === 1 ? [6, 46, 22, 13, 13] : [7, 54, 24, 15];
    const labels = variant === 1 ? ['Ref.', 'Fictional benefit / scope', 'Sample condition', 'Ceiling SGD', 'Price SGD']
      : variant === 2 ? ['Ref.', 'Package coverage / conditions', 'Compensation basis', 'Price SGD']
        : ['Ref.', 'Supplementary item / condition', 'Example limit', 'Price SGD'];
    const cols = () => {
      const group = document.createElement('colgroup');
      widths.forEach(width => { const col = document.createElement('col'); col.style.width = `${width}%`; group.append(col); });
      return group;
    };
    header.append(cols());
    const head = document.createElement('thead');
    const title = head.insertRow();
    const titleCell = document.createElement('th'); titleCell.colSpan = widths.length; titleCell.textContent = label;
    title.append(titleCell);
    const columns = head.insertRow();
    labels.forEach(label => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; columns.append(cell); });
    header.append(head); mount.append(header);
    for (let index = 0; index < count; index += 1) {
      const rowId = `${id}-${String(index + 1).padStart(3, '0')}`;
      const row = content(element('table', `prowitem schedule schedule-${variant} ${index % 2 ? 'tinted' : ''}`), rowId);
      row.dataset.pfTableId = id;
      row.append(cols());
      const tr = row.createTBody().insertRow();
      const ref = tr.insertCell(); ref.textContent = String(index + 1).padStart(2, '0'); ref.dataset.pfCellPolicy = 'first';
      const description = tr.insertCell();
      const [name, scope] = data.coverage[(index + variant - 1) % data.coverage.length];
      description.append(element('strong', 'item-name', `${name} / ${variant === 2 ? 'Horizon package' : 'Sample option'} ${index + 1}`));
      const brief = [
        'Fictional recovery support; documented expenses only.',
        'Sample travel rescheduling allowance; no emergency service.',
        'Illustrative equipment support; listed assets only.',
        'Fictional household coordination; one sample event.',
        'Sample belongings allowance; documented replacement only.',
        'Illustrative volunteer event support; prior sample review required.',
        'Non-emergency conversation scheduling; no medical service.',
        'Fictional daily-task coordination; no wage replacement.',
        'Sample home access allowance; no service is dispatched.',
        'Fictional course rescheduling; unused sessions only.'
      ];
      description.append(document.createTextNode(variant !== 1 && index % 3 === 0 ? brief[(index + variant - 1) % brief.length] : scope));
      const detailCount = variant === 1 ? (index % 5 === 0 ? 1 : 0) : variant === 2 ? [0, 0, 0, 2, 1, 0][index % 6] : index % 5 === 0 ? 1 : 0;
      for (let detail = 0; detail < detailCount; detail += 1) description.append(element('p', 'item-detail', data.details[(index + detail) % data.details.length]));
      if (variant !== 1 && index % 2) description.append(element('p', 'item-detail', data.conditions[index % data.conditions.length]));
      const basis = tr.insertCell(); basis.textContent = variant === 1 ? data.conditions[index % data.conditions.length]
        : `${variant === 2 ? 'Demonstrated expense only' : 'Illustrative allowance'}; maximum SGD ${(750 + index * 125).toLocaleString('en-SG')}. No cash alternative.`;
      if (variant === 1) { const limit = tr.insertCell(); limit.textContent = (1500 + index * 250).toLocaleString('en-SG'); limit.className = 'money'; }
      const price = tr.insertCell(); price.textContent = (48 + variant * 25 + index * 3.75).toFixed(2);
      price.className = 'money'; price.dataset.pfCellPolicy = 'first'; price.dataset.pfMonetary = 'currency';
      mount.append(row);
    }
  };

  heading('opening-title', '01 / BEFORE THE SCHEDULE · PROPOSAL TERMS');
  terms('opening', 25);
  table('benefit', '02 / BENEFIT RESERVATIONS · FICTIONAL ANNUAL SCHEDULE', 28, 1);
  // No manual pages: clauses fill the remaining left column, then right, before continuing.
  const columns = element('section', 'ptac two-column-terms');
  columns.dataset.pfColumns = '2'; columns.dataset.pfTableId = 'terms'; columns.dataset.flowSection = 'two-column';
  for (let index = 0; index < 36; index += 1) columns.append(clause('parallel', index, 4, true));
  mount.append(columns);
  table('package', '03 / EVERYDAY HORIZON · PACKAGE OPTIONS & COMPENSATION', 22, 2);
  heading('bridge-title', '04 / REVIEW NOTES · BEFORE SUPPLEMENTARY ITEMS');
  terms('bridge', 4, 6);
  table('supplement', '05 / SUPPLEMENTARY SERVICES · SEPARATE SAMPLE ITEMS', 20, 3);
  heading('closing-title', '06 / CLOSING TERMS · INTERNAL DEMONSTRATION');
  terms('closing', 3, 10);
  const signature = content(element('section', 'ptac pfsign signature-block'), 'signature');
  signature.dataset.pfTableId = 'terms';
  signature.innerHTML = '<h2>REVIEW ACKNOWLEDGEMENT / SAMPLE SIGNATURE</h2><p>For demonstration only. Signing does not bind insurance, authorize payment or accept an offer.</p><div class="signature-fields"><span>Customer name<br>________________________</span><span>Sample signature<br>________________________</span><span>Review date<br>________________</span></div><p class="appendix-note">The document continues after this signature. Read the complete appendix below.</p>';
  mount.append(signature);
  heading('appendix-title', '07 / AFTER THE SIGNATURE · EXTENDED SAMPLE TERMS');
  terms('appendix', 60, 3);
  const end = content(element('section', 'ptac end-note', 'END OF DEMONSTRATION · All schedules and terms are fictional. No insurance is issued.'), 'document-end');
  end.dataset.pfTableId = 'terms'; mount.append(end);
  window.PF055_EXPECTED_IDS = expected;
  // Retain exact authored semantic text for executable conservation checks.
  window.PF055_SOURCE = [...mount.querySelectorAll('[data-content-id]')].map(node => ({ id: node.dataset.contentId, text: node.textContent }));
})();
