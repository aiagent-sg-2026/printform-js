const provenance = (sourcePath, meaning) => ({ sourcePath: `fictional-local/${sourcePath}`, meaning });
const quantity = (amount, uom, sourcePath, meaning) => ({ amount, uom, decimalPlaces: 3, provenance: provenance(sourcePath, meaning) });
const status = (value, sourcePath) => ({ value, provenance: provenance(sourcePath, 'Exact source label only; not independently verified or approved') });
export function manufacturingDemo(common) {
  return { ...common('ManufacturingOrder', 'DEMO-MFG-2026-10'), manufacturing: {
    order: { id: 'FICTIONAL-WO-001', number: 'DEMO-WO-001', bom: 'FICTIONAL-BOM-01', provenance: provenance('work-order/id', 'Supplied manufacturing instruction identity and BOM reference; no BOM expansion') },
    product: { id: 'FICTIONAL-PRODUCT-001', code: 'DEMO-PANEL', name: 'Fictional training panel', provenance: provenance('work-order/product', 'Supplied product identity') },
    quantity: quantity('0008.500', 'Each', 'work-order/qty', 'Supplied order quantity, not finished-goods stock'),
    status: status('Work In Progress', 'work-order/status'),
    lines: [
      { id: 'FICTIONAL-WO-ROW-001', item: { id: 'FICTIONAL-MAT-001', code: 'DEMO-SHEET', name: 'Fictional sheet material' }, role: 'required', description: 'Independent source required material quantity',
        quantity: quantity('12.500', 'sheet', 'work-order/required/qty', 'Supplied required quantity; not calculated from BOM'), provenance: provenance('work-order/required/row', 'Supplied requirement row identity') },
      { id: 'FICTIONAL-WO-ROW-002', item: { id: 'FICTIONAL-PRODUCT-001', code: 'DEMO-PANEL', name: 'Fictional training panel' }, role: 'produced', description: 'Independent source production snapshot, not inventory posting',
        quantity: quantity('+0002.000', 'Each', 'work-order/produced/qty', 'Source supplied produced quantity; no remaining quantity inferred'), status: status('Pending review', 'work-order/produced/status'),
        provenance: provenance('work-order/produced/row', 'Supplied production snapshot identity only') }
    ]
  }, notes: 'Entirely fictional supplied manufacturing snapshot. No ERP connector, BOM calculation, stock reservation/posting, completion certification or inventory balance.' };
}
export function timesheetDemo(common) {
  return { ...common('Timesheet', 'DEMO-TIME-2026-10'), timesheet: {
    employee: { id: 'FICTIONAL-EMPLOYEE-TIME-001', name: 'Fictional Rowan Lantern', department: 'Fictional Workshop', provenance: provenance('timesheet/employee', 'Supplied employee identity; fictional demo only') },
    period: { from: '2026-10-01', to: '2026-10-15' }, status: status('Draft', 'timesheet/status'),
    entries: [
      { id: 'FICTIONAL-TIME-ROW-001', date: '2026-10-13', activity: 'Assembly observation', description: 'Supplied task hours, not a timer calculation',
        project: { id: 'FICTIONAL-PROJECT-001', name: 'Fictional training project', provenance: provenance('timesheet/row-1/project', 'Supplied project reference') },
        task: { id: 'FICTIONAL-TASK-001', name: 'Fictional assembly study', provenance: provenance('timesheet/row-1/task', 'Supplied task reference') },
        hours: quantity('0007.500', 'hour', 'timesheet/row-1/hours', 'Exact supplied hours; no wages or billing calculation'), status: status('Recorded', 'timesheet/row-1/status'),
        provenance: provenance('timesheet/row-1', 'Supplied time entry identity') },
      { id: 'FICTIONAL-TIME-ROW-002', date: '2026-10-14', activity: 'Training', description: 'Independent supplied time entry with no project/task inferred',
        hours: quantity('-0000.000', 'hour', 'timesheet/row-2/hours', 'Source supplied signed zero hours'), provenance: provenance('timesheet/row-2', 'Supplied time entry identity') }
    ]
  }, notes: 'Entirely fictional supplied timesheet. No wages, overtime, billing, inferred duration, approval, payment or employee attendance certification.' };
}
