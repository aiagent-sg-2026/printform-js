import { sourceFailure as fail, sourceErrorCode } from './source-workspace-errors.js';
import { sourceWorkspaceStarter } from './source-workspace-starter.js';
import { verifySourceArtifact } from './source-workspace-artifact.js';

const authorized = new WeakSet();
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const imageHash = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const readonly = new Set(['list','read','search','diff','artifacts']);
const identityOf = value => Object.fromEntries(['release','contractHash','knowledgeHash','packageHash'].map(key=>[key,value[key]]));

class SourceWorkspaceRun {
  #connection;
  #opening;
  #closing;
  #closed = false;
  #uncertain = false;
  #admitted = false;
  #id;
  #revision;
  #digest;
  #image;
  #binding;
  #artifacts = new Map();
  #commands = new Map();
  #edited = new Set();
  #imported = null;
  constructor(connection,readOnly) {
    this.#connection = connection;
    this.profile = readOnly ? 'coding-read-only' : 'coding';
    Object.freeze(this);
  }
  get active() { return !this.#closed && !this.#uncertain && this.#connection.available; }
  get denialCode() { return this.#uncertain ? 'EFFECT_UNKNOWN' : this.#closed ? 'CANCELLED' : 'WORKSPACE_AUTH_EXPIRED'; }
  get imported() { return this.#imported; }
  #invalidate() { this.#uncertain = true; this.#artifacts.clear(); this.#imported = null; }
  async open({identity,project,baseRevision,runId},signal) {
    if (!this.active) throw fail('WORKSPACE_DISCLOSURE_REQUIRED');
    if (!hash(identity.sourceRunnerHash) || identity.sourceRunnerHash !== this.#connection.runnerSourceHash) throw fail('WORKSPACE_RUNTIME_MISMATCH');
    if (this.#opening) return this.#opening;
    this.#binding = Object.freeze({releaseIdentity:Object.freeze(identityOf(identity)),documentId:project.manifest.documentId,baseRevision,runId});
    this.#opening = (async()=> {
      this.#admitted = true;
      const value = await this.#connection.create(this.#binding,sourceWorkspaceStarter(),signal);
      if (!id(value.id) || !Number.isSafeInteger(value.revision) || value.revision < 0 || !hash(value.treeDigest) || !imageHash(value.imageDigest)) throw fail('WORKSPACE_RECEIPT_INVALID');
      this.#id = value.id; this.#revision = value.revision; this.#digest = value.treeDigest; this.#image = value.imageDigest;
      signal.throwIfAborted();
      if (!this.active) throw fail('GRANT_DENIED');
      return {id:this.#id,revision:this.#revision,treeDigest:this.#digest,imageDigest:this.#image,profile:this.profile};
    })();
    return this.#opening;
  }
  async action(operation,args,signal) {
    if (!this.active || !this.#id) throw fail('WORKSPACE_UNAVAILABLE');
    if (this.profile === 'coding-read-only' && !readonly.has(operation)) throw fail('GRANT_DENIED');
    const revision = this.#revision, digest = this.#digest;
    let receipt;
    try { receipt = await this.#connection.call(this.#id,operation,args,revision,signal); }
    catch (error) { if (!error.admissionRejected) this.#invalidate(); throw error; }
    if (this.#closed) throw fail('CANCELLED');
    if (receipt.effectUnknown) { this.#invalidate(); throw fail('EFFECT_UNKNOWN'); }
    if (!id(receipt.callId) || receipt.status !== 'completed' || receipt.beforeRevision !== revision || receipt.beforeDigest !== digest ||
      !Number.isSafeInteger(receipt.afterRevision) || receipt.afterRevision < revision || receipt.afterRevision > revision + 1 || !hash(receipt.afterDigest) || receipt.imageDigest !== this.#image ||
      !Array.isArray(receipt.changes) || (readonly.has(operation) && (receipt.afterRevision !== revision || receipt.afterDigest !== digest || receipt.changes.length))) {
      this.#invalidate(); throw fail('WORKSPACE_RECEIPT_INVALID');
    }
    this.#revision = receipt.afterRevision; this.#digest = receipt.afterDigest;
    if (receipt.afterDigest !== digest) { this.#artifacts.clear(); this.#imported = null; }
    for (const change of receipt.changes) {
      if ((change.beforeType === 'file' || change.afterType === 'file') && typeof change.path === 'string' && !change.path.startsWith('artifacts/')) this.#edited.add(change.path);
    }
    if (operation === 'run') this.#commands.set(receipt.callId,{callId:receipt.callId,command:args.command,exitCode:receipt.exitCode,signal:receipt.signal ?? null,
      beforeDigest:receipt.beforeDigest,afterDigest:receipt.afterDigest,sourceRevision:receipt.afterRevision,changes:receipt.changes});
    if (receipt.error && !(operation === 'run' && receipt.error.code === 'COMMAND_FAILED' && Number.isInteger(receipt.exitCode) && receipt.exitCode !== 0)) throw fail(sourceErrorCode(receipt.error.code));
    return receipt;
  }
  async artifact(args,signal) {
    const command = this.#commands.get(args.callId);
    if (!command || command.exitCode !== 0) throw fail('ARTIFACT_REJECTED');
    const receipt = await this.action('artifacts',args,signal);
    const artifact = receipt.result;
    await verifySourceArtifact(artifact,{...this.#binding,workspaceId:this.#id,sourceRevision:this.#revision,treeDigest:this.#digest,imageDigest:this.#image,buildCallId:args.callId});
    if (!id(artifact.id)) throw fail('ARTIFACT_REJECTED');
    this.#artifacts.set(artifact.id,{artifact,args});
    const {content,...descriptor} = artifact;
    return descriptor;
  }
  async importArtifact(artifactId,signal) {
    if (this.profile !== 'coding') throw fail('GRANT_DENIED');
    const stored = this.#artifacts.get(artifactId);
    if (!stored || ![...this.#edited].some(path=>path !== stored.args.path)) throw fail('ARTIFACT_REJECTED');
    // Re-fetch under the current server tree/receipt. A cached ID cannot bless a later write.
    const receipt = await this.action('artifacts',stored.args,signal), artifact = receipt.result;
    const parsed = await verifySourceArtifact(artifact,{...this.#binding,workspaceId:this.#id,sourceRevision:this.#revision,treeDigest:this.#digest,imageDigest:this.#image,buildCallId:stored.args.callId});
    if (artifact.id !== artifactId || artifact.contentDigest !== stored.artifact.contentDigest) throw fail('ARTIFACT_REJECTED');
    this.#imported = this.#imported?.artifactId === artifactId ? this.#imported : Object.freeze({artifactId,contentDigest:artifact.contentDigest,workspaceId:this.#id,sourceRevision:this.#revision,treeDigest:this.#digest,imageDigest:this.#image,
      buildCallId:artifact.buildCallId,commands:[...this.#commands.values()]});
    return {artifact:parsed,evidence:this.#imported};
  }
  async confirmImported(evidence,signal) {
    if (!this.active || this.#imported !== evidence) throw fail('SOURCE_ARTIFACT_REQUIRED');
    const stored = this.#artifacts.get(evidence.artifactId);
    if (!stored) throw fail('SOURCE_ARTIFACT_REQUIRED');
    const receipt = await this.action('artifacts',stored.args,signal);
    const artifact = receipt.result;
    await verifySourceArtifact(artifact,{...this.#binding,workspaceId:this.#id,sourceRevision:this.#revision,treeDigest:this.#digest,imageDigest:this.#image,buildCallId:stored.args.callId});
    if (artifact.id !== evidence.artifactId || artifact.contentDigest !== evidence.contentDigest || this.#closed) throw fail('ARTIFACT_REJECTED');
  }
  close() {
    if (this.#closing) return this.#closing;
    this.#closed = true;
    this.#closing = (async()=> {
      await this.#opening?.catch(()=>{});
      if (this.#id) await this.#connection.close(this.#id);
      else if (this.#admitted) await this.#connection.revoke();
      this.#artifacts.clear();
    })();
    return this.#closing;
  }
}

export function authorizeSourceWorkspace(connection,{fictionalSource = false,readOnly = false} = {}) {
  if (fictionalSource !== true || !connection?.available) throw fail('WORKSPACE_DISCLOSURE_REQUIRED');
  const run = new SourceWorkspaceRun(connection,readOnly);
  authorized.add(run);
  return run;
}
export function isSourceAuthorization(run) { return authorized.has(run) && run.active; }
