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
import { navigationGroups, searchNavigation } from "@/lib/navigation";
import { isAppRoutePath } from "@/lib/app-routes";
import { searchFarmKnowledge } from "@/lib/agent/knowledge";

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
      "calendario-rutinas",
      "reproduccion-cunicola",
      "bioseguridad-bienestar",
      "compostaje",
      "cierre-sensores",
      "clientes-proveedores",
      "escala-y-modulos",
      "configuracion-general",
      "normas-estandares",
      "fuentes-externas",
      "reportar-fallas",
      "kit-campo-llave-en-mano",
      "personal-y-nomina",
      "plan-y-pagos",
      "usuarios-y-roles",
      "integraciones-erp-agentes",
      "asistente-avanzado",
    ]) {
      expect(slugSet.has(newSlug), `Falta nueva guía ${newSlug}`).toBe(true);
    }
  });

  it("asigna cada guía a un módulo válido (8 módulos reales + máx 2 complementarios) con capturas existentes en public/", () => {
    const coreModules = guideModules.filter((m) => m.kind === "modulo");
    const complementaryModules = guideModules.filter((m) => m.kind === "complementario");
    expect(coreModules.map((m) => m.id)).toEqual(navigationGroups.map((g) => g.id));
    expect(complementaryModules.length).toBeLessThanOrEqual(2);
    expect(getGuide("lugares-manejo")?.module).toBe("animales");

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
        const cleanHrefPath = rel.href.split("?")[0];
        expect(isAppRoutePath(cleanHrefPath), `Ruta relacionada fuera de app: ${rel.href}`).toBe(true);
        const cleanRoute = cleanHrefPath.replace(/^\//, "");
        const appGroupPageFile = path.join(process.cwd(), "src", "app", "(app)", cleanRoute, "page.tsx");
        const pageFile = path.join(process.cwd(), "src", "app", cleanRoute, "page.tsx");
        expect(
          fs.existsSync(appGroupPageFile) || fs.existsSync(pageFile),
          `Ruta relacionada inexistente: ${appGroupPageFile}`,
        ).toBe(true);
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
    expect(searchGuides("rutinas").some((g) => g.slug === "calendario-rutinas")).toBe(true);
    expect(searchGuides("reproducción").some((g) => g.slug === "reproduccion-cunicola")).toBe(true);
    expect(searchGuides("bioseguridad").some((g) => g.slug === "bioseguridad-bienestar")).toBe(true);
    expect(searchGuides("compostaje").some((g) => g.slug === "compostaje")).toBe(true);
    expect(searchGuides("cierre diario").some((g) => g.slug === "cierre-sensores")).toBe(true);
    expect(searchGuides("proveedores").some((g) => g.slug === "clientes-proveedores")).toBe(true);
    expect(searchGuides("gina").some((g) => g.slug === "asistente-operativo")).toBe(true);
    expect(searchGuides("modulos").some((g) => g.slug === "escala-y-modulos")).toBe(true);
    expect(searchGuides("recuperacion").some((g) => g.slug === "configuracion-general")).toBe(true);
    expect(searchGuides("normas").some((g) => g.slug === "normas-estandares")).toBe(true);
    expect(searchGuides("clima").some((g) => g.slug === "fuentes-externas")).toBe(true);
    expect(searchGuides("fallas").some((g) => g.slug === "reportar-fallas")).toBe(true);
    expect(searchGuides("vida util").some((g) => g.slug === "infraestructura-equipos")).toBe(true);
    expect(searchGuides("ganancia real").some((g) => g.slug === "balance-financiero")).toBe(true);
    expect(searchGuides("llave en mano").some((g) => g.slug === "kit-campo-llave-en-mano")).toBe(true);
    expect(searchGuides("nomina").some((g) => g.slug === "personal-y-nomina")).toBe(true);
    expect(searchGuides("wompi").some((g) => g.slug === "plan-y-pagos")).toBe(true);
    expect(searchGuides("roles").some((g) => g.slug === "usuarios-y-roles")).toBe(true);
    expect(searchGuides("mcp").some((g) => g.slug === "integraciones-erp-agentes")).toBe(true);
    expect(searchGuides("telegram").some((g) => g.slug === "asistente-avanzado")).toBe(true);
    const allHrefs = new Set(guides.flatMap((g) => g.relatedHrefs.map((r) => r.href.split("?")[0])));
    expect(allHrefs.has("/configuracion/modulos")).toBe(true);
    expect(allHrefs.has("/configuracion")).toBe(true);
    expect(allHrefs.has("/configuracion/fallas")).toBe(true);
    expect(allHrefs.has("/finanzas")).toBe(true);
    expect(allHrefs.has("/analisis")).toBe(true);
    expect(allHrefs.has("/analisis/normas")).toBe(true);
    expect(allHrefs.has("/analisis/fuentes-externas")).toBe(true);

    const first = getAdjacentGuides(guides[0].slug);
    expect(first.prev).toBeNull();
    expect(first.next?.slug).toBe(guides[1].slug);

    expect(resolveHeroThemeByPath("/guia")).toBe("guia");
    expect(resolveHeroThemeByPath("/guia/escanear-qr")).toBe("guia");
    expect(resolveHeroThemeByPath("/planeacion/calendario")).toBe("aves");
    expect(resolveHeroThemeByPath("/sanidad/bioseguridad")).toBe("sanidad");
    expect(resolveHeroThemeByPath("/operaciones/compostaje")).toBe("gallinaza");
    expect(resolveHeroThemeByPath("/operaciones/cierre")).toBe("insumos");
    expect(getGuideHeroTheme("escanear-qr")).toBe("escanear");
  });
});

describe("F1/B4 · guías de cierre descubribles por búsqueda y por el corpus del agente", () => {
  const NEW_GUIDES: Array<{ slug: string; query: string; navQuery: string }> = [
    { slug: "kit-campo-llave-en-mano", query: "kit de campo llave en mano semanas acta", navQuery: "kit de campo" },
    { slug: "personal-y-nomina", query: "nomina personal jornal prestaciones", navQuery: "nomina" },
    { slug: "plan-y-pagos", query: "plan pagos wompi nequi ciclo", navQuery: "wompi" },
    { slug: "usuarios-y-roles", query: "usuarios roles permisos cupos", navQuery: "roles" },
    { slug: "integraciones-erp-agentes", query: "integraciones erp conectores token mcp api", navQuery: "integraciones erp" },
    { slug: "asistente-avanzado", query: "gina briefing telegram delegacion memoria", navQuery: "briefing" },
  ];

  it("cada guía nueva es recuperable por consultar_conocimiento con relatedHrefs válidos", async () => {
    for (const { slug, query } of NEW_GUIDES) {
      const result = await searchFarmKnowledge(query, { limit: 6 });
      const match = result.matches.find((m) => m.id === `guia:${slug}`);
      expect(match, `Corpus no recupera guia:${slug} con "${query}"`).toBeTruthy();
      expect(match!.relatedHrefs.length).toBeGreaterThan(0);
      for (const rel of match!.relatedHrefs) {
        expect(isAppRoutePath(rel.href.split("?")[0]), `relatedHref fuera de app en ${slug}: ${rel.href}`).toBe(true);
      }
    }
  });

  it("cada guía nueva aparece en el buscador global de navegación", () => {
    for (const { slug, navQuery } of NEW_GUIDES) {
      const entries = searchNavigation(navQuery, 12);
      expect(
        entries.some((entry) => entry.href === `/manual/${slug}`),
        `searchNavigation("${navQuery}") no encuentra /manual/${slug}`,
      ).toBe(true);
    }
  });

  it("los estándares nuevos de nómina, fuentes externas y delegación están indexados", async () => {
    const nomina = await searchFarmKnowledge("cuanto le pago al jornalero con prestaciones", { limit: 6 });
    expect(nomina.matches.some((m) => m.id === "std-nomina-rural-colombia")).toBe(true);
    const fuentes = await searchFarmKnowledge("que es sipsa trm uvt", { limit: 6 });
    expect(fuentes.matches.some((m) => m.id === "std-fuentes-externas-interpretacion")).toBe(true);
    const delegacion = await searchFarmKnowledge("que puede automatizar el agente piso duro", { limit: 6 });
    expect(delegacion.matches.some((m) => m.id === "std-delegacion-agentes")).toBe(true);
  });
});

