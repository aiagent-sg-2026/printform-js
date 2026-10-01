const DB_VERSION = 1;
const STORE_NAME = "profiles";
const META_ID = "__vault_meta__";
const PBKDF2_ITERATIONS = 600_000;
const MIN_PASSPHRASE_LENGTH = 12;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function openDatabase(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Cannot open vault database"));
  });
}

function assertPassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw Object.assign(new Error(`Passphrase must contain at least ${MIN_PASSPHRASE_LENGTH} characters`), { code: "VAULT_PASSPHRASE_TOO_SHORT" });
  }
}

function assertProfile(profile) {
  if (!profile || typeof profile !== "object" || !/^[a-z][a-z0-9-]{1,63}$/u.test(profile.id || "")) {
    throw Object.assign(new Error("Provider profile id is invalid"), { code: "VAULT_PROFILE_INVALID" });
  }
  if (!profile.provider || !profile.model || !profile.apiKey) {
    throw Object.assign(new Error("Provider, model and API key are required"), { code: "VAULT_PROFILE_INCOMPLETE" });
  }
}

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey("raw", textEncoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function associatedData(profileId) {
  return textEncoder.encode(JSON.stringify({ version: DB_VERSION, profileId }));
}

async function encryptProfile(profile, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: associatedData(profile.id) },
    key,
    textEncoder.encode(JSON.stringify(profile))
  );
  return { iv: bytesToBase64(iv), cipher: bytesToBase64(cipher) };
}

async function decryptProfile(record, key) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(record.iv), additionalData: associatedData(record.id) },
    key,
    base64ToBytes(record.cipher)
  );
  return JSON.parse(textDecoder.decode(plain));
}

export class ByokVault {
  constructor({ dbName = "printform-agent-vault-v1" } = {}) {
    this.dbName = dbName;
    this.db = null;
    this.key = null;
    this.salt = null;
    this.profiles = new Map();
  }

  get unlocked() { return Boolean(this.key); }

  async database() {
    if (!this.db) this.db = await openDatabase(this.dbName);
    return this.db;
  }

  async readAll() {
    const db = await this.database();
    return requestValue(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll());
  }

  async write(record) {
    const db = await this.database();
    return requestValue(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record));
  }

  async unlock(passphrase) {
    assertPassphrase(passphrase);
    const records = await this.readAll();
    let meta = records.find((record) => record.id === META_ID);
    if (!meta) {
      meta = { id: META_ID, version: DB_VERSION, salt: bytesToBase64(crypto.getRandomValues(new Uint8Array(16))) };
      await this.write(meta);
    }
    try {
      const key = await deriveKey(passphrase, base64ToBytes(meta.salt));
      const profiles = new Map();
      for (const record of records.filter((item) => item.id !== META_ID)) profiles.set(record.id, await decryptProfile(record, key));
      this.key = key;
      this.salt = meta.salt;
      this.profiles = profiles;
      return this.listProfiles();
    } catch (error) {
      this.lock();
      throw Object.assign(new Error("Cannot unlock provider vault with this passphrase"), { code: "VAULT_UNLOCK_FAILED", cause: error });
    }
  }

  lock() {
    this.key = null;
    this.salt = null;
    this.profiles.clear();
  }

  listProfiles() {
    return Array.from(this.profiles.values(), (profile) => ({
      id: profile.id, provider: profile.provider, model: profile.model,
      endpoint: profile.endpoint || "", apiVariant: profile.apiVariant || "chat",
      inputPricePer1M: profile.inputPricePer1M ?? "",
      outputPricePer1M: profile.outputPricePer1M ?? "",
      maxCostUsd: profile.maxCostUsd ?? ""
    }));
  }

  getProfile(id) {
    const profile = this.profiles.get(id);
    return profile ? structuredClone(profile) : null;
  }

  async saveProfile(profile) {
    if (!this.unlocked) throw Object.assign(new Error("Unlock the provider vault first"), { code: "VAULT_LOCKED" });
    assertProfile(profile);
    const normalized = {
      id: profile.id, provider: profile.provider, model: profile.model,
      endpoint: profile.endpoint || "", apiVariant: profile.apiVariant || "chat", apiKey: profile.apiKey,
      inputPricePer1M: profile.inputPricePer1M ?? "",
      outputPricePer1M: profile.outputPricePer1M ?? "",
      maxCostUsd: profile.maxCostUsd ?? ""
    };
    const encrypted = await encryptProfile(normalized, this.key);
    await this.write({ id: normalized.id, provider: normalized.provider, model: normalized.model, endpoint: normalized.endpoint, apiVariant: normalized.apiVariant, inputPricePer1M: normalized.inputPricePer1M, outputPricePer1M: normalized.outputPricePer1M, maxCostUsd: normalized.maxCostUsd, updatedAt: Date.now(), ...encrypted });
    this.profiles.set(normalized.id, normalized);
    return this.listProfiles();
  }

  async deleteProfile(id) {
    if (!this.unlocked) throw Object.assign(new Error("Unlock the provider vault first"), { code: "VAULT_LOCKED" });
    const db = await this.database();
    await requestValue(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id));
    this.profiles.delete(id);
  }

  async clear() {
    this.lock();
    if (this.db) this.db.close();
    this.db = null;
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      // WebKit may report blocked while the just-closed connection finishes
      // draining. Wait for deletion, with a bound for truly open connections.
      const timer = setTimeout(() => reject(new Error("Cannot clear provider vault while it is in use")),5000);
      request.onsuccess = () => { clearTimeout(timer); resolve(); };
      request.onerror = () => { clearTimeout(timer); reject(request.error || new Error("Cannot clear provider vault")); };
    });
  }
}

export const VAULT_POLICY = Object.freeze({
  pbkdf2Iterations: PBKDF2_ITERATIONS,
  saltBytes: 16,
  ivBytes: 12,
  minPassphraseLength: MIN_PASSPHRASE_LENGTH
});
