import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import { broilerBatches, farmLocations, farms, transactions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildEggMicroInsight, evaluateHarvestWindowWarning } from "@/lib/micro-insights";
import { GET as alertasGET } from "@/app/api/produccion/alertas/route";
import { GET as kpisGET, POST as kpisPOST } from "@/app/api/analisis/kpis-adopcion/route";
import { GET as onboardingGET, POST as onboardingPOST } from "@/app/api/onboarding/route";
import * as authMod from "@/lib/auth";
import { mockRequest, parseJson } from "./helpers";
import { randomUUID } from "node:crypto";

describe("Micro-insights de utilidad neta, ventana de sacrificio y KPIs de adopción (Task B3)", () => {
  const farmId = randomUUID();
  const userId = randomUUID();

  beforeAll(async () => {
    await db.insert(farms).values({
      id: farmId,
      slug: `test-b3-${farmId.slice(0, 8)}`,
      name: "Granja B3 MicroInsights",
      deploymentMode: "saas",
      planCode: "FREEMIUM_SEMILLA",
    });

    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values({
        id: userId,
        farmId,
        username: `b3_${userId.slice(0, 8)}`,
        passwordHash: "hash",
        name: "Productor B3",
        role: "propietario",
      });
    });

    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: userId,
      farmId,
      username: `b3_${userId.slice(0, 8)}`,
      name: "Productor B3",
      role: "propietario",
    });
  });

  afterAll(async () => {
    await db.delete(farms).where(eq(farms.id, farmId));
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      farmId: "00000000-0000-0000-0000-000000000001",
      username: "test",
      name: "Test User",
      role: "admin",
    });
  });

  it("buildEggMicroInsight incluye 'Utilidad Neta Hoy' cuando recibe consumo de alimento y conserva metrics[0..2]", () => {
    const insight = buildEggMicroInsight({
      date: "2026-11-13",
      species: "gallina",
      locationName: "Galpón 1",
      totalCollected: 90,
      broken: 2,
      forIncubation: 0,
      unitPrice: 550,
      activeLayingBirds: 100,
      previousDayCollected: 84,
      todayFeedKg: 11,
      todayFeedCostCOP: 28000,
    });

    expect(insight.metrics[0]?.label).toBe("Empaque NTC 1240");
    expect(insight.metrics[1]?.label).toBe("Valor comercial hoy");
    expect(insight.metrics[2]?.label).toBe("Postura Ave-Día (HD%)");
    expect(insight.metrics[3]?.label).toBe("Utilidad Neta Hoy");
    expect(insight.metrics[3]?.value).toContain("+$20.400");
    expect(insight.whatsappText).toContain("Utilidad Neta Hoy");
  });

  it("evaluateHarvestWindowWarning dispara alertas en ventanas óptimas multi-especie", () => {
    expect(evaluateHarvestWindowWarning({ species: "pollo", ageDays: 42, code: "L-1" })?.severity).toBe("warning");
    expect(evaluateHarvestWindowWarning({ species: "pollo", ageDays: 49, code: "L-1" })?.severity).toBe("critical");
    expect(evaluateHarvestWindowWarning({ species: "codorniz", ageDays: 42, code: "L-COD" })?.severity).toBe("warning");
    expect(evaluateHarvestWindowWarning({ species: "conejo", ageDays: 75, code: "L-CON" })?.severity).toBe("warning");
    expect(evaluateHarvestWindowWarning({ species: "cuy", ageDays: 75, code: "L-CUY" })?.severity).toBe("warning");
    expect(evaluateHarvestWindowWarning({ species: "pato", ageDays: 56, code: "L-PAT" })?.severity).toBe("critical");
    expect(evaluateHarvestWindowWarning({ species: "pollo", ageDays: 20, code: "L-YOUNG" })).toBeNull();
  });

  it("GET /api/produccion/alertas emite alerta type 'harvest_window' para lotes en edad de cosecha", async () => {
    const start43DaysAgo = new Date(Date.now() - 43 * 86400000).toISOString().slice(0, 10);

    await runWithFarmContext(farmId, async () => {
      const [loc] = await db
        .insert(farmLocations)
        .values({
          farmId,
          code: `GALP-B3-${farmId.slice(0, 6)}`,
          name: "Galpón Pollos Test",
          type: "galpon",
        })
        .returning();

      await db.insert(broilerBatches).values({
        farmId,
        code: "L-HARVEST-43",
        species: "pollo",
        purpose: "engorde_carne",
        breed: "Ross 308",
        startDate: start43DaysAgo,
        initialQuantity: 50,
        currentQuantity: 48,
        targetWeeks: 6,
        targetDays: 42,
        locationId: loc.id,
        status: "activo",
      });
    });

    const res = await alertasGET(mockRequest("http://localhost/api/produccion/alertas", { method: "GET" }));
    expect(res.status).toBe(200);
    const alerts = (await parseJson(res)) as Array<{ type: string; birdGroup?: string; severity: string }>;
    const hw = alerts.find((a) => a.type === "harvest_window" && a.birdGroup === "L-HARVEST-43");
    expect(hw).toBeDefined();
    expect(hw?.severity).toBe("warning");
  });

  it("POST + GET /api/analisis/kpis-adopcion guarda telemetría y retorna los 5 KPIs de la Sección 8", async () => {
    // Ejecutar onboarding Día 1 para generar sanidad + animales + ubicación
    const onbRes = await onboardingPOST(
      mockRequest("http://localhost/api/onboarding", {
        method: "POST",
        body: {
          nombrePredio: "Granja B3 MicroInsights",
          ciudad: "Palmira",
          administrador: "Productor B3",
          escala: "PEQUENO",
          especies: ["gallina"],
          fechaInicioOperacion: "2026-11-13",
          unidades: [
            {
              nombreInstalacion: "Galpón Pon 1",
              tipoInstalacion: "galpon",
              especie: "gallina",
              lineaGenetica: "Hy-Line Brown",
              edadActualDias: 140,
              cantidadVivaHoy: 20,
              saldoConcentradoBultos40kg: 2,
              proposito: "postura_huevo",
            },
          ],
          bultosConcentrado40kg: 2,
          nombreAlimentoInicial: "Ponedora",
        },
      }),
    );
    expect([200, 201]).toContain(onbRes.status);

    // Registrar transacción analítica para activar centro de costos
    await runWithFarmContext(farmId, async () => {
      await db.insert(transactions).values({
        farmId,
        date: "2026-11-13",
        type: "egreso",
        category: "Compra de insumos",
        description: "Bulto concentrado B3",
        amount: "85000",
        species: "gallina",
      });
    });

    const p1 = await kpisPOST(
      mockRequest("http://localhost/api/analisis/kpis-adopcion", {
        method: "POST",
        body: { type: "onboarding", durationSec: 210 },
      }),
    );
    expect(p1.status).toBe(201);

    const p2 = await kpisPOST(
      mockRequest("http://localhost/api/analisis/kpis-adopcion", {
        method: "POST",
        body: { type: "capture", mode: "huevos", durationSec: 36 },
      }),
    );
    expect(p2.status).toBe(201);

    const p3 = await kpisPOST(
      mockRequest("http://localhost/api/analisis/kpis-adopcion", {
        method: "POST",
        body: { type: "capture", mode: "alimentacion", durationSec: 54 },
      }),
    );
    expect(p3.status).toBe(201);

    const kpisRes = await kpisGET(mockRequest("http://localhost/api/analisis/kpis-adopcion", { method: "GET" }));
    expect(kpisRes.status).toBe(200);
    const kpis = (await parseJson(kpisRes)) as {
      timeToValueMinutes: number | null;
      avgFieldCaptureSeconds: number | null;
      captureSamplesCount: number;
      weeklyClosureAdherencePct: number;
      adherence21dPct: number;
      sanitaryAndGenealogyIntegrityPct: number;
      costCentersActiveCount: number;
    };

    expect(kpis.timeToValueMinutes).toBe(3.5);
    expect(kpis.captureSamplesCount).toBe(2);
    expect(kpis.avgFieldCaptureSeconds).toBe(45);
    expect(typeof kpis.weeklyClosureAdherencePct).toBe("number");
    expect(typeof kpis.adherence21dPct).toBe("number");
    expect(kpis.sanitaryAndGenealogyIntegrityPct).toBeGreaterThan(0);
    expect(kpis.costCentersActiveCount).toBeGreaterThanOrEqual(1);
    // Sanity check onboardingGET still loads cleanly
    const getOnb = await onboardingGET(mockRequest("http://localhost/api/onboarding", { method: "GET" }));
    expect(getOnb.status).toBe(200);
  });
});
