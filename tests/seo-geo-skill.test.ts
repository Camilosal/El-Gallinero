import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { proxy } from "@/proxy";
import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { guides } from "@/lib/guide-data";
import { getPrivacidad } from "@/lib/legal-content";
import { APP_ROUTE_PREFIXES } from "@/lib/app-routes";
import {
  ENTITY_IDS,
  SITE_URL,
  buildFaqNode,
  buildJsonLd,
  buildPageMetadata,
  buildSoftwareNode,
  canonicalUrlFor,
  fitSeoDescription,
  fitSeoTitle,
} from "@/lib/seo";

describe("SEO + GEO skill compliance", () => {
  it("robots.ts declara bots de buscadores e IA y protege rutas privadas", () => {
    const config = robots();
    expect(config.sitemap).toBe(`${SITE_URL}/sitemap.xml`);

    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const allAgents = rules.flatMap((rule) =>
      Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? ""],
    );

    for (const bot of [
      "Googlebot",
      "Bingbot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Perplexity-User",
      "Applebot",
      "GPTBot",
      "ClaudeBot",
      "Google-Extended",
      "CCBot",
      "*",
    ]) {
      expect(allAgents).toContain(bot);
    }

    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow)
        ? rule.disallow
        : [rule.disallow ?? ""];
      expect(disallow).toContain("/api/");
      expect(disallow).toContain("/dashboard");
      expect(disallow).toContain("/login");
      // Ninguna ruta privada de la app (inicio, configuracion, etc.) queda abierta a rastreadores.
      for (const prefix of APP_ROUTE_PREFIXES) {
        expect(disallow).toContain(prefix);
      }
    }
  });

  it("sitemap.ts incluye rutas públicas y guías pero excluye /login y /dashboard", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const expectedPath of [
      "",
      "/registro",
      "/guia",
      "/ayuda",
      "/open-source",
      "/realidad-campo",
      "/planes",
      "/nosotros",
      "/contacto",
      "/bitacora",
      "/terminos",
      "/retracto",
      "/privacidad",
    ]) {
      expect(urls).toContain(`${SITE_URL}${expectedPath}`);
    }

    for (const guide of guides) {
      expect(urls).toContain(`${SITE_URL}/guia/${guide.slug}`);
    }
    for (const article of BITACORA_ARTICLES) {
      expect(urls).toContain(`${SITE_URL}/bitacora/${article.slug}`);
    }
    expect(urls).toContain(`${SITE_URL}/planes`);
    expect(urls.some((url) => /\/planes\/(semilla|ciclo-60d|semestral-ponedora|mediano-mensual)$/.test(url))).toBe(false);

    expect(urls.some((u) => u.includes("/login"))).toBe(false);
    expect(urls.some((u) => u.includes("/dashboard"))).toBe(false);
    expect(urls.some((u) => u.includes("/api/"))).toBe(false);
    // F3: ninguna ruta privada de la app (p. ej. /inicio, /configuracion/*) en el sitemap.
    for (const url of urls) {
      const path = url.slice(SITE_URL.length);
      for (const prefix of APP_ROUTE_PREFIXES) {
        expect(path === prefix || path.startsWith(`${prefix}/`)).toBe(false);
      }
    }
  });

  it("GET /llms.txt responde 200 text/plain con índice completo del sitio y ecosistema", async () => {
    const response = getLlmsTxt();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("# IwaGranja");
    expect(body).toContain("https://iwage.co");
    expect(body).toContain("https://camilosaldarriaga.com");

    for (const guide of guides) {
      expect(body).toContain(`${SITE_URL}/guia/${guide.slug}`);
    }
    for (const article of BITACORA_ARTICLES) {
      expect(body).toContain(`${SITE_URL}/bitacora/${article.slug}`);
    }
    expect(body).toContain(`${SITE_URL}/planes`);
    expect(body).not.toContain(`${SITE_URL}/planes/ciclo-60d`);
  });

  it("llms.txt describe las capacidades agénticas (API v1, MCP, briefing proactivo, Telegram) con datos verificables", async () => {
    const body = await getLlmsTxt().text();
    expect(body).toContain("## Capacidades agénticas e integraciones");
    expect(body).toContain("/api/v1/agent/tools");
    expect(body).toContain("/api/mcp");
    expect(body).toContain("JSON-RPC 2.0");
    expect(body).toContain("agent:read");
    expect(body).toContain("agent:write");
    expect(body).toContain("90 días");
    expect(body).toContain("Telegram");
    expect(body.toLowerCase()).toContain("briefing");
    expect(body).toContain("piso duro");
    expect(body).toContain("external_agent");
    expect(body).toContain(`${SITE_URL}/guia/asistente-avanzado`);
    expect(body).toContain(`${SITE_URL}/guia/integraciones-erp-agentes`);
    // No expone rutas privadas de la app como enlaces navegables del índice.
    expect(body).not.toContain(`${SITE_URL}/inicio`);
    expect(body).not.toContain(`${SITE_URL}/configuracion`);
  });

  it("proxy permite acceso público sin sesión a /llms.txt", async () => {
    const llmsReq = new NextRequest(`${SITE_URL}/llms.txt`);
    const llmsRes = await proxy(llmsReq);
    expect(llmsRes.status).toBe(200);
    expect(llmsRes.headers.get("location")).toBeNull();
  });

  it("buildPageMetadata genera canónica propia, OG es_CO, Twitter card y omite alternates cuando noindex=true", () => {
    const publicMeta = buildPageMetadata({
      title: "Guía práctica de prueba",
      description: "Descripción verificada para IwaGranja en Colombia.",
      path: "/guia/",
      ogImage: "/images/guia/inicio-dashboard.webp",
    });

    expect(publicMeta.alternates?.canonical).toBe(`${SITE_URL}/guia`);
    expect(publicMeta.openGraph?.locale).toBe("es_CO");
    expect(publicMeta.openGraph?.url).toBe(`${SITE_URL}/guia`);
    expect(publicMeta.twitter).toMatchObject({
      card: "summary_large_image",
    });
    expect(publicMeta.robots).toEqual({ index: true, follow: true });

    const privateMeta = buildPageMetadata({
      title: "Acceso privado",
      description: "Pantalla interna de autenticación.",
      path: "/login",
      noindex: true,
    });

    expect(privateMeta.alternates).toBeUndefined();
    expect(privateMeta.robots).toEqual({ index: false, follow: false });
  });

  it("buildJsonLd arma @graph conectado con Person, Organization, WebSite, WebPage, SoftwareApplication y FAQPage", () => {
    const graphDoc = buildJsonLd({
      path: "/",
      title: "IwaGranja",
      description: "Software avícola offline-first",
      breadcrumbs: [{ name: "Inicio", path: "/" }],
      extraNodes: [
        buildSoftwareNode(),
        buildFaqNode(canonicalUrlFor("/"), [{ q: "¿Es gratis?", a: "Sí, existe un plan Gratis." }]),
      ],
    });

    const graph = graphDoc["@graph"] as Array<Record<string, unknown>>;
    const ids = graph.map((node) => node["@id"]);
    expect(ids).toContain(ENTITY_IDS.person);
    expect(ids).toContain(ENTITY_IDS.organization);
    expect(ids).toContain(ENTITY_IDS.website);
    expect(ids).toContain(`${SITE_URL}#webpage`);
    expect(ids).toContain(ENTITY_IDS.software);
    expect(ids).toContain(`${SITE_URL}#faq`);
  });

  it("fitSeoTitle y fitSeoDescription mantienen longitudes recomendadas para artículos y guías", () => {
    for (const article of BITACORA_ARTICLES) {
      const title = fitSeoTitle(article.title);
      const desc = fitSeoDescription(article.summary);
      expect(title.length).toBeLessThanOrEqual(65);
      expect(desc.length).toBeGreaterThanOrEqual(50);
      expect(desc.length).toBeLessThanOrEqual(160);
    }

    for (const guide of guides) {
      const title = fitSeoTitle(`${guide.title} · Manual`);
      const desc = fitSeoDescription(guide.summary);
      expect(title.length).toBeLessThanOrEqual(65);
      expect(desc.length).toBeGreaterThanOrEqual(40);
      expect(desc.length).toBeLessThanOrEqual(160);
    }
  });

  it("política de privacidad documenta la analítica web sin cookies de seguimiento", () => {
    const privacidad = getPrivacidad();
    const titles = privacidad.sections.map((section) => section.title);
    expect(
      titles.some((title) => title.includes("Analítica web") && title.includes("sin cookies")),
    ).toBe(true);
  });

  it("alinea los @id canónicos de Schema.org con Iwagé (founder, organization y granja)", () => {
    expect(ENTITY_IDS.person).toBe("https://iwage.co/#founder");
    expect(ENTITY_IDS.organization).toBe("https://iwage.co/#organization");
    expect(ENTITY_IDS.project).toBe("https://iwage.co/granja/#organization");

    const sw = buildSoftwareNode();
    expect(sw.creator).toEqual({ "@id": ENTITY_IDS.organization });
    expect(sw.author).toEqual({ "@id": ENTITY_IDS.person });
    expect(sw.maintainer).toEqual({ "@id": ENTITY_IDS.person });
    expect(sw.isPartOf).toEqual({ "@id": ENTITY_IDS.project });
  });
});
