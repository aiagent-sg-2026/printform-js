import { sourceFailure as fail, sourceErrorCode } from './source-workspace-errors.js';

export const SOURCE_RUNNER_URL = 'http://127.0.0.1:4317';
export const SOURCE_PROTOCOL = 'printform-coding-v1';
// 64,000 raw output bytes may expand sixfold in JSON; metadata stays bounded.
const MAX_RESPONSE_BYTES = 1024 * 1024;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const unavailable = () => fail('WORKSPACE_UNAVAILABLE');

function runnerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw unavailable(); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw unavailable();
  return url.origin;
}
async function responseJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw unavailable();
  const decoder = new TextDecoder('utf-8',{fatal:true});
  let size = 0, text = '';
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw fail('WORKSPACE_RESPONSE_LIMIT');
      text += decoder.decode(value,{stream:true});
    }
    text += decoder.decode();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
    if (!response.ok) {
      const code = data.error?.code || data.code;
      throw Object.assign(fail(typeof code === 'string' ? sourceErrorCode(code) : 'WORKSPACE_UNAVAILABLE'),{httpStatus:response.status});
    }
    return data;
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}

// Pairing credentials remain private, in memory. They never become model arguments,
// project fields, recovery snapshots, URLs or localStorage values.
class SourceConnection {
  #token;
  #fetch;
  #revoke;
  #dead = false;
  constructor(base,transport,paired) {
    if (paired.protocol !== SOURCE_PROTOCOL || paired.profile !== 'local-docker-node24-source-json-v1' || !/^[a-f0-9]{64}$/.test(paired.runnerSourceHash || '') || paired.responseBytes !== MAX_RESPONSE_BYTES ||
      typeof paired.token !== 'string' || paired.token.length < 24 || paired.token.length > 256 || !Number.isFinite(paired.expiresAt) || paired.expiresAt <= Date.now()) throw unavailable();
    this.base = base; this.#fetch = transport; this.#token = paired.token;
    this.expiresAt = paired.expiresAt; this.profile = paired.profile; this.runnerSourceHash = paired.runnerSourceHash;
  }
  get available() { return !this.#dead && Date.now() < this.expiresAt; }
  async request(path,{body,signal,intent = crypto.randomUUID(),wait = false} = {}) {
    if (!this.available) throw fail('WORKSPACE_AUTH_EXPIRED');
    const stop = signal ? AbortSignal.any([signal,AbortSignal.timeout(wait ? 65_000 : 15_000)]) : AbortSignal.timeout(wait ? 65_000 : 15_000);
    const headers = {Authorization:`Bearer ${this.#token}`};
    if (body !== undefined) Object.assign(headers,{'Content-Type':'application/json','x-pf-intent':intent});
    let response;
    try {
      response = await this.#fetch(`${this.base}${path}`,{method:body === undefined ? 'GET' : 'POST',headers,
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),signal:stop,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw unavailable();
    }
    return responseJson(response);
  }
  create(metadata,files,signal,intent) { return this.request('/v1/workspaces',{body:{...metadata,files},signal,intent}); }
  async call(id,operation,args,expectedRevision,signal) {
    if (!identifier(id)) throw fail('WORKSPACE_UNAVAILABLE');
    const root = `/v1/workspaces/${id}`;
    let receipt;
    try { receipt = await this.request(`${root}/calls`,{body:{operation,expectedRevision,args},signal}); }
    catch (error) {
      if (error.httpStatus >= 400 && error.httpStatus < 500 && ['AGENT_ARGUMENTS_INVALID','WORKSPACE_PATH_DENIED','QUOTA_EXCEEDED'].includes(error.code)) error.admissionRejected = true;
      throw error;
    }
    if (!identifier(receipt.callId)) throw fail('WORKSPACE_RECEIPT_INVALID');
    if (receipt.status === 'running') receipt = await this.request(`${root}/calls/${receipt.callId}?wait=1`,{signal,wait:true});
    return receipt;
  }
  cancel(id) { if (!identifier(id)) throw unavailable(); return this.request(`/v1/workspaces/${id}/cancel`,{body:{}}); }
  close(id) { if (!identifier(id)) throw unavailable(); return this.request(`/v1/workspaces/${id}/close`,{body:{}}); }
  revoke() {
    if (this.#revoke) return this.#revoke;
    if (this.#dead) return Promise.resolve();
    this.#revoke = this.request('/v1/revoke',{body:{}}).finally(()=> { this.#dead = true; this.#token = ''; });
    return this.#revoke;
  }
}

export async function pairSourceRunner(code,{baseURL = SOURCE_RUNNER_URL,transport = globalThis.fetch.bind(globalThis),signal} = {}) {
  const base = runnerUrl(baseURL);
  if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(code)) throw fail('WORKSPACE_PAIRING_INVALID');
  let response;
  try {
    response = await transport(`${base}/v1/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),
      signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  } catch { if (signal?.aborted) throw signal.reason; throw unavailable(); }
  return new SourceConnection(base,transport,await responseJson(response));
}
