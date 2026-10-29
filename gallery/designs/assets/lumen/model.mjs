import {validate} from './validate.mjs';
export function ratio(numerator, denominator) {
  if (![numerator, denominator].every(n => Number.isSafeInteger(n) && n >= 0)) throw new TypeError('Ratio requires nonnegative safe integers');
  if (denominator === 0) return {numerator, denominator, percent1dp:null};
  const n = BigInt(numerator) * 1000n, d = BigInt(denominator);
  const rounded = (2n * n + d) / (2n * d);
  return {numerator, denominator, percent1dp:`${rounded / 10n}.${rounded % 10n}`};
}
export function summarize(data) {
  const d = validate(data), observed = d.evidence.filter(e => e.status === 'observed');
  const cells = d.semesters.flatMap(s => d.domains.map(domain => {
    const ids = observed.filter(e => e.semesterId === s.id && e.domainIds.includes(domain.id)).map(e => e.id);
    const reflection = d.reflections.find(r => r.semesterId === s.id && r.domainId === domain.id);
    return {semesterId:s.id, domainId:domain.id, observedEvidenceIds:ids, observedEvidenceCount:ids.length, reflectionStatus:reflection?.status ?? null};
  }));
  const attendance = d.semesters.map(s => {
    const a = s.attendance, missing = a.scheduled === null;
    return {semesterId:s.id, state:missing ? 'missing' : 'recorded',
      knownAttendanceRate:missing ? null : ratio(a.present, a.present + a.absent),
      recordingCoverage:missing ? null : ratio(a.present + a.absent, a.scheduled)};
  });
  return {documentId:d.document.id, domainCount:d.domains.length, semesterCount:d.semesters.length,
    observedRecordCount:observed.length, plannedRecordCount:d.evidence.length - observed.length,
    evidenceCoverage:ratio(cells.filter(c => c.observedEvidenceCount > 0).length, cells.length),
    coverageMeaning:'domain-semester cells with at least one observed evidence record / all configured domain-semester cells; not ability or development score',
    cells, attendance, goalCount:d.goals.length, communicationCount:d.communications.length};
}
export const percent = r => r === null ? 'Not recorded' : r.percent1dp === null ? 'Not applicable' : `${r.percent1dp}%`;
export const category = status => ({exploring:'Exploring', 'with-support':'With support', independently:'Independently', 'not-observed':'Not observed'})[status] ?? 'Not recorded';
