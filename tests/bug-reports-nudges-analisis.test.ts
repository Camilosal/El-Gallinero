import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import {
  GET as fallasGET,
  PATCH as fallasPATCH,
  POST as fallasPOST,
} from "@/app/api/soporte/fallas/route";
import {
  BEHAVIORAL_NUDGE_GROUPS,
  pickNextRotatingNudge,
  resolvePageNudgeGroup,
} from "@/lib/behavioral-nudges";
import {
  buildBugTags,
  formatBugReportPreviewText,
  resolveBugOriginInfo,
} from "@/lib/bug-report";
import { filterNavigationGroups, navigationGroups, searchNavigation } from "@/lib/navigation";
import { clearSentNotificationsLog, getSentNotificationsLog } from "@/lib/notifications";
import { buildScaleDefaultFlags } from "@/lib/onboarding";
import { mockRequest, parseJson } from "./helpers";

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("Análisis con Normas/Guías, Nudges Conductuales Rotativos y Reporte de Fallas Etiquetado", () => {
  const createdReportCodes: string[] = [];

  afterAll(async () => {
    if (createdReportCodes.length === 0) return;
    const rows = await db
      .select({ id: appSettings.id, value: appSettings.value })
      .from(appSettings)
      .where(like(appSettings.key, "support.bug.%"));

    for (const row of rows) {
      if (createdReportCodes.some((code) => row.value.includes(code))) {
        await db.delete(appSettings).where(eq(appSettings.id, row.id));
      }
    }
  });

  it("incluye Normas y guías aplicables dentro del grupo Análisis en la barra lateral y en escala Pequeño/Mediano", () => {
    const analisisGroup = navigationGroups.find((g) => g.id === "analisis");
    expect(analisisGroup).toBeDefined();
    expect(analisisGroup?.items.some((item) => item.href === "/analisis/normas")).toBe(true);
    expect(analisisGroup?.items.some((item) => item.href === "/analisis/fuentes-externas")).toBe(true);

    for (const scale of ["PEQUENO", "MEDIANO"] as const) {
      const visibleGroups = filterNavigationGroups(buildScaleDefaultFlags(scale));
      const visibleAnalisis = visibleGroups.find((g) => g.id === "analisis");
      expect(visibleAnalisis?.items.some((i) => i.href === "/analisis/normas")).toBe(true);
    }

    expect(
      fs.existsSync(path.join(process.cwd(), "src/app/(app)/analisis/normas/page.tsx")),
    ).toBe(true);
    expect(
      searchNavigation("normas y guias").some((entry) => entry.href === "/analisis/normas"),
    ).toBe(true);
    expect(
      searchNavigation("fallas").some((entry) => entry.href === "/configuracion/fallas"),
    ).toBe(true);
  });

  it("resuelve nudges conductuales específicos por página y rota secuencialmente en cada recarga o apertura", () => {
    const sampleRoutes: Array<[string, string, string]> = [
      ["/inicio", "", "inicio"],
      ["/escanear", "", "escanear"],
      ["/animales", "", "animales"],
      ["/produccion", "tab=huevos", "produccion_huevos"],
      ["/produccion", "tab=carne", "produccion_carne"],
      ["/produccion", "tab=gallinaza", "produccion_gallinaza"],
      ["/produccion", "tab=alimentacion", "alimentacion"],
      ["/produccion/mortalidad", "", "mortalidad"],
      ["/ubicaciones", "", "ubicaciones"],
      ["/sanidad/control", "", "sanidad"],
      ["/finanzas/ventas", "", "finanzas"],
      ["/inventarios/balance", "", "inventarios"],
      ["/operaciones/cierre", "", "almacen_operaciones"],
      ["/planeacion/calendario", "", "planeacion"],
      ["/analisis/normas", "", "analisis"],
      ["/configuracion/catalogos", "tab=normas", "configuracion"],
      ["/manual", "", "guia"],
    ];

    for (const [pathname, query, expectedKey] of sampleRoutes) {
      const group = resolvePageNudgeGroup(pathname, query);
      expect(group.key).toBe(expectedKey);
      expect(group.nudges.length).toBeGreaterThanOrEqual(4);
    }

    for (const group of Object.values(BEHAVIORAL_NUDGE_GROUPS)) {
      expect(group.nudges.length).toBeGreaterThanOrEqual(4);
    }

    const storage = createMemoryStorage();
    const huevosPool = BEHAVIORAL_NUDGE_GROUPS.produccion_huevos.nudges;
    const pickedIds: string[] = [];
    for (let i = 0; i < huevosPool.length + 1; i++) {
      const res = pickNextRotatingNudge("produccion_huevos:/produccion?tab=huevos", huevosPool, storage);
      pickedIds.push(res.nudge.id);
    }
    expect(pickedIds[0]).not.toBe(pickedIds[1]);
    expect(pickedIds[1]).not.toBe(pickedIds[2]);
    expect(pickedIds[2]).not.toBe(pickedIds[3]);
    expect(pickedIds[huevosPool.length]).toBe(pickedIds[0]);

    const layoutSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/_client-layout.tsx"),
      "utf8",
    );
    const heroBannerSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/HeroBanner.tsx"),
      "utf8",
    );
    expect(layoutSrc).toContain("DashboardBreadcrumb");
    expect(layoutSrc).toContain("BugReportModal");
    expect(heroBannerSrc).toContain("<BehavioralNudgeBanner");
    expect(heroBannerSrc.indexOf("<BehavioralNudgeBanner")).toBeGreaterThan(
      heroBannerSrc.indexOf("<HeroFrame"),
    );
  });

  it("etiqueta automáticamente el origen de cada falla y formatea vista previa", () => {
    const origin = resolveBugOriginInfo(
      "/produccion",
      "tab=huevos",
      "topbar",
    );
    expect(origin.originPath).toBe("/produccion");
    expect(origin.originQuery).toBe("tab=huevos");
    expect(origin.originGroup).toBe("Producción");
    expect(origin.originModule).toContain("Huevos");

    const normasOrigin = resolveBugOriginInfo("/analisis/normas", "", "sidebar");
    expect(normasOrigin.originGroup).toBe("Análisis");
    expect(normasOrigin.originModule).toContain("Normas");

    const tags = buildBugTags({
      originPath: origin.originPath,
      originModule: origin.originModule,
      originGroup: origin.originGroup,
      triggerSource: "topbar",
      category: "calculo",
      severity: "alta",
      online: false,
      deviceType: "movil",
      reporterRole: "ADMIN",
      farmName: "Iwagé Granja Piloto",
    });

    expect(tags).toContain("ruta:/produccion");
    expect(tags).toContain("grupo:produccion");
    expect(tags).toContain("origen:topbar");
    expect(tags).toContain("categoria:calculo");
    expect(tags).toContain("severidad:alta");
    expect(tags).toContain("red:offline");
    expect(tags).toContain("dispositivo:movil");
    expect(tags).toContain("rol:admin");

    const preview = formatBugReportPreviewText({
      reportCode: "FAIL-20261114-ABCD",
      title: "Descuadre en cubetas AA",
      category: "calculo",
      severity: "alta",
      description: "Al registrar recolección no resta las cubetas vendidas.",
      originFullUrl: origin.originFullUrl,
      originModule: origin.originModule,
      originGroup: origin.originGroup,
      triggerSource: "topbar",
      tags,
    });
    expect(preview).toContain("FAIL-20261114-ABCD");
    expect(preview).toContain("[ruta:/produccion]");
    expect(preview).toContain("Producción · Huevos");
  });

  it("POST / GET / PATCH /api/soporte/fallas valida, persiste etiquetado, notifica y permite seguimiento", async () => {
    clearSentNotificationsLog();

    const invalidRes = await fallasPOST(
      mockRequest("http://localhost/api/soporte/fallas", {
        method: "POST",
        body: { title: "No", description: "Corto" },
      }),
    );
    expect(invalidRes.status).toBe(400);

    const createRes = await fallasPOST(
      mockRequest("http://localhost/api/soporte/fallas", {
        method: "POST",
        body: {
          title: "Error de prueba etiquetado en Normas de Análisis",
          description: "Prueba automatizada verificando envío etiquetado desde /analisis/normas.",
          stepsToReproduce: "1. Entrar a Análisis -> Normas. 2. Hacer clic en verificar.",
          expectedBehavior: "Mostrar la última versión vigente.",
          category: "norma_dato",
          severity: "alta",
          originPath: "/analisis/normas",
          originQuery: "",
          triggerSource: "sidebar",
          customTags: ["qa-auto", "normas"],
          environment: {
            online: true,
            deviceType: "escritorio",
            viewport: "1440x900",
          },
          capturedErrors: [
            {
              kind: "network",
              message: "HTTP 502 sincronizando fuente",
              source: "/api/configuracion/fuentes-externas",
              occurredAt: "2026-11-14T19:00:00.000Z",
            },
          ],
        },
      }),
    );

    expect(createRes.status).toBe(201);
    const createdJson = await parseJson(createRes);
    const report = createdJson.report;
    expect(report.reportCode).toMatch(/^FAIL-\d{8}-[A-F0-9]{4}$/);
    createdReportCodes.push(report.reportCode);

    expect(report.originPath).toBe("/analisis/normas");
    expect(report.originGroup).toBe("Análisis");
    expect(report.tags).toContain("ruta:/analisis/normas");
    expect(report.tags).toContain("grupo:analisis");
    expect(report.tags).toContain("origen:sidebar");
    expect(report.tags).toContain("categoria:norma_dato");
    expect(report.tags).toContain("severidad:alta");
    expect(report.tags).toContain("qa-auto");
    expect(report.capturedErrors).toHaveLength(1);

    const sent = getSentNotificationsLog();
    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect(sent[0].subject).toContain(report.reportCode);
    expect(sent[0].subject).toContain("[ALTA]");
    expect(sent[0].text).toContain("ruta:/analisis/normas");

    const listRes = await fallasGET(
      mockRequest("http://localhost/api/soporte/fallas?tag=ruta:/analisis/normas"),
    );
    expect(listRes.status).toBe(200);
    const listJson = await parseJson(listRes);
    expect(listJson.reports.some((r: { reportCode: string }) => r.reportCode === report.reportCode)).toBe(true);
    expect(listJson.summary.total).toBeGreaterThanOrEqual(1);

    const patchRes = await fallasPATCH(
      mockRequest("http://localhost/api/soporte/fallas", {
        method: "PATCH",
        body: {
          reportCode: report.reportCode,
          status: "resuelto",
          resolutionNote: "Verificado en pruebas automatizadas.",
        },
      }),
    );
    expect(patchRes.status).toBe(200);
    const patchJson = await parseJson(patchRes);
    expect(patchJson.report.status).toBe("resuelto");
    expect(patchJson.report.resolutionNote).toBe("Verificado en pruebas automatizadas.");
  });
});
