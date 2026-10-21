import { activityLines } from './ai-activity.js';
import { icon, renderIconStep } from './icons.js';

// Style patches arrive as JSON text; show "fontSize 12 · bold" instead.
const readable = value => {
  const text = String(value);
  if (!text.startsWith('{')) return text;
  try { return Object.entries(JSON.parse(text)).map(([key,item]) => item === true ? key : `${key} ${item}`).join(' · ') || text; } catch { return text; }
};
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
// Plain activity, retained steps and raw changes share one collapsed disclosure.
function renderDetails(message) {
  const diff = message.diff;
  const table = node('table','ai-diff'), head = document.createElement('thead'), row = document.createElement('tr');
  for (const label of ['Setting','Before','After']) { const cell = node('th','',label); cell.scope = 'col'; row.append(cell); } head.append(row);
  const body = document.createElement('tbody');
  for (const entry of diff) { const r = document.createElement('tr'); for (const value of [`${entry.target} · ${entry.property}`,entry.before,entry.after]) r.append(node('td','',readable(value))); body.append(r); }
  table.append(head,body);
  const json = node('pre','ai-diff-json',JSON.stringify(diff,null,2));
  json.tabIndex = 0; json.setAttribute('aria-label','Raw changes as JSON');
  const details = node('details','ai-change-details');
  details.append(node('summary','','Details'));
  const lines = node('ul','ai-activity');
  for (const line of activityLines(diff)) { const item = node('li','',line), image = node('span','ai-activity-icon'); image.innerHTML = icon('check'); item.prepend(image); lines.append(item); }
  details.append(lines);
  if (message.steps?.length) {
    const steps = node('section','ai-run-steps'), count = message.steps.length, list = node('ol','');
    steps.append(node('p','',`Worked in ${count} ${count === 1 ? 'step' : 'steps'}`));
    for (const step of message.steps) list.append(renderIconStep(step));
    steps.append(list); details.append(steps);
  }
  details.append(table,json);
  return details;
}
const HEADINGS = {ready:'Needs your approval',applied:'Applied'};
const withIcon = (element,name) => { const image = node('span','ai-card-icon'); image.innerHTML = icon(name); element.prepend(image); return element; };
function appliedHeader(panel,message) {
  const header = node('div','ai-card-header'), heading = withIcon(node('h3','','Applied'),'check');
  const actions = node('div','ai-card-tools');
  if (panel.canUndo(message)) {
    const undo = withIcon(node('button','','Undo'),'undo'); undo.type = 'button'; undo.dataset.ai = 'undo'; undo.dataset.cardId = message.id; undo.disabled = Boolean(panel.applying);
    if (Number.isInteger(message.appliedRevision)) { const revision = `Undo Revision ${message.appliedRevision}`; undo.title = revision; undo.setAttribute('aria-description',revision); }
    actions.append(undo);
  }
  header.append(heading,actions); return header;
}
function cardState(panel,message,previewed) {
  if (message.status === 'ready') return previewed ? 'Previewed on paper · review it, then Apply' : 'Not applied yet · preview, then Apply';
  if (message.status !== 'applied') return 'Expired · send a new request';
  if (message.appliedBus !== panel.getBus()) return 'Applied to a previous form · history only';
  return panel.canUndo(message) ? 'Applied to the form · Undo restores the previous layout' : 'Applied earlier · history only';
}
export function renderChangeCard(panel,message) {
  const active = panel.proposal?.cardId === message.id;
  const card = node('section','ai-change-card'); card.setAttribute('aria-label','AI layout changes');
  if (active) card.dataset.aiProposal = '';
  const applied = message.status === 'applied', details = renderDetails(message);
  if (applied) card.classList.add('ai-change-applied');
  if (applied && (message.appliedBus !== panel.getBus() || !panel.canUndo(message))) card.classList.add('ai-change-history');
  card.append(applied ? appliedHeader(panel,message) : node('h3','',HEADINGS[message.status] || 'Earlier suggestion'));
  card.append(details);
  const previewed = active && panel.viewing && panel.checked;
  if (!applied || !panel.canUndo(message)) card.append(node('p','ai-card-state',cardState(panel,message,previewed)));
  if (active) {
    const actions = node('div','ai-actions');
    for (const [action,label,disabled] of [['preview',previewed ? 'Preview again' : 'Preview',panel.busy],['apply','Apply',!panel.checked || panel.busy],['discard','Discard',panel.applying]]) {
      const button = node('button',action === 'apply' ? 'primary' : '',label); button.type = 'button'; button.dataset.ai = action; if (action === 'apply') button.dataset.intent = panel.proposal?.intentKey || ''; button.disabled = Boolean(disabled || panel.applying); actions.append(button);
    }
    card.append(actions);
  }
  return card;
}
