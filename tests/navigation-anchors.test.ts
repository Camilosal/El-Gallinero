import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXTRA_LANDING_MODULES,
  SHOWCASE_GALLERY,
} from "@/lib/landing-showcase";
import {
  guideDetailHref,
  guideModuleAnchorHref,
  guideModules,
  guides,
} from "@/lib/guide-data";

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

function assertValidGuideHref(href: string, validAnchors: Set<string>, validSlugs: Set<string>) {
  expect(href.startsWith("/guia")).toBe(true);
  if (href.includes("#")) {
    const [, fragment] = href.split("#");
    expect(fragment).toBeTruthy();
    expect(validAnchors.has(fragment)).toBe(true);
    return;
  }
  if (href !== "/guia") {
    const slug = href.replace(/^\/guia\//, "");
    expect(validSlugs.has(slug)).toBe(true);
  }
}

describe("NAV-01 y coherencia de producto", () => {
  const validModuleIds = new Set(guideModules.map((m) => m.id));
  const validAnchors = new Set(guideModules.map((m) => `mod-${m.id}`));
  const validSlugs = new Set(guides.map((g) => g.slug));

  it("los helpers canónicos de enlaces apuntan a anclas mod-* y slugs reales", () => {
    const guideIndexSource = readRepoFile("src/components/guide/GuideIndexView.tsx");
    expect(guideIndexSource).toContain("id={`mod-${mod.id}`}");

    for (const id of validModuleIds) {
      const href = guideModuleAnchorHref(id);
      assertValidGuideHref(href, validAnchors, validSlugs);
    }

    for (const slug of validSlugs) {
      const href = guideDetailHref(slug);
      assertValidGuideHref(href, validAnchors, validSlugs);
    }
  });

  it("EXTRA_LANDING_MODULES apunta 100% a anclas #mod-* o slugs reales de /guia", () => {
    for (const mod of EXTRA_LANDING_MODULES) {
      assertValidGuideHref(mod.guideHash, validAnchors, validSlugs);
    }
  });

  it("realidad-campo solo usa enlaces /guia#mod-* o /guia/<slug> válidos", () => {
    const realidadSource = readRepoFile("src/app/realidad-campo/page.tsx");
    const matches = [...realidadSource.matchAll(/moduleLink:\s*"([^"]+)"/g)];
    expect(matches.length).toBeGreaterThanOrEqual(6);
    for (const match of matches) {
      assertValidGuideHref(match[1], validAnchors, validSlugs);
    }
  });

  it("SHOWCASE_GALLERY usa la ruta pública real /lote/[id] y el copy público evita '14 módulos'", () => {
    const traceability = SHOWCASE_GALLERY.find((item) => item.id === "gal-trazabilidad");
    expect(traceability?.routeLabel).toBe("/lote/[id]");

    for (const rel of [
      "src/app/page.tsx",
      "src/app/guia/page.tsx",
      "src/app/llms.txt/route.ts",
      "src/app/not-found.tsx",
      "src/app/realidad-campo/page.tsx",
      "src/lib/landing-showcase.ts",
    ]) {
      const content = readRepoFile(rel);
      expect(content.toLowerCase()).not.toContain("14 módulos");
    }
  });
});
