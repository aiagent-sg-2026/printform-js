import { renderWelcome } from './ai-welcome.js';
import { taskOutcomeNotice } from './ai-task-outcome.js';
import { renderChangeCard } from './ai-change-card.js';
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
export function renderConversation(panel) {
  const log = panel.node('[data-ai-log]'), scroll = panel.node('.ai-conversation-scroll') || log;
  const position = scroll.scrollTop, atEnd = scroll.scrollHeight-position-scroll.clientHeight < 60;
  const sharing = panel.node('.ai-sharing'), granted = ['#ai-observation-text','#ai-observation-pixels'].filter(selector=>panel.node(selector)?.checked).length;
  if (sharing) sharing.querySelector('summary').textContent = granted ? `Sharing permissions · ${granted} selected for one run` : 'Sharing permissions · fictional data only';
  log.replaceChildren();
  if (!panel.conversation.messages.length) {
    log.append(renderWelcome());
  }
  for (const message of panel.conversation.messages) {
    const article = node('article',`ai-message ai-${message.role}`); article.dataset.messageId = message.id;
    article.dataset.state = message.status || 'answer';
    const outcome = message.status === 'error' ? ' · request failed' : message.status === 'cancelled' ? ' · stopped' : '';
    article.append(node('div','ai-message-label',message.role === 'user' ? 'You' : `AI assistant${outcome}`));
    const notice = taskOutcomeNotice(message.taskOutcome);
    if (notice) { const state = node('p','ai-card-state',notice); state.setAttribute('role','status'); article.append(state); }
    article.append(node('div','ai-message-text',message.text));
    if (message.observation) {
      const citation = node('div','ai-observation-receipt',`Observation receipt: ${message.observation.id}`);
      citation.setAttribute('aria-label','Answer observation receipt'); article.append(citation);
    }
    if (message.diff) article.append(renderChangeCard(panel,message));
    // Only the newest failure can be resent; after a later request an old Edit & resend would be stale history.
    if ((message.status === 'error' || message.status === 'cancelled') && panel.conversation.messages.at(-1) === message) {
      const button = node('button','ai-retry','Edit & resend'); button.type = 'button'; button.dataset.ai = 'retry'; button.dataset.cardId = message.id; article.append(button);
    }
    article.setAttribute('aria-label',message.role === 'user' ? 'You' : 'AI assistant'); log.append(article);
  }
  // The wait is shown where the answer will appear. The status line stays the announced source, so this copy is hidden from readers.
  if (panel.pendingMessage) {
    const wait = node('article','ai-message ai-assistant ai-pending'); wait.setAttribute('aria-hidden','true');
    wait.append(node('div','ai-message-label','AI assistant'));
    wait.append(node('div','ai-message-text ai-pending-text',panel.node('[data-ai-status]').textContent || 'Working…'));
    // A run in steps shows its latest steps; a rejected one carries its code in the tooltip only.
    if (panel.agentSteps?.length) {
      const steps = node('ol','ai-steps');
      for (const step of panel.agentSteps.slice(-6)) { const item = node('li',step.ok ? '' : 'ai-step-failed',`${step.ok ? '✓' : '✗'} ${step.text}`); if (step.code) item.title = step.code; steps.append(item); }
      wait.append(steps);
    }
    log.append(wait);
  }
  // Respect a reader's position in history; only a reader already at the end follows new work.
  scroll.scrollTop = panel.conversation.messages.length && atEnd ? scroll.scrollHeight : position;
}
export function setupPanelLayout(panel) {
  const key = 'printform-studio-v3:ai-width', separator = panel.node('[data-ai-resize]');
  let width = 390;
  try { const saved = localStorage.getItem(key); if (/^\d{3}$/.test(saved) && Number(saved) >= 320 && Number(saved) <= 600) width = Number(saved); } catch {}
  const set = value=> { width = Math.max(320,Math.min(600,Math.round(value))); document.body.style.setProperty('--ai-width',`${width}px`); separator.setAttribute('aria-valuenow',String(width)); panel.fitPrompt(); };
  const save = ()=> { try { localStorage.setItem(key,String(width)); } catch {} };
  set(width);
  window.addEventListener('resize',()=>panel.fitPrompt());
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
  const settings = panel.node('.ai-settings');
  panel.root.addEventListener('click',event=> {
    if (settings.open && !settings.contains(event.target)) settings.open = false;
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
