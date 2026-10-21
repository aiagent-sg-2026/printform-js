import { parseProposal, fail } from './ai-edits.js';
import { assertScope } from './ai-chat-protocol.js';
import { explicitBindingPointers } from './ai-authoring.js';
import { labelSelection } from './design-authoring.js';
import { protectedBindings, assertProtectedBindings } from './agent-binding-invariants.js';

const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
// One entry per changed property: the value it had at the start and the value it has now. A change that a later
// step reverted disappears, so the human reviewing the result sees the net change only.
function mergeDiff(entries) {
  const merged = new Map();
  for (const entry of entries) {
    const key = `${labelSelection(entry.target)}\u0000${entry.property}`, first = merged.get(key);
    merged.set(key,first ? {...first,after:entry.after} : {...entry});
  }
  return [...merged.values()].filter(entry=>!same(entry.before,entry.after));
}
// The agent's working copy. Every step is checked by the same parser and scope rules as a single proposal, against
// the previous step's result. Only the host commits the final proposal: checked ordinary design edits may auto-apply; other/source work needs human Preview/Apply.
export function createDraft(project,{scope = {mode:'whole'},request = '',references = []} = {}) {
  const steps = [], explicit = explicitBindingPointers(request,references), baseline = protectedBindings(project.manifest.studioV3);
  let current = project, version = 0;
  return {
    get project() { return current; },
    get version() { return version; },
    get count() { return steps.length; },
    apply(summary,operations) {
      const step = parseProposal(JSON.stringify({summary,operations}),current,explicit);
      assertScope(step,scope,current);
      assertProtectedBindings(baseline,step.design);
      steps.push({before:current,...step}); current = step.candidate; version += 1;
      return step;
    },
    undo() {
      const last = steps.pop();
      if (!last) return false;
      current = last.before; version += 1;
      return true;
    },
    // The whole run as one proposal for the existing Preview / Apply / Undo flow.
    proposal(summary) {
      const diff = mergeDiff(steps.flatMap(step=>step.diff)), last = steps.at(-1);
      if (!last || !diff.length) throw fail('NO_CHANGES');
      assertProtectedBindings(baseline,last.design);
      return {
        kind:'proposal',summary,diff,targets:[...new Set(steps.flatMap(step=>step.targets))],
        ownership:Object.assign({},...steps.map(step=>step.ownership)),operations:steps.flatMap(step=>step.operations),
        design:last.design,candidate:last.candidate
      };
    }
  };
}
