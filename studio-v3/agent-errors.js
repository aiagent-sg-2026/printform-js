import { SOURCE_ERROR_CONTRACTS } from './source-workspace-errors.js';
// Error contract for the agent: every code a tool or run can raise, mapped to the contract error families
// (docs/STUDIO_V3_CODING_AGENT_CONTRACTS.md). Existing codes are kept; this table only classifies them.
const entry = (family,category,recoverable,retryAdvice) => Object.freeze({family,category,recoverable,retryAdvice});

export const TOOL_ERRORS = Object.freeze({
  ...SOURCE_ERROR_CONTRACTS,
  AGENT_ARGUMENTS_INVALID:entry(null,'invalid-input',true,'Send arguments that match the tool parameters exactly, without type coercion.'),
  MALFORMED_PROPOSAL:entry(null,'invalid-input',true,'Send a well-formed operation list with a short summary.'),
  AUTHORING_OPERATION_LIMIT:entry('QUOTA_EXCEEDED','invalid-input',true,'Split the change into smaller steps within the operation limit.'),
  UNSAFE_PROPOSAL:entry(null,'rejected',true,'Keep the operation within the documented targets, bounds and binding rules.'),
  GLOBAL_FONT_PROPERTY_UNSUPPORTED:entry(null,'invalid-input',true,'Use font for the global size; fontSize belongs to element and field typography.'),
  TABLE_SECTION_GRID_UNSUPPORTED:entry(null,'rejected',true,'The items section uses column widths, never a section grid.'),
  FIELD_WIDTH_UNSUPPORTED:entry(null,'rejected',true,'Omit width on non-items static/bound fields and use section layout.columns. Only items columns use percentage width; image fields use pixel dimensions.'),
  LOGO_ASSET_UNAVAILABLE:entry('CAPABILITY_UNAVAILABLE','rejected',true,'Use an asset listed in context, or value:null; assets cannot be imported by the agent.'),
  UNSAFE_SCOPE:entry('SCOPE_DENIED','rejected',true,'Edit only the selected targets, or report_blocked if the request needs more.'),
  COLUMN_WIDTH_LIMIT:entry(null,'rejected',true,'Keep item column widths between 1 and 100 and their total at or below 100.'),
  NO_CHANGES:entry(null,'rejected',true,'Choose a value that differs from the current draft, or finish if the work is done.'),
  TABLE_BACKGROUND_INTENT:entry('SCOPE_DENIED','rejected',true,'Change the table background only when the request asks for it.'),
  AGENT_SKILL_UNAVAILABLE:entry('CAPABILITY_UNAVAILABLE','unavailable',true,'Use a guide id listed by get_capabilities.'),
  AGENT_INSPECTION_REQUIRED:entry('EVIDENCE_STALE','evidence',true,'Call inspect_draft on the exact final draft before finish.'),
  EVIDENCE_STALE:entry('EVIDENCE_STALE','evidence',true,'The observed state changed. Inspect the current candidate again; start a new run if the host revision changed.'),
  OBSERVATION_DISCLOSURE_REQUIRED:entry('APPROVAL_REQUIRED','rejected',true,'No text/value disclosure is authorized. Use numeric inspect_draft or ask the person to authorize a new run.'),
  OBSERVATION_AUTHORIZATION_STALE:entry('EVIDENCE_STALE','evidence',true,'Document, content, revision, run or policy changed. A new run needs fresh host authorization; undo cannot revive it.'),
  OBSERVATION_CONTENT_UNSUPPORTED:entry('SCOPE_DENIED','rejected',true,'Encoded pixel content is outside semantic authorization. Remove it from the requested text or use numeric inspection.'),
  OBSERVATION_CONTEXT_LIMIT:entry('QUOTA_EXCEEDED','rejected',true,'Authorized context exceeds 32000 bytes. Reduce the form/data or use numeric inspection; no content is silently omitted.'),
  OBSERVATION_PIXELS_REQUIRED:entry('APPROVAL_REQUIRED','rejected',true,'A new run requires explicit fictional page-pixel consent and text consent. Numeric diagnostics remain available.'),
  OBSERVATION_PIXELS_POLICY_DENIED:entry('SCOPE_DENIED','rejected',true,'Host policy explicitly denies pixels. A run checkbox cannot override that policy; use numeric/semantic inspection.'),
  OBSERVATION_PIXELS_VALUES_DENIED:entry('SCOPE_DENIED','rejected',true,'The document contains bound values denied by host policy. Cropping cannot authorize them.'),
  OBSERVATION_PIXELS_SENSITIVE:entry('SCOPE_DENIED','rejected',true,'Real-classified documents, encoded pixels and embedded images/signatures are blocked. Synthetic text cannot sanitize them.'),
  OBSERVATION_PIXELS_LIMIT:entry('QUOTA_EXCEEDED','rejected',true,'PNG bytes or dimensions exceed the capture budget, or the image is invalid. Inspect and capture a smaller valid region.'),
  OBSERVATION_PIXELS_BOUNDS:entry(null,'invalid-input',true,'Use an existing zero-based page and an integer crop fully inside its bounds.'),
  OBSERVATION_PIXELS_UNSUPPORTED:entry('ENVIRONMENT_UNSUPPORTED','unavailable',true,'The qualified DOM raster capture is unavailable or failed. Use semantic/numeric inspection; visual evidence was not produced.'),
  OBSERVATION_PIXELS_PAIR_REQUIRED:entry('EVIDENCE_STALE','evidence',true,'The actual capture tool call and result must accompany the host image input. Start a fresh observed run.'),
  AGENT_INSPECTION_BLOCKED:entry('EVIDENCE_STALE','evidence',true,'Fix the reported print issues and inspect again before finish.'),
  GRANT_DENIED:entry('SCOPE_DENIED','rejected',true,'This run does not grant that effect. Answer with finish_answer, or report_blocked if the request needs an edit.'),
  AGENT_EVIDENCE_REQUIRED:entry('EVIDENCE_STALE','evidence',true,'Read a guide, the form context or an inspection before finish_answer, so the answer rests on evidence.'),
  AGENT_ANSWER_LIMIT:entry('QUOTA_EXCEEDED','rejected',true,'Shorten the answer so it and the host-authored latest observation citation fit within 4000 characters; nothing is silently omitted.'),
  TOOL_FAILED:entry('EFFECT_UNKNOWN','internal',false,'Do not repeat blindly; report_blocked with the failing step.')
});

// Raised by the host around tools; the run stops and no further call is accepted.
export const RUN_ERRORS = Object.freeze({
  AGENT_BUDGET:entry('QUOTA_EXCEEDED','budget',false,'The tool-call budget is spent; the person may start a new request.'),
  AGENT_STALLED:entry('QUOTA_EXCEEDED','budget',false,'The same step failed repeatedly; the run stopped.'),
  AGENT_TOKEN_BUDGET:entry('QUOTA_EXCEEDED','budget',false,'The token budget is spent; the run stopped.'),
  AGENT_CONTEXT_LIMIT:entry('QUOTA_EXCEEDED','budget',false,'The context limit was reached; the run stopped.'),
  AGENT_TIMEOUT:entry('COMMAND_TIMEOUT','budget',false,'The run deadline passed; the run stopped.'),
  GRANT_PROFILE_UNKNOWN:entry('SCOPE_DENIED','internal',false,'The host requested an effect profile that does not exist.'),
  GRANT_PROFILE_UNAVAILABLE:entry('CAPABILITY_UNAVAILABLE','unavailable',false,'This effect profile has no tools in this release yet.'),
  AGENT_BLOCKED:entry('CAPABILITY_UNAVAILABLE','stopped',false,'The agent reported a missing capability.'),
  AGENT_RELEASE_MISMATCH:entry('RELEASE_MISMATCH','release',false,'Reload Studio so app and knowledge come from one release.'),
  AGENT_KNOWLEDGE_UNAVAILABLE:entry('KNOWLEDGE_STALE','release',false,'The release knowledge could not be verified; reload or retry later.'),
  AGENT_REGISTRY_INVALID:entry('RELEASE_MISMATCH','internal',false,'Tool contracts and handlers disagree; this build must not run.'),
  AGENT_USAGE_UNAVAILABLE:entry('PROVIDER_UNAVAILABLE','provider',false,'The provider did not report usage, so the budget cannot be enforced.'),
  AI_RUN_FAILED:entry('PROVIDER_UNAVAILABLE','provider',false,'The run ended without a proposal or report.')
});

export const ERROR_CONTRACTS = Object.freeze({...TOOL_ERRORS,...RUN_ERRORS});
export const CONTRACT_FAMILIES = Object.freeze(['CAPABILITY_UNAVAILABLE','KNOWLEDGE_STALE','RELEASE_MISMATCH','SCOPE_DENIED','REVISION_CONFLICT','APPROVAL_REQUIRED',
  'WORKSPACE_UNAVAILABLE','WORKSPACE_CONFLICT','ENVIRONMENT_UNSUPPORTED','QUOTA_EXCEEDED','COMMAND_TIMEOUT','CANCELLED','EFFECT_UNKNOWN','EVIDENCE_STALE','ARTIFACT_REJECTED','PROVIDER_UNAVAILABLE']);
