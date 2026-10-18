const provenance = sourcePath => ({ sourcePath: `fictional-supplied/${sourcePath}`, meaning: 'Fictional supplied snapshot; not approval, procurement or work execution evidence' });
const sourced = (facts, path) => ({ ...facts, provenance: provenance(path) });
const quantity = (amount, uom, path) => ({ amount, decimalPlaces: 3, uom, provenance: provenance(path) });

export function requisitionDemo(common) {
  return { ...common('PurchaseRequisition', 'DEMO-REQ-2026-10'), requisition: {
    request: sourced({ id: 'F-REQ-001', number: 'REQ-001' }, 'requisition/request'),
    purpose: sourced({ value: 'Purchase' }, 'requisition/purpose'),
    requester: sourced({ id: 'F-REQUESTER-001', name: 'Fictional Rowan', department: 'Workshop' }, 'requisition/requester'),
    status: sourced({ value: 'Draft' }, 'requisition/status'),
    lines: [
      { id: 'F-REQ-LINE-001', item: { id: 'F-ITEM-001', code: 'FILTER-A', name: 'Fictional filter cartridge' }, description: 'Requested replacement cartridges',
        quantity: quantity('0008.500', 'Each', 'requisition/lines/0/qty'), requiredBy: '2026-10-24',
        destination: sourced({ id: 'F-STORE-A' }, 'requisition/lines/0/destination'), provenance: provenance('requisition/lines/0') },
      { id: 'F-REQ-LINE-002', item: { id: 'F-ITEM-002', name: 'Fictional seal kit' }, description: 'Supplied zero request snapshot',
        quantity: quantity('-0000.000', 'kit', 'requisition/lines/1/qty'), provenance: provenance('requisition/lines/1') }
    ]
  }, notes: 'Fictional purchase request only. No supplier selection, purchase order, authorization, price or stock movement is inferred.' };
}

export function maintenanceDemo(common) {
  return { ...common('MaintenanceWorkOrder', 'DEMO-MAINT-2026-10'), maintenance: {
    order: sourced({ id: 'F-MAINT-001', number: 'MWO-001' }, 'maintenance/order'),
    asset: sourced({ id: 'F-ASSET-001', name: 'Fictional workshop pump', serialNumber: 'F-PUMP-0001' }, 'maintenance/asset'),
    status: sourced({ value: 'Planned' }, 'maintenance/status'),
    tasks: [
      { id: 'F-TASK-001', description: 'Inspect inlet filter', instruction: 'Record the observed condition before any replacement.',
        status: sourced({ value: 'Not started' }, 'maintenance/tasks/0/status'), provenance: provenance('maintenance/tasks/0') },
      { id: 'F-TASK-002', description: 'Supplied replacement filter quantity', quantity: quantity('+0002.500', 'Each', 'maintenance/tasks/1/qty'),
        provenance: provenance('maintenance/tasks/1') }
    ]
  }, notes: 'Fictional maintenance instructions and supplied task status, not evidence that work was performed, verified or approved. No labor cost or completion calculation.' };
}
