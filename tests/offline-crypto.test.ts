import { describe, expect, it } from "vitest";
import {
  clearOfflineCryptoKey,
  decryptBlobPayload,
  decryptJsonPayload,
  encryptBlobPayload,
  encryptJsonPayload,
  isEncryptedBlobEnvelope,
  isEncryptedEnvelope,
  setOfflineCryptoSeed,
} from "@/lib/offline/crypto";

describe("Offline IndexedDB AES-GCM Encryption (Task A2)", () => {
  it("cifra y descifra payloads JSON produciendo IV único y fallando cerrado ante alteración", async () => {
    clearOfflineCryptoKey(true);
    await setOfflineCryptoSeed("farm-test-crypto-seed");

    const original = {
      locationId: "loc-1",
      totalCollected: 145,
      notes: "Recolección mañana galpón 2",
    };

    const enc1 = await encryptJsonPayload(original);
    const enc2 = await encryptJsonPayload(original);

    expect(isEncryptedEnvelope(enc1)).toBe(true);
    expect(isEncryptedEnvelope(enc2)).toBe(true);
    if (isEncryptedEnvelope(enc1) && isEncryptedEnvelope(enc2)) {
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ct).not.toBe(enc2.ct);
      expect(JSON.stringify(enc1)).not.toContain("Recolección");
    }

    const decoded = await decryptJsonPayload<typeof original>(enc1);
    expect(decoded).toEqual(original);

    // Datos manipulados deben rechazar el descifrado (GCM auth tag)
    if (isEncryptedEnvelope(enc1)) {
      const tampered = {
        ...enc1,
        ct: enc1.ct.slice(0, -4) + "AAAA",
      };
      await expect(decryptJsonPayload(tampered)).rejects.toThrow();
    }
  });

  it("mantiene compatibilidad con registros legados sin cifrar y cifra blobs de voz", async () => {
    clearOfflineCryptoKey(true);
    await setOfflineCryptoSeed("farm-test-blob-seed");

    const legacy = { total: 10 };
    expect(await decryptJsonPayload(legacy)).toEqual(legacy);

    const blob = new Blob(["nota de voz prueba gallinero"], { type: "audio/webm" });
    const encBlob = await encryptBlobPayload(blob);
    expect(isEncryptedBlobEnvelope(encBlob)).toBe(true);

    const restored = await decryptBlobPayload(encBlob);
    expect(restored.type).toBe("audio/webm");
    expect(await restored.text()).toBe("nota de voz prueba gallinero");
  });
});

