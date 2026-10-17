import { JSON_PROJECT_LIMITS, parseBoundedJson } from './json-safety.js';
import { DATASET_FORMAT, sameData } from './database-model.js';
import { createImportReview, importTargets, previewImport } from './structured-import-model.js';
import { importReceipt } from './structured-import-receipt.js';
import { IMPORT_CONVERSIONS } from './structured-import-values.js';
import { saveProject } from './file-io.js';

function checkedPreview(database,review) {
  const preview = previewImport(database.project,review), receipt = importReceipt(review,preview);
  const project = {...database.project,sampleData:preview.data,manifest:{...database.project.manifest,localImport:receipt}};
  parseBoundedJson(saveProject(project),{...JSON_PROJECT_LIMITS,label:'Portable import (project with original source)'});
  return {preview:{...preview,receipt},receipt};
}
export async function reviewImportFile(database,source,filename='') {
  // Keep the existing portable dataset wrapper contract and source schema path.
  if (!/\.csv$/i.test(filename) && /^[\s\uFEFF]*\{/.test(source) && parseBoundedJson(source.replace(/^\uFEFF/,''),{maxDepth:18}).format === DATASET_FORMAT) return database.import(source.replace(/^\uFEFF/,''));
  const review = createImportReview(database.project,source,filename);
  database.importReview = review; database.screen = 'database'; database.error = '';
  database.message = 'Local file parsed. Map fields, preview every validation result, then explicitly Apply. The form and saved datasets are unchanged.';
}
export function editImportReview(database,target) {
  const control = target.dataset.dbImportControl;
  if (!control) return false;
  const review = database.importReview;
  if (!review) return true;
  if (control === 'source') {
    if (!review.source.scopes.some(scope=>scope.pointer === target.value)) throw new Error('Choose an available source scope.');
    review.sourcePointer = target.value; review.mappings = {};
  } else if (control === 'target') {
    importTargets(database.project,target.value);
    review.targetPointer = target.value; review.mappings = {};
  } else {
    const pointer = target.dataset.dbImportField;
    if (!importTargets(database.project,review.targetPointer).some(field=>field.pointer === pointer)) throw new Error('Unavailable import target.');
    const mapping = review.mappings[pointer] || {source:'',conversion:'preserve'};
    if (control === 'field') mapping.source = target.value;
    else if (control === 'conversion' && IMPORT_CONVERSIONS.includes(target.value)) mapping.conversion = target.value;
    else throw new Error('Unsupported import mapping control.');
    review.mappings[pointer] = mapping;
  }
  review.preview = null; database.error = ''; database.render(); return true;
}
export async function importReviewAction(database,name) {
  const review = database.importReview;
  if (name === 'import-cancel') {
    database.importReview = null; database.error = ''; database.message = 'Import cancelled. Form data, table edits and saved datasets are unchanged.'; return;
  }
  if (!review) throw new Error('Choose a CSV or JSON file first.');
  if (name === 'import-preview') { review.preview = null; review.preview = checkedPreview(database,review).preview; return; }
  if (!review.preview) throw new Error('Preview this mapping before Apply. Mapping changes invalidate the previous preview.');
  const {preview,receipt} = checkedPreview(database,review);
  if (!sameData(preview.data,review.preview.data) || !sameData(receipt,review.preview.receipt)) throw new Error('The source or mapping changed after preview. Preview again before Apply.');
  if ((database.draft || database.state.dataDraft !== null) && !confirm('Replace unapplied table or JSON edits with this reviewed import? Saved database records will not change.')) return;
  await database.callbacks.apply(preview.data,null,database.context,{kind:'imported-data',name:`Local file: ${review.source.filename}`},undefined,undefined,receipt);
  database.resetDraft();
  database.message = 'Reviewed local import applied to the real form. Saved datasets are unchanged. Save form / Open retains this general data, its existing schema, original local file and mapping; legacy-compatible data can additionally use Save as new. No source authenticity or business approval is asserted.';
}
