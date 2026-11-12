import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HERO_THEMES,
  getAllHeroAssetUrls,
  getGuideHeroTheme,
  resolveHeroThemeByPath,
} from "../src/lib/hero-themes";

describe("hero-themes", () => {
  it("resuelve temas exactos para rutas y pestañas de producción", () => {
    expect(resolveHeroThemeByPath("/dashboard")).toBe("inicio");
    expect(resolveHeroThemeByPath("/dashboard/escanear")).toBe("escanear");
    expect(resolveHeroThemeByPath("/dashboard/almacen")).toBe("insumos");
    expect(resolveHeroThemeByPath("/dashboard/produccion", "huevos")).toBe("huevos");
    expect(resolveHeroThemeByPath("/dashboard/produccion", "incubacion")).toBe("incubacion");
    expect(resolveHeroThemeByPath("/dashboard/produccion", "gallinaza")).toBe("gallinaza");
    expect(resolveHeroThemeByPath("/dashboard/finanzas/ventas")).toBe("finanzas");
    expect(resolveHeroThemeByPath("/dashboard/analisis/kpis")).toBe("analisis");
    expect(resolveHeroThemeByPath("/lote/123")).toBe("aves");
    expect(resolveHeroThemeByPath("/dashboard/ubicaciones/456")).toBe("ubicaciones");
  });

  it("resuelve temas para todos los módulos de la guía", () => {
    expect(getGuideHeroTheme("primeros-pasos")).toBe("inicio");
    expect(getGuideHeroTheme("produccion")).toBe("huevos");
    expect(getGuideHeroTheme("sanidad")).toBe("sanidad");
    expect(getGuideHeroTheme("finanzas")).toBe("finanzas");
    expect(getGuideHeroTheme("desconocido")).toBe("guia");
  });

  it("todos los assets referenciados en HERO_THEMES existen en public/", () => {
    const publicRoot = path.resolve(process.cwd(), "public");
    const urls = getAllHeroAssetUrls({ highDpi: true, includeFallbackJpg: true });
    expect(urls.length).toBe(Object.keys(HERO_THEMES).length * 3);

    for (const url of urls) {
      const filePath = path.join(publicRoot, url.replace(/^\//, ""));
      expect(fs.existsSync(filePath), `Falta asset ${url}`).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(1000);
    }
  });
});

