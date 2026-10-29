import {block, row, field, esc, label} from './dom.mjs';
import {percent} from './model.mjs';
export function overview(form, d, summary, state, artwork) {
  block(form, `<div><span class="eyebrow">FIELDNOTES / 01</span><div class="wordmark">Lumen<span>Learning, in context.</span></div></div><img src="${esc(artwork)}" alt="Original abstract branching leaves, sun and open book; no people">`, 'masthead');
  row(form, `<h1>${field('document.title', d.document.title)}</h1><p class="kicker">${field('school.name', d.school.name)}</p><p>${field('school.address', d.school.address)}</p>`, 'overview', 'title-card');
  row(form, `<p><b>${label(state, 'Fictional learner', '虚构学习者')}</b> — ${field('child.pseudonym', d.child.pseudonym)} · ${field('child.id', d.child.id)}</p><p>${field('child.className', d.child.className)}</p><p>${field('child.ageBand', d.child.ageBand)}</p><p>${label(state, 'Educator', '教师')} — ${field('school.teacher', d.school.teacher)}</p><p>${field('document.id', d.document.id)} · ${field('document.issued', d.document.issued)} · Source schema ${field('schemaVersion', d.schemaVersion)}</p>`, 'overview', 'identity');
  row(form, `<p>${field('child.introduction', d.child.introduction)}</p><p class="notice">${field('document.notice', d.document.notice)}</p>`, 'overview');
  const c = summary.evidenceCoverage;
  block(form, `<div class="metrics"><div><strong>${summary.observedRecordCount}</strong><span>${label(state, 'Observed evidence records', '已观察记录')}</span><p>${summary.plannedRecordCount} planned — excluded</p></div><div><strong>${c.numerator} / ${c.denominator} <em>${percent(c)}</em></strong><span>${label(state, 'Domain-semester evidence coverage', '领域学期证据覆盖')}</span><p>${c.numerator} of ${c.denominator} configured domain-semester cells have an observed record.</p></div></div>`, 'metrics-wrap');
  row(form, '<p>Counts describe documentation, not ability. Descriptive categories are teacher-authored, never averaged or ranked. A multi-domain observation counts once globally and can cover several cells. Planned records do not count as observed evidence.</p>', 'overview', 'note');
  for (const [i, s] of d.semesters.entries()) {
    const n = d.evidence.filter(e => e.semesterId === s.id && e.status === 'observed').length;
    row(form, `<h3>${field(`semesters.${i}.label`, s.label)}</h3><p>${field(`semesters.${i}.id`, s.id)} · ${field(`semesters.${i}.start`, s.start)} → ${field(`semesters.${i}.end`, s.end)}</p>`, 'overview', 'term-ribbon').dataset.pfKeepWithNext = 'true';
    block(form, `<svg class="count-chart" viewBox="0 0 620 32" role="img" aria-label="${n} observed evidence records in ${esc(s.label)}"><rect x="0" y="4" width="390" height="20" rx="3" fill="#e4eae4"/><rect x="0" y="4" width="${390 * n / Math.max(1, summary.observedRecordCount)}" height="20" rx="3" fill="#286455"/><text x="410" y="20" fill="#223c33" font-size="14">${n} observed records</text></svg>`, 'chart-wrap');
  }
}
