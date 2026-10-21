import { COMMIT_POLICY_SHORT } from './agent-commit-policy.js';
import { CURRENCY_CODES } from './currency-catalog.js';
import { BUSINESS_DOCUMENT_KINDS } from './business-document-adapter.js';

export const GENERAL_PRINT_SKILL = Object.freeze({
  id:'general-print-authoring',
  description:'Independent supplied-source tables, exact offline barcodes, Studio primary currencies and supplied-business document contracts; distinguishes callable draft edits from human workflows.',
  sources:['studio-v3/agent-general-print-guide.js','studio-v3/additional-tables.js','studio-v3/additional-table-controls.js','studio-v3/design-validation.js','studio-v3/controller.js','studio-v3/currency-catalog.js','studio-v3/business-manufacturing-timesheet.js','studio-v3/business-requisition-maintenance.js','studio-v3/erpnext-material-request-adapter.js','studio-v3/odoo-maintenance-request-adapter.js','studio-v3/erpnext-quality-inspection-adapter.js','studio-v3/business-document-adapter.js','studio-v3/business-document-project.js','studio-v2/core/barcode.js','studio-v2/core/barcode-binding.js','studio-v2/core/barcode-inspection.js','studio-v3/structured-import-model.js','studio-v3/file-io.js'],
  evaluations:['tests/studio-v3-additional-tables.test.js','tests/studio-v3-barcode-authoring.test.js','tests/studio-v3-offline-barcode.test.js','tests/studio-v3-barcode-binding.test.js','tests/studio-v3-currency-catalog.test.js','tests/studio-v3-manufacturing-timesheet.test.js','tests/studio-v3-requisition-maintenance.test.js','tests/studio-v3-erpnext-material-request.test.js','tests/studio-v3-odoo-maintenance-request.test.js','tests/fixtures/odoo-maintenance-request.js','tests/fixtures/odoo-maintenance-request.json','tests/studio-v3-erpnext-quality-inspection.test.js','tests/fixtures/erpnext-quality-inspection.js','tests/fixtures/erpnext-quality-inspection.json','tests/studio-v3-capability-chat-recovery.test.js','tests/studio-v3-authoring-boundary-regressions.test.js','tests/studio-v3-barcode-content-diagnostics.test.js','tests/studio-v3-requisition-maintenance-agent.test.js','e2e/studio-v3-additional-tables-barcode.spec.js','e2e/studio-v3-offline-barcode.spec.js','e2e/studio-v3-barcode-overflow.spec.js','e2e/studio-v3-barcode-nested-overflow.spec.js','e2e/studio-v3-numeric-binding-finish.spec.js','e2e/studio-v3-business-document.spec.js','e2e/studio-v3-erpnext-material-request.spec.js','e2e/studio-v3-odoo-maintenance-request.spec.js','e2e/studio-v3-erpnext-quality-inspection.spec.js'],
  content:`# General supplied-data print authoring

get_context IDs; form-authoring/schemas limits. Private draft; inspect final candidate before finish. ${COMMIT_POLICY_SHORT} Guides grant no effects; read-only cannot author; finish_answer is not draft. Readiness proves no source/semantic/production acceptance.

## Independent tables and operations

Primary: collection + columns + blocks.items. Up to4 additionalTables,5 total; unique table-prefixed IDs, label, absolute collection Pointer, enabled/repeatHeader/breakBefore,1..30 columns each. Column width1..100%, sum<=100%. Columns use owning-array ./relative paths, document fields /absolute paths. No wildcards/expressions/prototype paths/joins/flattening/cross-array totals/inferred sums/source mutation.
Only object-row arrays with ./scalar fields, no scalar/mixed arrays/object values. New/enabled/rebound empty arrays need schema; unchanged legal empty tables remain editable. Empty invents no zeros. Independent rows/headers/counts/pagination/data survive Save/Open/standalone. Creation order in primary body slot; hiding items leaves extras.
set_field:{target,patch}: scoped existing extra columns (context IDs, e.g. table-work-operation); remove_field:{target}: retain>=1 column. Labels/styles cannot rebind/change meaning. add_field/reorder_fields: header/customer/items/totals/footer only. set_section/set_collection/reorder_sections/set_table_style cannot create/rebind/reorder/style extras; no add_table/new_dataset/import/save. Human: JSON > Template structure > Add independent source table; Properties > Apply source table; column Properties/Data binding. Deletion preserves source/primary.

## Exact offline barcodes

kind:"barcode",existing string pointer,text:"",format:"",barcode:{format:CODE128/EAN13,moduleWidth:integer1..4,height:integer20..160,displayValue:boolean}. Nested CSS px, not field width/height; table width %. add_field: original slots/supplied paths; set_field: separate nonprotected string; rows use owning collection. Human Data binding > Printable barcode > Offline barcode > Apply binding.
Numeric kind/text/format protected; financial/canonical/fixed/barcode pointer/collection protected across removal/re-addition. Compatible ordinary primary numeric rebinding allowed; inspect actual typed-data/formatter, not global typeof-number rules.
CODE128: exact1..128 ASCII U+0020..U+007E, preserve spaces/case/leading zeros; no coercion/trim. EAN13:13 supplied digits + valid supplied check digit, not12digits/numbers/whitespace; never invent check digit. No GS1 ownership/application identifiers/licensing/certification/scanner qualification inference.
SVG/quiet zones never shrink. Check entire symbol against every enclosing td/th/.field content box (excluding padding/borders) and page. BARCODE_CONTENT_OVERFLOW: once/symbol, <=20 failing-container details. Widen allocation/adjust config, never source. Config acceptance proves no source/checksum/fit. Offline JsBarcode3.12.1/MIT, no CDN/image/fetch.
Numeric diagnostics omit barcode values; observe_context needs disclosure. Config history is expired, not Apply authority.

## Currency and source facts

Studio primary:${CURRENCY_CODES.join(', ')} (16-code ISO4217 subset). Human Data > Locale & currency. Unsupported portable primary rejects; legal linked/base/context currencies (AED/BHD) and core formatter remain supported. Explicit currency:nonempty string document.currency, not object/null. Supported source/display must match. Legacy mismatches open/save for repair; new edits cannot create them. Source/import previews show effects; accepted change syncs metadata, no conversion. Currency/dataset/import human-only.
No FX/tax/rounding-rule/total recomputation. Preserve amounts/currency tokens/decimal spelling/precision/quantities/hours/signs/UOM/IDs/status/provenance and /printRows/context pointers; status is not approval.

## Supplied-business contracts

Human New:${BUSINESS_DOCUMENT_KINDS.join(', ')} via supplied-business-v1; starters, not connectors/real-event evidence. ManufacturingOrder: no BOM/inventory calculation/stock posting/completion inference. Timesheet: no payroll/wages/approval/certification. PurchaseRequisition/MaintenanceWorkOrder: no procurement approval/orders/work authorization/parts consumption/completion certification. Preserve absent optional facts.
Business/ERP settlement/transaction/Globe3: external SDK > Studio Open, not file-picker/agent tools. No arbitrary ERP/ISO/UBL/GS1 import; CSV/JSON needs reviewed mappings/supported canonical profile.
- ERPNext v15.0.0 Purchase Material Request: exact-export envelope + native Company + authorized amount/decimalPlaces/provenance overlay per qty. Float checks consistency, never recovers lost zeros/precision. Other purposes/versions unsupported; no approval/procurement/stock/cost/work execution.
- Pinned Odoo17 maintenance.request Node SDK: authorized snapshotJson + database/request/version/source-revision identity + equipment/company/stage -> MaintenanceWorkOrder. Not client/RPC/arbitrary import. Subject=requested work, not execution; no invented quantities/approval/completion/schedule timezone/HTML-to-text instructions.
- Pinned ERPNext v15.0.0 Quality Inspection Node SDK -> InspectionReport. reading_value/reading_1..10 are Data: exact strings/signs/zeros/locale spelling. Float limits need supplied exact amount/precision/UOM/provenance; no formulas/acceptance/averages/compliance evaluation. Exact selected site/inspection + reference/company/item/child identities required; duplicate decoded JSON keys reject.
All native evidence/original snapshots remain unprinted live data in share copies. No SDK grants connector/raw-file picker/new canonical kind/callable adapter.

## Human import and sharing

Human Data > Import CSV / JSON > collection/row mapping > Preview > Apply: review rows/requirements/currency for all enabled tables on that collection. No joins; exact barcode strings/schema/provenance/canonical bindings protected.
Save/Open keeps design/data/tables/barcodes; standalone HTML bundles validated offline runtime. Share copy removes only original local-import receipt/source text/filename from separate download, NOT live/unbound data/printed values/labels/images/template metadata or filenames copied into content. Not anonymization; inspect contents. Current data/receipt/history/unsaved state unchanged; pending/session/import/recovery privacy separate. Print/downloads/persistence/committed Undo/Redo human-only. No physical scan/print/all-ERP/production qualification from guides/unexecuted tests.
`
});
