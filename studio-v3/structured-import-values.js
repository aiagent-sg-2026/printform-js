import { unsafeJsonKey } from './json-safety.js';

const fail = message => { throw new Error(message); };
export const IMPORT_CONVERSIONS = ['preserve','text','number','boolean'];
export function importParts(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || /~(?![01])/.test(pointer)) fail('Use a safe absolute JSON Pointer.');
  const parts = pointer.slice(1).split('/').map(key=>key.replaceAll('~1','/').replaceAll('~0','~'));
  if (parts.some(unsafeJsonKey)) fail('Prototype and constructor pointers are not supported.');
  return parts;
}
const protectedKey = /^(?:status|docstatus|workflowState|approval.*|approved.*|posting.*|posted.*|submitted.*|signature.*|signed.*|source|provenance|profile|basisProfile)$/i;
export const protectedImportPath = pointer => importParts(pointer).some(key=>protectedKey.test(key.replaceAll('_','').replaceAll('-','')));
export const declaresSourceProfile = data =>
  (typeof data?.profile === 'string' && data.profile.length > 0) ||
  (typeof data?.claim?.basisProfile === 'string' && data.claim.basisProfile.length > 0);
export function importValue(data,pointer) {
  return importParts(pointer).reduce((value,key)=>value !== null && typeof value === 'object' && Object.hasOwn(value,key) ? value[key] : undefined,data);
}
export function convertImportValue(value,conversion) {
  if (!IMPORT_CONVERSIONS.includes(conversion)) fail('Choose an explicit supported conversion.');
  if (value === undefined || value !== null && typeof value === 'object') fail('Every mapped record must supply a scalar source value.');
  if (conversion === 'preserve') return value;
  if (conversion === 'text') return String(value);
  if (conversion === 'boolean') {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    fail('Boolean conversion accepts only true or false (not 0/1, yes/no or blank).');
  }
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) fail('Number conversion requires an explicit decimal without grouping, surrounding spaces or a leading plus.');
  const number = Number(value);
  if (!Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number)) fail('Number conversion must be finite and cannot lose an unsafe integer identifier. Keep the source as text.');
  return number === 0 ? 0 : number;
}
