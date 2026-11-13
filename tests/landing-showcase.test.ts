import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADOPTION_KEYS,
  AI_AUTOMATION_PILLARS,
  CYCLE_PLANS_SHOWCASE,
  SECTOR_STANDARDS,
  SHOWCASE_GALLERY,
  SHOWCASE_TABS,
  getAllLandingShowcaseAssetUrls,
} from "@/lib/landing-showcase";

describe("página de presentación — pantallazos, estándares y adopción", () => {
  it("todos los pantallazos referenciados existen físicamente en public/", () => {
    const publicDir = path.join(process.cwd(), "public");
    const assets = getAllLandingShowcaseAssetUrls();
    expect(assets.length).toBeGreaterThanOrEqual(10);

    for (const url of assets) {
      const relative = url.startsWith("/") ? url.slice(1) : url;
      const fullPath = path.join(publicDir, relative);
      expect(fs.existsSync(fullPath), `No existe captura: ${url}`).toBe(true);
    }
  });

  it("cubre los 6 flujos interactivos sin duplicados y con textos alternativos", () => {
    const ids = new Set(SHOWCASE_TABS.map((t) => t.id));
    expect(ids.size).toBe(SHOWCASE_TABS.length);
    expect(SHOWCASE_TABS.length).toBe(6);

    const sims = new Set(SHOWCASE_TABS.map((t) => t.simulationKind));
    expect(sims).toEqual(
      new Set([
        "routines",
        "quick-capture",
        "ai-voice",
        "ntc1240-curves",
        "sanitary-withdrawal",
        "offline-peps",
      ]),
    );

    for (const tab of SHOWCASE_TABS) {
      expect(tab.screenshotAlt.trim().length).toBeGreaterThan(15);
      expect(tab.highlights.length).toBeGreaterThanOrEqual(2);
    }

    expect(SHOWCASE_GALLERY.length).toBe(8);
    for (const g of SHOWCASE_GALLERY) {
      expect(g.alt.trim().length).toBeGreaterThan(15);
    }
  });

  it("documenta estándares del sector, pilares IA/automatización y claves de adopción", () => {
    const codes = SECTOR_STANDARDS.map((s) => s.code).join(" ");
    expect(codes).toContain("NTC 1240");
    expect(codes).toContain("ICA 3650");
    expect(codes).toContain("8452");
    expect(codes).toContain("PRAMSAC");
    expect(codes).toContain("30292");
    expect(codes).toContain("DIAN");

    expect(AI_AUTOMATION_PILLARS.length).toBe(3);
    expect(ADOPTION_KEYS.length).toBe(4);
    for (const key of ADOPTION_KEYS) {
      expect(key.title.trim().length).toBeGreaterThan(5);
      expect(key.detail.trim().length).toBeGreaterThan(20);
    }
  });

  it("presenta los 4 planes por ciclo productivo y medios de pago locales", () => {
    expect(CYCLE_PLANS_SHOWCASE.length).toBe(4);
    const ids = CYCLE_PLANS_SHOWCASE.map((p) => p.id);
    expect(ids).toEqual([
      "FREEMIUM_SEMILLA",
      "CICLO_60D",
      "SEMESTRAL_PONEDORA",
      "MEDIANO_MENSUAL",
    ]);

    const joined = CYCLE_PLANS_SHOWCASE.map(
      (p) => `${p.priceLabel} ${p.summary} ${p.highlights.join(" ")}`,
    ).join(" ");
    expect(joined).toContain("$45.000");
    expect(joined).toContain("Nequi");
  });
});

