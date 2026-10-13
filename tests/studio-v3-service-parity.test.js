import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {ledgerRows} from './support/feature-ledger.js';

// COV-03 register: for every workflow the agent can call today, does the UI use the same service?
//   shared      one service, called by the UI adapter and by the Pi adapter, with a parity test
//   parallel    the UI and Pi each have their own implementation; not yet shown to agree (open)
//   agent-only  no separate UI editing workflow to keep in step (host-provided input or agent runtime)
const REGISTER = JSON.parse(fs.readFileSync('docs/studio-v3-service-parity.json','utf8'));
const callable = ledgerRows().filter(row => row.disposition === 'agent-callable' && row.agent_path !== 'none');
const titles = file => [...fs.readFileSync(file,'utf8').matchAll(/\b(?:it|test)(?:\.each\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map(match => match[2]);

describe('Studio v3 UI and Pi service parity register (COV-03)', () => {
  it('has exactly one entry for every workflow the agent can call today', () => {
    const ids = REGISTER.entries.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(callable.map(row => row.id).sort());
  });
  it('cites files that exist, and a parity test for every shared workflow', () => {
    for (const entry of REGISTER.entries) {
      expect(['shared','parallel','agent-only'], entry.id).toContain(entry.status);
      for (const key of ['service','ui','pi']) if (entry[key]) expect(fs.existsSync(entry[key]), `${entry.id}: ${entry[key]}`).toBe(true);
      expect(entry.note, entry.id).toBeTruthy();
      if (entry.status === 'shared') {
        expect(entry.service && entry.ui && entry.pi, entry.id).toBeTruthy();
        expect(fs.existsSync(entry.test.file), entry.id).toBe(true);
        expect(titles(entry.test.file).some(title => title.includes(entry.test.test)), `${entry.id}: ${entry.test.test}`).toBe(true);
      }
      if (entry.status === 'parallel') { expect(entry.ui && entry.pi, entry.id).toBeTruthy(); expect(entry.next, entry.id).toBeTruthy(); expect(entry.test, entry.id).toBeNull(); }
      if (entry.status === 'agent-only') expect(entry.ui, entry.id).toBeNull();
    }
  });
  it('states the open parity debt so it cannot be mistaken for coverage', () => {
    const count = status => REGISTER.entries.filter(entry => entry.status === status).length;
    expect({shared:count('shared'),parallel:count('parallel'),agentOnly:count('agent-only')}).toEqual({shared:4,parallel:16,agentOnly:12});
    const doc = fs.readFileSync('docs/STUDIO_V3_AGENT_REGISTRY.md','utf8');
    expect(doc).toContain(`${count('shared')} shared, ${count('parallel')} parallel, ${count('agent-only')} agent-only`);
  });
});
