const LABELS = {get_capabilities:'Checked what the assistant can do',read_skill:'Read a product guide',get_context:'Looked at the form',apply_operations:'Made changes',inspect_draft:'Checked the print preview',observe_context:'Read authorized form context',retrieve_page:'Captured an authorized fictional page/crop',undo_step:'Undid a step',take_notes:'Planned the next step',finish:'Finished',report_blocked:'Reported a problem',
  workspace_list:'Listed isolated source',workspace_read:'Read isolated source',workspace_search:'Searched isolated source',workspace_write:'Wrote isolated source',workspace_patch:'Patched isolated source',workspace_run:'Ran an isolated command',workspace_diff:'Reviewed the source diff',workspace_artifacts:'Retrieved a source-bound artifact',import_artifact:'Imported into the private working copy'};
// Tool results report technical words ("ready", "saved"); the line shows plain ones. Unknown details pass through.
const DETAILS = {ready:'looks good',saved:'done'};
// One line of the run's timeline. A rejected step is shown as such; its code stays in the tooltip, not the line.
export function stepLabel({name,ok,detail,taskOutcome}) {
  if (taskOutcome === 'draft-not-produced') return 'No change was produced · answer retained; form unchanged';
  if (name === 'finish_answer') return ok ? 'Answered without a proposal' : 'Answer rejected, trying again';
  const label = LABELS[name] || 'Worked on the form';
  return ok ? `${label}${detail ? ` · ${DETAILS[detail] || detail}` : ''}` : `${label} · did not work, the assistant is trying another way`;
}
