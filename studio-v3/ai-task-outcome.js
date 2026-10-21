export const TASK_OUTCOMES = Object.freeze(['answered','draft-not-produced','draft-ready']);
export const DRAFT_NOT_PRODUCED = 'Requested draft not completed: no inspected proposal was delivered. The model answer below is not a preview or an applied change. Edit & resend the request to try again; the form is unchanged.';
// Legacy draft-not-produced metadata remains readable in stored conversations.
export function answerResult(message) {
  return {kind:'answer',message,taskOutcome:'answered'};
}
export function taskOutcomeNotice(outcome) {
  return outcome === 'draft-not-produced' ? DRAFT_NOT_PRODUCED : '';
}
