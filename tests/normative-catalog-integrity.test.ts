import { describe, expect, it } from "vitest";
import {
  getNormativeCatalogWithSyncMeta,
  NORMATIVE_CATALOG,
} from "@/lib/normative-catalog";

describe("NORM-01, NORM-02 & NORM-03 · Catálogo normativo verificable", () => {
  it("NTC 1240 figura como norma técnica voluntaria y acotada únicamente a huevo de gallina", () => {
    const ntc = NORMATIVE_CATALOG.find((item) => item.id === "norm-ntc-1240");
    expect(ntc).toBeDefined();
    expect(ntc!.legalBinding).toBe("norma_tecnica_voluntaria");
    expect(ntc!.kindLabel.toLowerCase()).toContain("voluntaria");
    expect(ntc!.kindLabel.toLowerCase()).not.toContain("obligatoria");
    expect(ntc!.species).toEqual(["gallina"]);
    expect(ntc!.species).not.toContain("codorniz");
    expect(ntc!.species).not.toContain("pato");
  });

  it("Res. ICA 12486/2023 está acotada a cuyes y conejos, y Res. 30292/2017 se marca como antecedente reemplazado", () => {
    const res12486 = NORMATIVE_CATALOG.find((item) => item.id === "norm-ica-12486");
    expect(res12486).toBeDefined();
    expect(res12486!.species).toEqual(["conejo", "cuy"]);

    const compost = NORMATIVE_CATALOG.find((item) => item.id === "norm-ica-30292-agrosavia");
    expect(compost).toBeDefined();
    expect(compost!.verificationStatus).toBe("reemplazado");
    expect(compost!.legalBinding).not.toBe("obligatoria_legal");
  });

  it("getNormativeCatalogWithSyncMeta separa última sincronización técnica de lastVerifiedAt y verificationStatus", () => {
    const baseline = NORMATIVE_CATALOG.map((item) => ({
      id: item.id,
      lastVerifiedAt: item.lastVerifiedAt,
      verificationStatus: item.verificationStatus,
      verifiedBy: item.verifiedBy,
    }));

    const syncA = getNormativeCatalogWithSyncMeta("2026-11-15", [], "2026-11-15");
    const syncB = getNormativeCatalogWithSyncMeta("2027-02-01", [], "2027-02-01");

    expect(syncA.lastSyncAt).toBe("2026-11-15");
    expect(syncB.lastSyncAt).toBe("2027-02-01");
    expect(syncB.lastSourceCheckedAt).toBe("2027-02-01");

    for (const orig of baseline) {
      const a = syncA.items.find((i) => i.id === orig.id)!;
      const b = syncB.items.find((i) => i.id === orig.id)!;
      expect(a.lastVerifiedAt).toBe(orig.lastVerifiedAt);
      expect(b.lastVerifiedAt).toBe(orig.lastVerifiedAt);
      expect(b.verificationStatus).toBe(orig.verificationStatus);
      expect(b.verifiedBy).toBe(orig.verifiedBy);
      if (b.verificationStatus === "pendiente") {
        expect(b.lastVerifiedAt).toBeNull();
      }
    }
  });

  it("todos los ítems incluyen jurisdicción, alcance explícito y fuente válida HTTPS", () => {
    for (const item of NORMATIVE_CATALOG) {
      expect(item.jurisdiction.trim().length).toBeGreaterThan(2);
      expect(item.applicableScope.trim().length).toBeGreaterThan(15);
      expect(item.sourceUrl.startsWith("https://")).toBe(true);
    }
  });
});
