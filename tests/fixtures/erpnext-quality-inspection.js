import { readFileSync } from 'node:fs';
import { ERPNEXT_QUALITY_INSPECTION_PROFILE, ERPNEXT_QUALITY_INSPECTION_REVISION } from '../../studio-v3/erpnext-quality-inspection-adapter.js';

// Repository test cwd, not import.meta: this fixture also runs under Playwright's CJS transform.
export const qualityInspectionRaw = () => readFileSync('tests/fixtures/erpnext-quality-inspection.json', 'utf8');
const exact = (amount, decimalPlaces, uom, sourcePath) => ({ amount, decimalPlaces, uom,
  provenance: { sourcePath: `fictional-authorized-export/${sourcePath}`, meaning: 'Fictional independently authorized exact decimal, precision and measurement UOM; not calibration or approval.' } });
export function fictionalErpNextQualityInspection() {
  const base = 'snapshot.document.readings[1]';
  return { profile: ERPNEXT_QUALITY_INSPECTION_PROFILE,
    context: { erpnextVersion: '15.0.0', sourceRevision: ERPNEXT_QUALITY_INSPECTION_REVISION,
      site: 'fictional-quality.invalid', inspectionName: 'F-QI-2026-001', referenceRowName: 'F-PR-ITEM-1' },
    snapshotJson: qualityInspectionRaw(), exact: {
      [`${base}.reading_1`]: exact('-0000.1250', 4, 'mm', 'offset/reading_1'),
      [`${base}.reading_2`]: exact('+0000.0000', 4, 'mm', 'offset/reading_2'),
      [`${base}.min_value`]: exact('-0000.2000', 4, 'mm', 'offset/min_value'),
      [`${base}.max_value`]: exact('+0000.2000', 4, 'mm', 'offset/max_value')
    } };
}
export function changeQualitySnapshot(input, mutate) {
  const snapshot = JSON.parse(input.snapshotJson); mutate(snapshot);
  input.snapshotJson = JSON.stringify(snapshot); return input;
}
