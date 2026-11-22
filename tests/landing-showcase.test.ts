import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADOPTION_HIGHLIGHTS,
  AI_AUTOMATION_PILLARS,
  EXTRA_LANDING_MODULES,
  LANDING_MODULES,
  SHOWCASE_GALLERY,
  SHOWCASE_TABS,
  getCyclePlanBySlug,
  getAllLandingShowcaseAssetUrls,
} from "@/lib/landing-showcase";

describe("página de presentación — pantallazos y adopción", () => {
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

  it("documenta pilares IA/automatización y los 6 módulos", () => {
    expect(AI_AUTOMATION_PILLARS.length).toBe(3);
    expect(ADOPTION_HIGHLIGHTS.length).toBe(4);
    for (const item of ADOPTION_HIGHLIGHTS) {
      expect(item.title.trim().length).toBeGreaterThan(5);
      expect(item.description.trim().length).toBeGreaterThan(20);
    }
    expect(LANDING_MODULES.length).toBe(6);
    expect(EXTRA_LANDING_MODULES.length).toBe(8);
    expect(LANDING_MODULES.length + EXTRA_LANDING_MODULES.length).toBe(14);
    for (const mod of LANDING_MODULES) {
      expect(mod.name.trim().length).toBeGreaterThan(5);
      expect(mod.summary.trim().split(/\s+/).length).toBeLessThanOrEqual(10);
    }
  });

  it("usa el visor en sección aparte, numeración correlativa 1-5, carrusel rotativo y footer único", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    const showcase = fs.readFileSync(
      path.join(process.cwd(), "src/components/LandingShowcase.tsx"),
      "utf8",
    );

    expect(page).toContain("<LandingShowcase />");
    expect(page).toContain("<LandingFooter />");
    expect(page).not.toContain("<LegalFooter />");
    expect(page).not.toContain("ADOPTION_KEYS");
    expect(page).not.toContain("≥ 48 px");
    expect(page).not.toContain("multi-tenant");

    // Claridad de plataforma + herramienta informativa + pequeños y medianos productores
    expect(page.toLowerCase()).toContain("herramienta informativa");
    expect(page.toLowerCase()).toContain("plataforma");
    expect(page.toLowerCase()).toContain("pequeños y medianos productores");

    // Tarjetas acopladas en la base del hero e imagen de módulos lado a lado
    expect(page).toContain("land-hero-dock");
    expect(page).toContain("land-animated-card");
    expect(page).toContain("land-card-icon-badge");

    // Numeración única correlativa 1..5 sin repetir el 1
    expect(showcase).toContain("1 · Así se ve por dentro");
    expect(page).not.toContain("1 · ");
    expect(page).toContain("2 · Fácil de adoptar");
    expect(page).toContain("3 · Qué incluye el sistema");
    expect(page).toContain("4 · Planes y suscripciones");
    expect(page).toContain("5 · Comienza hoy");

    // Galería rotativa accesible y encabezado horizontal completo en vitrina
    expect(showcase).toContain('aria-roledescription="carousel"');
    expect(showcase).toContain("land-carousel-track");
    expect(showcase).toContain("lg:col-span-12");

    expect(page).toContain("<ModulesAccordionShowcase");
    expect(page).toContain("<LandingSubscriptionPlans");
    expect(page).toContain('href="/bitacora/normas-y-guias-granja-mixta"');
    expect(page).not.toContain("<SectorStandardsCarousel");
    expect(page).toContain('href="/guia"');
    expect(page).toContain('href="/open-source"');
    expect(
      fs.existsSync(path.join(process.cwd(), "src/app/open-source/page.tsx")),
    ).toBe(true);

    const footer = fs.readFileSync(
      path.join(process.cwd(), "src/components/LandingFooter.tsx"),
      "utf8",
    );
    expect(footer).toContain("APP_DEVELOPER");
    expect(footer).toContain("LEGAL_LINKS");
    expect(footer).not.toContain("SIC_URL");
    expect(page).toContain('id="preguntas-frecuentes"');
    expect(page).toContain('href="/realidad-campo"');
    expect(page).toContain("hero-illustration.webp");
    expect(
      fs.existsSync(path.join(process.cwd(), "src/app/realidad-campo/page.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(process.cwd(), "src/app/planes/[slug]/page.tsx")),
    ).toBe(true);
  });

  it("conserva rutas antiguas como redirecciones sin publicar sus tarifas retiradas", () => {
    expect(getCyclePlanBySlug("ciclo-60d")).toMatchObject({ legacyCode: "CICLO_60D" });
    expect(getCyclePlanBySlug("semestral-ponedora")).toMatchObject({ legacyCode: "SEMESTRAL_PONEDORA" });
    expect(getCyclePlanBySlug("desconocido")).toBeUndefined();
    const legacySource = fs.readFileSync(path.join(process.cwd(), "src/lib/landing-showcase.ts"), "utf8");
    expect(legacySource).not.toContain("$45.000");
    expect(legacySource).not.toContain("$120.000");
  });
});

