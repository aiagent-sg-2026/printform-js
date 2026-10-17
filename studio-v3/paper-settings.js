import { PAPER_SIZES_MM } from '../src/printform/paper-sizes.js';
import { resolvePaperDimensions } from '../src/printform/helpers.js';

export { PAPER_SIZES_MM };
export const PAPERS = Object.freeze([...Object.keys(PAPER_SIZES_MM),'CUSTOM']);
export const ORIENTATIONS = Object.freeze(['portrait','landscape']);
export const CUSTOM_MM = Object.freeze({min:20,max:1000});
export const PAGE_SIDES = Object.freeze(['top','right','bottom','left']);
const finite = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const fail = message => { throw new Error(message); };
function exact(value,keys,label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k))) fail(`Unsupported ${label} property.`);
}
export function pageSettings(design) {
  return {paper:design.page?.paper ?? 'A4',orientation:design.page?.orientation ?? 'portrait',
    margins:{top:0,right:0,bottom:0,left:0,...design.page?.margins},
    ...(design.page?.customSizeMm ? {customSizeMm:structuredClone(design.page.customSizeMm)} : {}),
    ...(design.page?.printerProfile ? {printerProfile:structuredClone(design.page.printerProfile)} : {})};
}
export function paperMillimeters(page) {
  const size = page.paper === 'CUSTOM' ? page.customSizeMm : PAPER_SIZES_MM[page.paper];
  if (!size) fail('Choose a supported paper size and supply custom dimensions when required.');
  const width = page.paper === 'CUSTOM' ? size.width : size.widthMm;
  const height = page.paper === 'CUSTOM' ? size.height : size.heightMm;
  return page.orientation === 'landscape' ? {width:height,height:width} : {width,height};
}
export function pageDimensions(design) {
  const page = pageSettings(design);
  if (page.paper !== 'CUSTOM') return resolvePaperDimensions({paperSize:page.paper,orientation:page.orientation,dpi:96});
  const size = paperMillimeters(page);
  return {width:size.width*96/25.4,height:size.height*96/25.4};
}
export function validatePrinterProfile(profile) {
  exact(profile,['version','source','name','minWidthMm','maxWidthMm','minHeightMm','maxHeightMm','orientations','nonPrintableMm','dpi','cutter'],'printer profile');
  if (profile.version !== 1 || profile.source !== 'user-supplied') fail('Printer profiles must be version 1, explicitly user-supplied capabilities, not discovered or certified.');
  if (typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 100) fail('Give the user-supplied printer profile a name (1–100 characters).');
  for (const key of ['minWidthMm','maxWidthMm','minHeightMm','maxHeightMm']) {
    if (profile[key] !== undefined && !finite(profile[key],1,2000)) fail(`${key} must be 1–2000 mm, or blank for unknown.`);
  }
  for (const axis of ['Width','Height']) if (profile[`min${axis}Mm`] !== undefined && profile[`max${axis}Mm`] !== undefined && profile[`min${axis}Mm`] > profile[`max${axis}Mm`]) fail(`Printer minimum ${axis.toLowerCase()} exceeds its maximum.`);
  if (profile.orientations !== undefined && (!Array.isArray(profile.orientations) || !profile.orientations.length || profile.orientations.length > 2 || new Set(profile.orientations).size !== profile.orientations.length || profile.orientations.some(v=>!ORIENTATIONS.includes(v)))) fail('Printer orientations must contain portrait and/or landscape, or remain unknown.');
  if (profile.nonPrintableMm !== undefined) {
    exact(profile.nonPrintableMm,PAGE_SIDES,'printer nonprintable margin');
    for (const value of Object.values(profile.nonPrintableMm)) if (!finite(value,0,100)) fail('Printer nonprintable margins must be 0–100 mm, or blank for unknown.');
  }
  if (profile.dpi !== undefined && (!Number.isInteger(profile.dpi) || !finite(profile.dpi,72,9600))) fail('User-supplied DPI must be an integer from 72–9600, or unknown. It does not change CSS pixel units.');
  if (profile.cutter !== undefined && typeof profile.cutter !== 'boolean') fail('Cutter capability must be true, false, or unknown.');
  return profile;
}
export function validatePageSettings(raw) {
  exact(raw,['paper','orientation','margins','customSizeMm','printerProfile'],'page');
  const page = pageSettings({page:raw});
  if (!PAPERS.includes(page.paper)) fail('Unsupported paper size.');
  if (!ORIENTATIONS.includes(page.orientation)) fail('Unsupported paper orientation.');
  if (page.paper === 'CUSTOM') {
    exact(raw.customSizeMm,['width','height'],'custom paper dimension');
    if (!['width','height'].every(k=>finite(raw.customSizeMm[k],CUSTOM_MM.min,CUSTOM_MM.max))) fail('Custom paper width and height must each be 20–1000 mm. Values are not clamped.');
  } else if (raw.customSizeMm !== undefined) fail('Custom dimensions are only valid with CUSTOM paper. Choose CUSTOM or remove customSizeMm.');
  if (raw.margins !== undefined) {
    exact(raw.margins,PAGE_SIDES,'page margin');
    if (Object.values(raw.margins).some(v=>!finite(v,0,72))) fail('Page margins must be between 0 and 72px (CSS pixels, not mm).');
  }
  const size = pageDimensions({page});
  if (size.width-page.margins.left-page.margins.right < 48 || size.height-page.margins.top-page.margins.bottom < 24) fail('Paper margins leave too little usable area. Keep at least 48px width and 24px height; reduce margins or enlarge paper.');
  if (raw.printerProfile !== undefined) {
    validatePrinterProfile(raw.printerProfile);
    const profile = raw.printerProfile, mm = paperMillimeters(page);
    for (const [axis,value] of [['Width',mm.width],['Height',mm.height]]) {
      if (profile[`min${axis}Mm`] !== undefined && value < profile[`min${axis}Mm`] || profile[`max${axis}Mm`] !== undefined && value > profile[`max${axis}Mm`]) fail(`Selected paper ${axis.toLowerCase()} (${value} mm, after orientation) contradicts the user-supplied printer range. Change paper or update/remove the profile.`);
    }
    if (profile.orientations && !profile.orientations.includes(page.orientation)) fail('Selected orientation contradicts the user-supplied printer profile. Change orientation or update/remove the profile.');
    for (const side of PAGE_SIDES) if (profile.nonPrintableMm?.[side] !== undefined && page.margins[side]*25.4/96 + 1e-7 < profile.nonPrintableMm[side]) fail(`${side} page margin is smaller than the user-supplied nonprintable margin. Increase the page margin (px), or correct/remove the profile (mm).`);
  }
  return raw;
}
export function printerStatus(design) {
  const profile = design.page?.printerProfile;
  const unknown = !profile ? ['all device capabilities'] : ['minWidthMm','maxWidthMm','minHeightMm','maxHeightMm','orientations','dpi','cutter'].filter(key=>profile[key] === undefined);
  if (profile) for (const side of PAGE_SIDES) if (profile.nonPrintableMm?.[side] === undefined) unknown.push(`${side} nonprintable margin`);
  return {physicalBlocked:true,capabilities:profile ? 'user-supplied' : 'unknown',unknown,
    message:`Physical acceptance blocked: no actual device/output has been verified. ${profile ? 'Profile constraints are user-supplied, not discovered or certified.' : 'Printer capabilities are unknown; no device profile selected.'} Browser/PDF layout does not set native paper, DPI, cutter or driver settings.`};
}
