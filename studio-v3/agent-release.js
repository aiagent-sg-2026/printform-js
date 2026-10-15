// Vite stamps this identity from the package generated immediately before bundling.
export const AGENT_BUILD_IDENTITY = typeof __PRINTFORM_V3_AGENT_IDENTITY__ === 'undefined' ? null : Object.freeze(__PRINTFORM_V3_AGENT_IDENTITY__);
const fail = code => Object.assign(new Error(code),{code});
export async function verifyAgentRelease({expected=AGENT_BUILD_IDENTITY,base=globalThis.document?.querySelector('meta[name=printform-assets]')?.content,
  fetcher=globalThis.fetch,signal}={}) {
  signal?.throwIfAborted();
  if (!expected) return Object.freeze({release:'development',verified:false}); // Unbundled unit/development use only.
  if (base !== `./releases/${expected.release}/`) throw fail('AGENT_RELEASE_MISMATCH');
  const stop = AbortSignal.any([...(signal ? [signal] : []),AbortSignal.timeout(5000)]);
  let manifest;
  try {
    const response = await fetcher(`${base}agent/agent-manifest.json`,{signal:stop,cache:'no-cache'});
    if (!response.ok) throw new Error();
    const text = await response.text();
    if (text.length>8192) throw new Error();
    manifest=JSON.parse(text);
  } catch {
    signal?.throwIfAborted();
    throw fail('AGENT_KNOWLEDGE_UNAVAILABLE');
  }
  if (manifest.version!==1 || ['release','contractHash','knowledgeHash','packageHash'].some(key=>manifest[key]!==expected[key])) throw fail('AGENT_RELEASE_MISMATCH');
  if (expected.sourceRunnerHash !== undefined && (!/^[a-f0-9]{64}$/.test(expected.sourceRunnerHash) || manifest.sourceRunnerHash !== expected.sourceRunnerHash)) throw fail('AGENT_RELEASE_MISMATCH');
  signal?.throwIfAborted();
  return Object.freeze({...expected,verified:true});
}
