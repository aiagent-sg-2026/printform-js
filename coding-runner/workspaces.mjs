import { randomUUID } from 'node:crypto';
import { PROFILE, check, keys, context, validateFiles, integer, runArgs, changesBetween, safeError, RunnerError } from './policy.mjs';
import * as operations from './operations.mjs';

export class Workspaces {
  constructor(docker, limits) { this.docker = docker; this.limits = limits; this.items = new Map(); }
  async create(owner, body) {
    context(body); validateFiles(body.files, this.limits);
    check([...this.items.values()].filter((item) => item.state !== 'closed').length < this.limits.workspaces, 'WORKSPACE_LIMIT', 429);
    const workspace = { id: randomUUID(), owner, context: structuredClone(body), revision: 0, state: 'initializing',
      touched: Date.now(), calls: new Map(), callCount: 0, lease: null };
    delete workspace.context.files; this.items.set(workspace.id, workspace);
    try {
      workspace.initialization = this.docker.createWorkspace(workspace, body.files);
      workspace.tree = await workspace.initialization; workspace.base = structuredClone(workspace.tree);
      if (workspace.state !== 'closing') workspace.state = 'ready';
      return { id: workspace.id, revision: workspace.revision, treeDigest: workspace.tree.treeDigest, profile: PROFILE, imageDigest: this.docker.imageDigest };
    } catch (error) { workspace.state = 'quarantined'; throw error; }
  }
  owned(owner, id, ready = true) {
    const workspace = this.items.get(id); check(workspace && workspace.owner === owner, 'WORKSPACE_NOT_FOUND', 404);
    workspace.touched = Date.now();
    if (ready) check(workspace.state === 'ready', workspace.state === 'closed' || workspace.state === 'closing' ? 'WORKSPACE_CLOSED' : 'WORKSPACE_QUARANTINED', 409);
    return workspace;
  }
  accept(owner, id, body) {
    keys(body, ['operation', 'expectedRevision', 'args'], ['operation', 'expectedRevision', 'args']);
    check(['list', 'read', 'search', 'write', 'patch', 'run', 'diff', 'artifacts'].includes(body.operation), 'INVALID_OPERATION');
    const workspace = this.owned(owner, id); check(!workspace.lease, 'WORKSPACE_BUSY', 409);
    check(integer(body.expectedRevision, 0, Number.MAX_SAFE_INTEGER) === workspace.revision, 'STALE_REVISION', 409);
    check(workspace.callCount < this.limits.calls, 'CALL_LIMIT', 429); keys(body.args, Object.keys(body.args ?? {}));
    let args = body.args;
    if (body.operation === 'run') {
      args = runArgs(args, this.limits);
      if (args.cwd) check(workspace.tree.entries.some((entry) => entry.path === args.cwd && entry.type === 'directory'), 'DIRECTORY_NOT_FOUND', 404);
    }
    if (body.operation === 'write' || body.operation === 'patch') args = { changes: operations.validatePatch(args, this.limits, body.operation === 'write') };
    const receipt = { callId: randomUUID(), operation: body.operation, status: 'running', beforeRevision: workspace.revision,
      beforeDigest: workspace.tree.treeDigest, imageDigest: this.docker.imageDigest };
    workspace.callCount++; workspace.calls.set(receipt.callId, receipt);
    const lease = { operation: body.operation, callId: receipt.callId, cancelRequested: false, job: null, promise: null };
    workspace.lease = lease;
    lease.promise = Promise.resolve().then(async () => {
      try {
        if (body.operation === 'run') await this.run(workspace, lease, receipt, args);
        else if (body.operation === 'write' || body.operation === 'patch') {
          const tree = await this.docker.helper(workspace, 'patch', args); this.reconcile(workspace, receipt, tree);
          receipt.result = { revision: workspace.revision, treeDigest: tree.treeDigest, changes: receipt.changes };
        } else if (body.operation === 'search') receipt.result = await this.docker.helper(workspace, 'search', args);
        else if (body.operation === 'list') receipt.result = operations.list(workspace.tree, args);
        else if (body.operation === 'read') receipt.result = operations.read(workspace.tree, args, this.limits);
        else if (body.operation === 'diff') receipt.result = operations.diff(workspace.base, workspace.tree, args, this.limits);
        else receipt.result = operations.artifact(workspace, args, this.limits, this.docker.imageDigest);
      } catch (error) {
        receipt.error = safeError(error);
        if (['UNSAFE_TREE', 'EFFECT_UNKNOWN', 'HELPER_FAILED', 'HELPER_OUTPUT_LIMIT', 'DOCKER_TIMEOUT', 'DOCKER_OPERATION_FAILED', 'PROCESS_STATE_UNKNOWN', 'RESOURCE_OWNERSHIP'].includes(error.code)) {
          workspace.state = 'quarantined'; receipt.effectUnknown = true;
        }
      } finally {
        receipt.status = 'completed';
        if (receipt.effectUnknown) { receipt.afterRevision = null; receipt.afterDigest = null; receipt.changes = null; }
        else { receipt.afterRevision ??= workspace.revision; receipt.afterDigest ??= workspace.tree.treeDigest; receipt.changes ??= []; }
        workspace.lease = null; workspace.touched = Date.now();
        while (workspace.calls.size > this.limits.receipts) workspace.calls.delete(workspace.calls.keys().next().value);
      }
      return receipt;
    });
    return receipt;
  }
  reconcile(workspace, receipt, tree) {
    receipt.changes = changesBetween(workspace.tree.entries, tree.entries);
    if (tree.treeDigest !== workspace.tree.treeDigest) workspace.revision++;
    workspace.tree = tree; receipt.afterRevision = workspace.revision; receipt.afterDigest = tree.treeDigest;
  }
  async run(workspace, lease, receipt, args) {
    if (lease.cancelRequested) throw new RunnerError('CANCELLED', 409);
    lease.job = this.docker.run(workspace, args);
    let output;
    try { output = await lease.job.promise; }
    catch (error) { workspace.state = 'quarantined'; receipt.effectUnknown = true; throw error; }
    Object.assign(receipt, output); delete receipt.reason;
    try { this.reconcile(workspace, receipt, await this.docker.helper(workspace, 'snapshot')); }
    catch (error) { workspace.state = 'quarantined'; receipt.effectUnknown = true; throw error; }
    if (lease.cancelRequested || output.reason) throw new RunnerError(output.reason ?? 'CANCELLED', 409);
    if (output.exitCode !== 0) throw new RunnerError('COMMAND_FAILED', 409);
  }
  getCall(owner, id, callId) {
    const workspace = this.owned(owner, id, false); const receipt = workspace.calls.get(callId);
    check(receipt, 'CALL_NOT_FOUND', 404); return { workspace, receipt };
  }
  async status(owner, id, callId, wait) {
    const { workspace, receipt } = this.getCall(owner, id, callId);
    if (wait && workspace.lease?.callId === callId) await workspace.lease.promise;
    return receipt;
  }
  async cancel(owner, id) {
    const workspace = this.owned(owner, id, false); const lease = workspace.lease;
    if (!lease || lease.operation !== 'run') return { cancelled: false, revision: workspace.revision, treeDigest: workspace.tree?.treeDigest ?? null };
    lease.cancelRequested = true;
    if (lease.job) await lease.job.cancel(); await lease.promise;
    check(workspace.state !== 'quarantined', 'WORKSPACE_QUARANTINED', 409);
    return { cancelled: true, callId: lease.callId, revision: workspace.revision, treeDigest: workspace.tree.treeDigest, processesRemoved: true };
  }
  async close(owner, id) {
    const workspace = this.owned(owner, id, false); if (workspace.state === 'closed') return { id, closed: true };
    if (workspace.closingPromise) return workspace.closingPromise;
    workspace.state = 'closing';
    workspace.closingPromise = Promise.resolve().then(async () => {
      if (workspace.initialization) await workspace.initialization.catch(() => {});
      workspace.state = 'closing';
      if (workspace.lease?.operation === 'run') await this.cancel(owner, id).catch(() => {});
      if (workspace.lease) await workspace.lease.promise;
      try { await this.docker.destroy(workspace); workspace.state = 'closed'; workspace.tree = null; workspace.base = null; return { id, closed: true }; }
      catch (error) { workspace.state = 'quarantined'; workspace.closingPromise = null; throw error; }
    });
    return workspace.closingPromise;
  }
  async expire() {
    for (const workspace of this.items.values()) if (Date.now() - workspace.touched > this.limits.idleMs) {
      if (workspace.state === 'closed') this.items.delete(workspace.id);
      else await this.close(workspace.owner, workspace.id).catch(() => {});
    }
  }
  async revoke(owner) {
    const results = await Promise.allSettled([...this.items.values()].filter((workspace) => workspace.owner === owner).map((workspace) => this.close(owner, workspace.id)));
    check(results.every((result) => result.status === 'fulfilled'), 'CLEANUP_FAILED', 503);
  }
  async shutdown() {
    const results = await Promise.allSettled([...this.items.values()].map((workspace) => this.close(workspace.owner, workspace.id)));
    check(results.every((result) => result.status === 'fulfilled'), 'CLEANUP_FAILED', 503);
  }
}
