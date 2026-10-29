import {validate} from './validate.mjs';
export const defaults = {domains:8, terms:2, language:'bilingual', comments:'standard', attendance:'complete'};
const extraTitles = ['Music & rhythm / 音乐节奏', 'Construction & design / 建构设计', 'Listening & reflection / 聆听反思', 'Everyday independence / 生活自主'];
export const longComment = () => Array.from({length:34}, (_, i) => `Observation ${String(i + 1).padStart(2, '0')}: The educator offered quiet time, listened to the learner’s explanation and recorded the materials chosen without inferring ability. 观察${i + 1}：教师耐心倾听学习者说明自己的选择，保留不同情境中的细节，不将描述转化为能力分数。`).join('\n');
export function fixture(sample, state = defaults) {
  validate(sample);
  if (![4, 8, 12].includes(state.domains) || ![1, 2].includes(state.terms)) throw new TypeError('Unsupported scale');
  const d = structuredClone(sample);
  // Exact bound source is authoritative at its own scale; synthesis only for scale controls.
  if (state.domains !== d.domains.length || state.terms !== d.semesters.length) {
    d.domains = Array.from({length:state.domains}, (_, i) => sample.domains[i] ? structuredClone(sample.domains[i]) : {...structuredClone(sample.domains[0]), id:`DOM-${String(i + 1).padStart(2, '0')}`, title:extraTitles[i - 8]});
    d.semesters = sample.semesters.slice(0, state.terms);
    if (d.semesters.length !== state.terms) throw new TypeError('Bound source has no second term; reset/import a two-term sample first');
    d.reflections = []; d.evidence = []; d.goals = [];
    for (const [i, domain] of d.domains.entries()) {
      for (const [t, s] of d.semesters.entries()) {
        if (i === state.domains - 1 && t === state.terms - 1) continue;
        d.reflections.push({...structuredClone(sample.reflections[0]), domainId:domain.id, semesterId:s.id, status:['exploring', 'with-support', 'independently'][(i + t) % 3]});
        d.evidence.push({...structuredClone(sample.evidence[0]), id:`EV-${t + 1}-${String(i + 1).padStart(2, '0')}`, domainIds:[domain.id], semesterId:s.id,
          date:`2026-${t === 0 ? '03' : '09'}-${String(i + 2).padStart(2, '0')}`, status:i === state.domains - 2 && t === state.terms - 1 ? 'planned' : 'observed', title:`Learning invitation ${i + 1} / 学习活动`});
      }
      if (i % 2 === 0) d.goals.push({...structuredClone(sample.goals[0]), id:`GOAL-${String(i + 1).padStart(2, '0')}`, domainId:domain.id, evidenceIds:[`EV-1-${String(i + 1).padStart(2, '0')}`]});
    }
    d.communications = sample.communications.filter(c => d.semesters.some(s => s.id === c.semesterId));
  }
  if (state.comments === 'long' && d.reflections.length) d.reflections[0].comment = longComment();
  for (const s of d.semesters) {
    if (state.attendance === 'missing') s.attendance = {scheduled:null, present:null, absent:null, unknown:null};
    if (state.attendance === 'zero') s.attendance = {scheduled:0, present:0, absent:0, unknown:0};
  }
  return validate(d);
}
