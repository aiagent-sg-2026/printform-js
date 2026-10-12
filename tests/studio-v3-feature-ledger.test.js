import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {read,ledgerRows} from './support/feature-ledger.js';

const LEDGER_MD = read('docs/STUDIO_V3_FEATURE_LEDGER.md');
const ROWS = ledgerRows();
const DISPOSITIONS = ['agent-callable','human-mediated','intentionally-unavailable'];
// Bare entries are action IDs; `attr:value` selector entries are checked in the selector test.
const ledgerIds = new Set(ROWS.flatMap(row => row.ui_entries.split(';').filter(id => id && !id.includes(':'))));
const sourceFiles = ['studio-v3/index.html','studio-v3/app.js','studio-v3/database-controller.js','studio-v3/database-view.js','studio-v3/views.js','studio-v3/workspace-views.js','studio-v3/form-drafts.js'];
const between = (text,start,end) => text.slice(text.indexOf(start),end ? text.indexOf(end,text.indexOf(start)) : undefined);
const names = text => [...text.matchAll(/name === '([a-z-]+)'/g)].map(m => m[1]);

function uiActionIds() {
  const ids = new Set();
  for (const file of sourceFiles) for (const m of read(file).matchAll(/data-(?:db-)?action="([a-z-]+)"/g)) ids.add(m[1]);
  for (const id of names(between(read('studio-v3/app.js'),'async function action(name)','document.querySelectorAll'))) ids.add(id);
  for (const id of names(between(read('studio-v3/database-controller.js'),'async action('))) ids.add(id);
  return [...ids].sort();
}

describe('Studio v3 feature ledger (COV-01 integrity)', () => {
  it('maps every UI data-action and database action ID to a ledger row', () => {
    const ids = uiActionIds();
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter(id => !ledgerIds.has(id))).toEqual([]);
  });
  it('does not reference UI entry IDs that no longer exist', () => {
    const source = sourceFiles.map(read).join('\n');
    const stale = [...ledgerIds].filter(id => !source.includes(`'${id}'`) && !source.includes(`"${id}"`));
    expect(stale).toEqual([]);
  });
  it('has unique stable IDs, a valid disposition and a reason for every row', () => {
    expect(new Set(ROWS.map(row => row.id)).size).toBe(ROWS.length);
    for (const row of ROWS) {
      expect(row.id, row.id).toMatch(/^printform\.[a-z]+\.[a-z-]+$/);
      expect(DISPOSITIONS, row.id).toContain(row.disposition);
      expect(row.reason, row.id).not.toBe('');
      expect(['yes','no'], row.id).toContain(row.eligible_gap);
      expect(row.eligible_gap === 'yes' ? row.disposition : 'agent-callable', row.id).toBe('agent-callable');
      if (row.agent_path === 'none') expect(row.reason, row.id).not.toMatch(/^Reachable/);
    }
  });
  it('names a service, knowledge and evaluation owner and human path where required', () => {
    for (const row of ROWS) {
      expect(row.service_owner && row.knowledge_owner && row.evaluation_owner, row.id).toBeTruthy();
      if (row.disposition === 'human-mediated') expect(row.human_path || row.ui_entries || row.reason, row.id).toBeTruthy();
      for (const owner of [row.service_owner,row.evaluation_owner]) if (!owner.startsWith('planned:')) expect(fs.existsSync(owner), `${row.id}: ${owner}`).toBe(true);
    }
  });
  it('keeps the Markdown summary equal to the CSV counts', () => {
    const count = key => ROWS.filter(row => row.disposition === key).length;
    expect(LEDGER_MD).toContain(`| Ledger rows | ${ROWS.length} |`);
    for (const key of DISPOSITIONS) expect(LEDGER_MD).toContain(`| ${key} | ${count(key)} |`);
    expect(LEDGER_MD).toContain(`| Eligible gaps (missing or limited agent paths) | ${ROWS.filter(row => row.eligible_gap === 'yes').length} |`);
  });
  it('keeps both ledger files within the 300-line limit', () => {
    expect(LEDGER_MD.split('\n').length).toBeLessThanOrEqual(300);
    expect(read('docs/STUDIO_V3_FEATURE_LEDGER.csv').split('\n').length).toBeLessThanOrEqual(300);
  });
});
