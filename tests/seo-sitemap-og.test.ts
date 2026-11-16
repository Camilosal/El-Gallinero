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
  it("sitemap cubre las 70 rutas públicas sin duplicados ni rutas privadas", () => {
    const entries = sitemap();
    const expectedCount =
      13 + CYCLE_PLANS_SHOWCASE.length + BITACORA_ARTICLES.length + guides.length;
    expect(expectedCount).toBe(70);
    expect(entries.length).toBe(expectedCount);

    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(expectedCount);
    for (const url of urls) {
      expect(url.startsWith("https://gallinero.iwage.co")).toBe(true);
      expect(url).not.toMatch(/\/(dashboard|api|login)(\/|$)/);
    }

    const uniqueDates = new Set(
      entries.map((e) =>
        e.lastModified instanceof Date
          ? e.lastModified.toISOString().slice(0, 10)
          : String(e.lastModified).slice(0, 10),
      ),
    );
    expect(uniqueDates.size).toBeGreaterThanOrEqual(2);
  });

  it("resolveOgImageDimensions y buildPageMetadata declaran el tamaño real en disco de todos los activos", () => {
    const guiaWebps = fs
      .readdirSync(path.join(process.cwd(), "public/images/guia"))
      .filter((name) => name.endsWith(".webp"))
      .map((name) => `/images/guia/${name}`);

    const pathsToVerify = new Set<string>([
      ...guiaWebps,
      "/images/heroes/inicio-2x.webp",
      "/traceability-flow.png",
      "/hero-illustration.png",
      "/modules-diagram.png",
      "/logo-iwagranja-horizontal.webp",
      "/logo-iwagranja.webp",
      "/logo-iwagranja-mark.webp",
      "/icon-192.png",
      "/icon-512.png",
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
