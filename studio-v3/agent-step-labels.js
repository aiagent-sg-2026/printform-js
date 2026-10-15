const LABELS = {get_capabilities:'Read available capabilities',read_skill:'Read a product guide',get_context:'Read the form',apply_operations:'Changed the draft',inspect_draft:'Checked the print preview',observe_context:'Read authorized form context',retrieve_page:'Captured an authorized fictional page/crop',undo_step:'Undid a step',take_notes:'Made a note',finish:'Handed over the result',report_blocked:'Reported a block',
  workspace_list:'Listed isolated source',workspace_read:'Read isolated source',workspace_search:'Searched isolated source',workspace_write:'Wrote isolated source',workspace_patch:'Patched isolated source',workspace_run:'Ran an isolated command',workspace_diff:'Reviewed the source diff',workspace_artifacts:'Retrieved a source-bound artifact',import_artifact:'Imported into the private draft'};
// One line of the run's timeline. A rejected step is shown as such; its code stays in the tooltip, not the line.
export function stepLabel({name,ok,detail}) {
  const label = LABELS[name] || 'Worked on the draft';
  return ok ? `${label}${detail ? ` · ${detail}` : ''}` : `${label} · rejected, trying again`;
}
