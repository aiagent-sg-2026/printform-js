import { fail } from './ai-edits.js';

// Only the bounded, public report_blocked field is presentation data. Never use
// exception messages, causes, source output or logs as a substitute for it.
export function publicBlockedReason(error) {
  return error?.code === 'AGENT_BLOCKED' && typeof error.reason === 'string' && error.reason.length >= 1 && error.reason.length <= 500
    ? error.reason : null;
}
export function blockedError(blocked) {
  const error = fail(blocked.code), reason = publicBlockedReason(blocked);
  if (reason !== null) error.reason = reason;
  return error;
}
