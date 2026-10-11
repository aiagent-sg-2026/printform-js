import { runScenarioMatrix } from './scenario-matrix.js';

// The Validate panel's "Run all synthetic samples" button. Clicking it again while it runs stops it and restores the
// committed paper. Any new run, edit or navigation bumps state.runId; a result that arrives after that is dropped.
export function createValidateAll({state,project,render,stopRun,cancelPaper,invalidateAI,renderPanels,syncControls}) {
  return async function validateAll() {
    if (state.running) { stopRun(); cancelPaper(); renderPanels(); await render(); return; }
    invalidateAI(); const run = ++state.runId; state.running = true; state.matrix = {}; renderPanels(); syncControls();
    const current = () => run === state.runId, stop = new AbortController();
    try {
      await runScenarioMatrix({project:project(),signal:stop.signal,
        render:async candidate => { const report = await render(candidate); if (!current()) stop.abort(); return report; },
        onScenario:scenario => { state.matrix[scenario.id] = scenario.quality; renderPanels(); }});
    } catch (error) { if (!current()) return; throw error; }
    if (!current()) return;
    state.running = false; renderPanels(); await render();
  };
}
