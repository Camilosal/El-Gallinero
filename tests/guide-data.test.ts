import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUIDE_WORKFLOWS,
  getAdjacentGuides,
  getAllGuideAssetUrls,
  getGuide,
  getGuidePreviewImage,
  getGuidesByModule,
  guideModules,
  guides,
  searchGuides,
} from "@/lib/guide-data";
import { getGuideHeroTheme, resolveHeroThemeByPath } from "@/lib/hero-themes";

const REQUIRED_LEGACY_SLUGS = [
  "primeros-pasos",
  "recoger-huevos",
  "gestionar-gallinas",
  "alimentar-aves",
  "incubacion",
  "produccion-carne",
  "sacrificio-aves",
  "gallinaza-produccion",
  "plan-parvada",
  "registrar-venta",
  "registrar-egreso",
  "catalogo-productos",
  "balance-financiero",
  "presupuestos",
  "plan-sanitario",
  "control-sanitario",
  "calendario-vacunacion",
  "alertas-mortalidad",
  "inventario-huevos",
  "inventario-carne",
  "inventario-insumos",
  "balance-inventarios",
  "kpis-reportes",
  "estandares-raza",
  "mantenimiento",
  "gestion-gallinaza",
  "catalogos-sistema",
  "lugares-manejo",
  "trazabilidad-genetica",
  "asistente-operativo",
  "infraestructura-equipos",
];

describe("guía de uso actualizada y capturas verificadas", () => {
  it("conserva todos los slugs históricos y cubre los módulos nuevos", () => {
    const slugSet = new Set(guides.map((g) => g.slug));
    expect(slugSet.size).toBe(guides.length);

    for (const slug of REQUIRED_LEGACY_SLUGS) {
      expect(slugSet.has(slug), `Falta slug histórico ${slug}`).toBe(true);
    }

    for (const newSlug of [
      "modo-offline-voz",
      "escanear-qr",
      "control-peso",
      "inventario-alimentos",
      "soberania-alimentaria",
      "cuentas-cobrar-pagar",
    ]) {
      expect(slugSet.has(newSlug), `Falta nueva guía ${newSlug}`).toBe(true);
    }
  });

  it("asigna cada guía a un módulo válido con capturas existentes en public/", () => {
    const modIds = new Set(guideModules.map((m) => m.id));
    const grouped = getGuidesByModule();

    for (const mod of guideModules) {
      expect((grouped.get(mod.id) ?? []).length, `Módulo vacío: ${mod.id}`).toBeGreaterThan(0);
    }

    for (const guide of guides) {
      expect(modIds.has(guide.module), `Módulo inválido en ${guide.slug}: ${guide.module}`).toBe(true);
      expect(guide.summary.length).toBeGreaterThan(15);
      expect(guide.tags.length).toBeGreaterThan(0);

      const screenshots = guide.sections.filter((s) => s.type === "screenshot");
      expect(screenshots.length, `Falta pantallazo en guía ${guide.slug}`).toBeGreaterThan(0);

      for (const shot of screenshots) {
        expect(shot.image).toBeTruthy();
        expect(shot.alt).toBeTruthy();
        expect(shot.caption).toBeTruthy();
        const diskPath = path.join(process.cwd(), "public", shot.image!.replace(/^\//, ""));
        expect(fs.existsSync(diskPath), `Captura faltante en disco: ${diskPath}`).toBe(true);
        expect(fs.statSync(diskPath).size).toBeGreaterThan(1024);
      }

      expect(getGuidePreviewImage(guide)?.src).toBeTruthy();

      for (const rel of guide.relatedHrefs) {
        expect(rel.href.startsWith("/dashboard")).toBe(true);
        const cleanRoute = rel.href.split("?")[0].replace(/^\//, "");
        const pageFile = path.join(process.cwd(), "src", "app", cleanRoute, "page.tsx");
        expect(fs.existsSync(pageFile), `Ruta relacionada inexistente: ${pageFile}`).toBe(true);
      }
    }

    expect(getAllGuideAssetUrls().length).toBeGreaterThanOrEqual(30);
  });

  it("resuelve búsqueda, workflows, adyacencia y temas hero para rutas standalone /guia", () => {
    for (const wf of GUIDE_WORKFLOWS) {
      for (const slug of wf.slugs) {
        expect(getGuide(slug), `Workflow ${wf.id} apunta a slug inexistente ${slug}`).toBeDefined();
      }
    }

    expect(searchGuides("cxc").some((g) => g.slug === "cuentas-cobrar-pagar")).toBe(true);
    expect(searchGuides("offline").some((g) => g.slug === "modo-offline-voz")).toBe(true);
    expect(searchGuides("qr").some((g) => g.slug === "escanear-qr")).toBe(true);
    expect(searchGuides("soberanía").some((g) => g.slug === "soberania-alimentaria")).toBe(true);
    expect(searchGuides("peso").some((g) => g.slug === "control-peso")).toBe(true);

    const first = getAdjacentGuides(guides[0].slug);
    expect(first.prev).toBeNull();
    expect(first.next?.slug).toBe(guides[1].slug);

    expect(resolveHeroThemeByPath("/guia")).toBe("guia");
    expect(resolveHeroThemeByPath("/guia/escanear-qr")).toBe("guia");
    expect(getGuideHeroTheme("escanear-qr")).toBe("escanear");
  });
});

