import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { guides } from "@/lib/guide-data";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";
import { buildPageMetadata, resolveOgImageDimensions } from "@/lib/seo";

function readImageDimensions(relPublicPath: string): { width: number; height: number } {
  const fullPath = path.join(process.cwd(), "public", relPublicPath.replace(/^\//, ""));
  const b = fs.readFileSync(fullPath);
  if (relPublicPath.endsWith(".png")) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  if (chunk === "VP8 ") {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  const bits = b.readUInt32LE(21);
  return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
}

describe("SEO-01 y SEO-02 — Sitemap granular y dimensiones OG reales", () => {
  it("sitemap cubre las rutas públicas con fechas válidas y no uniformes", () => {
    const entries = sitemap();
    const expectedCount =
      13 + CYCLE_PLANS_SHOWCASE.length + BITACORA_ARTICLES.length + guides.length;
    expect(entries.length).toBe(expectedCount);

    const uniqueDates = new Set(
      entries.map((e) =>
        e.lastModified instanceof Date
          ? e.lastModified.toISOString().slice(0, 10)
          : String(e.lastModified).slice(0, 10),
      ),
    );
    expect(uniqueDates.size).toBeGreaterThanOrEqual(3);
  });

  it("resolveOgImageDimensions y buildPublicMetadata declaran el tamaño real en disco de cada activo OG", () => {
    const pathsToVerify = new Set<string>([
      "/images/guia/inicio-dashboard.webp",
      "/images/guia/asistente-ia.webp",
      "/images/guia/configuracion-panel.webp",
      "/images/guia/captura-rapida-modal.webp",
      "/images/guia/finanzas-balance.webp",
      "/images/guia/finanzas-presupuestos.webp",
      "/images/heroes/inicio-2x.webp",
      ...BITACORA_ARTICLES.map((a) => a.image.src),
    ]);

    for (const imgPath of pathsToVerify) {
      const actual = readImageDimensions(imgPath);
      const declared = resolveOgImageDimensions(imgPath);
      expect(declared).toEqual(actual);

      const metadata = buildPageMetadata({
        title: "Prueba",
        description: "Descripción de prueba",
        path: "/prueba",
        ogImage: imgPath,
        ogImageAlt: "Alt de prueba",
      });
      const images = metadata.openGraph?.images;
      const first = Array.isArray(images) ? images[0] : images;
      expect(first && typeof first === "object" && "width" in first ? first.width : null).toBe(
        actual.width,
      );
      expect(first && typeof first === "object" && "height" in first ? first.height : null).toBe(
        actual.height,
      );
    }
  });
});
