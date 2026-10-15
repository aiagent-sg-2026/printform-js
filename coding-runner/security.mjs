import { randomBytes, randomUUID } from 'node:crypto';
import { check, keys, text, UUID, sha, canonical, PROTOCOL, PROFILE, RunnerError } from './policy.mjs';

export function configuredOrigin(value) {
  let parsed; try { parsed = new URL(value); } catch { throw new RunnerError('INVALID_ORIGIN'); }
  check(parsed.origin === value && !parsed.username && !parsed.password &&
    (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))), 'INVALID_ORIGIN');
  return value;
}
export function hostGuard(request, port) {
  check(request.headers.host === `127.0.0.1:${port}` && request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'host').length === 1, 'HOST_REJECTED', 403);
  check(request.socket.remoteAddress === '127.0.0.1', 'HOST_REJECTED', 403);
}
export function originGuard(request, origin) { check(request.headers.origin === origin, 'ORIGIN_REJECTED', 403); }
export function cors(response, origin) {
  response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-pf-intent');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
}
export function preflight(request) {
  check(['GET', 'POST'].includes(request.headers['access-control-request-method']), 'PREFLIGHT_REJECTED', 403);
  const headers = (request.headers['access-control-request-headers'] ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  check(headers.every((header) => ['content-type', 'authorization', 'x-pf-intent'].includes(header)), 'PREFLIGHT_REJECTED', 403);
}
export class Pairing {
  constructor(origin, limits, onRevoke = () => Promise.resolve()) {
    this.origin = origin; this.limits = limits; this.onRevoke = onRevoke; this.codes = new Map(); this.tokens = new Map(); this.intents = new Map(); this.revoked = new Map();
  }
  revoke(token) {
    const value = this.tokens.get(token); if (!value) return Promise.resolve();
    clearTimeout(value.timer); this.tokens.delete(token); this.intents.delete(value.principal);
    return Promise.resolve().then(() => this.onRevoke(value.principal));
  }
  prune() {
    for (const [code, expires] of this.codes) if (expires <= Date.now()) this.codes.delete(code);
    for (const [token, value] of this.tokens) if (value.expiresAt <= Date.now()) void this.revoke(token).catch(() => {});
    for (const [token, value] of this.revoked) if (value.expiresAt <= Date.now()) this.revoked.delete(token);
  }
  page(request, port) {
    check(request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document' &&
      request.headers['sec-fetch-user'] === '?1' && ['none', 'same-origin', 'same-site', 'cross-site'].includes(request.headers['sec-fetch-site']), 'PAIRING_NAVIGATION_REQUIRED', 403);
    check(!request.headers.origin || request.headers.origin === `http://127.0.0.1:${port}`, 'ORIGIN_REJECTED', 403);
    this.prune(); while (this.codes.size >= 8) this.codes.delete(this.codes.keys().next().value);
    const code = randomBytes(24).toString('base64url'); this.codes.set(code, Date.now() + 120000);
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pair PrintForm companion</title><body><h1>Pair your local companion</h1><p>Only copy this one-time code into the PrintForm browser settings you opened. It expires in two minutes.</p><code id="pair-code">${code}</code><p>Allowed browser origin: ${this.origin.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')}</p><p>Local Docker Node source execution only. Network access is disabled. Pairing does not upload a form or authorize Apply.</p></body></html>`;
  }
  pair(body) {
    keys(body, ['code'], ['code']); text(body.code, 128); this.prune();
    const expires = this.codes.get(body.code); check(expires && expires > Date.now(), 'PAIRING_CODE_INVALID', 403);
    check(this.tokens.size < 8 && this.revoked.size < 64, 'PAIRING_LIMIT', 429); this.codes.delete(body.code);
    const token = randomBytes(32).toString('base64url'); const value = { principal: randomUUID(), origin: this.origin, expiresAt: Date.now() + this.limits.tokenMs };
    value.timer = setTimeout(() => { void this.revoke(token).catch(() => {}); }, this.limits.tokenMs); value.timer.unref();
    this.tokens.set(token, value); return { token, expiresAt: value.expiresAt, protocol: PROTOCOL, profile: PROFILE };
  }
  authenticate(request) {
    this.prune(); const header = request.headers.authorization;
    check(typeof header === 'string' && /^Bearer [A-Za-z0-9_-]{43}$/.test(header), 'AUTH_REQUIRED', 401);
    const value = this.tokens.get(header.slice(7)); check(value && value.origin === request.headers.origin, 'AUTH_REJECTED', 401); return value.principal;
  }
  accept(principal, request, body, action) {
    check(this.authenticate(request) === principal, 'AUTH_REJECTED', 401);
    const intent = request.headers['x-pf-intent']; check(typeof intent === 'string' && UUID.test(intent), 'INTENT_REQUIRED');
    let cache = this.intents.get(principal); if (!cache) { cache = new Map(); this.intents.set(principal, cache); }
    const fingerprint = sha(canonical({ method: request.method, path: request.url, body })); const previous = cache.get(intent);
    if (previous) { check(previous.fingerprint === fingerprint, 'INTENT_CONFLICT', 409); return previous.promise; }
    check(cache.size < 256, 'INTENT_LIMIT', 429);
    const promise = Promise.resolve().then(() => {
      check(this.authenticate(request) === principal, 'AUTH_REJECTED', 401); return action();
    });
    cache.set(intent, { fingerprint, promise }); return promise;
  }
  revokeRequest(request, body) {
    this.prune();
    const header = request.headers.authorization, intent = request.headers['x-pf-intent'];
    check(typeof header === 'string' && /^Bearer [A-Za-z0-9_-]{43}$/.test(header), 'AUTH_REQUIRED', 401);
    check(request.headers.origin === this.origin, 'ORIGIN_REJECTED', 403);
    check(typeof intent === 'string' && UUID.test(intent), 'INTENT_REQUIRED');
    const token = header.slice(7), fingerprint = sha(canonical({ method: request.method, path: request.url, body }));
    const previous = this.revoked.get(token);
    if (previous) {
      check(previous.intent === intent, 'AUTH_REJECTED', 401);
      check(previous.fingerprint === fingerprint, 'INTENT_CONFLICT', 409); return previous.promise;
    }
    keys(body, []);
    const value = this.tokens.get(token); check(value, 'AUTH_REJECTED', 401);
    const accepted = this.intents.get(value.principal)?.get(intent);
    check(!accepted || accepted.fingerprint === fingerprint, 'INTENT_CONFLICT', 409);
    const promise = this.revoke(token).then(() => ({ revoked: true, workspacesClosed: true }));
    this.revoked.set(token, { intent, fingerprint, promise, expiresAt: value.expiresAt }); return promise;
  }
  clear() {
    this.codes.clear(); for (const token of this.tokens.keys()) void this.revoke(token).catch(() => {});
    this.intents.clear(); this.revoked.clear();
  }
}
export async function jsonBody(request, maxBytes) {
  check(/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? ''), 'CONTENT_TYPE', 415);
  const chunks = []; let bytes = 0;
  for await (const chunk of request) { bytes += chunk.length; check(bytes <= maxBytes, 'BODY_TOO_LARGE', 413); chunks.push(chunk); }
  try { const source = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); const body = JSON.parse(source); keys(body, Object.keys(body ?? {})); return body; }
  catch { throw new RunnerError('INVALID_JSON'); }
}
