// Generates studio-v3/agent-workflows.js from the feature ledger CSV (the authority), so the agent can tell people
// which workflows are human-mediated, intentionally unavailable or not yet callable, without a hand-kept list.
// Run after editing the ledger: node scripts/generate-studio-v3-workflows.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './studio-v3-task-register.mjs';

export const LEDGER = 'docs/STUDIO_V3_FEATURE_LEDGER.csv';
export const MODULE = 'studio-v3/agent-workflows.js';

// A row is callable today when it is agent-callable and the current registry reaches it.
export function workflowStatus(row) {
  if (row.disposition !== 'agent-callable') return row.disposition;
  return row.agent_path === 'none' ? 'not-yet-callable' : 'callable';
}

export function renderWorkflowsModule(csvText) {
  const rows = parseCsv(csvText).rows.map(row => [row.id,row.feature,workflowStatus(row),row.human_path || row.reason]).filter(row => row[2] !== 'callable');
  const lines = rows.map(row => `  ${JSON.stringify(row)},`);
  return `// Generated from ${LEDGER} by scripts/generate-studio-v3-workflows.mjs. Do not edit by hand.\n`
    + '// [ledger id, workflow, status, human path or reason] for every workflow the agent cannot perform today.\n'
    + `export const LEDGER_WORKFLOWS = Object.freeze([\n${lines.join('\n')}\n].map(row=>Object.freeze(row)));\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(MODULE,renderWorkflowsModule(fs.readFileSync(LEDGER,'utf8')));
  console.log(`Wrote ${MODULE}.`);
}
