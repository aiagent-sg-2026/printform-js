import { STYLE_KEYS, MAX_AUTHORING_DIFFS, fail } from './ai-edits.js';
import { isHexColor } from './table-style.js';
export const HISTORY_LIMIT = 12;
const roles = ['user','assistant'];
const statuses = ['answer','ready','applied','expired','error','cancelled'];
const authoringProperties = new Set(['id','lastPointer','label','kind','pointer','format','text','showLabel','labelStyle','valueStyle','width','assetId','height','fit','add_field','remove_field','field_order','enabled','layout','breakBefore','keepTogether','sectionOrder','page.paper','page.orientation','page.margins','logo','collection','title','typography']);
function validAuthoringDiff(d) {
  if (d.property === 'tableStyle.rowBackground') return d.target === 'items' && [d.before,d.after].every(v=>v === '(unset)' || isHexColor(v));
  const target = typeof d.target === 'string' && /^(document|page-number|header-logo|header-title|(?:label-)?(?:header|customer|items|totals|footer)(?:-[a-z0-9-]{1,60})?)$/.test(d.target);
  const scalar = v=>v === null || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 10000) || (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000000);
  return target && authoringProperties.has(d.property) && scalar(d.before) && scalar(d.after);
}
export function cleanMessages(messages) {
  if (!Array.isArray(messages) || messages.length > HISTORY_LIMIT) throw fail('INVALID_CHAT_RECOVERY');
  return messages.map(message=> {
    if (!message || !roles.includes(message.role) || typeof message.text !== 'string' || message.text.length > 4000 || !Number.isFinite(message.time) || message.time < 0 || message.time > 8640000000000000) throw fail('INVALID_CHAT_RECOVERY');
    const cleaned = {id:crypto.randomUUID(),role:message.role,text:message.text,time:message.time,status:statuses.includes(message.status) ? message.status : 'answer'};
    cleaned.documentKey = typeof message.documentKey === 'string' && /^v3-[a-z0-9-]{1,100}$/i.test(message.documentKey) ? message.documentKey : null;
    if (message.diff) {
      if (message.role !== 'assistant' || !Array.isArray(message.diff) || message.diff.length > MAX_AUTHORING_DIFFS) throw fail('INVALID_CHAT_RECOVERY');
      cleaned.diff = message.diff.map(d=> {
        const style = d.target === 'style' && STYLE_KEYS.includes(d.property), column = /^items-[a-z0-9-]{1,80}$/i.test(d.target) && d.property === 'width';
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
    const message = {id:crypto.randomUUID(),role,text:text.slice(0,4000),status,time:Date.now(),...extra};
    this.messages.push(message); this.messages = this.messages.slice(-HISTORY_LIMIT); return message;
  }
  context(documentKey) {
    const recent = this.messages.filter(m=>m.documentKey === documentKey && ['answer','ready','applied'].includes(m.status)).slice(-6);
    let remaining = 3000;
    return recent.reverse().map(m=> { const content = m.text.slice(0,Math.min(800,remaining)); remaining -= content.length; return {role:m.role,content}; }).filter(m=>m.content).reverse();
  }
  snapshot() { return this.messages.map(({role,text,time,status,diff,documentKey})=>({role,text,time,status,documentKey,...(diff ? {diff} : {})})); }
  restore(messages,documentKey) { this.messages = cleanMessages(messages); }
  expire() { for (const m of this.messages) if (m.diff && m.status === 'ready') m.status = 'expired'; }
}
