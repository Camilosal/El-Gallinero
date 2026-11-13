import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerFarm } from "@/app/api/auth/register/route";
import { FAQS, NOSOTROS_TEXT, getPrivacidad, getRetracto, getTerminos } from "@/lib/legal-content";
import { LEGAL_LINKS, PLAN_PROMISES, SIC_URL } from "@/lib/legal";
import { CYCLE_PLANS_SHOWCASE } from "@/lib/landing-showcase";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const words = (t: string) => t.trim().split(/\s+/).length;
const flat = (d: ReturnType<typeof getTerminos>) =>
  d.sections.flatMap((s) => s.paragraphs).join(" ");

describe("Lanzamiento: legal, confianza y soporte", () => {
  it("las 10 preguntas frecuentes tienen máximo 80 palabras y /nosotros máximo 120", () => {
    expect(FAQS).toHaveLength(10);
    for (const f of FAQS) expect(words(f.a), f.q).toBeLessThanOrEqual(80);
    expect(words(NOSOTROS_TEXT)).toBeLessThanOrEqual(120);
    expect(NOSOTROS_TEXT).toContain("Ambalá");
  });

  it("los términos cubren los puntos exigidos y usan las mismas frases que los planes", () => {
    const t = flat(getTerminos());
    expect(t).toContain(PLAN_PROMISES.noAutoCharge);
    expect(t).toContain(PLAN_PROMISES.expiry);
    for (const needle of ["NIT/RUT", "COP", "IVA", "inteligencia artificial", "exportar", "ICA", "INVIMA", SIC_URL]) {
      expect(t, needle).toContain(needle);
    }
    const landing = read("src/app/page.tsx");
    expect(landing).toContain("PLAN_PROMISES.noAutoCharge");
    expect(landing).toContain("PLAN_PROMISES.expiry");
    expect(landing).toContain("priceNote()");
    expect(landing).toContain("<LegalFooter />");
  });

  it("retracto y privacidad enlazan la SIC y describen derechos y canal", () => {
    expect(flat(getRetracto())).toContain(SIC_URL);
    expect(flat(getRetracto())).toContain("5 días hábiles");
    const p = flat(getPrivacidad());
    expect(p).toContain("Ley 1581");
    expect(p).toContain("RNBD");
  });

  it("el pie legal, login, registro y el pago enlazan los tres documentos", () => {
    expect(LEGAL_LINKS.map((l) => l.href)).toEqual(["/terminos", "/retracto", "/privacidad"]);
    expect(read("src/components/LegalFooter.tsx")).toContain("SIC_URL");
    for (const f of ["src/app/login/page.tsx", "src/components/SubscriptionUpgradeModal.tsx"]) {
      expect(read(f)).toContain("LegalLinksBar");
    }
    const registro = read("src/app/registro/page.tsx");
    for (const href of ["/terminos", "/retracto", "/privacidad"]) expect(registro).toContain(href);
    expect(registro).toContain("useState(false)");
  });

  it("las páginas públicas existen y pasan el proxy sin sesión", async () => {
    const { proxy } = await import("@/proxy");
    for (const route of ["terminos", "retracto", "privacidad", "contacto", "ayuda", "nosotros"]) {
      expect(fs.existsSync(path.join(root, `src/app/${route}/page.tsx`)), route).toBe(true);
      const res = await proxy(new NextRequest(`http://localhost:3000/${route}`, { headers: { accept: "text/html" } }));
      expect(res.status, route).toBe(200);
    }
  });

  it("la landing aclara cobro mensual, tiene 3 chips y 2 botones en el hero", () => {
    expect(CYCLE_PLANS_SHOWCASE.find((p) => p.id === "MEDIANO_MENSUAL")?.name).toContain("cobro mensual");
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
});
