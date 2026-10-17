import { requestIntent } from './ai-request-intent.js';

export const TASK_OUTCOMES = Object.freeze(['answered','draft-not-produced','draft-ready']);
export const DRAFT_NOT_PRODUCED = 'Requested draft not completed: no inspected proposal was delivered. The model answer below is not a preview or an applied change. Edit & resend the request to try again; the form is unchanged.';
// The expected deliverable is host-owned, independent of the model's finish tool or prose.
// This metadata does not grant an effect or certify that a candidate satisfies every user requirement.
export function answerTaskOutcome(intent) {
  return intent?.kind === 'draft' ? 'draft-not-produced' : 'answered';
}
export function answerResult(message,request) {
  return {kind:'answer',message,taskOutcome:answerTaskOutcome(requestIntent(request))};
}
export function taskOutcomeNotice(outcome) {
  return outcome === 'draft-not-produced' ? DRAFT_NOT_PRODUCED : '';
}
