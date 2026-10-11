import { renderWelcome } from './ai-welcome.js';
// Style patches arrive as JSON text; show "fontSize 12 · bold" instead.
const readable = value => {
  const text = String(value);
  if (!text.startsWith('{')) return text;
  try { return Object.entries(JSON.parse(text)).map(([key,item]) => item === true ? key : `${key} ${item}`).join(' · ') || text; } catch { return text; }
};
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
export function renderConversation(panel) {
  const log = panel.node('[data-ai-log]'), atEnd = log.scrollHeight-log.scrollTop-log.clientHeight < 60;
  log.replaceChildren();
  if (!panel.conversation.messages.length) {
    log.append(renderWelcome());
  }
  for (const message of panel.conversation.messages) {
    const article = node('article',`ai-message ai-${message.role}`); article.dataset.messageId = message.id;
    article.append(node('div','ai-message-text',message.text));
    if (message.diff) {
      const active = panel.proposal?.cardId === message.id;
      const card = node('section','ai-change-card'); card.setAttribute('aria-label','AI layout changes');
      if (active) card.dataset.aiProposal = '';
      const table = node('table','ai-diff'), head = document.createElement('thead'), row = document.createElement('tr');
      for (const label of ['Setting','Before','After']) row.append(node('th','',label)); head.append(row);
      const body = document.createElement('tbody');
      for (const diff of message.diff) { const r = document.createElement('tr'); for (const value of [`${diff.target} · ${diff.property}`,diff.before,diff.after]) r.append(node('td','',readable(value))); body.append(r); }
      table.append(head,body); card.append(table);
      const previewed = active && panel.viewing && panel.checked;
      const state = node('p','ai-card-state',message.status === 'ready' ? (previewed ? 'Previewed on paper · review it, then Apply' : 'Not applied · preview first') : message.status === 'applied' ? (message.appliedBus !== panel.getBus() ? 'Applied to a previous form · history only' : panel.canUndo(message) ? 'Applied to the form' : 'Applied earlier · history only') : 'Expired · send a new request'); card.append(state);
      if (active) {
        const actions = node('div','ai-actions');
        for (const [action,label,disabled] of [['preview',previewed ? 'Preview again' : 'Preview on page',panel.busy],['apply','Apply',!panel.checked || panel.busy],['discard','Discard',panel.applying]]) {
          const button = node('button',action === 'apply' ? 'primary' : '',label); button.type = 'button'; button.dataset.ai = action; if (action === 'apply') button.dataset.intent = panel.proposal?.intentKey || ''; button.disabled = Boolean(disabled || panel.applying); actions.append(button);
        }
        card.append(actions);
      } else if (message.status === 'applied' && panel.canUndo(message)) {
        const button = node('button','','Undo this edit'); button.type = 'button'; button.dataset.ai = 'undo'; button.dataset.cardId = message.id; button.disabled = Boolean(panel.applying); card.append(button);
      }
      article.append(card);
    }
    // Only the newest failure can be resent; after a later request an old Edit & resend would be stale history.
    if ((message.status === 'error' || message.status === 'cancelled') && panel.conversation.messages.at(-1) === message) {
      const button = node('button','ai-retry','Edit & resend'); button.type = 'button'; button.dataset.ai = 'retry'; button.dataset.cardId = message.id; article.append(button);
    }
    article.setAttribute('aria-label',message.role === 'user' ? 'You' : 'AI assistant'); log.append(article);
  }
  // The wait is shown where the answer will appear. The status line stays the announced source, so this copy is hidden from readers.
  if (panel.pendingMessage) {
    const wait = node('article','ai-message ai-assistant ai-pending'); wait.setAttribute('aria-hidden','true');
    wait.append(node('div','ai-message-text ai-pending-text',panel.node('[data-ai-status]').textContent || 'Working…'));
    // A run in steps shows its latest steps; a rejected one carries its code in the tooltip only.
    if (panel.agentSteps?.length) {
      const steps = node('ol','ai-steps');
      for (const step of panel.agentSteps.slice(-6)) { const item = node('li',step.ok ? '' : 'ai-step-failed',`${step.ok ? '✓' : '✗'} ${step.text}`); if (step.code) item.title = step.code; steps.append(item); }
      wait.append(steps);
    }
    log.append(wait);
  }
  // The empty state reads from its top; a running conversation follows its newest message.
  if (!panel.conversation.messages.length) log.scrollTop = 0;
  else if (atEnd) log.scrollTop = log.scrollHeight;
}
export function setupPanelLayout(panel) {
  const key = 'printform-studio-v3:ai-width', separator = panel.node('[data-ai-resize]');
  let width = 390;
  try { const saved = localStorage.getItem(key); if (/^\d{3}$/.test(saved) && Number(saved) >= 320 && Number(saved) <= 600) width = Number(saved); } catch {}
  const set = value=> { width = Math.max(320,Math.min(600,Math.round(value))); document.body.style.setProperty('--ai-width',`${width}px`); separator.setAttribute('aria-valuenow',String(width)); };
  const save = ()=> { try { localStorage.setItem(key,String(width)); } catch {} };
  set(width);
  separator.addEventListener('keydown',event=> {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); set(event.key === 'Home' ? 320 : event.key === 'End' ? 600 : width+(event.key === 'ArrowLeft' ? 20 : -20)); save();
  });
  separator.addEventListener('pointerdown',event=> {
    if (event.button !== 0) return;
    separator.setPointerCapture(event.pointerId); const start = event.clientX, before = width;
    const move = e=>set(before+start-e.clientX);
    const end = ()=> { separator.removeEventListener('pointermove',move); separator.removeEventListener('pointerup',end); separator.removeEventListener('pointercancel',end); save(); };
    separator.addEventListener('pointermove',move); separator.addEventListener('pointerup',end); separator.addEventListener('pointercancel',end);
  });
  panel.root.addEventListener('focusin',event=> {
    const input=event.target.closest('.ai-input');
    if(!input)return;const bounds=event.target.getBoundingClientRect(),view=panel.node('.ai-composer').getBoundingClientRect();
    if(bounds.top<view.top || bounds.bottom>view.bottom)input.scrollIntoView?.({block:'nearest',inline:'nearest'});
  });
  panel.root.addEventListener('keydown',event=> {
    if (event.target.id === 'ai-prompt' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void panel.send(); }
  });
  document.addEventListener('keydown',event=> {
    if (!panel.open || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); const menu = panel.node('.ai-settings');
      if (menu.open) { menu.open = false; menu.querySelector('summary').focus(); } else panel.close(); // the open menu takes the first Escape
    }
    if (event.key !== 'Tab' || innerWidth > 900) return;
    const nodes = [...panel.root.querySelectorAll('button,textarea,select,input,summary,[tabindex="0"]')].filter(n=>!n.disabled && n.getClientRects().length);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
  });
}
