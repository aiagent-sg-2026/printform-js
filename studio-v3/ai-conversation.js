import { STYLE_KEYS, MAX_AUTHORING_DIFFS, fail } from './ai-edits.js';
import { isHexColor } from './table-style.js';
import { TASK_OUTCOMES } from './ai-task-outcome.js';
import { validatePageSettings, validatePrinterProfile } from './paper-settings.js';
import { validateBarcodeSettings } from './design-validation.js';
export const HISTORY_LIMIT = 12;
const roles = ['user','assistant'];
const statuses = ['answer','ready','applied','expired','error','cancelled'];
const receiptIdentity = observation => {
  if (!observation || typeof observation.id !== 'string' || !/^observation-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(observation.id)) throw fail('INVALID_CHAT_RECOVERY');
  return {id:observation.id};
};
const authoringProperties = new Set(['id','lastPointer','label','kind','pointer','format','text','showLabel','labelStyle','valueStyle','width','assetId','height','fit','add_field','remove_field','field_order','enabled','layout','breakBefore','keepTogether','sectionOrder','page.paper','page.orientation','page.margins','logo','collection','title','typography']);
function validPageDiff(property,value) {
  if (value === '(unset)') return true;
  if (typeof value !== 'string' || value.length > 10000) return false;
  try {
    const parsed = JSON.parse(value);
    if (property === 'page.customSizeMm') validatePageSettings({paper:'CUSTOM',customSizeMm:parsed});
    else validatePrinterProfile(parsed);
    return true;
  } catch { return false; }
}
function validBarcodeDiff(value) {
  if (value === '(unset)') return true;
  if (typeof value !== 'string' || value.length > 10000) return false;
  try { validateBarcodeSettings(JSON.parse(value)); return true; } catch { return false; }
}
function validAuthoringDiff(d) {
  if (['page.customSizeMm','page.printerProfile'].includes(d.property)) return d.target === 'document' && [d.before,d.after].every(value=>validPageDiff(d.property,value));
  if (['tableStyle.rowBackground','tableStyle.headerBackground','tableStyle.headerColor'].includes(d.property)) return d.target === 'items' && [d.before,d.after].every(v=>v === '(unset)' || isHexColor(v));
  const target = typeof d.target === 'string' && d.target.length <= 80 && /^(document|page-number|header-logo|header-title|(?:label-)?(?:header|customer|items|totals|footer)(?:-[a-z0-9-]{1,60})?|(?:label-)?table-[a-z0-9-]{1,68})$/.test(d.target);
  if (d.property === 'barcode') return target && !d.target.startsWith('label-') && !['document','page-number','header-logo','header-title','header','customer','items','totals','footer'].includes(d.target) && [d.before,d.after].every(validBarcodeDiff);
  const scalar = v=>v === null || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 10000) || (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000000);
  return target && authoringProperties.has(d.property) && scalar(d.before) && scalar(d.after);
}
export function cleanMessages(messages) {
  if (!Array.isArray(messages) || messages.length > HISTORY_LIMIT) throw fail('INVALID_CHAT_RECOVERY');
  return messages.map(message=> {
    if (!message || !roles.includes(message.role) || typeof message.text !== 'string' || message.text.length > 4000 || !Number.isFinite(message.time) || message.time < 0 || message.time > 8640000000000000) throw fail('INVALID_CHAT_RECOVERY');
    const cleaned = {id:crypto.randomUUID(),role:message.role,text:message.text,time:message.time,status:statuses.includes(message.status) ? message.status : 'answer'};
    if (message.at !== undefined) {
      if (!Number.isSafeInteger(message.at) || message.at < 0 || message.at > 8640000000000000) throw fail('INVALID_CHAT_RECOVERY');
      cleaned.at = message.at;
    }
    if (message.observationProtected === true) cleaned.observationProtected = true;
    if (message.taskOutcome !== undefined) {
      if (message.role !== 'assistant' || !TASK_OUTCOMES.includes(message.taskOutcome)) throw fail('INVALID_CHAT_RECOVERY');
      cleaned.taskOutcome = message.taskOutcome;
      if (message.taskOutcome === 'draft-not-produced') cleaned.status = 'error';
    }
    if (message.observation !== undefined) {
      if (message.role !== 'assistant') throw fail('INVALID_CHAT_RECOVERY');
      cleaned.observation = receiptIdentity(message.observation);
    }
    cleaned.documentKey = typeof message.documentKey === 'string' && /^v3-[a-z0-9-]{1,100}$/i.test(message.documentKey) ? message.documentKey : null;
    if (message.diff) {
      if (message.role !== 'assistant' || !Array.isArray(message.diff) || message.diff.length > MAX_AUTHORING_DIFFS) throw fail('INVALID_CHAT_RECOVERY');
      cleaned.diff = message.diff.map(d=> {
        const style = d.target === 'style' && STYLE_KEYS.includes(d.property), column = /^(?:items-[a-z0-9-]{1,80}|table-[a-z0-9-]{1,68})$/i.test(d.target) && d.property === 'width';
        const valid = v=>d.property === 'color' ? typeof v === 'string' && /^#[a-f0-9]{6}$/i.test(v) : ['font','padding','width'].includes(d.property) ? Number.isFinite(v) && v >= (d.property === 'font' ? 6 : d.property === 'padding' ? 2 : 1) && v <= (d.property === 'font' ? 14 : d.property === 'padding' ? 16 : 100) : typeof v === 'boolean';
        const structuralWidth = column && (d.before === '(unset)' || d.after === '(unset)') && [d.before,d.after].every(v=>v === '(unset)' || valid(v));
        if ((!style && !column) ? !validAuthoringDiff(d) : !structuralWidth && (!valid(d.before) || !valid(d.after))) throw fail('INVALID_CHAT_RECOVERY');
        return {target:d.target,property:d.property,before:d.before,after:d.after};
      });
      cleaned.status = 'expired';
    }
    return cleaned;
  });
}
export class Conversation {
  constructor() { this.messages = []; }
  add(role,text,status='answer',extra={}) {
    const now = Date.now(), message = {id:crypto.randomUUID(),role,text:text.slice(0,4000),status,time:now,...extra,at:now};
    if (extra.observation !== undefined) message.observation = receiptIdentity(extra.observation);
    this.messages.push(message); this.messages = this.messages.slice(-HISTORY_LIMIT); return message;
  }
  context(documentKey) {
    const recent = this.messages.filter(m=>!m.observationProtected && m.documentKey === documentKey && ['answer','ready','applied'].includes(m.status)).slice(-6);
    let remaining = 3000;
    return recent.reverse().map(m=> { const content = m.text.slice(0,Math.min(800,remaining)); remaining -= content.length; return {role:m.role,content}; }).filter(m=>m.content).reverse();
  }
  snapshot() { return this.messages.map(({role,text,time,at,status,diff,documentKey,observationProtected,observation,taskOutcome})=>({role,text,time,...(at !== undefined ? {at} : {}),status,documentKey,...(taskOutcome ? {taskOutcome} : {}),...(observationProtected ? {observationProtected:true} : {}),...(observation ? {observation:receiptIdentity(observation)} : {}),...(diff ? {diff} : {})})); }
  restore(messages,documentKey) { this.messages = cleanMessages(messages); }
  expire() { for (const m of this.messages) if (m.diff && m.status === 'ready') m.status = 'expired'; }
}
