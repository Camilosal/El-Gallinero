/**
 * Cifrado local en reposo (Web Crypto AES-GCM 256 bits) para IndexedDB Offline-First.
 * Protege payloads de galpón, cachés de consultas y notas de voz en dispositivos compartidos.
 */

export interface EncryptedEnvelope {
  __enc: 1;
  v: "aes-gcm-256";
  iv: string;
  ct: string;
}

export interface EncryptedBlobEnvelope {
  __enc: 1;
  v: "aes-gcm-256-blob";
  mimeType: string;
  iv: string;
  ct: string;
}

const STORAGE_KEY = "gallinero_offline_k1";
let cachedKey: CryptoKey | null = null;
let cachedScope = "default";

function getSubtle(): SubtleCrypto | null {
  if (typeof globalThis === "undefined") return null;
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) return null;
  return c.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as EncryptedEnvelope).__enc === 1 &&
    (value as EncryptedEnvelope).v === "aes-gcm-256" &&
    typeof (value as EncryptedEnvelope).iv === "string" &&
    typeof (value as EncryptedEnvelope).ct === "string"
  );
}

export function isEncryptedBlobEnvelope(value: unknown): value is EncryptedBlobEnvelope {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as EncryptedBlobEnvelope).__enc === 1 &&
    (value as EncryptedBlobEnvelope).v === "aes-gcm-256-blob" &&
    typeof (value as EncryptedBlobEnvelope).iv === "string" &&
    typeof (value as EncryptedBlobEnvelope).ct === "string"
  );
}

export async function getOrCreateOfflineCryptoKey(): Promise<CryptoKey | null> {
  const subtle = getSubtle();
  if (!subtle) return null;
  if (cachedKey) return cachedKey;

  const storage =
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
      ? window.localStorage
      : null;

  if (storage) {
    try {
      const rawJwk = storage.getItem(`${STORAGE_KEY}:${cachedScope}`);
      if (rawJwk) {
        const parsed = JSON.parse(rawJwk) as JsonWebKey;
        cachedKey = await subtle.importKey(
          "jwk",
          parsed,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
        return cachedKey;
      }
    } catch {
      // Regenerar llave si el JWK guardado estuviera corrupto
    }
  }

  const generated = await subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  cachedKey = generated;

  if (storage) {
    try {
      const exported = await subtle.exportKey("jwk", generated);
      storage.setItem(`${STORAGE_KEY}:${cachedScope}`, JSON.stringify(exported));
    } catch {
      // Almacenamiento lleno o bloqueado: la llave sigue en memoria para la sesión
    }
  }

  return cachedKey;
}

export async function setOfflineCryptoSeed(seed: string): Promise<void> {
  const subtle = getSubtle();
  if (!subtle) return;
  const normalized = String(seed || "default").trim() || "default";
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  cachedScope = normalized.slice(0, 32);
  cachedKey = await subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export function clearOfflineCryptoKey(purgePersisted = false): void {
  cachedKey = null;
  if (purgePersisted && typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    try {
      window.localStorage.removeItem(`${STORAGE_KEY}:${cachedScope}`);
    } catch {
      // Ignorar
    }
  }
  cachedScope = "default";
}

export async function encryptJsonPayload<T>(value: T): Promise<EncryptedEnvelope | T> {
  if (value === undefined) return value;
  const subtle = getSubtle();
  const key = await getOrCreateOfflineCryptoKey();
  if (!subtle || !key) return value;

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded),
  );

  return {
    __enc: 1,
    v: "aes-gcm-256",
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptJsonPayload<T>(stored: unknown): Promise<T> {
  if (!isEncryptedEnvelope(stored)) {
    return stored as T;
  }
  const subtle = getSubtle();
  const key = await getOrCreateOfflineCryptoKey();
  if (!subtle || !key) {
    throw new Error("Web Crypto no está disponible para descifrar el almacén local");
  }

  const iv = base64ToBytes(stored.iv);
  const ct = base64ToBytes(stored.ct);
  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct),
  );
  const jsonText = new TextDecoder().decode(new Uint8Array(decrypted));
  return JSON.parse(jsonText) as T;
}

export async function encryptBlobPayload(blob: Blob): Promise<EncryptedBlobEnvelope | Blob> {
  const subtle = getSubtle();
  const key = await getOrCreateOfflineCryptoKey();
  if (!subtle || !key) return blob;

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const rawBuffer = await blob.arrayBuffer();
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    rawBuffer,
  );

  return {
    __enc: 1,
    v: "aes-gcm-256-blob",
    mimeType: blob.type || "audio/webm",
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBlobPayload(stored: unknown, fallbackMimeType = "audio/webm"): Promise<Blob> {
  if (!isEncryptedBlobEnvelope(stored)) {
    if (stored instanceof Blob) return stored;
    throw new Error("Formato de audio local inválido");
  }
  const subtle = getSubtle();
  const key = await getOrCreateOfflineCryptoKey();
  if (!subtle || !key) {
    throw new Error("Web Crypto no está disponible para descifrar audio offline");
  }

  const iv = base64ToBytes(stored.iv);
  const ct = base64ToBytes(stored.ct);
  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct),
  );
  return new Blob([decrypted], { type: stored.mimeType || fallbackMimeType });
}

