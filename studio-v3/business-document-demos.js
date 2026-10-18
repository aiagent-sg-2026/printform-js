import { BUSINESS_DOCUMENT_PROFILE } from './business-document-adapter.js';
import { serviceDemo, packingDemo } from './business-service-logistics-demos.js';
import { inspectionDemo, handoverDemo } from './business-inspection-handover-demos.js';
import { manufacturingDemo, timesheetDemo } from './business-manufacturing-timesheet-demos.js';
import { requisitionDemo, maintenanceDemo } from './business-requisition-maintenance-demos.js';

export const BUSINESS_DEMO_TEMPLATES = Object.freeze([
  { documentKind: 'AccountStatement', label: 'Account statement · 对账单', baseType: 'invoice', description: 'Explicit references/due dates, debit/credit meanings and supplied balances; no aging or reconciliation.' },
  { documentKind: 'StockMovement', label: 'Stock movement · 库存移动单', baseType: 'delivery', description: 'Supplied lot, serial list, expiry, locations, quantity precision and UOM; no stock posting or conversion.' },
  { documentKind: 'PayrollSlip', label: 'Payroll slip · 工资明细', baseType: 'invoice', description: 'Fictional supplied earnings, deductions, hours, hourly rate and net pay; no payroll calculation or bank data.' },
  { documentKind: 'ServiceReport', label: 'Service report · 维修服务报告', baseType: 'delivery', description: 'Supplied job, customer, asset and work observations with provenance; no acceptance, fees or completion inference.' },
  { documentKind: 'PackingList', label: 'Packing list · 装箱单', baseType: 'delivery', description: 'Supplied packages, item quantities, locations and independent weights with provenance; no summation or conversion.' },
  { documentKind: 'InspectionReport', label: 'Inspection report · 检验报告', baseType: 'delivery', description: 'Supplied observations, independent measurements and source result labels; no inferred conformance or certification.' },
  { documentKind: 'AssetHandover', label: 'Asset handover · 资产交接', baseType: 'delivery', description: 'Supplied asset identities, condition, quantities and source parties; no signature, receipt or ownership inference.' },
  { documentKind: 'ManufacturingOrder', label: 'Manufacturing order · 生产工单', baseType: 'delivery', description: 'Supplied order, product and independent material/production quantities with provenance; no BOM expansion or stock posting.' },
  { documentKind: 'Timesheet', label: 'Timesheet · 工时表', baseType: 'delivery', description: 'Supplied employee, project/task, hours and exact source status with provenance; no wages, duration calculation or approval inference.' },
  { documentKind: 'PurchaseRequisition', label: 'Purchase requisition · 采购申请', baseType: 'delivery', description: 'Supplied requested items, quantities, required dates and provenance; no authorization, purchasing or accounting inference.' },
  { documentKind: 'MaintenanceWorkOrder', label: 'Maintenance work order · 维护工单', baseType: 'delivery', description: 'Supplied asset, task instructions, quantities and source status; no work execution, completion or approval inference.' }
].map(entry => Object.freeze({ ...entry, status: 'ready', scenarioCount: 1 })));
const provenance = (sourcePath, meaning) => ({ sourcePath, meaning });
const money = (amount, sourcePath, meaning, minorUnitDigits = 3) => ({ amount, currency: 'SGD', minorUnitDigits, provenance: provenance(sourcePath, meaning) });
const fact = (id, label, role, amount, meaning, minorUnitDigits) => ({ id, label, role, basis: meaning, amount: money(amount, `fictional-ledger/${id}`, meaning, minorUnitDigits) });
const reference = (documentType, id, number) => ({ system: 'Fictional local source', documentType, id, number });
const common = (kind, number) => ({ profile: BUSINESS_DOCUMENT_PROFILE,
  source: reference(kind, `fictional:${kind}:source`, number), document: { kind, number, date: '2026-10-15', ...(['AccountStatement', 'PayrollSlip'].includes(kind) ? { currency: 'SGD' } : {}) },
  company: { id: 'FICTIONAL-COMPANY-ONLY', name: 'Fictional Lantern Workshop', address: 'Fictional Demo Street · not a real business' }
});
function statement() {
  return { ...common('AccountStatement', 'DEMO-STMT-2026-10'), statement: {
    party: { id: 'FICTIONAL-PARTY-ONLY', name: 'Fictional Willow Customer', role: 'customer' },
    account: { id: 'FICTIONAL-AR-LEDGER', name: 'Fictional customer ledger', basis: 'receivable', debitMeaning: 'Source ledger debit increases receivable', creditMeaning: 'Source ledger credit decreases receivable' },
    period: { from: '2026-10-01', to: '2026-10-15' },
    entries: [
      { id: 'fictional-stmt-entry-invoice', date: '2026-10-03', dueDate: '2026-11-03', description: 'Source invoice charge · 来源发票记账',
        reference: reference('SalesInvoice', 'FICTIONAL-INV-1', 'DEMO-INV-1'),
        amounts: [fact('fictional-stmt-debit', 'Invoice debit', 'debit', '1,234.500', 'Source receivable debit, tax already included')] },
      { id: 'fictional-stmt-entry-receipt', date: '2026-10-10', description: 'Source receipt posting, not a bank-clearance assertion',
        reference: reference('ReceiptPosting', 'FICTIONAL-REC-1', 'DEMO-REC-1'),
        amounts: [fact('fictional-stmt-credit', 'Receipt credit', 'credit', '300.000', 'Source receivable credit only')] }
    ],
    balances: [fact('fictional-stmt-opening', 'Opening ledger balance', 'openingBalance', '+100.000', 'Debit balance before period; supplied source ledger snapshot'),
      fact('fictional-stmt-closing', 'Closing ledger balance', 'closingBalance', '1,034.500', 'Debit balance at period end; supplied, not recomputed')]
  }, notes: 'Entirely fictional statement. No aging buckets, inferred payment status or bank clearance. Balances are independently supplied snapshots.' };
}
function stock() {
  const quantity = (amount, uom, id) => ({ amount, uom, decimalPlaces: 3, provenance: provenance(`fictional-stock/${id}`, 'Supplied movement quantity; sign is not movement direction') });
  return { ...common('StockMovement', 'DEMO-STOCK-2026-10'), stock: {
    purpose: 'Fictional internal relocation and separate issue/receipt · 虚构调拨及领用/收料',
    lines: [
      { id: 'fictional-stock-transfer', item: { id: 'FICTIONAL-MATERIAL-A', code: 'DEMO-MAT-A', name: 'Fictional sheet material' }, description: 'Move supplied quantity between explicitly named bins', direction: 'transfer',
        quantity: quantity('12.500', 'sheet', 'transfer'), from: { id: 'DEMO-WH-A', name: 'Fictional main store', bin: 'A-01',
          provenance: provenance('fictional-stock/transfer/from', 'Supplied source warehouse and bin') },
        to: { id: 'DEMO-WH-B', name: 'Fictional workshop', bin: 'B-02' }, batch: 'FICTIONAL-LOT-1',
        tracking: { lot: 'FICTIONAL-LOT-1', expiryDate: '2027-04-30', provenance: provenance('fictional-stock/transfer/tracking', 'Supplied lot and expiry only; no shelf-life calculation') },
        reference: reference('TransferInstruction', 'FICTIONAL-TR-1', 'DEMO-TR-1') },
      { id: 'fictional-stock-issue', item: { id: 'FICTIONAL-MATERIAL-B', code: 'DEMO-MAT-B' }, description: 'Independent consumption issue; not a sales delivery', direction: 'outflow',
        quantity: quantity('2.250', 'kg', 'issue'), from: { id: 'DEMO-WH-B', bin: 'B-03' } },
      { id: 'fictional-stock-receipt', item: { id: 'FICTIONAL-MATERIAL-C', code: 'DEMO-MAT-C' }, description: 'Independent supplied stock receipt; not a supplier invoice', direction: 'inflow',
        quantity: quantity('7.000', 'Each', 'receipt'), to: { id: 'DEMO-WH-A', bin: 'A-04' },
        tracking: { serialNumbers: ['DEMO-SERIAL-001', 'DEMO-SERIAL-002'], provenance: provenance('fictional-stock/receipt/serials', 'Source supplied serial list; no quantity inferred from its length') } }
    ]
  }, notes: 'Entirely fictional stock snapshot. Different UOMs are not summed or converted. No inferred valuation, on-hand balance, tax or accounting impact.' };
}
function payroll() {
  return { ...common('PayrollSlip', 'DEMO-PAYSLIP-2026-10'), payroll: {
    employee: { id: 'FICTIONAL-EMPLOYEE-ONLY-001', name: 'Fictional Avery Lantern', department: 'Fictional Training Department', jobTitle: 'Fictional Workshop Demonstrator' },
    period: { from: '2026-10-01', to: '2026-10-15' }, payDate: '2026-10-20',
    components: [
      { ...fact('fictional-pay-basic', 'Basic earnings · 基本工资', 'earning', '2,000.000', 'Source supplied period earnings, not hours × rate'),
        hours: { amount: '0007.500', decimalPlaces: 3, uom: 'hour', provenance: provenance('fictional-payroll/basic/hours', 'Independent source supplied hour basis') },
        hourlyRate: money('111.000', 'fictional-payroll/basic/hourly-rate', 'Independent supplied hourly rate; not used to calculate earnings') },
      fact('fictional-pay-allowance', 'Training allowance', 'earning', '123.456', 'Independent source supplied allowance'),
      fact('fictional-pay-deduction', 'Fictional deduction', 'deduction', '45.678', 'Source supplied demonstration deduction; no jurisdictional tax rule'),
      fact('fictional-pay-employer', 'Employer-only contribution', 'employerContribution', '88.001', 'Employer cost, not an employee deduction and not net pay')
    ],
    summary: [fact('fictional-pay-gross', 'Supplied gross earnings', 'gross', '2,123.456', 'Period gross snapshot from fictional source'),
      fact('fictional-pay-deductions', 'Supplied employee deductions', 'deductions', '45.678', 'Employee deductions snapshot from fictional source'),
      fact('fictional-pay-net', 'Supplied net pay', 'netPay', '2,077.778', 'Net entitlement snapshot, not proof of payment')]
  }, notes: 'All identities and amounts were invented for this fixture. No real employee records, bank identifiers or payroll provider. Not statutory payroll certification or payment execution.' };
}
export function businessDemoInput(kind) {
  const factories = { AccountStatement: statement, StockMovement: stock, PayrollSlip: payroll, ServiceReport: () => serviceDemo(common), PackingList: () => packingDemo(common),
    InspectionReport: () => inspectionDemo(common), AssetHandover: () => handoverDemo(common), ManufacturingOrder: () => manufacturingDemo(common), Timesheet: () => timesheetDemo(common),
    PurchaseRequisition: () => requisitionDemo(common), MaintenanceWorkOrder: () => maintenanceDemo(common) };
  if (!Object.hasOwn(factories, kind)) throw new Error(`Unknown supplied business demo: ${kind}`);
  return factories[kind]();
}
