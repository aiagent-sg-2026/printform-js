import http from "node:http";
import { isIP } from "node:net";
import { URL } from "node:url";
import { JSDOM } from "jsdom";
import { CommandBus } from "../core/command-bus.js";
import { classifyImportedDocument } from "../core/data-policy.js";
import { DurableTransactionStore } from "../core/durable-transaction-store.js";
import { SqliteDurableBackend } from "./sqlite-durable-backend.mjs";
import { crashHttpRequest, failHttpRequest, jsonResponse, respondAfterNetworkPolicy, safeServerError } from "./transaction-http-response.mjs";

const SERVER_COMMANDS = new Set([
  "get_capabilities", "get_project_summary", "get_form_spec", "list_components",
  "get_component", "inspect_design_state", "validate_project", "get_revision",
  "get_transaction", "list_active_transactions", "get_audit_events",
  "get_transaction_history", "get_evidence_pack", "begin_transaction",
  "preview_changes", "approve_transaction", "apply_changes", "rollback_transaction",
  "renew_lease", "release_lease", "takeover_transaction", "recover_transaction",
  "resolve_conflict", "compare_revision", "request_export",
]);

function isLoopbackHost(host) {
  if (/^localhost\.?$/i.test(host)) return true;
  if (isIP(host) === 4) return host.startsWith("127.");
  if (isIP(host) !== 6) return false;
  const canonical = new URL(`http://[${host}]`).hostname;
  return canonical === "[::1]" || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(canonical);
}

async function readJson(request, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body is too large"), { code: "REQUEST_TOO_LARGE" });
    chunks.push(chunk);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch (error) { throw Object.assign(new Error(`Invalid JSON: ${error.message}`), { code: "INVALID_JSON" }); }
}

export class TransactionHttpServer {
  constructor({
    dbPath,
    formId,
    initialProject,
    host = "127.0.0.1",
    port = 0,
    leaseDurationMs = 30 * 1000,
    serverToken = process.env.PRINTFORM_TRANSACTION_SERVER_TOKEN || "",
    allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"],
    onCrash = null,
    testMode = false,
    dataPolicy = null,
  } = {}) {
    if (!dbPath || !formId || !initialProject) throw new TypeError("TransactionHttpServer requires dbPath, formId and initialProject");
    if (typeof host === "string" && host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    if (!isLoopbackHost(host) && (typeof serverToken !== "string" || !serverToken.trim())) {
      throw Object.assign(new Error("Non-loopback transaction server requires a non-empty serverToken"), { code: "SERVER_AUTH_REQUIRED" });
    }
    this.dbPath = dbPath;
    this.formId = formId;
    this.initialProject = structuredClone(initialProject);
    this.host = host;
    this.port = port;
    this.leaseDurationMs = leaseDurationMs;
    this.serverToken = serverToken;
    this.allowedOrigins = new Set(allowedOrigins);
    this.onCrash = onCrash;
    this.testMode = testMode === true;
    this.dataPolicy = dataPolicy || classifyImportedDocument(formId);
    this.persistenceAllowed = this.dataPolicy.allowDurable === true;
    this.backend = this.persistenceAllowed ? new SqliteDurableBackend({ filename: dbPath }) : null;
    this.key = `printform:server:${formId}`;
    this.httpServer = null;
    this.#ensureDomRuntime();
  }

  async start() {
    await this.#recoverPendingTransactions();
    this.httpServer = http.createServer((request, response) => {
      this.#handle(request, response).catch((error) => {
        console.error(`[printform-transaction-server] request failure: ${safeServerError(error).code}`);
        try { failHttpRequest(request, response, error, this.#origin(request)); }
        catch (failure) { console.error(`[printform-transaction-server] response failure: ${safeServerError(failure).code}`); response.destroy(); }
      });
    });
    return new Promise((resolve, reject) => {
      const onError = (error) => { this.httpServer.off("listening", onListening); reject(error); };
      const onListening = () => {
        this.httpServer.off("error", onError);
        const address = this.httpServer.address();
        resolve({ host: this.host, port: address.port, url: `http://${isIP(this.host) === 6 ? `[${this.host}]` : this.host}:${address.port}` });
      };
      this.httpServer.once("error", onError);
      this.httpServer.once("listening", onListening);
      this.httpServer.listen(this.port, this.host);
    });
  }

  async close() {
    if (this.httpServer) await new Promise((resolve) => this.httpServer.close(() => resolve()));
    this.httpServer = null;
    this.backend?.close();
  }

  #origin(request) {
    const origin = request.headers.origin;
    return this.allowedOrigins.has(origin) ? origin : null;
  }

  #ensureDomRuntime() {
    if (typeof globalThis.document !== "undefined" && typeof globalThis.DOMParser !== "undefined") return;
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    globalThis.document = dom.window.document;
    globalThis.DOMParser = dom.window.DOMParser;
  }

  #authorize(request) {
    if (!this.serverToken) return;
    const bearer = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const supplied = request.headers["x-printform-server-token"] || bearer;
    if (supplied !== this.serverToken) throw Object.assign(new Error("Server authentication failed"), { code: "UNAUTHORIZED", status: 401 });
  }

  #store() {
    if (!this.backend) throw Object.assign(new Error("Server document persistence is disabled by the current data policy"), { code: "DATA_POLICY_STORAGE_BLOCKED", status: 403 });
    return new DurableTransactionStore({
      backend: this.backend,
      key: this.key,
      formId: this.formId,
      initialProject: this.initialProject,
      clock: () => this.backend.serverNow(),
    });
  }

  #bus(request, failurePhase = null) {
    const owner = String(request.headers["x-printform-owner"] || "anonymous");
    const agentId = String(request.headers["x-printform-agent-id"] || owner);
    const store = this.#store();
    return new CommandBus(this.initialProject, {
      transactionStore: store,
      owner,
      agentId,
      clock: () => this.backend.serverNow(),
      leaseDurationMs: this.leaseDurationMs,
      dataPolicy: this.dataPolicy,
      failureInjector: (phase) => phase === failurePhase,
    });
  }

  async #recoverPendingTransactions() {
    if (!this.backend) return;
    const bus = this.#bus({ headers: {} });
    for (const transaction of bus.transactionStore.listTransactions()) {
      if (["committing", "recovery_required"].includes(transaction.status)) {
        bus.recoverTransaction({ transactionId: transaction.transaction_id });
      }
    }
  }

  #serverNow() { return this.backend?.serverNow() || new Date(); }

  #databaseSummary() {
    if (this.backend) return this.backend.summary();
    return {
      persistence_allowed: false,
      classification: this.dataPolicy.classification,
      transactions: 0,
      revisions: 0,
      audit_events: 0,
      evidence_anchors: 0,
    };
  }

  #assertServerPersistenceAllowed() {
    if (!this.persistenceAllowed) {
      throw Object.assign(new Error("Server document persistence is disabled by the current data policy"), { code: "DATA_POLICY_STORAGE_BLOCKED", status: 403 });
    }
  }

  async #handle(request, response) {
    const origin = this.#origin(request);
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-PrintForm-Server-Token, X-PrintForm-Owner, X-PrintForm-Agent-Id, X-PrintForm-Failure-Phase, X-PrintForm-Crash-At, X-PrintForm-Drop-After-Commit, X-PrintForm-Crash-After-Commit, X-PrintForm-Delay-Ms",
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      });
      response.end();
      return;
    }
    this.#authorize(request);
    const url = new URL(request.url, `http://${isIP(this.host) === 6 ? `[${this.host}]` : this.host}`);
    if (this.testMode && url.pathname === "/__test__/shutdown" && request.method === "POST") {
      jsonResponse(response, 200, { ok: true }, origin);
      setTimeout(() => this.close().then(() => process.exit(0)), 0);
      return;
    }
    if (url.pathname === "/health" && request.method === "GET") {
      jsonResponse(response, 200, { ok: true, server_time: this.#serverNow().toISOString(), pid: process.pid, database: this.#databaseSummary() }, origin);
      return;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "v1" || parts[1] !== "forms" || decodeURIComponent(parts[2] || "") !== this.formId) {
      throw Object.assign(new Error("Route not found"), { code: "NOT_FOUND", status: 404 });
    }
    this.#assertServerPersistenceAllowed();
    if (this.testMode && request.headers["x-printform-drop-before"] === "true") { request.socket.destroy(); return; }
    const body = ["POST"].includes(request.method) ? await readJson(request) : {};
    if (parts[3] === "command" && request.method === "POST") {
      await this.#command(request, response, body, origin);
      return;
    }
    if (parts[3] === "evidence" && request.method === "POST") {
      await this.#evidence(request, response, body, origin);
      return;
    }
    if (parts[3] === "audit" && request.method === "GET") {
      jsonResponse(response, 200, { ok: true, events: this.#store().listAuditEvents() }, origin);
      return;
    }
    if (parts[3] === "revision" && request.method === "GET") {
      jsonResponse(response, 200, { ok: true, revision: this.#store().getRevision() }, origin);
      return;
    }
    if (parts[3] === "evidence" && request.method === "GET") {
      const revision = url.searchParams.has("revision") ? Number(url.searchParams.get("revision")) : undefined;
      const store = this.#store();
      jsonResponse(response, 200, { ok: true, evidencePack: store.getEvidencePack(revision), anchor: store.getEvidenceAnchor(revision) }, origin);
      return;
    }
    throw Object.assign(new Error("Route not found"), { code: "NOT_FOUND", status: 404 });
  }

  async #command(request, response, body, origin) {
    const name = body.name;
    if (!SERVER_COMMANDS.has(name)) throw Object.assign(new Error(`Unsupported server command: ${name}`), { code: "UNKNOWN_TOOL" });
    const input = body.input || {};
    const store = this.#store();
    const transaction = name === "apply_changes" && input.transactionId ? store.getTransaction(input.transactionId) : null;
    if (name === "apply_changes" && transaction?.status === "committed") {
      if (input.expectedCandidateHash && transaction.preview_hash !== input.expectedCandidateHash) throw Object.assign(new Error("Idempotency key was reused for a different candidate"), { code: "IDEMPOTENCY_KEY_REUSE" });
      respondAfterNetworkPolicy(request, response, { ok: true, result: { already_committed: true, committed_revision: transaction.working_revision, transaction } }, origin, this.testMode);
      return;
    }
    if (name === "apply_changes" && ["committing", "recovery_required"].includes(transaction?.status)) {
      throw Object.assign(new Error("Commit is in progress or requires recovery"), { code: "COMMIT_IN_PROGRESS", transactionId: transaction.transaction_id, status: transaction.status });
    }
    const failurePhase = this.testMode ? request.headers["x-printform-failure-phase"] || request.headers["x-printform-crash-at"] || null : null;
    const crashPhase = this.testMode ? request.headers["x-printform-crash-at"] || null : null;
    const bus = this.#bus(request, failurePhase);
    const result = await bus.execute(name, input);
    if (!result.ok && crashPhase && crashPhase === result.error?.phase) {
      crashHttpRequest(request, response, result.error.phase, this.onCrash);
      return;
    }
    if (result.ok && name === "apply_changes") {
      result.result = { ...result.result, already_committed: false, committed_revision: result.result.revision };
      if (this.testMode && request.headers["x-printform-crash-after-commit"] === "true") {
        crashHttpRequest(request, response, "after_commit_before_response", this.onCrash);
        return;
      }
    }
    respondAfterNetworkPolicy(request, response, result, origin, this.testMode);
  }

  async #evidence(request, response, pack, origin) {
    const store = this.#store();
    const existing = Number.isInteger(pack.revision) ? store.getEvidenceAnchor(pack.revision) : null;
    if (existing) {
      if (existing.evidence_pack_hash !== pack.hash) throw Object.assign(new Error("A different Evidence Pack is already anchored"), { code: "EVIDENCE_ANCHOR_CONFLICT" });
      respondAfterNetworkPolicy(request, response, { ok: true, result: { already_anchored: true, anchor: existing, evidencePack: store.getEvidencePack(pack.revision) } }, origin, this.testMode);
      return;
    }
    const failurePhase = this.testMode ? request.headers["x-printform-failure-phase"] || request.headers["x-printform-crash-at"] || null : null;
    const bus = this.#bus(request, failurePhase);
    try {
      const evidencePack = bus.recordEvidencePack(pack);
      if (this.testMode && request.headers["x-printform-crash-at"] === "during_evidence_write") {
        crashHttpRequest(request, response, "during_evidence_write", this.onCrash);
        return;
      }
      respondAfterNetworkPolicy(request, response, { ok: true, result: { already_anchored: false, evidencePack, anchor: store.getEvidenceAnchor(pack.revision) } }, origin, this.testMode);
    } catch (error) {
      if (this.testMode && request.headers["x-printform-crash-at"] && request.headers["x-printform-crash-at"] === error.phase) crashHttpRequest(request, response, error.phase, this.onCrash);
      else throw error;
    }
  }

}
