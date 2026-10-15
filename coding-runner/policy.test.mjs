// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pathName, validateFiles, LIMITS, normalizeLimits, runArgs, sha, treeDigest } from './policy.mjs';
import { Pairing, hostGuard, configuredOrigin } from './security.mjs';
import { artifact, diff, read, validatePatch } from './operations.mjs';

const origin = 'https://yapweijun1996.github.io';
function navigation() {
  return { headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-fetch-user': '?1', 'sec-fetch-site': 'none' } };
}
function paired(onRevoke) {
  const pairing = new Pairing(origin, LIMITS, onRevoke);
  const html = pairing.page(navigation(), 4317); const code = /id="pair-code">([^<]+)/.exec(html)[1];
  const credentials = pairing.pair({ code });
  const request = { method: 'POST', url: '/v1/workspaces', headers: { origin, authorization: `Bearer ${credentials.token}`, 'x-pf-intent': randomUUID() } };
  return { pairing, credentials, request, principal: pairing.authenticate(request) };
}
function tree(content, path = 'main.js') {
  const entries = [{ path, content, type: 'file', mode: 0o644, bytes: Buffer.byteLength(content), digest: sha(content) }];
  return { entries, treeDigest: treeDigest(entries) };
}
afterEach(() => vi.useRealTimers());

describe('source boundary policy', () => {
  it.each(['../secret', '/etc/passwd', 'a/../b', 'a//b', 'a\\b', 'C:secret', 'a/./b', 'a\0b', 'a\nb'])('rejects unsafe path %j', (path) => {
    expect(() => pathName(path)).toThrow();
  });
  it('rejects duplicate files, prefix conflicts, binary and widened limits', () => {
    expect(() => validateFiles([{ path: 'a', content: '' }, { path: 'a', content: 'x' }])).toThrow('DUPLICATE_PATH');
    expect(() => validateFiles([{ path: 'a', content: '' }, { path: 'a/b', content: 'x' }])).toThrow('PATH_CONFLICT');
    expect(() => validateFiles([{ path: 'a', content: '\0' }])).toThrow();
    expect(() => normalizeLimits({ timeoutMs: 60001 })).toThrow();
    expect(() => runArgs({ command: 'true', env: { NODE_OPTIONS: '--inspect' } }, LIMITS)).toThrow();
    expect(() => runArgs({ command: 'true', cwd: '..' }, LIMITS)).toThrow('UNSAFE_PATH');
  });
  it('validates every atomic patch member before admission', () => {
    expect(() => validatePatch({ changes: [{ path: 'a', expectedDigest: null, content: 'ok' }, { path: '../bad', expectedDigest: null, content: 'no' }] }, LIMITS)).toThrow();
    expect(() => validatePatch({ changes: [{ path: 'a', expectedDigest: null, content: '' }, { path: 'a', expectedDigest: null, content: null }] }, LIMITS)).toThrow('DUPLICATE_PATH');
  });
  it('returns exact bounded content and refuses incomplete diffs', () => {
    const source = tree('αβγ'); const value = read(source, { path: 'main.js', maxChars: 2 }, LIMITS);
    expect(value.content).toBe('αβ'); expect(value.truncated).toBe(true); expect(value.digest).toBe(sha('αβγ'));
    expect(read(tree('😀x'), { path: 'main.js', maxChars: 1 }, LIMITS).content).toBe('😀');
    expect(() => read(source, { path: 'main.js', expectedDigest: sha('old') }, LIMITS)).toThrow('STALE_FILE');
    expect(() => diff(tree('a'.repeat(64000)), tree('b'.repeat(64000)), {}, LIMITS)).toThrow('DIFF_TOO_LARGE');
  });
});

describe('pairing, owner credentials and intents', () => {
  it('requires a loopback human navigation and consumes each code once', () => {
    const pairing = new Pairing(origin, LIMITS);
    expect(() => pairing.page({ headers: {} }, 4317)).toThrow('PAIRING_NAVIGATION_REQUIRED');
    const linked = navigation(); linked.headers['sec-fetch-site'] = 'cross-site'; linked.headers.referer = origin;
    expect(pairing.page(linked, 4317)).toContain('id="pair-code"');
    expect(() => pairing.page({ headers: { ...linked.headers, 'sec-fetch-dest': 'iframe' } }, 4317)).toThrow('PAIRING_NAVIGATION_REQUIRED');
    const html = pairing.page(navigation(), 4317), code = /id="pair-code">([^<]+)/.exec(html)[1];
    const value = pairing.pair({ code }); expect(value.expiresAt).toBeGreaterThan(Date.now());
    expect(() => pairing.pair({ code })).toThrow('PAIRING_CODE_INVALID'); pairing.clear();
    expect(() => configuredOrigin('https://example.com/path')).toThrow('INVALID_ORIGIN');
    expect(() => hostGuard({ headers: { host: 'evil.test:4317' }, rawHeaders: ['Host', 'evil.test:4317'], socket: { remoteAddress: '127.0.0.1' } }, 4317)).toThrow('HOST_REJECTED');
  });
  it('caches concurrent accepted intents before any asynchronous effect', async () => {
    const { pairing, request, principal } = paired(); let effects = 0;
    const first = pairing.accept(principal, request, { value: 1 }, async () => ++effects);
    const second = pairing.accept(principal, request, { value: 1 }, async () => ++effects);
    expect(second).toBe(first); expect(effects).toBe(0); expect(await second).toBe(1);
    expect(() => pairing.accept(principal, request, { value: 2 }, async () => ++effects)).toThrow('INTENT_CONFLICT');
    request.url = '/v1/revoke'; expect(() => pairing.revokeRequest(request, {})).toThrow('INTENT_CONFLICT');
    expect(() => pairing.authenticate({ headers: { ...request.headers, origin: 'https://evil.test' } })).toThrow('AUTH_REJECTED'); pairing.clear();
  });
  it('revokes all owner effects while allowing only the original revoke receipt replay', async () => {
    let revoked = 0; const { pairing, request } = paired(async () => { revoked++; }); request.url = '/v1/revoke';
    const first = pairing.revokeRequest(request, {}), replay = pairing.revokeRequest(request, {});
    expect(replay).toBe(first); expect(() => pairing.authenticate(request)).toThrow('AUTH_REJECTED');
    expect(await first).toEqual({ revoked: true, workspacesClosed: true }); expect(revoked).toBe(1);
    expect(() => pairing.revokeRequest(request, { extra: true })).toThrow('INTENT_CONFLICT');
    expect(() => pairing.revokeRequest({ ...request, headers: { ...request.headers, 'x-pf-intent': randomUUID() } }, {})).toThrow('AUTH_REJECTED'); pairing.clear();
  });
  it('expires credentials and initiates owner teardown instead of leaving commands alive', async () => {
    vi.useFakeTimers(); let closed = 0;
    const { pairing, request } = paired(async () => { closed++; });
    await vi.advanceTimersByTimeAsync(LIMITS.tokenMs + 1);
    expect(closed).toBe(1); expect(() => pairing.authenticate(request)).toThrow('AUTH_REJECTED'); pairing.clear();
  });
});

it('derives artifact provenance outside the source and invalidates old build identities', () => {
  const content = JSON.stringify({ format: 'printform-operation-artifact', version: 1, summary: 'Synthetic operation', operations: [{ type: 'example' }] });
  const source = tree(content, 'build/operations.json'), callId = randomUUID();
  const workspace = { id: randomUUID(), revision: 2, tree: source, calls: new Map([[callId, { callId, operation: 'run', status: 'completed', exitCode: 0, afterRevision: 2, afterDigest: source.treeDigest }]]),
    context: { releaseIdentity: { release: 'owned' }, documentId: 'doc', baseRevision: 7, runId: 'run' } };
  const value = artifact(workspace, { callId, path: 'build/operations.json' }, LIMITS, 'sha256:owned');
  expect(value.documentId).toBe('doc'); expect(value.sourceRevision).toBe(2); expect(value.contentDigest).toBe(sha(content));
  workspace.revision++; expect(() => artifact(workspace, { callId, path: 'build/operations.json' }, LIMITS, 'sha256:owned')).toThrow('STALE_ARTIFACT');
});
