import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fixture, defaults} from '../../gallery/designs/assets/lumen/fixtures.mjs';
import {validate} from '../../gallery/designs/assets/lumen/validate.mjs';
import {summarize, ratio, percent, category} from '../../gallery/designs/assets/lumen/model.mjs';
import {render} from '../../gallery/designs/assets/lumen/template.mjs';
const read = file => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../gallery/designs/assets/lumen', file)));
const sample = read('sample.json');
const build = (domains, terms) => fixture(sample, {...defaults, domains, terms});
describe('PF-067 Lumen independent design expectations', () => {
  it('matches the exact default, all six scales and seven edges', () => {
    expect(summarize(sample)).toEqual(read('expected.json'));
    for (const s of read('scenarios.json')) expect(summarize(build(s.domains, s.semesters))).toEqual(s.expected);
    for (const edge of read('edges.json')) {
      const d = Object.assign(build(4, 1), edge.replaceTopLevel);
      if (edge.valid) expect(summarize(d)).toEqual(edge.expected);
      else expect(() => summarize(d)).toThrow();
    }
  });
  it('deduplicates global multi-domain records but covers several cells', () => {
    const d = build(4, 1); d.evidence[0].domainIds.push(d.domains[3].id);
    const m = summarize(d);
    expect(m.observedRecordCount).toBe(2); expect(m.evidenceCoverage.numerator).toBe(3);
    expect(m.cells[3].reflectionStatus).toBe(null);
    d.reflections[0].status = 'not-observed';
    expect(summarize(d).evidenceCoverage).toEqual(m.evidenceCoverage);
    expect(category('not-observed')).toBe('Not observed'); expect(category(null)).toBe('Not recorded');
  });
  it('rounds exact ratios half-up, retaining missing versus zero semantics', () => {
    expect(ratio(1, 32).percent1dp).toBe('3.1'); expect(ratio(1, 16).percent1dp).toBe('6.3');
    expect(ratio(1, 3).percent1dp).toBe('33.3');
    expect(percent(null)).toBe('Not recorded'); expect(percent(ratio(0, 0))).toBe('Not applicable');
  });
  it('rejects schema, chronology, references and partial attendance errors', () => {
    const mutations = [d => d.extra = 'bad', d => d.document.title = '', d => d.domains.pop(),
      d => d.semesters.reverse(), d => d.semesters[1].start = d.semesters[0].end,
      d => d.document.issued = '0000-01-01', d => d.document.issued = '1900-02-29',
      d => d.evidence[0].date = '2026-07-03', d => d.communications[0].semesterId = 'BAD-ID',
      d => d.reflections.push(d.reflections[0]), d => d.goals[0].evidenceIds.push('BAD-ID'),
      d => d.evidence[0].domainIds.push(d.evidence[0].domainIds[0]), d => d.semesters[0].attendance.unknown = null,
      d => d.semesters[0].attendance.present = '88'];
    for (const mutate of mutations) { const d = structuredClone(sample); mutate(d); expect(() => validate(d)).toThrow(); }
  });
  it('binds every scalar source field exactly once in the authored body and escapes text', () => {
    const d = structuredClone(sample); d.school.teacher = '<script>bad()</script> & 教师';
    const form = render(d, summarize(d), defaults, 'data:image/svg+xml,');
    const fields = [...form.querySelectorAll('[data-source-key]')];
    function visit(v, key = '') {
      if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => visit(x, key ? `${key}.${k}` : k));
      const hits = fields.filter(f => f.dataset.sourceKey === key); expect(hits).toHaveLength(1); expect(hits[0].textContent).toBe(String(v));
    }
    visit(d); expect(form.querySelector('script')).toBeNull();
  });
});
