export const AI_MESSAGES = {
  DEMO_IMAGE_CAPABILITY_UNVERIFIED:'Image support is not confirmed for this Demo model. Image analysis is unavailable. Use Check image support to try again, or choose Text & positions and reattach the PDF to send without images.',
  DEMO_SESSION_FORBIDDEN:'Demo session rejected (HTTP 403) for project github-pages and this browser Origin. The gateway owner must check the existing registration. Nothing changed.',
  DEMO_SESSION_UNAVAILABLE:'Demo session unavailable. Check connection or existing origin registration. Nothing changed.',
  DEMO_SESSION_EXPIRED:'Demo session expired after one refresh. Retry with review. Nothing changed.',
  DEMO_MODEL_UNAVAILABLE:'The selected Demo alias is unavailable. Discover models again. Nothing changed.',
  DEMO_RATE_LIMIT:'Demo request limit reached. Try again later. Nothing changed.',
  DEMO_REQUEST_FAILED:'Demo request failed. Check gateway availability. Nothing changed.',
  MALFORMED_PROPOSAL:'The model did not return a complete supported answer or proposal. Nothing changed.',
  UNSAFE_PROPOSAL:'The model proposed an unsupported or unsafe edit. Nothing changed.',
  TABLE_BACKGROUND_INTENT:'The suggestion did not match the requested table row background. Ask for the intended row fill or exact hex color. Nothing changed.',
  UNSAFE_SCOPE:'The suggestion exceeds the selected scope. Choose Whole template for global styles. Nothing changed.',
  COLUMN_WIDTH_LIMIT:'Proposed column widths exceed 100%. Nothing changed.',
  NO_CHANGES:'The suggestion contains no layout changes. Nothing changed.',
  STALE_PROPOSAL:'Form changed, or the selection/scope changed. Send a new request. Nothing changed.',
  AI_TIMEOUT:'The request timed out. Retry with review. Nothing changed.',
  AI_RUN_FAILED:'Pi could not complete a validated answer or proposal. Nothing changed.'
};
export const errorMessage = error=>error.name === 'AbortError' ? 'Cancelled. Nothing changed.' : AI_MESSAGES[error.code] || 'AI request failed. Nothing changed.';
