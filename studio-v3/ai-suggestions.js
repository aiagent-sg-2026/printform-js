import { icon } from './icons.js';
export const SUGGESTIONS = Object.freeze([
  ['type','Make title larger and blue'],['image','Add a fictional company logo on the left'],['align','Move totals to the left'],['items','Improve table style'],['qr','Add a fictional payment QR placeholder'],
  ['spacing','Increase section spacing'],['type','Use consistent fonts'],['items','Balance table column widths'],['header','Align header text to the left'],['footer','Add a fictional footer note']
].map(([name,prompt])=>Object.freeze({name,prompt})));
export function visibleSuggestions(offset=0) { return Array.from({length:5},(_,index)=>SUGGESTIONS[((offset+index)%SUGGESTIONS.length+SUGGESTIONS.length)%SUGGESTIONS.length]); }
const states = new WeakMap();
export function setupSuggestions(panel) {
  const section=document.createElement('section'), heading=document.createElement('div'), title=document.createElement('h3'), refresh=document.createElement('button'), chips=document.createElement('div');
  section.className='ai-suggestions'; section.setAttribute('data-ai-suggestions',''); section.setAttribute('aria-label','Suggested actions'); heading.className='ai-suggestions-heading'; title.innerHTML=icon('lightbulb'); title.append('Suggested actions');
  refresh.type='button'; refresh.setAttribute('aria-label','Show other suggestions'); refresh.innerHTML=icon('refresh'); chips.className='ai-suggestion-chips'; heading.append(title,refresh); section.append(heading,chips);
  let offset=0;
  const render=()=> { chips.replaceChildren(...visibleSuggestions(offset).map(({name,prompt})=> { const button=document.createElement('button'); button.type='button'; button.dataset.ai='prompt'; button.dataset.prompt=prompt; button.innerHTML=icon(name); button.append(prompt); return button; })); };
  refresh.addEventListener('click',()=> { if (refresh.disabled) return; offset=(offset+5)%SUGGESTIONS.length; render(); updateSuggestions(panel); });
  states.set(panel,{section,refresh,chips,render}); panel.node('.ai-composer').before(section); updateSuggestions(panel);
}
export function updateSuggestions(panel) {
  const state=states.get(panel); if (!state) return;
  const disabled=Boolean(panel.busy || panel.applying || panel.restoring || panel.referenceFiles?.reading);
  if (!panel.conversation.messages.length) state.chips.replaceChildren();
  else if (!state.chips.childElementCount) state.render();
  state.section.hidden=true;
  state.refresh.disabled=disabled; for (const button of state.chips.querySelectorAll('[data-prompt]')) button.disabled=disabled;
}
