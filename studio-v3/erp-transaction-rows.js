const origin = reference => `${reference.role} · ${reference.document.system} · ${reference.document.documentType} · ${reference.document.number} · ID ${reference.document.id}`;
const provenance = value => `${value.provenance.sourcePath} · ${value.provenance.meaning}`;

// Each row has a traceable supplied fact; none is an invented invoice item or computed total.
export function transactionPrintRows(data) {
  const rows = [], refs = new Map(data.references.map(reference => [reference.id, reference]));
  const append = (id, section, meaning, value, direction, trace, extra = {}) => rows.push({
    no: rows.length + 1, sourceId: id, section, meaning, value, direction, trace, ...extra
  });
  data.references.forEach(reference => append(reference.id, 'Source reference', origin(reference),
    [reference.document.currency, reference.document.date].filter(Boolean).join(' · '), 'linked source',
    [provenance(reference), reference.document.companyId && `Company ${reference.document.companyId}`, reference.document.partyId && `Party ${reference.document.partyId}`].filter(Boolean).join(' · '),
    { sourceReference: structuredClone(reference.document), sourcePath: `references/${reference.id}` }));
  const lineTrace = line => [
    `Line ${line.id}`, line.sourceReferenceId && origin(refs.get(line.sourceReferenceId)),
    line.sourceLineId && `Original line ${line.sourceLineId}`, line.item && [line.item.code, line.item.name, `Item ID ${line.item.id}`].filter(Boolean).join(' · ')
  ].filter(Boolean).join(' · ');
  data.lines?.forEach((line, index) => {
    line.quantities.forEach((quantity, i) => append(line.id, 'Inventory / quantity', `${quantity.role} · ${line.description}`,
      quantity.displayQuantity, quantity.direction,
      [lineTrace(line), provenance(quantity), quantity.warehouse && `Warehouse ${[quantity.warehouse.name, quantity.warehouse.id].filter(Boolean).join(' · ')}`].filter(Boolean).join(' · '),
      { ...(line.sourceLineId ? { sourceLineId: line.sourceLineId } : {}), sourcePath: `lines[${index}].quantities[${i}]`, quantity: structuredClone(quantity) }));
    line.amounts.forEach((fact, i) => append(fact.id, 'Supplied line amount', `${fact.role} · ${fact.label} · ${line.description}`, fact.amount.displayAmount,
      fact.amount.direction, [`Fact ${fact.id}`, lineTrace(line), provenance(fact.amount), fact.basis, fact.sourceReferenceId && origin(refs.get(fact.sourceReferenceId))].filter(Boolean).join(' · '),
      { sourcePath: `lines[${index}].amounts[${i}]`, money: structuredClone(fact.amount) }));
  });
  data.taxes?.forEach((fact, index) => append(fact.id, 'ERP tax / charge', `${fact.label} · ${fact.basis}`, fact.amount.displayAmount,
    fact.amount.direction, [`Fact ${fact.id}`, provenance(fact.amount), fact.sourceReferenceId && origin(refs.get(fact.sourceReferenceId))].filter(Boolean).join(' · '),
    { sourcePath: `taxes[${index}]`, money: structuredClone(fact.amount) }));
  data.summary?.forEach((fact, index) => append(fact.id, 'ERP supplied summary', `${fact.role} · ${fact.label}`, fact.amount.displayAmount,
    fact.amount.direction, [`Fact ${fact.id}`, provenance(fact.amount), fact.basis, fact.sourceReferenceId && origin(refs.get(fact.sourceReferenceId))].filter(Boolean).join(' · '),
    { sourcePath: `summary[${index}]`, money: structuredClone(fact.amount) }));
  data.allocations?.forEach((allocation, index) => {
    for (const [key, label] of [['amount', 'Refund-basis applied'], ['cashAppliedAmount', 'Cash-currency applied'], ['remainingAmount', 'Refund-basis remaining balance']]) {
      if (!allocation[key]) continue;
      const amount = allocation[key];
      append(allocation.id, 'Cash refund allocation', `${label}${allocation.state ? ` · ${allocation.state}` : ''}`, amount.displayAmount, amount.direction,
        `${origin(refs.get(allocation.sourceReferenceId))} · Allocation ${allocation.id} · ${provenance(amount)}`,
        { sourcePath: `allocations[${index}].${key}`, sourceReference: structuredClone(refs.get(allocation.sourceReferenceId).document), money: structuredClone(amount) });
    }
  });
  return rows;
}
