export function setupVersionHistory(panel) {
  const button = panel.node('[data-ai-history]'), popover = panel.node('#ai-history');
  if (!button || !popover) return;
  panel.closeVersionHistory = (focus=true)=> {
    if (popover.hidden) return false;
    popover.hidden = true; button.setAttribute('aria-expanded','false');
    if (focus) button.focus(); return true;
  };
  const render = ()=> {
    const bus = panel.getBus(), title = document.createElement('strong'), list = document.createElement('ul');
    title.textContent = 'Retained revisions';
    // Undo/redo allocate a new revision without adding a snapshot entry. Never invent missing history.
    const revisions = [...new Set([...(bus?.history.entries || []).map(entry=>entry.revision),bus?.revision])].filter(Number.isSafeInteger).sort((a,b)=>a-b);
    for (const revision of revisions) {
      const item = document.createElement('li'); item.textContent = `Revision ${revision}${revision === bus.revision ? ' · Current' : ''}`;
      if (revision === bus.revision) item.setAttribute('aria-current','true'); list.append(item);
    }
    popover.replaceChildren(title,list);
  };
  panel.updateVersionHistory = ()=> {
    button.disabled = Boolean(panel.busy || panel.applying || panel.restoring || !panel.getBus());
    if (button.disabled) { const focused = popover.contains(document.activeElement); panel.closeVersionHistory(false); if (focused) panel.node('#ai-prompt')?.focus(); }
    else if (!popover.hidden) render();
  };
  button.addEventListener('click',()=> {
    if (button.disabled || panel.busy || panel.applying) return;
    if (panel.closeVersionHistory()) return;
    panel.node('.ai-settings').open = false; render(); popover.hidden = false; button.setAttribute('aria-expanded','true'); popover.focus();
  });
  panel.root.addEventListener('click',event=> { if (!popover.contains(event.target) && !button.contains(event.target)) panel.closeVersionHistory(false); });
  panel.updateVersionHistory();
}
