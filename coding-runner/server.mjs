import http from 'node:http';
import { DockerBroker } from './docker.mjs';
import { Workspaces } from './workspaces.mjs';
import { Pairing, configuredOrigin, hostGuard, originGuard, cors, preflight, jsonBody } from './security.mjs';
import { PROTOCOL, PROFILE, JSON_RESPONSE_BYTES, BASE_IMAGE, DEFAULT_IMAGE, normalizeLimits, check, keys, UUID, safeError } from './policy.mjs';

export function createCodingServer({ origin, port = 4317, image = DEFAULT_IMAGE, limits: suppliedLimits = {} } = {}) {
  const allowedOrigin = configuredOrigin(origin); const limits = normalizeLimits(suppliedLimits);
  check(Number.isSafeInteger(port) && port >= 0 && port <= 65535, 'INVALID_PORT');
  const docker = new DockerBroker(image, limits), workspaces = new Workspaces(docker, limits);
  const pairing = new Pairing(allowedOrigin, limits, (principal) => workspaces.revoke(principal));
  let boundPort = port, listening = null, closing = null, expiryTimer = null, stopping = false;
  function send(response, status, value) {
    if (response.destroyed) return;
    const text = JSON.stringify(value);
    check(Buffer.byteLength(text) <= JSON_RESPONSE_BYTES, 'RESPONSE_LIMIT', 503);
    response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(text);
  }
  async function body(request, max) {
    const value = await jsonBody(request, max); check(!stopping, 'SERVER_CLOSING', 503); return value;
  }
  function admit(principal, request, value, action) {
    check(!stopping, 'SERVER_CLOSING', 503);
    return pairing.accept(principal, request, value, () => { check(!stopping, 'SERVER_CLOSING', 503); return action(); });
  }
  async function route(request, response) {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    response.setHeader('X-Frame-Options', 'DENY'); response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    hostGuard(request, boundPort); check(!stopping, 'SERVER_CLOSING', 503);
    const url = new URL(request.url, `http://127.0.0.1:${boundPort}`);
    check(url.origin === `http://127.0.0.1:${boundPort}`, 'HOST_REJECTED', 403);
    if (request.method === 'GET' && url.pathname === '/pair' && !url.search) {
      const html = pairing.page(request, boundPort); response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return;
    }
    if (request.method === 'GET' && url.pathname === '/health' && !url.search) {
      if (request.headers.origin !== undefined) { originGuard(request, allowedOrigin); cors(response, allowedOrigin); }
      send(response, 200, { protocol: PROTOCOL, profile: PROFILE, imageDigest: docker.imageDigest, runnerSourceHash: docker.runnerSourceHash, responseBytes: JSON_RESPONSE_BYTES, baseImage: BASE_IMAGE,
        capabilities: ['list', 'read', 'search', 'write', 'patch', 'run', 'diff', 'artifacts', 'cancel'],
        isolation: { network: 'none', root: 'read-only', uid: 1000, storage: 'owned-tmpfs', disposableCommands: true }, limits }); return;
    }
    originGuard(request, allowedOrigin); cors(response, allowedOrigin);
    if (request.method === 'OPTIONS') { preflight(request); response.statusCode = 204; response.end(); return; }
    if (request.method === 'POST' && url.pathname === '/v1/pair' && !url.search) {
      send(response, 200, { ...pairing.pair(await body(request, 1024)), runnerSourceHash: docker.runnerSourceHash, responseBytes: JSON_RESPONSE_BYTES }); return;
    }
    if (request.method === 'POST' && url.pathname === '/v1/revoke' && !url.search) {
      send(response, 200, await pairing.revokeRequest(request, await body(request, 1024))); return;
    }
    const principal = pairing.authenticate(request);
    if (request.method === 'POST' && url.pathname === '/v1/workspaces' && !url.search) {
      const value = await body(request, limits.bodyBytes);
      send(response, 200, await admit(principal, request, value, () => workspaces.create(principal, value))); return;
    }
    const match = /^\/v1\/workspaces\/([^/]+)\/(calls|cancel|close)(?:\/([^/]+))?$/.exec(url.pathname);
    check(match && UUID.test(match[1]), 'NOT_FOUND', 404); const [, id, action, callId] = match;
    if (request.method === 'GET' && action === 'calls' && callId && UUID.test(callId)) {
      check([...url.searchParams.keys()].every((key) => key === 'wait') && (!url.search || url.search === '?wait=1'), 'INVALID_ARGUMENT');
      send(response, 200, await workspaces.status(principal, id, callId, url.searchParams.get('wait') === '1')); return;
    }
    check(request.method === 'POST' && !callId && !url.search, 'METHOD_NOT_ALLOWED', 405);
    const value = await body(request, limits.bodyBytes);
    const result = await admit(principal, request, value, () => {
      if (action === 'calls') return workspaces.accept(principal, id, value);
      keys(value, []); return action === 'cancel' ? workspaces.cancel(principal, id) : workspaces.close(principal, id);
    });
    send(response, result.status === 'running' ? 202 : 200, result);
  }
  const server = http.createServer((request, response) => {
    void route(request, response).catch((error) => send(response, error.status ?? 500, { error: safeError(error) }));
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32;
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  function listen() {
    if (listening) return listening;
    check(!stopping, 'SERVER_CLOSING', 503);
    listening = (async () => {
      await docker.initialize();
      await new Promise((resolve, reject) => {
        server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
      });
      boundPort = server.address().port;
      expiryTimer = setInterval(() => { void workspaces.expire(); pairing.prune(); }, Math.min(limits.idleMs, 30000)); expiryTimer.unref();
      return { url: `http://127.0.0.1:${boundPort}`, port: boundPort, protocol: PROTOCOL, profile: PROFILE, imageDigest: docker.imageDigest, runnerSourceHash: docker.runnerSourceHash };
    })();
    return listening;
  }
  function close() {
    if (closing) return closing;
    stopping = true; clearInterval(expiryTimer);
    closing = (async () => {
      if (listening) await listening.catch(() => {});
      let cleanupError; try { await workspaces.shutdown(); } catch (error) { cleanupError = error; }
      pairing.clear();
      if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (cleanupError) throw cleanupError;
    })();
    return closing;
  }
  return { server, listen, close };
}
