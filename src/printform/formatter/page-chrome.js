import { DomHelpers } from '../dom.js';

// Track each source section separately: docinfo variants and different table
// headings are legitimate peers. Weak keys release the state with the page.
const pageClones = new WeakMap();
export function appendPageChromeOnce(container, source, logFn, label) {
  if (!source) return null;
  let clones = pageClones.get(container);
  if (!clones) { clones = new WeakMap(); pageClones.set(container, clones); }
  const existing = clones.get(source);
  if (existing?.parentNode === container) return null;
  const clone = DomHelpers.appendClone(container, source, logFn, label);
  if (clone) clones.set(source, clone);
  return clone;
}
