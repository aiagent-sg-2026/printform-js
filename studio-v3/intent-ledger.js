import { fail } from './ai-edits.js';

// Host-side idempotency for effects that change committed state. The key is minted by the host, never taken from the
// model; the input string identifies what the key was minted for. The same key with the same input returns the original
// outcome (even while it is still running), the same key with another input is rejected, and a new key is a new effect.
// A failed outcome is replayed too: after an unknown result nothing is retried blindly under the same key.
const KEY = /^[A-Za-z0-9-]{8,80}$/;
export const newIntentKey = () => globalThis.crypto.randomUUID();
export function createIntentLedger({limit = 64} = {}) {
  const entries = new Map();
  return {
    run(key,input,effect) {
      if (!KEY.test(key ?? '')) throw fail('INTENT_KEY_INVALID');
      const known = entries.get(key);
      if (known) {
        if (known.input !== input) throw fail('INTENT_CONFLICT');
        return known.outcome;
      }
      // Registered before the effect starts, so a concurrent caller always finds it.
      const outcome = Promise.resolve().then(effect);
      outcome.catch(() => {});
      entries.set(key,{input,outcome});
      if (entries.size > limit) entries.delete(entries.keys().next().value);
      return outcome;
    },
    // The original outcome for a key already seen, or null. Used to answer a duplicate without re-validating the world.
    replay(key) { return entries.get(key)?.outcome ?? null; }
  };
}
