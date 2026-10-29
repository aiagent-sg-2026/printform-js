import {heading, row, field, label, list, refs, esc} from './dom.mjs';
import {category} from './model.mjs';
export function domains(form, d, state) {
  heading(form, '02', label(state, 'Evidence & educator reflections', '学习证据与教师反思'), 'domains-intro');
  row(form, '<p>Read observations in their original context. Exploring · With support · Independently · Not observed are descriptive categories supplied by an educator. Not recorded means the reflection cell is absent. None is an ability score.</p>', 'domains-intro');
  for (const [i, domain] of d.domains.entries()) {
    const id = `domain-${i}`, key = `domains.${i}`;
    const intro = row(form, `<h3>${field(`${key}.title`, domain.title)} <span class="reference">${field(`${key}.id`, domain.id)}</span></h3><p>${field(`${key}.description`, domain.description)}</p><p><b>${label(state, 'Look-fors', '观察线索')}</b> — ${refs(`${key}.lookFors`, domain.lookFors)}</p>`, id, 'domain-intro');
    intro.dataset.pfKeepWithNext = 'true';
    const reflectionCards = [];
    for (const term of d.semesters) {
      const index = d.reflections.findIndex(r => r.domainId === domain.id && r.semesterId === term.id), r = d.reflections[index];
      if (!r) {
        reflectionCards.push(`<h3>${esc(term.label)} · Not recorded</h3><p>No reflection recorded for ${esc(domain.id)} / ${esc(term.id)}.</p>`);
      } else {
        const k = `reflections.${index}`;
        reflectionCards.push(`<h3>${esc(term.label)} · ${category(r.status)}</h3><p class="reference">${field(`${k}.domainId`, r.domainId)} · ${field(`${k}.semesterId`, r.semesterId)} · ${field(`${k}.status`, r.status)}</p><p>${field(`${k}.comment`, r.comment)}</p>`);
      }
    }
    if (state.comments === 'long' || d.reflections.some(r => r.domainId === domain.id && r.comment.length > 700)) reflectionCards.forEach(html => row(form, html, id, 'reflection'));
    else row(form, reflectionCards, id, 'reflection');
    // A multi-domain record is authored once, under its first referenced domain.
    // Other domains contain references only, never duplicated observation prose.
    const records = d.evidence.map((e, index) => ({e, index})).filter(({e}) => e.domainIds[0] === domain.id);
    const links = d.evidence.filter(e => e.domainIds.slice(1).includes(domain.id));
    if (!records.length) row(form, '<p>No primary evidence records in this domain. Missing evidence is not a zero ability judgment.</p>', id, 'note');
    const evidenceCards = [];
    for (const {e, index} of records) {
      const k = `evidence.${index}`;
      evidenceCards.push(`<div class="${e.status === 'planned' ? 'planned-record' : 'observed-record'}" data-evidence-id="${esc(e.id)}"><h3>${field(`${k}.title`, e.title)} <span class="reference">${field(`${k}.id`, e.id)}</span></h3><p class="reference"><b class="evidence-tag">${e.status === 'planned' ? 'Planned — excluded' : 'Observed'}</b> · ${field(`${k}.date`, e.date)} · ${field(`${k}.semesterId`, e.semesterId)} · ${refs(`${k}.domainIds`, e.domainIds)} · ${field(`${k}.status`, e.status)}</p><p>${field(`${k}.description`, e.description)}</p><p class="next-note"><b>${label(state, 'Next observation', '下次观察')}</b> — ${field(`${k}.teacherNote`, e.teacherNote)}</p></div>`);
    }
    // Long source cards use the ordinary full-width measured continuation path.
    // Paired editorial cards are only for concise source records, never shrunk.
    if (evidenceCards.length === 2 && records.every(({e}) => [e.title, e.description, e.teacherNote].join('').length < 700)) row(form, evidenceCards, id, 'evidence');
    else evidenceCards.forEach(html => row(form, html, id, 'evidence'));
    if (links.length) row(form, `<p class="reference">Shared evidence references (full records elsewhere): ${links.map(e => esc(e.id)).join(' · ')}</p>`, id, 'note');
  }
}
