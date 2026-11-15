import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { metadata as manualMetadata } from "@/app/(app)/manual/page";
import { generateMetadata as generateManualArticleMetadata } from "@/app/(app)/manual/[slug]/page";
import { canonicalUrlFor, SITE_URL } from "@/lib/seo";

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (/\.(ts|tsx|md|yml|yaml|json)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("SEC-01 & SEC-02 · Credenciales, controles de acceso y /manual", () => {
  it("documentación de agentes y código fuente no exponen contraseñas operativas ni claves demo débiles", () => {
    const forbiddenPatterns = [
      /Pr@yectos/i,
      /Pr%40yectos/i,
      /PGPASSWORD\s*=\s*['"][^$<]/i,
      /admin123/i,
    ];

    const filesToCheck = [
      path.join(process.cwd(), "AGENTS_GALLINERO.md"),
      path.join(process.cwd(), "CONTRIBUTING.md"),
      path.join(process.cwd(), "SECURITY.md"),
      ...walkFiles(path.join(process.cwd(), "src")),
    ];

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `Patrón sensible ${pattern} detectado en ${path.relative(process.cwd(), filePath)}`,
        ).toBe(false);
      }
    }
  });

  it("proxy protege rutas privadas HTML/API sin sesión y permite rutas públicas", async () => {
    for (const privatePath of ["/finanzas", "/dashboard/finanzas"]) {
      const privateHtml = new NextRequest(`${SITE_URL}${privatePath}`, {
        headers: { accept: "text/html" },
      });
      const privateHtmlRes = await proxy(privateHtml);
      expect(privateHtmlRes.status).toBe(307);
      expect(privateHtmlRes.headers.get("location")).toBe(`${SITE_URL}/login`);
    }

    const privateApi = new NextRequest(`${SITE_URL}/api/superadmin/granjas`);
    const privateApiRes = await proxy(privateApi);
    expect(privateApiRes.status).toBe(401);

    const adminRoute = new NextRequest(`${SITE_URL}/admin`, {
      headers: { accept: "text/html" },
    });
    const adminRes = await proxy(adminRoute);
    expect(adminRes.status).toBe(307);

    for (const publicPath of [
      "/",
      "/guia",
      "/guia/primeros-pasos",
      "/manual",
      "/manual/primeros-pasos",
      "/bitacora",
      "/planes",
      "/realidad-campo",
      "/lote/L-001",
      "/sitemap.xml",
      "/robots.txt",
      "/llms.txt",
      "/api/health",
    ]) {
      const req = new NextRequest(`${SITE_URL}${publicPath}`, {
        headers: { accept: "text/html" },
      });
      const res = await proxy(req);
      expect(res.status, `Ruta pública ${publicPath} no debe pedir sesión`).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }

    for (const [legacyPath, expectedTarget] of [
      ["/dashboard/guia", "/manual"],
      ["/dashboard/guia/primeros-pasos", "/manual/primeros-pasos"],
    ]) {
      const req = new NextRequest(`${SITE_URL}${legacyPath}`, {
        headers: { accept: "text/html" },
      });
      const res = await proxy(req);
      expect(res.status).toBe(308);
      expect(res.headers.get("location")).toBe(`${SITE_URL}${expectedTarget}`);
    }

    const unknownUrl = new NextRequest(`${SITE_URL}/ruta-inexistente-404`, {
      headers: { accept: "text/html" },
    });
    const unknownRes = await proxy(unknownUrl);
    expect(unknownRes.status).toBe(200);
    expect(unknownRes.headers.get("location")).toBeNull();
  });

  it("/manual mantiene acceso público pero emite noindex + canonical a /guia", async () => {
    expect(manualMetadata.robots).toEqual({ index: false, follow: false });
    expect(manualMetadata.alternates?.canonical).toBe(canonicalUrlFor("/guia"));

    const articleMeta = await generateManualArticleMetadata({
      params: Promise.resolve({ slug: "primeros-pasos" }),
    });
    expect(articleMeta.robots).toEqual({ index: false, follow: false });
    expect(articleMeta.alternates?.canonical).toBe(canonicalUrlFor("/guia/primeros-pasos"));
  });
});
