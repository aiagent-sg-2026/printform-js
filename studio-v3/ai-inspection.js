// This is the entire dynamic-context boundary for a disclosed authoring run.
// No messages, paths, labels, selectors, text, sample values or pixels cross it.
const CODES = new Set(['MONETARY_TOKEN_UNREADABLE','LOGO_ASSET_UNAVAILABLE','TABLE_SECTION_GRID_UNSUPPORTED','AUTHORING_OPERATION_LIMIT','GLOBAL_FONT_PROPERTY_UNSUPPORTED','MALFORMED_PROPOSAL','UNSAFE_PROPOSAL','UNSAFE_SCOPE','NO_CHANGES','COLUMN_WIDTH_LIMIT','PAPER_SIZE_OVERFLOW','PAGINATION_FAILED','PAGE_LIMIT','ROW_COUNT_MISMATCH','ROW_DUPLICATE_INDEX','ROW_MISSING_INDEX','ROW_ORDER_MISMATCH','HORIZONTAL_OVERFLOW','VERTICAL_OVERFLOW','SECTION_OVERLAP','HEADER_MISSING','HEADER_DUPLICATE','DOCINFO_MISSING','DOCINFO_DUPLICATE','IMAGE_ALT_MISSING','TABLE_HEADER_MISSING','CONTRAST_FAILURE','ACTIVE_TABLE_HEADER_MISSING','KEEP_TOGETHER_FAILURE','SIGNATURE_SPLIT','TOTAL_BLOCK_SPLIT','UNEXPECTED_EMPTY_PAGE','MISSING_FIELD','INVALID_POINTER','COLLECTION_NOT_ARRAY','COLUMNS_EMPTY','COLUMN_WIDTHS','NUMBER_REQUIRED','SCALAR_REQUIRED','RENDER_TIMEOUT','RENDER_ERROR','RENDER_FAILED','BINDING_FAILED','PRINTFORM_ROOT_MISSING']);
const numbers = (value,keys) => Object.fromEntries(keys.filter(key=>Number.isFinite(value?.[key]) && value[key] >= 0 && value[key] <= 1000000).map(key=>[key,Math.round(value[key]*100)/100]));
const code = value => CODES.has(value) || value === 'TABLE_BACKGROUND_INTENT' ? value : 'VALIDATION_BLOCKED';
export function safeRunDiagnostics(result,project) {
  const report = result?.report || result, quality = result?.quality || result;
  const ids = new Set((project?.spec?.components || []).map(c=>c.id));
  const errors = [...new Set((quality?.errors || report?.validation?.errors || []).slice(0,30).map(e=>code(e.code)))];
  const issues = (report?.issues || []).slice(0,20).map(issue=>({
    code:code(issue.code), ...(ids.has(issue.component_id) ? {componentId:issue.component_id} : {}),
    ...numbers(issue,['pageIndex','page']),measured:numbers(issue.measured_size,['width','height']),available:numbers(issue.available_size,['width','height'])
  }));
  return {ready:quality?.ready === true || (report?.status === 'ready' && !errors.length),errors,issues,
    metrics:numbers(report?.metrics,['logicalPages','rows','verticalOverflowPages','horizontalOverflowElements','operationCount','maxOperations']),
    pages:(report?.pageGeometry || []).slice(0,24).map(p=>numbers(p,['pageIndex','width','height']))};
}
export function repairRequest(original,{attempt,envelope,diagnostics}) {
  const base = JSON.parse(original);
  let previousProposal = null;
  try { if (typeof envelope === "string" && envelope.length <= 20000) previousProposal = JSON.parse(envelope); } catch {}
  return JSON.stringify({...base,repair:{attempt,previousProposal,diagnostics}},null,2);
}
