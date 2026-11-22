import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  agentBriefings,
  appSettings,
  budgetItems,
  budgets,
  farms,
  feedInventory,
  feedMovements,
  mortalityRecords,
  sanitaryCalendar,
  transactions,
} from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { addDaysIso, todayColombiaIso } from "@/lib/date-validation";
import { PROGRESSIVE_CONFIG_SETTING_KEY, createDefaultProgressiveConfig } from "@/lib/onboarding";
import {
  buildDailyBriefing,
  collectBriefingFindings,
  detectMortalityAnomaly,
  listBriefings,
  markBriefingRead,
  maybeTriggerMortalityAnomalyBriefing,
  renderTemplateNarrative,
} from "@/lib/agent/proactive";
import { POST as cronPOST } from "@/app/api/cron/agente-proactivo/route";

const farmId = crypto.randomUUID();
const todayIso = todayColombiaIso();
const feedName = `Concentrado C1 ${farmId.slice(0, 6)}`;
const vaccineName = `Vacuna Newcastle C1 ${farmId.slice(0, 6)}`;
const budgetCategory = `alimento_c1_${farmId.slice(0, 8)}`;
const envBackup: Record<string, string | undefined> = {};

function cronRequest(secret?: string): any {
  return new Request("http://localhost/api/cron/agente-proactivo", {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

async function setScale(scale: "PEQUENO" | "MEDIANO") {
  await runWithFarmContext(farmId, async () => {
    const config = createDefaultProgressiveConfig(scale);
    await db
      .insert(appSettings)
      .values({ key: PROGRESSIVE_CONFIG_SETTING_KEY, value: JSON.stringify(config) })
      .onConflictDoUpdate({
        target: [appSettings.farmId, appSettings.key],
        set: { value: JSON.stringify(config), updatedAt: new Date() },
      });
  });
}

describe("C1 · agente proactivo: briefings deterministas", () => {
  beforeAll(async () => {
    for (const key of ["ASSISTANT_AI_API_KEY", "DEEPSEEK_API_KEY", "CRON_SECRET"]) {
      envBackup[key] = process.env[key];
    }
    // Sin clave LLM: la narración debe usar la plantilla determinista.
    delete process.env.ASSISTANT_AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    await db.insert(farms).values({ id: farmId, slug: `finca-c1-${farmId.slice(0, 8)}`, name: "Finca Prueba C1" });

    await runWithFarmContext(farmId, async () => {
      // Alimento para 2 días: stock 20 kg con consumo de 10 kg/día en los últimos 7 días.
      const [feed] = await db
        .insert(feedInventory)
        .values({ name: feedName, category: "Concentrado", feedType: "Otro", unit: "kg", currentStock: "20", costPerUnit: "2000" })
        .returning();
      const movements = Array.from({ length: 7 }, (_, i) => ({
        feedId: feed.id,
        quantity: "10",
        isEntry: false,
        date: addDaysIso(todayIso, -(i + 1)),
        notes: "Consumo semilla prueba C1",
      }));
      await db.insert(feedMovements).values(movements);

      // Vacuna atrasada (rutina sanitaria vencida ayer).
      await db.insert(sanitaryCalendar).values({
        type: "vacuna",
        name: vaccineName,
        nextDueDate: addDaysIso(todayIso, -1),
        isActive: true,
      });
    });

    await setScale("PEQUENO");
  });

  afterAll(async () => {
    await runWithFarmContext(farmId, async () => {
      const feeds = await db.select({ id: feedInventory.id }).from(feedInventory);
      for (const feed of feeds) {
        await db.delete(feedMovements).where(eq(feedMovements.feedId, feed.id));
      }
      await db.delete(feedInventory);
      await db.delete(sanitaryCalendar);
      await db.delete(mortalityRecords);
      await db.delete(transactions);
      await db.delete(budgetItems);
      await db.delete(budgets);
      await db.delete(agentBriefings);
      await db.delete(appSettings).where(eq(appSettings.key, PROGRESSIVE_CONFIG_SETTING_KEY));
    });
    await db.delete(farms).where(eq(farms.id, farmId));
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("granja con alimento para 2 días y vacuna atrasada genera esos hallazgos", async () => {
    const findings = await runWithFarmContext(farmId, () => collectBriefingFindings(todayIso));
    const feedFinding = findings.find((f) => f.code === "alimento_cobertura" && f.title.includes(feedName));
    expect(feedFinding).toBeTruthy();
    expect(feedFinding!.severity).toBe("critical");
    expect(feedFinding!.detail).toContain("2 días");
    expect(feedFinding!.href).toBe("/inventarios/alimentacion");

    const vaccineFinding = findings.find((f) => f.code === "vacuna_atrasada" && f.title.includes(vaccineName));
    expect(vaccineFinding).toBeTruthy();
    expect(vaccineFinding!.severity).toBe("critical");
  });

  it("buildDailyBriefing crea el briefing del día con plantilla (sin API key) y versión corta PEQUENO", async () => {
    const result = await runWithFarmContext(farmId, () => buildDailyBriefing({ todayIso }));
    expect(result.created).toBe(true);
    expect(result.briefing.kind).toBe("diario");
    expect(result.briefing.payload.scale).toBe("PEQUENO");
    expect(result.briefing.payload.narratedBy).toBe("template");
    expect(result.briefing.payload.findings.length).toBeLessThanOrEqual(3);
    expect(result.briefing.payload.findings.some((f) => f.title.includes(feedName))).toBe(true);
    expect(result.briefing.payload.findings.some((f) => f.title.includes(vaccineName))).toBe(true);
    expect(result.briefing.narrative).toContain(feedName);
    expect(result.briefing.readAt).toBeNull();
  });

  it("segunda llamada del mismo día no duplica el briefing", async () => {
    const first = await runWithFarmContext(farmId, () => buildDailyBriefing({ todayIso }));
    const second = await runWithFarmContext(farmId, () => buildDailyBriefing({ todayIso }));
    expect(second.created).toBe(false);
    expect(second.briefing.id).toBe(first.briefing.id);
    const rows = await runWithFarmContext(farmId, () =>
      db
        .select()
        .from(agentBriefings)
        .where(and(eq(agentBriefings.briefingDate, todayIso), eq(agentBriefings.kind, "diario"))),
    );
    expect(rows.length).toBe(1);
  });

  it("MEDIANO recibe el informe completo (hasta 6 hallazgos) y la plantilla lista todos", async () => {
    await setScale("MEDIANO");
    await runWithFarmContext(farmId, () =>
      db.delete(agentBriefings).where(and(eq(agentBriefings.briefingDate, todayIso), eq(agentBriefings.kind, "diario"))),
    );
    const result = await runWithFarmContext(farmId, () => buildDailyBriefing({ todayIso }));
    expect(result.created).toBe(true);
    expect(result.briefing.payload.scale).toBe("MEDIANO");
    expect(result.briefing.payload.findings.length).toBeLessThanOrEqual(6);
    expect(result.briefing.payload.findings.length).toBeGreaterThanOrEqual(2);

    const template = renderTemplateNarrative(result.briefing.payload.findings, todayIso, "MEDIANO");
    for (const finding of result.briefing.payload.findings) {
      expect(template).toContain(finding.title);
    }
    await setScale("PEQUENO");
  });

  it("mortalidad sobre el umbral dispara briefing de anomalía por evento, idempotente", async () => {
    await runWithFarmContext(farmId, async () => {
      // Media móvil 1/día en los 7 días previos; hoy 500 → muy por encima de 2×.
      const previous = Array.from({ length: 7 }, (_, i) => ({
        date: addDaysIso(todayIso, -(i + 1)),
        birdType: "gallina",
        quantity: 1,
        cause: "causa_natural" as const,
      }));
      await db.insert(mortalityRecords).values([
        ...previous,
        { date: todayIso, birdType: "gallina", quantity: 500, cause: "enfermedad" as const },
      ]);
    });

    const anomaly = await runWithFarmContext(farmId, () => detectMortalityAnomaly(todayIso));
    expect(anomaly).toBeTruthy();
    expect(anomaly!.code).toBe("mortalidad_anormal");
    expect(anomaly!.severity).toBe("critical");

    const first = await runWithFarmContext(farmId, () => maybeTriggerMortalityAnomalyBriefing());
    expect(first).toBeTruthy();
    expect(first!.created).toBe(true);
    expect(first!.briefing.kind).toBe("anomalia");
    expect(first!.briefing.payload.findings[0].code).toBe("mortalidad_anormal");

    const second = await runWithFarmContext(farmId, () => maybeTriggerMortalityAnomalyBriefing());
    expect(second!.created).toBe(false);
    expect(second!.briefing.id).toBe(first!.briefing.id);
  });

  it("desviación de presupuesto > 10 % aparece como hallazgo", async () => {
    await runWithFarmContext(farmId, async () => {
      const [budget] = await db
        .insert(budgets)
        .values({
          name: `Presupuesto C1 ${farmId.slice(0, 6)}`,
          periodStart: addDaysIso(todayIso, -10),
          periodEnd: addDaysIso(todayIso, 10),
          type: "egreso",
        })
        .returning();
      await db.insert(budgetItems).values({ budgetId: budget.id, category: budgetCategory, monthlyTarget: "100000" });
      await db.insert(transactions).values({
        date: todayIso,
        type: "egreso",
        category: budgetCategory,
        description: "Gasto semilla prueba C1",
        amount: "200000",
      });
    });

    const findings = await runWithFarmContext(farmId, () => collectBriefingFindings(todayIso));
    const deviation = findings.find((f) => f.code === "presupuesto_desviado" && f.detail.includes("100 %"));
    expect(deviation).toBeTruthy();
    expect(deviation!.href).toBe("/finanzas/presupuestos");
  });

  it("marcado de leído es idempotente y listBriefings devuelve los del día", async () => {
    const briefings = await runWithFarmContext(farmId, () => listBriefings(10));
    expect(briefings.length).toBeGreaterThanOrEqual(2);
    const target = briefings[0];
    const first = await runWithFarmContext(farmId, () => markBriefingRead(target.id));
    expect(first!.readAt).toBeTruthy();
    const second = await runWithFarmContext(farmId, () => markBriefingRead(target.id));
    expect(second!.readAt?.getTime()).toBe(first!.readAt?.getTime());
  });

  it("el cron exige CRON_SECRET: sin configurar 503, secreto inválido 401, válido 200", async () => {
    delete process.env.CRON_SECRET;
    const noConfig = await cronPOST(cronRequest("lo-que-sea"));
    expect(noConfig.status).toBe(503);

    process.env.CRON_SECRET = "secreto-cron-c1";
    const unauthorized = await cronPOST(cronRequest("secreto-equivocado"));
    expect(unauthorized.status).toBe(401);
    const missingHeader = await cronPOST(cronRequest());
    expect(missingHeader.status).toBe(401);

    const authorized = await cronPOST(cronRequest("secreto-cron-c1"));
    expect(authorized.status).toBe(200);
    const body = (await authorized.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.farmsProcessed).toBeGreaterThanOrEqual(1);
    expect(body.briefingsCreated + body.briefingsExisting).toBe(body.farmsProcessed);
  });
});