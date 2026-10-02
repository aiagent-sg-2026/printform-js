const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
export function renderConversation(panel) {
  const log = panel.node('[data-ai-log]'), atEnd = log.scrollHeight-log.scrollTop-log.clientHeight < 60;
  log.replaceChildren();
  if (!panel.conversation.messages.length) {
    const intro = node('section','ai-welcome'); intro.append(node('h3','','Let’s shape your print form'),node('p','','Ask about the current layout, or propose colors and spacing. Review every edit on paper before applying it.')); log.append(intro);
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
      for (const diff of message.diff) { const r = document.createElement('tr'); for (const value of [`${diff.target} · ${diff.property}`,diff.before,diff.after]) r.append(node('td','',String(value))); body.append(r); }
      table.append(head,body); card.append(table);
      const state = node('p','ai-card-state',message.status === 'ready' ? 'Not applied · preview first' : message.status === 'applied' ? (message.appliedBus !== panel.getBus() ? 'Applied to a previous form · history only' : panel.canUndo(message) ? 'Applied to the form' : 'Applied earlier · history only') : 'Expired · send a new request'); card.append(state);
      if (active) {
        const actions = node('div','ai-actions');
        for (const [action,label,disabled] of [['preview','Preview',panel.busy],['apply','Apply',!panel.checked || panel.busy],['discard','Discard',panel.applying]]) {
          const button = node('button',action === 'apply' ? 'primary' : '',label); button.type = 'button'; button.dataset.ai = action; button.disabled = Boolean(disabled || panel.applying); actions.append(button);
        }
        card.append(actions);
      } else if (message.status === 'applied' && panel.canUndo(message)) {
        const button = node('button','','Undo this edit'); button.type = 'button'; button.dataset.ai = 'undo'; button.dataset.cardId = message.id; button.disabled = Boolean(panel.applying); card.append(button);
      }
      article.append(card);
    }
    if (message.status === 'error' || message.status === 'cancelled') {
      const button = node('button','ai-retry','Retry with review'); button.type = 'button'; button.dataset.ai = 'retry'; button.dataset.cardId = message.id; article.append(button);
    }
    const time = node('time','ai-message-meta',`${message.role === 'user' ? 'You' : 'AI assistant'} · ${new Date(message.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`);
    time.dateTime = new Date(message.time).toISOString(); article.append(time); log.append(article);
  }
  if (atEnd) log.scrollTop = log.scrollHeight;
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
  panel.root.addEventListener('keydown',event=> {
    if (event.target.id === 'ai-prompt' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void panel.send(); }
  });
  document.addEventListener('keydown',event=> {
    if (!panel.open || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') { event.preventDefault(); panel.close(); }
    if (event.key !== 'Tab' || innerWidth > 900) return;
    const nodes = [...panel.root.querySelectorAll('button,textarea,select,input,summary,[tabindex="0"]')].filter(n=>!n.disabled && n.getClientRects().length);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
  });
}
