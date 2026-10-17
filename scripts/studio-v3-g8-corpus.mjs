import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {FAMILIES, ESSENTIAL, readRegister, validateRegister} from './studio-v3-task-register.mjs';
import {newProject, compileProject} from '../studio-v3/model.js';

export const CORPUS_DIR = 'docs/studio-v3-task-register/corpus';
export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,sort(value[key])]));
  return value;
}
export const digest = value => `sha256:${createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')}`;
export const stateOf = project => ({design:project.manifest.studioV3,data:project.sampleData,schema:project.schema,locale:project.manifest.locale,currency:project.manifest.currency});
export function readCorpus(dir = CORPUS_DIR) {
  return FAMILIES.flatMap(family => JSON.parse(fs.readFileSync(path.join(dir,`${family}.json`),'utf8')));
}
export function validateCorpus(corpus = readCorpus(), register = readRegister()) {
  const errors = validateRegister(register), ids = new Set(), digests = new Set();
  if (corpus.length !== 60) errors.push('corpus must contain exactly 60 cases');
  for (const family of FAMILIES) if (corpus.filter(c => c.family === family).length !== 6) errors.push(`corpus family ${family} must contain six cases`);
  for (const slot of ESSENTIAL) if (corpus.filter(c => c.essential === slot).length !== 1) errors.push(`corpus essential ${slot} must occur once`);
  if (corpus.filter(c => c.holdout).length < 12) errors.push('corpus needs twelve held-out cases');
  for (const c of corpus) {
    const task = register.tasks.rows.find(t => t.id === c.id), hash = digest(c.input);
    if (ids.has(c.id) || digests.has(hash)) errors.push(`${c.id}: duplicate case/input`);
    ids.add(c.id); digests.add(hash);
    if (!task || task.status !== 'frozen' || task.input_digest !== hash || task.family !== c.family || task.essential !== c.essential || task.holdout !== (c.holdout ? 'yes' : 'no')) errors.push(`${c.id}: frozen register/input mismatch`);
    if (task && !task.failure_oracle.startsWith(`${digest(c.oracle)};`)) errors.push(`${c.id}: frozen oracle digest mismatch`);
    if (Buffer.byteLength(canonical(c.input)) > 48000 || !c.input.prompt || !c.input.state?.design || !c.input.state?.data || !c.input.state?.schema) errors.push(`${c.id}: missing or oversized actual input`);
    if (!['answer','candidate','source','denial','roundtrip','history'].includes(c.oracle?.kind)) errors.push(`${c.id}: unsupported oracle`);
    if (!c.oracle || !Object.keys(c.oracle).some(key => key !== 'kind')) errors.push(`${c.id}: missing semantic oracle`);
  }
  return errors;
}
export function projectForCase(c) {
  const project = newProject('invoice',true);
  project.manifest.documentId = `g8-${c.id}`;
  project.manifest.title = `Fictional G8 ${c.id}`;
  project.sampleData = structuredClone(c.input.state.data);
  project.schema = structuredClone(c.input.state.schema);
  project.manifest.locale = c.input.state.locale;
  project.manifest.currency = c.input.state.currency;
  return compileProject(project,c.input.state.design);
}
export function publicInput(c,{qualification = false} = {}) {
  if (c.holdout && !qualification) throw new Error('Held-out input is reserved for formal qualification; never use to tune runtime guides.');
  return {taskId:c.id,inputDigest:digest(c.input),...structuredClone(c.input)};
}
