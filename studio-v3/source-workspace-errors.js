const entry = (family,category,recoverable,retryAdvice) => Object.freeze({family,category,recoverable,retryAdvice});
export const sourceFailure = code => Object.assign(new Error(code),{code});
export const SOURCE_ERROR_CONTRACTS = Object.freeze({
  WORKSPACE_UNAVAILABLE:entry('WORKSPACE_UNAVAILABLE','unavailable',false,'The local companion/workspace is unavailable. Do not invent source results or fall back to a host shell.'),
  WORKSPACE_DISCLOSURE_REQUIRED:entry('APPROVAL_REQUIRED','rejected',false,'A paired local companion and explicit per-run fictional-source permission are required. The model cannot grant either.'),
  WORKSPACE_AUTH_EXPIRED:entry('SCOPE_DENIED','rejected',false,'The local pairing expired or was revoked. Stop; a new human pairing is required.'),
  WORKSPACE_PAIRING_INVALID:entry('APPROVAL_REQUIRED','rejected',false,'Use the current one-use code shown by the locally started companion. Never send it to the model.'),
  WORKSPACE_RUNTIME_MISMATCH:entry('RELEASE_MISMATCH','release',false,'Update/rebuild the local companion from this exact Studio release; a protocol name alone is not sufficient.'),
  WORKSPACE_RECEIPT_INVALID:entry('EFFECT_UNKNOWN','evidence',false,'The receipt cannot be verified. Stop and reconcile/close the workspace; never rerun a mutation blindly.'),
  WORKSPACE_RESPONSE_LIMIT:entry('QUOTA_EXCEEDED','rejected',false,'The response exceeded the verified transport bound. Stop and reconcile/close the workspace; do not retry a potentially committed mutation blindly.'),
  WORKSPACE_CONFLICT:entry('WORKSPACE_CONFLICT','rejected',true,'Read the actual current source/revision and file hashes before planning another edit. Do not replay a command with a new intent blindly.'),
  WORKSPACE_PATH_DENIED:entry('SCOPE_DENIED','rejected',true,'Use a relative regular UTF-8 source path inside the supplied workspace; no traversal, symlinks or host paths.'),
  WORKSPACE_FILE_NOT_FOUND:entry('WORKSPACE_UNAVAILABLE','rejected',true,'List the supplied workspace and use an existing regular file path.'),
  WORKSPACE_BUSY:entry('WORKSPACE_CONFLICT','rejected',true,'A prior owned operation is active. Observe its actual outcome before another write.'),
  WORKSPACE_QUARANTINED:entry('EFFECT_UNKNOWN','rejected',false,'The source tree or operation outcome is unsafe/unknown. Close this workspace; do not keep executing it.'),
  WORKSPACE_CLEANUP_FAILED:entry('EFFECT_UNKNOWN','internal',false,'Cleanup was not acknowledged. Stop execution and reconcile the owned local companion; do not claim all processes stopped.'),
  SOURCE_ARTIFACT_REQUIRED:entry('ARTIFACT_REJECTED','evidence',true,'Edit actual source, execute it, retrieve and import its current JSON operation artifact, then inspect the exact final draft.'),
  ARTIFACT_REJECTED:entry('ARTIFACT_REJECTED','evidence',true,'Use the successful current run artifact with matching bytes, image, source tree, document, release and base revision. HTML/scripts and forged/stale receipts are not accepted.'),
  ENVIRONMENT_UNSUPPORTED:entry('ENVIRONMENT_UNSUPPORTED','unavailable',false,'This bounded local Node/Docker environment is unavailable or incompatible. No host execution or dependency/network fallback is allowed.'),
  QUOTA_EXCEEDED:entry('QUOTA_EXCEEDED','rejected',true,'Stay within the disclosed source, file, receipt, output and command bounds; report a missing capability instead of bypassing quotas.'),
  COMMAND_TIMEOUT:entry('COMMAND_TIMEOUT','stopped',true,'The command/search deadline elapsed. Read the reconciled source outcome before deliberately issuing a different command.'),
  CANCELLED:entry('CANCELLED','stopped',false,'The operation was cancelled. No late artifact or form handoff is authorized.'),
  EFFECT_UNKNOWN:entry('EFFECT_UNKNOWN','internal',false,'The actual effect is unknown. Stop and reconcile; never infer success from stdout or retry the mutation blindly.')
});
const aliases = {
  AUTH_REQUIRED:'WORKSPACE_AUTH_EXPIRED',AUTH_REJECTED:'WORKSPACE_AUTH_EXPIRED',PAIRING_CODE_INVALID:'WORKSPACE_PAIRING_INVALID',
  HOST_REJECTED:'WORKSPACE_UNAVAILABLE',ORIGIN_REJECTED:'WORKSPACE_UNAVAILABLE',PAIRING_NAVIGATION_REQUIRED:'WORKSPACE_PAIRING_INVALID',
  WORKSPACE_NOT_FOUND:'WORKSPACE_UNAVAILABLE',WORKSPACE_CLOSED:'WORKSPACE_UNAVAILABLE',SERVER_CLOSING:'WORKSPACE_UNAVAILABLE',
  STALE_REVISION:'WORKSPACE_CONFLICT',STALE_FILE:'WORKSPACE_CONFLICT',INTENT_CONFLICT:'WORKSPACE_CONFLICT',
  UNSAFE_PATH:'WORKSPACE_PATH_DENIED',UNSAFE_TREE:'WORKSPACE_QUARANTINED',FILE_NOT_FOUND:'WORKSPACE_FILE_NOT_FOUND',
  SOURCE_QUOTA:'QUOTA_EXCEEDED',WORKSPACE_LIMIT:'QUOTA_EXCEEDED',INTENT_LIMIT:'QUOTA_EXCEEDED',CALL_LIMIT:'QUOTA_EXCEEDED',DIFF_TOO_LARGE:'QUOTA_EXCEEDED',ARTIFACT_TOO_LARGE:'QUOTA_EXCEEDED',
  RESPONSE_LIMIT:'WORKSPACE_RESPONSE_LIMIT',
  INVALID_ARGUMENT:'AGENT_ARGUMENTS_INVALID',INVALID_UTF8:'AGENT_ARGUMENTS_INVALID',INVALID_OFFSET:'AGENT_ARGUMENTS_INVALID',DUPLICATE_PATH:'AGENT_ARGUMENTS_INVALID',PATH_CONFLICT:'AGENT_ARGUMENTS_INVALID',
  IMAGE_UNAVAILABLE:'ENVIRONMENT_UNSUPPORTED',UNSEALED_IMAGE:'ENVIRONMENT_UNSUPPORTED',RUNNER_SOURCE_MISMATCH:'WORKSPACE_RUNTIME_MISMATCH',
  SEARCH_TIMEOUT:'COMMAND_TIMEOUT',CLEANUP_FAILED:'WORKSPACE_CLEANUP_FAILED',BUILD_NOT_SUCCESSFUL:'ARTIFACT_REJECTED',STALE_ARTIFACT:'ARTIFACT_REJECTED'
};
export function sourceErrorCode(code) {
  if (Object.hasOwn(SOURCE_ERROR_CONTRACTS,code)) return code;
  if (Object.hasOwn(aliases,code)) return aliases[code];
  if (typeof code === 'string' && code.startsWith('ARTIFACT_')) return 'ARTIFACT_REJECTED';
  return 'EFFECT_UNKNOWN';
}
