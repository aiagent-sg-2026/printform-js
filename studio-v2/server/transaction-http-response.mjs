export function jsonResponse(response, status, body, origin = null) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(payload);
}

const SAFE_ERROR_MESSAGES = new Map([
  ["UNAUTHORIZED", "Authentication failed"],
  ["NOT_FOUND", "Resource not found"],
  ["REQUEST_TOO_LARGE", "Request body exceeds the supported limit"],
  ["INVALID_JSON", "Request body is not valid JSON"],
  ["DATA_POLICY_STORAGE_BLOCKED", "Operation blocked by the current data policy"],
]);
const SAFE_ERROR_CODES = new Set([
  "UNAUTHORIZED", "NOT_FOUND", "REQUEST_TOO_LARGE", "INVALID_JSON",
  "DATA_POLICY_STORAGE_BLOCKED", "SERVER_UNAVAILABLE", "RECOVERY_REQUIRED",
  "REVISION_CONFLICT", "STORE_CONFLICT", "TRANSACTION_RECORD_CONFLICT",
  "LEASE_EXPIRED", "LEASE_OWNER_MISMATCH", "LEASE_ID_MISMATCH",
  "COMMIT_IN_PROGRESS", "EVIDENCE_ANCHOR_CONFLICT", "UNKNOWN_TOOL",
  "COMMAND_FAILED", "TRANSACTION_NOT_FOUND", "TRANSACTION_REQUIRED",
  "TRANSACTION_NOT_APPROVED", "CANDIDATE_HASH_MISMATCH", "CANDIDATE_INVALID",
  "CANDIDATE_CONTENT_MISMATCH", "TRANSACTION_ALREADY_COMMITTED", "SERVER_ERROR",
  "IDEMPOTENCY_KEY_REUSE", "LEASE_NOT_RENEWABLE", "TAKEOVER_NOT_ALLOWED",
  "CONFLICT_RESOLUTION_REQUIRED", "INVALID_TRANSACTION_STATE", "INJECTED_CRASH",
  "PREVIEW_REQUIRED", "STALE_POLICY_CONTEXT",
]);
const SAFE_PHASES = new Set(["before_preview", "after_approval", "before_commit", "during_commit", "after_revision_write", "after_commit", "after_commit_before_response", "during_evidence_write"]);

export function safeServerError(error) {
  const code = SAFE_ERROR_CODES.has(error?.code) ? error.code : "SERVER_ERROR";
  return {
    code,
    message: SAFE_ERROR_MESSAGES.get(code) || "Command failed",
    expectedRevision: Number.isSafeInteger(error?.expectedRevision) && error.expectedRevision >= 0 ? error.expectedRevision : undefined,
    actualRevision: Number.isSafeInteger(error?.actualRevision) && error.actualRevision >= 0 ? error.actualRevision : undefined,
    transactionId: typeof error?.transactionId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(error.transactionId) ? error.transactionId : undefined,
    phase: SAFE_PHASES.has(error?.phase) ? error.phase : undefined,
  };
}

function safeResponseBody(body) {
  if (!body || body.ok !== false) return body;
  return { ok: false, error: safeServerError(body.error) };
}

export function statusForError(error) {
  if (["REVISION_CONFLICT", "STORE_CONFLICT", "TRANSACTION_RECORD_CONFLICT", "LEASE_EXPIRED", "LEASE_OWNER_MISMATCH", "LEASE_ID_MISMATCH", "COMMIT_IN_PROGRESS", "EVIDENCE_ANCHOR_CONFLICT"].includes(error.code)) return 409;
  if (["SERVER_UNAVAILABLE", "RECOVERY_REQUIRED"].includes(error.code)) return 503;
  return 400;
}

export function respondAfterNetworkPolicy(request, response, body, origin, testMode = false) {
  const send = () => {
    if (testMode === true && request.headers["x-printform-drop-after-commit"] === "true") { request.socket.destroy(); return; }
    const safeBody = safeResponseBody(body);
    jsonResponse(response, safeBody.ok ? 200 : statusForError(safeBody.error || {}), safeBody, origin);
  };
  const delay = testMode === true ? Math.max(0, Number(request.headers["x-printform-delay-ms"]) || 0) : 0;
  if (delay) setTimeout(send, delay); else send();
}

export function crashHttpRequest(request, response, phase, onCrash) {
  response.destroy();
  if (onCrash) onCrash(phase);
}

export function failHttpRequest(request, response, error, origin) {
  if (response.destroyed || response.headersSent) return;
  const safeError = safeServerError(error);
  console.error(`[printform-transaction-server] ${safeError.code}`);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status : statusForError(safeError);
  jsonResponse(response, status, { ok: false, error: safeError }, origin);
}
