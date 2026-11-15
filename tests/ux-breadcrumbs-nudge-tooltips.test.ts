import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDashboardBreadcrumb } from "../src/lib/breadcrumbs";
import { resolveDefaultFieldHelp } from "../src/lib/field-help";

function readSource(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("Nudges debajo del Hero y fila única en Inicio", () => {
  it("el layout del dashboard ubica DashboardBreadcrumb arriba y no renderiza BehavioralNudgeBanner sobre los Hero", () => {
    const layout = readSource("src/app/dashboard/_client-layout.tsx");
    expect(layout).toContain("<DashboardBreadcrumb />");
    expect(layout).not.toContain("<BehavioralNudgeBanner");
  });

  it("HeroBanner ubica BehavioralNudgeBanner debajo de HeroFrame dentro del contenedor hero", () => {
    const heroBanner = readSource("src/components/HeroBanner.tsx");
    const frameIdx = heroBanner.indexOf("<HeroFrame");
    const nudgeIdx = heroBanner.indexOf("<BehavioralNudgeBanner");
    expect(frameIdx).toBeGreaterThan(-1);
    expect(nudgeIdx).toBeGreaterThan(frameIdx);
    expect(heroBanner).toContain("hideNudge");
    expect(heroBanner).toContain('pathname?.startsWith("/dashboard")');
  });

  it("la hoja de Inicio coloca el nudge y las dos tarjetas adjuntas en una sola fila (lg:grid-cols-3) debajo del Hero", () => {
    const home = readSource("src/app/dashboard/page.tsx");
    const heroIdx = home.indexOf("<HeroBanner");
    const rowIdx = home.indexOf("${topStripGridCols}");
    const nudgeCompactIdx = home.indexOf("<BehavioralNudgeBanner compact");
    expect(home).toContain("hideNudge");
    expect(home).toContain("lg:grid-cols-3");
    expect(rowIdx).toBeGreaterThan(heroIdx);
    expect(nudgeCompactIdx).toBeGreaterThan(rowIdx);
  });
});

describe("Camino de migajas (DashboardBreadcrumb)", () => {
  it("resuelve correctamente rutas de Inicio, módulos, pestañas y páginas dinámicas", () => {
    expect(resolveDashboardBreadcrumb("/dashboard")).toEqual([{ label: "Inicio" }]);

    expect(resolveDashboardBreadcrumb("/dashboard/produccion", "tab=huevos")).toEqual([
      { label: "Inicio", href: "/dashboard" },
      { label: "Producción", href: "/dashboard/produccion" },
      { label: "Huevos" },
    ]);

    expect(
      resolveDashboardBreadcrumb("/dashboard/produccion", "tab=alimentacion&subtab=etapas"),
    ).toEqual([
      { label: "Inicio", href: "/dashboard" },
      { label: "Almacén", href: "/dashboard/almacen" },
      { label: "Gestión de alimentación", href: "/dashboard/produccion?tab=alimentacion" },
      { label: "Programas y dietas" },
    ]);

    expect(resolveDashboardBreadcrumb("/dashboard/ubicaciones/abc-123")).toEqual([
      { label: "Inicio", href: "/dashboard" },
      { label: "Animales", href: "/dashboard/animales" },
      { label: "Lugares de manejo", href: "/dashboard/ubicaciones" },
      { label: "Detalle del lugar" },
    ]);

    expect(resolveDashboardBreadcrumb("/dashboard/configuracion/fallas")).toEqual([
      { label: "Inicio", href: "/dashboard" },
      { label: "Configuración", href: "/dashboard/configuracion" },
      { label: "Reportes de fallas" },
    ]);

    const guiaCrumb = resolveDashboardBreadcrumb("/dashboard/guia/normas-estandares");
    expect(guiaCrumb.map((c) => c.label)).toEqual([
      "Inicio",
      "Guía de Usuario",
      "Análisis",
      "Normas, estándares y guías aplicables con adjuntos",
    ]);
  });

  it("evita doble camino de migajas en las guías vistas dentro del dashboard", () => {
    const guideArticle = readSource("src/components/guide/GuideArticleView.tsx");
    expect(guideArticle).toContain('basePath.startsWith("/dashboard")');
    expect(guideArticle).toContain("{!isDashboard && (");
  });
});

describe("Tooltips sencillos en campos de formularios de captura", () => {
  it("provee explicaciones claras en español cotidiano para campos comunes", () => {
    const samples = [
      "Fecha",
      "Cantidad",
      "Precio/u ($)",
      "Galpón / ubicación",
      "Vida útil (meses)",
      "Días de retiro",
      "Línea / raza",
    ];
    for (const label of samples) {
      const tip = resolveDefaultFieldHelp(label);
      expect(tip, `Falta tooltip para ${label}`).toBeTruthy();
      expect(tip!.length).toBeGreaterThan(15);
    }
  });

  it("Input, Select y Textarea en ui.tsx usan FieldLabelRow con Tooltip táctil y accesible", () => {
    const ui = readSource("src/components/ui.tsx");
    expect(ui).toContain("resolveDefaultFieldHelp");
    expect(ui).toContain("FieldLabelRow");
    expect(ui).toContain('role="tooltip"');
    expect(ui).toContain("aria-expanded={open}");
  });

  it("QuickCaptureModal y OnboardingWizardModal incluyen tooltips en sus campos", () => {
    const quick = readSource("src/components/QuickCaptureModal.tsx");
    const wizard = readSource("src/components/OnboardingWizardModal.tsx");
    expect(quick).toContain("<Tooltip");
    expect(quick).not.toContain('help=""');
    expect(wizard).toContain("<Tooltip");
  });
});
