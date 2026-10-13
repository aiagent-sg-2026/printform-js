import { afterEach, describe, expect, it } from "vitest";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createEvidencePack } from "../../studio-v2/core/evidence-pack.js";
import { applyOperations } from "../../studio-v2/core/operations.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { TransactionHttpServer } from "../../studio-v2/server/transaction-http-server.mjs";

const FORM_ID = "server-boundary-synthetic";
const servers = [];
const NETWORK_FAULTS = {
  "X-PrintForm-Drop-Before": "true",
  "X-PrintForm-Drop-After-Commit": "true",
  "X-PrintForm-Delay-Ms": "60000",
};

function makeServer(options = {}) {
  const server = new TransactionHttpServer({
    dbPath: ":memory:",
    formId: FORM_ID,
    initialProject: createSalesInvoiceProject(),
    serverToken: "",
    allowedOrigins: [],
    ...options,
  });
  servers.push(server);
  return server;
}

async function startServer(options = {}) {
  const server = makeServer({ dataPolicy: classifySyntheticDocument(FORM_ID), ...options });
  const address = await server.start();
  return { server, url: address.url.replace("0.0.0.0", "127.0.0.1") };
}

async function request(handle, pathname, body, headers = {}) {
  const response = await fetch(`${handle.url}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-PrintForm-Owner": "declared-owner", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  return { status: response.status, body: await response.json() };
}

function command(handle, name, input = {}, headers = {}) {
  return request(handle, `/v1/forms/${FORM_ID}/command`, { name, input }, headers);
}

async function approvedFlow(handle, headers = {}) {
  const started = await command(handle, "begin_transaction", { baseRevision: 0 }, headers);
  expect(started.status).toBe(200);
  const transactionId = started.body.result.transaction_id;
  const operations = [{ type: "set_manifest_value", path: "/title", value: "Boundary synthetic" }];
  const preview = await command(handle, "preview_changes", { expectedRevision: 0, transactionId, operations }, headers);
  expect(preview.status).toBe(200);
  const expectedCandidateHash = preview.body.result.candidateHash;
  const approved = await command(handle, "approve_transaction", { expectedRevision: 0, transactionId, expectedCandidateHash }, headers);
  expect(approved.status).toBe(200);
  return { input: { expectedRevision: 0, transactionId, expectedCandidateHash }, operations };
}

async function evidencePack(flow) {
  return createEvidencePack({
    project: applyOperations(createSalesInvoiceProject(), flow.operations),
    revision: 1,
    transactionId: flow.input.transactionId,
    previewHash: flow.input.expectedCandidateHash,
    validation: { productionValid: true, errors: [], metrics: { logicalPages: 1 } },
    security: { valid: true, externalNetwork: false, arbitraryJavascript: false },
  });
}

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

describe("transaction HTTP deployment boundary", () => {
  it.each(["0.0.0.0", "::", "[::]", "192.168.1.2", "::2", "fd00::1", "::ffff:192.168.1.2", "localhost.example", "127.example"])(
    "rejects unauthenticated non-loopback configuration %s before opening storage",
    (host) => {
      expect(() => makeServer({ host, dataPolicy: classifySyntheticDocument(FORM_ID) })).toThrow(/non-empty serverToken/);
    },
  );

  it.each(["", "   ", null, 123])("rejects an unusable remote token %j", (serverToken) => {
    expect(() => makeServer({ host: "0.0.0.0", serverToken })).toThrow(/non-empty serverToken/);
  });

  it.each(["localhost", "LOCALHOST", "localhost.", "127.0.0.1", "127.0.0.2", "127.255.255.254", "::1", "0:0:0:0:0:0:0:1", "[::1]", "::ffff:127.0.0.1", "::ffff:7fff:fffe"])(
    "keeps local no-token configuration available for %s",
    (host) => { expect(makeServer({ host }).serverToken).toBe(""); },
  );

  it.each(["::1", "0:0:0:0:0:0:0:1", "[::1]"])("serves real HTTP with a valid IPv6 URL for %s", async (host) => {
    const handle = await startServer({ host });
    const health = await request(handle, "/health");
    expect(health).toMatchObject({ status: 200, body: { ok: true } });
  });

  it("requires the shared token on a wildcard listener without changing declared owner identity", async () => {
    const handle = await startServer({ host: "0.0.0.0", serverToken: "shared-token" });
    expect(await request(handle, "/health")).toMatchObject({ status: 401, body: { error: { code: "UNAUTHORIZED" } } });
    expect(await command(handle, "begin_transaction", { baseRevision: 0 }, { Authorization: "Bearer wrong-token" })).toMatchObject({ status: 401 });
    const authorized = await command(handle, "begin_transaction", { baseRevision: 0 }, { Authorization: "Bearer shared-token" });
    expect(authorized).toMatchObject({ status: 200, body: { result: { owner: "declared-owner" } } });
    const revision = await request(handle, `/v1/forms/${FORM_ID}/revision`, undefined, { "X-PrintForm-Server-Token": "shared-token" });
    expect(revision).toMatchObject({ status: 200, body: { ok: true } });
  });
});

describe("transaction HTTP fault-mode boundary", () => {
  it.each([false, "true"])("ignores every network/command/evidence hook when testMode is %j", async (testMode) => {
    const crashes = [];
    const handle = await startServer({ testMode, onCrash: (phase) => crashes.push(phase) });
    const started = await command(handle, "begin_transaction", { baseRevision: 0 }, NETWORK_FAULTS);
    expect(started.status).toBe(200);
    const transactionId = started.body.result.transaction_id;
    const operations = [{ type: "set_manifest_value", path: "/title", value: "Boundary synthetic" }];
    const preview = await command(handle, "preview_changes", { expectedRevision: 0, transactionId, operations }, {
      ...NETWORK_FAULTS, "X-PrintForm-Failure-Phase": "before_preview", "X-PrintForm-Crash-At": "before_preview",
    });
    expect(preview.status).toBe(200);
    const input = { expectedRevision: 0, transactionId, expectedCandidateHash: preview.body.result.candidateHash };
    expect(await command(handle, "approve_transaction", input, {
      ...NETWORK_FAULTS, "X-PrintForm-Failure-Phase": "after_approval", "X-PrintForm-Crash-At": "after_approval",
    })).toMatchObject({ status: 200, body: { ok: true } });
    const commitHeaders = { ...NETWORK_FAULTS, "X-PrintForm-Failure-Phase": "during_commit", "X-PrintForm-Crash-At": "during_commit", "X-PrintForm-Crash-After-Commit": "true" };
    expect(await command(handle, "apply_changes", input, commitHeaders)).toMatchObject({ status: 200, body: { result: { committed_revision: 1 } } });
    expect(await command(handle, "apply_changes", input, commitHeaders)).toMatchObject({ status: 200, body: { result: { already_committed: true } } });
    const pack = await evidencePack({ input, operations });
    const evidenceHeaders = { ...NETWORK_FAULTS, "X-PrintForm-Failure-Phase": "during_evidence_write", "X-PrintForm-Crash-At": "during_evidence_write" };
    expect(await request(handle, `/v1/forms/${FORM_ID}/evidence`, pack, evidenceHeaders)).toMatchObject({ status: 200, body: { result: { already_anchored: false } } });
    expect(await request(handle, `/v1/forms/${FORM_ID}/evidence`, pack, evidenceHeaders)).toMatchObject({ status: 200, body: { result: { already_anchored: true } } });
    expect(crashes).toEqual([]);
    expect(await request(handle, `/v1/forms/${FORM_ID}/revision`)).toMatchObject({ body: { revision: { revision: 1 } } });
  });

  it("retains explicitly enabled failure injection", async () => {
    const handle = await startServer({ testMode: true });
    const started = await command(handle, "begin_transaction", { baseRevision: 0 });
    const preview = await command(handle, "preview_changes", {
      expectedRevision: 0,
      transactionId: started.body.result.transaction_id,
      operations: [{ type: "set_manifest_value", path: "/title", value: "Injected" }],
    }, { "X-PrintForm-Failure-Phase": "before_preview" });
    expect(preview).toMatchObject({ status: 400, body: { ok: false, error: { code: "INJECTED_CRASH", phase: "before_preview" } } });
  });

  it.each(["X-PrintForm-Drop-Before", "X-PrintForm-Drop-After-Commit"])("retains explicitly enabled %s", async (header) => {
    const handle = await startServer({ testMode: true });
    await expect(command(handle, "get_revision", {}, { [header]: "true" })).rejects.toThrow();
    expect(await command(handle, "get_revision")).toMatchObject({ status: 200, body: { ok: true } });
  });

  it("retains explicitly enabled response delay", async () => {
    const handle = await startServer({ testMode: true });
    const started = performance.now();
    expect(await command(handle, "get_revision", {}, { "X-PrintForm-Delay-Ms": "150" })).toMatchObject({ status: 200 });
    expect(performance.now() - started).toBeGreaterThanOrEqual(125);
  });

  it.each(["during_commit", "after_commit_before_response"])("retains explicitly enabled crash at %s", async (phase) => {
    const crashes = [];
    const handle = await startServer({ testMode: true, onCrash: (value) => crashes.push(value) });
    const flow = await approvedFlow(handle);
    const headers = phase === "during_commit" ? { "X-PrintForm-Crash-At": phase } : { "X-PrintForm-Crash-After-Commit": "true" };
    await expect(command(handle, "apply_changes", flow.input, headers)).rejects.toThrow();
    expect(crashes).toEqual([phase]);
    const revision = await request(handle, `/v1/forms/${FORM_ID}/revision`);
    expect(revision.body.revision.revision).toBe(phase === "during_commit" ? 0 : 1);
  });

  it("retains explicitly enabled evidence-write failure and crash", async () => {
    const crashes = [];
    const handle = await startServer({ testMode: true, onCrash: (phase) => crashes.push(phase) });
    const flow = await approvedFlow(handle);
    expect(await command(handle, "apply_changes", flow.input)).toMatchObject({ status: 200 });
    const pack = await evidencePack(flow);
    const pathname = `/v1/forms/${FORM_ID}/evidence`;
    expect(await request(handle, pathname, pack, { "X-PrintForm-Failure-Phase": "during_evidence_write" })).toMatchObject({ status: 400, body: { error: { code: "INJECTED_CRASH", phase: "during_evidence_write" } } });
    await expect(request(handle, pathname, pack, { "X-PrintForm-Crash-At": "during_evidence_write" })).rejects.toThrow();
    expect(crashes).toEqual(["during_evidence_write"]);
    expect(await request(handle, pathname, pack)).toMatchObject({ status: 200, body: { result: { already_anchored: false } } });
  });
});
