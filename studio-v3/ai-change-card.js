import { activityLines } from './ai-activity.js';

// Style patches arrive as JSON text; show "fontSize 12 · bold" instead.
const readable = value => {
  const text = String(value);
  if (!text.startsWith('{')) return text;
  try { return Object.entries(JSON.parse(text)).map(([key,item]) => item === true ? key : `${key} ${item}`).join(' · ') || text; } catch { return text; }
};
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
// Technical properties, the raw diff and its JSON live here, collapsed; the card itself shows plain activity lines.
function renderDetails(diff) {
  const table = node('table','ai-diff'), head = document.createElement('thead'), row = document.createElement('tr');
  for (const label of ['Setting','Before','After']) { const cell = node('th','',label); cell.scope = 'col'; row.append(cell); } head.append(row);
  const body = document.createElement('tbody');
  for (const entry of diff) { const r = document.createElement('tr'); for (const value of [`${entry.target} · ${entry.property}`,entry.before,entry.after]) r.append(node('td','',readable(value))); body.append(r); }
  table.append(head,body);
  const json = node('pre','ai-diff-json',JSON.stringify(diff,null,2));
  json.tabIndex = 0; json.setAttribute('aria-label','Raw changes as JSON');
  const details = node('details','ai-change-details');
  details.append(node('summary','',`Details · ${diff.length} technical change${diff.length === 1 ? '' : 's'}`),table,json);
  return details;
}
const HEADINGS = {ready:'Suggested changes',applied:'Changes applied'};
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
  card.append(node('h3','',HEADINGS[message.status] || 'Earlier suggestion'));
  const lines = node('ul','ai-activity');
  for (const line of activityLines(message.diff)) lines.append(node('li','',line));
  card.append(lines,renderDetails(message.diff));
  const previewed = active && panel.viewing && panel.checked;
  card.append(node('p','ai-card-state',cardState(panel,message,previewed)));
  if (active) {
    const actions = node('div','ai-actions');
    for (const [action,label,disabled] of [['preview',previewed ? 'Preview again' : 'Preview on page',panel.busy],['apply','Apply',!panel.checked || panel.busy],['discard','Discard',panel.applying]]) {
      const button = node('button',action === 'apply' ? 'primary' : '',label); button.type = 'button'; button.dataset.ai = action; if (action === 'apply') button.dataset.intent = panel.proposal?.intentKey || ''; button.disabled = Boolean(disabled || panel.applying); actions.append(button);
    }
    card.append(actions);
  } else if (message.status === 'applied' && panel.canUndo(message)) {
    const button = node('button','','Undo this edit'); button.type = 'button'; button.dataset.ai = 'undo'; button.dataset.cardId = message.id; button.disabled = Boolean(panel.applying); card.append(button);
  }
  return card;
}
