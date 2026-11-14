import fs from "node:fs";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { POST as recoverPassword } from "@/app/api/auth/recover/route";
import { POST as registerFarm } from "@/app/api/auth/register/route";
import { POST as submitContact } from "@/app/api/contacto/route";
import { db } from "@/db";
import {
  appSettings,
  billingPayments,
  farms,
  farmSubscriptions,
  sessions,
  users,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import {
  BITACORA_ARTICLES,
  BITACORA_CTA_LABEL,
  countArticleWords,
} from "@/lib/bitacora-content";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";
import { LEGAL, LEGAL_LINKS, PLAN_PROMISES, SIC_URL, whatsappLink } from "@/lib/legal";
import {
  FAQS,
  NOSOTROS_TEXT,
  getPrivacidad,
  getRetracto,
  getTerminos,
} from "@/lib/legal-content";
import {
  clearSentNotificationsLog,
  getSentNotificationsLog,
} from "@/lib/notifications";
import { createWompiCheckoutSession } from "@/lib/subscription";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const words = (t: string) => t.trim().split(/\s+/).length;
const flat = (d: ReturnType<typeof getTerminos>) =>
  d.sections.flatMap((s) => s.paragraphs).join(" ");

describe("Lanzamiento: legal, confianza, soporte, recuperación y bitácora", () => {
  const createdFarmIds: string[] = [];
  const createdContactMarkers: string[] = [];

  afterEach(async () => {
    clearSentNotificationsLog();

    for (const farmId of createdFarmIds) {
      await runWithFarmContext(farmId, async () => {
        await db.delete(sessions).where(eq(sessions.farmId, farmId));
        await db.delete(billingPayments).where(eq(billingPayments.farmId, farmId));
        await db.delete(users).where(eq(users.farmId, farmId));
        await db.delete(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId));
        await db.delete(farms).where(eq(farms.id, farmId));
      });
    }
    createdFarmIds.length = 0;

    if (createdContactMarkers.length > 0) {
      await runWithFarmContext(DEFAULT_FARM_ID, async () => {
        for (const marker of createdContactMarkers) {
          await db
            .delete(appSettings)
            .where(
              and(
                eq(appSettings.farmId, DEFAULT_FARM_ID),
                like(appSettings.value, `%${marker}%`),
              ),
            );
        }
      });
      createdContactMarkers.length = 0;
    }
  });

  it("las 10 preguntas frecuentes tienen máximo 80 palabras, captura real y /nosotros máximo 120", () => {
    expect(FAQS).toHaveLength(10);
    for (const f of FAQS) {
      expect(words(f.a), f.q).toBeLessThanOrEqual(80);
      expect(f.image?.src, `Imagen faltante en FAQ: ${f.q}`).toBeTruthy();
      const diskPath = path.join(root, "public", f.image!.src.replace(/^\//, ""));
      expect(fs.existsSync(diskPath), `Archivo no existe: ${diskPath}`).toBe(true);
    }
    expect(words(NOSOTROS_TEXT)).toBeLessThanOrEqual(120);
    expect(NOSOTROS_TEXT).toContain("Ambalá");
  });

  it("identidad de contacto usa gallinero@iwage.co y WhatsApp colombiano +573026693366", () => {
    expect(LEGAL.email).toBe("gallinero@iwage.co");
    expect(LEGAL.whatsapp).toBe("3026693366");
    expect(whatsappLink()).toBe("https://wa.me/573026693366");
  });

  it("los términos cubren los puntos exigidos y usan las mismas frases que los planes", () => {
    const t = flat(getTerminos());
    expect(t).toContain(PLAN_PROMISES.noAutoCharge);
    expect(t).toContain(PLAN_PROMISES.expiry);
    for (const needle of [
      "NIT/RUT",
      "COP",
      "IVA",
      "inteligencia artificial",
      "exportar",
      "ICA",
      "INVIMA",
      SIC_URL,
    ]) {
      expect(t, needle).toContain(needle);
    }
    const landing = read("src/app/page.tsx");
    expect(landing).toContain("PLAN_PROMISES.noAutoCharge");
    expect(landing).toContain("PLAN_PROMISES.expiry");
    expect(landing).toContain("priceNote()");
    expect(landing).toContain("<LandingFooter />");
  });

  it("retracto y privacidad están finalizados, enlazan la SIC y detallan Decreto 090", () => {
    const retracto = flat(getRetracto());
    expect(retracto).toContain(SIC_URL);
    expect(retracto).toContain("5 días hábiles");
    expect(retracto).not.toContain("confirmar la asesoría jurídica");

    const p = flat(getPrivacidad());
    expect(p).toContain("Ley 1581");
    expect(p).toContain("RNBD");
    expect(p).toContain("Decreto 090");
  });

  it("el pie legal, login, registro y el pago enlazan los tres documentos", () => {
    expect(LEGAL_LINKS.map((l) => l.href)).toEqual([
      "/terminos",
      "/retracto",
      "/privacidad",
    ]);
    expect(read("src/components/LegalFooter.tsx")).not.toContain("SIC_URL");
    for (const f of [
      "src/app/login/page.tsx",
      "src/components/SubscriptionUpgradeModal.tsx",
    ]) {
      expect(read(f)).toContain("LegalLinksBar");
    }
    const registro = read("src/app/registro/page.tsx");
    for (const href of ["/terminos", "/retracto", "/privacidad"]) {
      expect(registro).toContain(href);
    }
    expect(registro).toContain("useState(false)");
  });

  it("la bitácora tiene 5 artículos completos (600-900 palabras), datos reales, capturas y CTA", () => {
    expect(BITACORA_ARTICLES).toHaveLength(5);
    for (const article of BITACORA_ARTICLES) {
      const count = countArticleWords(article);
      expect(count, `${article.slug}: ${count} palabras`).toBeGreaterThanOrEqual(600);
      expect(count, `${article.slug}: ${count} palabras`).toBeLessThanOrEqual(900);
      expect(article.realFarmData.fact.length, article.slug).toBeGreaterThan(20);
      const imgPath = path.join(root, "public", article.image.src.replace(/^\//, ""));
      expect(fs.existsSync(imgPath), `Falta imagen ${imgPath}`).toBe(true);
    }

    const indexPage = read("src/app/bitacora/page.tsx");
    const slugPage = read("src/app/bitacora/[slug]/page.tsx");
    expect(indexPage).toContain("BITACORA_CTA_LABEL");
    expect(indexPage).toContain('href="/registro"');
    expect(slugPage).toContain("BITACORA_CTA_LABEL");
    expect(slugPage).toContain('href="/registro"');
    expect(BITACORA_CTA_LABEL).toBe("Crear mi granja gratis");
  });

  it("las páginas públicas y nuevas rutas SEO pasan el proxy sin sesión", async () => {
    const { proxy } = await import("@/proxy");
    const htmlRoutes = [
      "/terminos",
      "/retracto",
      "/privacidad",
      "/contacto",
      "/ayuda",
      "/nosotros",
      "/bitacora",
      "/bitacora/cuanto-cuesta-producir-un-huevo",
    ];
    for (const route of htmlRoutes) {
      const res = await proxy(
        new NextRequest(`http://localhost:3000${route}`, {
          headers: { accept: "text/html" },
        }),
      );
      expect(res.status, route).toBe(200);
      expect(res.headers.get("location"), route).toBeNull();
    }

    for (const route of ["/api/contacto", "/sitemap.xml", "/robots.txt"]) {
      const res = await proxy(new NextRequest(`http://localhost:3000${route}`));
      expect(res.status, route).toBe(200);
    }
  });

  it("la landing aclara cobro mensual, tiene 3 chips y 2 botones en el hero", () => {
    expect(
      CYCLE_PLANS_SHOWCASE.find((p) => p.id === "MEDIANO_MENSUAL")?.name,
    ).toContain("cobro mensual");
    const landing = read("src/app/page.tsx");
    expect(landing).not.toContain("Entrar al sistema");
    expect(landing).toContain("<ol");
  });

  it("el registro exige la autorización y guarda constancia", async () => {
    const mk = (extra: Record<string, unknown>) =>
      new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmName: "Finca Sin Consentimiento",
          ownerName: "Nadie Prueba",
          username: `legal_${Date.now()}`,
          password: "ClaveSegura123",
          ...extra,
        }),
      });
    const res = await registerFarm(mk({}));
    expect(res.status).toBe(400);
    const res2 = await registerFarm(mk({ acceptLegal: "true" }));
    expect(res2.status).toBe(400);
  });

  it("POST /api/contacto valida campos, guarda ticket PQR y registra notificación", async () => {
    clearSentNotificationsLog();

    const badRes = await submitContact(
      new NextRequest("http://localhost:3000/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "soporte",
          name: "A",
          contactInfo: "123",
          message: "corto",
        }),
      }),
    );
    expect(badRes.status).toBe(400);

    const uniqueMarker = `contacto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    createdContactMarkers.push(uniqueMarker);

    const okRes = await submitContact(
      new NextRequest("http://localhost:3000/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "implementacion",
          name: "Productor Piloto",
          farm: "Granja Ambalá",
          contactInfo: `${uniqueMarker}@iwage.co`,
          message: "Necesito paquete llave en mano para dos galpones en Tolima.",
        }),
      }),
    );
    expect(okRes.status).toBe(201);
    const payload = await okRes.json();
    expect(payload.ok).toBe(true);
    expect(payload.ticketCode).toMatch(/^PQR-\d{8}-[A-F0-9]{4}$/);

    const savedRows = await runWithFarmContext(DEFAULT_FARM_ID, async () =>
      db
        .select()
        .from(appSettings)
        .where(
          and(
            eq(appSettings.farmId, DEFAULT_FARM_ID),
            like(appSettings.value, `%${payload.ticketCode}%`),
          ),
        ),
    );
    expect(savedRows.length).toBeGreaterThanOrEqual(1);

    const sent = getSentNotificationsLog();
    expect(sent.some((n) => n.subject.includes(payload.ticketCode))).toBe(true);
  });

  it("propietario registrado recibe recoveryCode, recupera acceso y checkout incluye redirect-url", async () => {
    clearSentNotificationsLog();
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const username = `prop_${suffix}`;

    const regRes = await registerFarm(
      new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmName: `Granja Recuperación ${suffix}`,
          ownerName: "Rosa Elena Rojas",
          username,
          password: "PasswordInicial9",
          municipality: "Ibagué",
          acceptLegal: true,
        }),
      }),
    );
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    const farmId = String(regBody.farmId);
    createdFarmIds.push(farmId);

    expect(regBody.user.role).toBe("propietario");
    expect(regBody.recoveryCode).toMatch(/^IWG-/);

    const recoverRes = await recoverPassword(
      new NextRequest("http://localhost:3000/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          recoveryCode: regBody.recoveryCode,
          newPassword: "NuevaClave88",
        }),
      }),
    );
    expect(recoverRes.status).toBe(200);
    const recoverJson = await recoverRes.json();
    expect(recoverJson).toEqual({ ok: true });

    const checkout = await runWithFarmContext(farmId, async () =>
      createWompiCheckoutSession({
        farmId,
        planCode: "CICLO_60D",
        method: "nequi",
      }),
    );
    expect(checkout.checkoutUrl).toContain("redirect-url=");
  });
});
