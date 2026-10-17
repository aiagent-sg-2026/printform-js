import { createImportReview, importTargets } from './structured-import-model.js';
import { IMPORT_CONVERSIONS } from './structured-import-values.js';
import { assertBoundedJson } from './json-safety.js';

export function importReviewSnapshot(review) {
  if (!review) return null;
  return {format:review.source.format,text:review.source.text,filename:review.source.filename,sourcePointer:review.sourcePointer,
    targetPointer:review.targetPointer,mappings:structuredClone(review.mappings),mappingPage:review.mappingPage || 0};
}

export function restoreImportReview(project,snapshot) {
  if (!snapshot) return null;
  assertBoundedJson(snapshot,{maxBytes:3*1024*1024,maxDepth:18,label:'Import review recovery'});
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || Object.keys(snapshot).sort().join(',') !== 'filename,format,mappingPage,mappings,sourcePointer,targetPointer,text'
    || typeof snapshot.text !== 'string' || typeof snapshot.filename !== 'string'
    || !['csv','json'].includes(snapshot.format)
    || !Number.isInteger(snapshot.mappingPage) || snapshot.mappingPage < 0
    || !snapshot.mappings || typeof snapshot.mappings !== 'object' || Array.isArray(snapshot.mappings)) throw new Error('Invalid import review recovery.');
  // Match receipt validation: the saved format selects the existing parser.
  // The bounded display name may have lost its suffix; it is not a format hint.
  const review = createImportReview(project,snapshot.text,`local.${snapshot.format}`);
  review.source.filename = snapshot.filename;
  const scope = review.source.scopes.find(entry=>entry.pointer === snapshot.sourcePointer);
  if (!scope) throw new Error('Recovered import scope is unavailable.');
  const targets = new Set(importTargets(project,snapshot.targetPointer).map(field=>field.pointer));
  if (snapshot.mappingPage > Math.max(0,Math.ceil(targets.size/10)-1)) throw new Error('Invalid recovered import field page.');
  const sources = new Set(scope.fields.map(field=>field.pointer));
  for (const [target,mapping] of Object.entries(snapshot.mappings)) {
    if (!targets.has(target) || !mapping || typeof mapping !== 'object' || Array.isArray(mapping)
      || Object.keys(mapping).sort().join(',') !== 'conversion,source'
      || mapping.source !== '' && !sources.has(mapping.source) || !IMPORT_CONVERSIONS.includes(mapping.conversion)) throw new Error('Invalid recovered import mapping.');
  }
  Object.assign(review,{sourcePointer:snapshot.sourcePointer,targetPointer:snapshot.targetPointer,mappings:structuredClone(snapshot.mappings),mappingPage:snapshot.mappingPage});
  // Preview expires across reload; the recovered source and mappings need explicit review again.
  return review;
}
