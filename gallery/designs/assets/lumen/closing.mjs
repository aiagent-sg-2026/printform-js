import {heading, row, block, field, label, list, refs, esc, node} from './dom.mjs';
import {percent} from './model.mjs';
function attendance(form, d, summary, state) {
  heading(form, '05', label(state, 'Attendance, with unknowns retained', '出勤与未记录天数'), 'attendance');
  row(form, '<p>Known attendance = Present ÷ (Present + Absent). Recording coverage = (Present + Absent) ÷ Scheduled. Unknown days stay unknown; no portfolio-wide average is calculated. Null is Not recorded; a zero denominator is Not applicable.</p>', 'attendance');
  const columns = [28, 18, 18, 18, 18];
  const table = (values, header) => `<colgroup>${columns.map(w => `<col style="width:${w}%">`).join('')}</colgroup><tbody><tr>${values.map(v => `<${header ? 'th' : 'td'}>${v}</${header ? 'th' : 'td'}>`).join('')}</tr></tbody>`;
  const head = node('table', 'prowheader attendance-table', table(['Term', 'Scheduled', 'Present', 'Absent', 'Unknown'], true));
  Object.assign(head.dataset, {pfTableId:'attendance-counts', pfKeepWithNext:'true'}); form.append(head);
  for (const [i, s] of d.semesters.entries()) {
    const a = s.attendance, m = summary.attendance[i], key = `semesters.${i}.attendance`;
    const el = node('table', 'prowitem attendance-table', table([esc(s.id), ...['scheduled', 'present', 'absent', 'unknown'].map(k => field(`${key}.${k}`, a[k] === null ? 'Not recorded' : a[k]))], false));
    Object.assign(el.dataset, {pfTableId:'attendance-counts', pfKeepTogether:'true', pfKeepWithNext:'true'}); form.append(el);
    row(form, `<h3>${esc(s.label)}</h3><p>Known attendance: <b>${percent(m.knownAttendanceRate)}</b>${m.knownAttendanceRate ? ` (${m.knownAttendanceRate.numerator}/${m.knownAttendanceRate.denominator})` : ''} · Recording coverage: <b>${percent(m.recordingCoverage)}</b>${m.recordingCoverage ? ` (${m.recordingCoverage.numerator}/${m.recordingCoverage.denominator})` : ''}</p>`, 'attendance-counts').dataset.pfKeepWithNext = 'true';
    let bar;
    if (a.scheduled === null || a.scheduled === 0) {
      const message = a.scheduled === null ? 'Not recorded' : 'Not applicable — zero scheduled days';
      bar = `<rect x="1" y="1" width="618" height="30" fill="none" stroke="#829b8e" stroke-dasharray="4 3"/><text x="12" y="21" font-size="14" fill="#223c33">${message}</text>`;
    } else {
      let x = 0;
      bar = ['present', 'absent', 'unknown'].map((k, j) => { const w = 620 * a[k] / a.scheduled, rect = `<rect x="${x}" y="2" width="${w}" height="28" fill="${['#286455', '#E9BE69', '#d7ded6'][j]}"/>`; x += w; return rect; }).join('');
    }
    block(form, `<svg class="count-chart" viewBox="0 0 620 32" role="img" aria-label="Attendance ${esc(s.id)}: ${a.scheduled === null ? 'Not recorded' : `Present ${a.present}, absent ${a.absent}, unknown ${a.unknown}`}">${bar}</svg><p class="reference">Forest: present · Apricot: absent · Pale: unknown</p>`, 'chart-wrap', 'attendance-counts');
  }
}
export function closing(form, d, summary, state) {
  const r = d.teacherReview;
  heading(form, '03', label(state, 'Teacher narrative', '教师叙述'), 'teacher');
  row(form, `<p class="review-status">${r.status === 'draft' ? 'Draft — teacher review required' : 'Reviewed — source label only, not institutional approval'}</p><p>${field('teacherReview.summary', r.summary)}</p><h3>${label(state, 'Strengths noticed', '所见长处')}</h3>${list('teacherReview.strengths', r.strengths)}<h3>${label(state, 'Next invitations', '下一步邀请')}</h3>${list('teacherReview.nextSteps', r.nextSteps)}`, 'teacher', 'teacher-quote');
  heading(form, '04', label(state, 'Small, actionable goals', '具体行动目标'), 'goals');
  if (!d.goals.length) row(form, '<p>No goals recorded.</p>', 'goals');
  for (const [i, g] of d.goals.entries()) {
    const k = `goals.${i}`;
    row(form, `<p class="eyebrow">${field(`${k}.id`, g.id)} · ${field(`${k}.domainId`, g.domainId)}</p><h3>${field(`${k}.title`, g.title)}</h3><p><b>Strategy</b> — ${field(`${k}.strategy`, g.strategy)}</p><p><b>Family idea</b> — ${field(`${k}.familyIdea`, g.familyIdea)}</p><p class="reference">Source evidence: ${g.evidenceIds.length ? refs(`${k}.evidenceIds`, g.evidenceIds) : 'No source evidence linked yet'} · Review ${field(`${k}.reviewDate`, g.reviewDate)}</p>`, 'goals', 'goal');
  }
  attendance(form, d, summary, state);
  heading(form, '06', label(state, 'Family discussion & print review', '家庭交流与打印复核'), 'family');
  if (!d.communications.length) row(form, '<p>No family communications recorded.</p>', 'family');
  for (const [i, c] of d.communications.entries()) {
    const k = `communications.${i}`;
    row(form, `<h3>${field(`${k}.topic`, c.topic)}</h3><p class="reference">${field(`${k}.id`, c.id)} · ${field(`${k}.semesterId`, c.semesterId)} · ${field(`${k}.date`, c.date)} · ${field(`${k}.channel`, c.channel)}</p><p>${field(`${k}.summary`, c.summary)}</p><p><b>Next step</b> — ${field(`${k}.nextStep`, c.nextStep)}</p>`, 'family', 'communication');
  }
  row(form, `<h3>Fictional print record — not legally binding authorization</h3><p>Reviewer: ${field('teacherReview.reviewer', r.reviewer)} · Source status: ${field('teacherReview.status', r.status)}</p><p>Discuss the context, check linked evidence, and retain differences between settings. No real signature or institutional approval is collected.</p>`, 'family', 'print-review');
  block(form, '<p>Optional handwritten discussion note</p><div class="discussion-line"></div><div class="discussion-line"></div>', 'discussion', 'family');
}
