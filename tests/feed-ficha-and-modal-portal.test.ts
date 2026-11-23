import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FEED_IMAGE_PRESETS,
  inferDefaultImageByFeed,
  inferDefaultSpeciesByFeed,
  isFeedCompatibleWithSpecies,
  normalizeFeedImageUrl,
  normalizeFeedSpeciesList,
  normalizeRegionalNamesList,
} from "@/lib/feeding/feed-catalog-metadata";

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

describe("Top-bar y modales top-layer (sin recorte por backdrop-blur)", () => {
  it("ui.tsx expone PortalDialog con createPortal + <dialog>.showModal() y closedby", () => {
    const ui = readRepoFile("src/components/ui.tsx");
    expect(ui).toContain("createPortal");
    expect(ui).toContain("export function PortalDialog");
    expect(ui).toContain("<dialog");
    expect(ui).toContain("showModal");
    expect(ui).toContain("closedby");
    expect(ui).toContain("iw-dialog");
  });

  it("los botones y modales de la barra superior usan PortalDialog o portal a document.body sin bloquear scroll del body", () => {
    const quickCreate = readRepoFile("src/components/QuickCreateMenu.tsx");
    const globalSearch = readRepoFile("src/components/GlobalSearch.tsx");
    const offlineSync = readRepoFile("src/components/OfflineSyncStatus.tsx");
    const bugModal = readRepoFile("src/components/BugReportModal.tsx");
    const scaleControl = readRepoFile("src/components/ScaleModeControl.tsx");
    const contactModal = readRepoFile("src/components/contacts/ContactFormModal.tsx");
    const globalsCss = readRepoFile("src/app/globals.css");

    expect(quickCreate).toContain("<PortalDialog");
    expect(globalSearch).toContain("<PortalDialog");
    expect(globalSearch).not.toContain('document.body.style.overflow = "hidden"');
    expect(offlineSync).toContain("<PortalDialog");
    expect(bugModal).toContain("<PortalDialog");
    expect(contactModal).toContain("<PortalDialog");
    expect(scaleControl).toContain("createPortal");

    expect(globalsCss).toContain("dialog.iw-dialog");
    expect(globalsCss).toContain("dialog:modal");
    expect(globalsCss).toContain("overscroll-behavior: contain");
  });
});

describe("Fichas de alimentos, imágenes offline, especies y alias regionales", () => {
  it("todos los presets de imagen SVG existen en public/images/alimentos", () => {
    expect(FEED_IMAGE_PRESETS.length).toBeGreaterThanOrEqual(15);
    for (const preset of FEED_IMAGE_PRESETS) {
      const diskPath = path.join(process.cwd(), "public", preset.imageUrl.replace(/^\//, ""));
      expect(fs.existsSync(diskPath), `Falta SVG ${preset.imageUrl}`).toBe(true);
    }
  });

  it("normaliza especies objetivo y alias regionales sin duplicados", () => {
    expect(normalizeFeedSpeciesList(["cuyes", "conejo", "CONEJOS", "curí", "invalido"])).toEqual([
      "conejo",
      "cuy",
    ]);
    expect(normalizeRegionalNamesList("Cuido postura, Purina, cuido postura ; Mash ")).toEqual([
      "Cuido postura",
      "Purina",
      "Mash",
    ]);
    expect(isFeedCompatibleWithSpecies(["conejo", "cuy"], "cuy")).toBe(true);
    expect(isFeedCompatibleWithSpecies(["gallina"], "conejo")).toBe(false);
    expect(inferDefaultSpeciesByFeed({ standardCatalogId: "IG-125", name: "Concentrado cuyes" })).toEqual(["cuy"]);
    expect(inferDefaultImageByFeed({ standardCatalogId: "IG-123", name: "Concentrado patos" })).toBe(
      "/images/alimentos/concentrado-patos.svg",
    );
    // Regresión: un código legado IG-001..IG-004 nunca debe pisar especies explícitas de codorniz/conejo/cuy/pato/pollo
    expect(inferDefaultSpeciesByFeed({ standardCatalogId: "IG-001", name: "Concentrado Codorniz Postura" })).toEqual([
      "codorniz",
    ]);
    expect(inferDefaultSpeciesByFeed({ standardCatalogId: "IG-003", name: "Concentrado Conejos Engorde" })).toEqual([
      "conejo",
    ]);
    expect(
      inferDefaultSpeciesByFeed({ standardCatalogId: "IG-003", name: "Concentrado Conejos y Cuyes (Peletizado)" }),
    ).toEqual(["conejo", "cuy"]);
    expect(inferDefaultSpeciesByFeed({ standardCatalogId: "IG-003", name: "Concentrado Patos Crecimiento" })).toEqual([
      "pato",
    ]);
    expect(
      inferDefaultSpeciesByFeed({ standardCatalogId: "IG-004", name: "Concentrado Pollo Inicio / Pre-iniciador" }),
    ).toEqual(["pollo"]);
    expect(inferDefaultImageByFeed({ standardCatalogId: "IG-003", name: "Concentrado Patos Crecimiento" })).toBe(
      "/images/alimentos/concentrado-patos.svg",
    );
  });

  it("valida rutas e imágenes cargadas rechazando esquemas inseguros", () => {
    expect(normalizeFeedImageUrl("/images/alimentos/concentrado-cuyes.svg").error).toBeUndefined();
    expect(normalizeFeedImageUrl("data:image/webp;base64,QUJDRA==").error).toBeUndefined();
    expect(normalizeFeedImageUrl("javascript:alert(1)").error).toBeTruthy();
  });
});
