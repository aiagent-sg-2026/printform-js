import { icon } from './icons.js';
// Starting actions shown in the empty conversation: each fills the message box, nothing is sent.
export const STARTERS = [
  ['form','Organize form','Organize this form into a clear reading order. Keep existing data bindings and make section headings easy to scan.'],
  ['type','Improve spacing','Improve the typography and spacing of this form so it is easy to read when printed. Keep existing content and data bindings.'],
  ['plus','Add notes area','Add a clearly labelled static notes area at the end of this form without changing existing data bindings.'],
  ['eye','Review layout','What would improve the readability and print layout of this form? Explain your recommendations without changing anything.']
];
const node = (tag,className,text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
// The empty conversation offers local prompt starters without sending a request.
export function renderWelcome() {
  const intro = node('section','ai-welcome'), chips = node('div','ai-chips');
  for (const [name,label,prompt] of STARTERS) {
    const chip = node('button',''); chip.type = 'button'; chip.dataset.ai = 'prompt'; chip.dataset.prompt = prompt;
    chip.insertAdjacentHTML('beforeend',icon(name)); chip.append(node('span','',label)); chips.append(chip);
  }
  intro.append(node('h3','','What would you like to change?'),chips);
  return intro;
}
