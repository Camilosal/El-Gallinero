import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentMemories, appSettings, users } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import * as authMod from "@/lib/auth";
import { buildPresetConfig } from "@/lib/kpi-dashboard";
import { recallRelevantMemories } from "@/lib/agent/memory";
import {
  learnFromExpenseAction,
  learnFromFeedingProgramAction,
  learnFromFeedMovementAction,
  learnFromKpiDashboardConfigAction,
  learnFromSaleAction,
} from "@/lib/agent/ui-memory-bridge";
import { PUT as kpiConfigPUT } from "@/app/api/analisis/kpis/config/route";
import { mockRequest } from "./helpers";

describe("ui-memory-bridge (Capacidad 4)", () => {
  const userId = crypto.randomUUID();
  const username = `uimem_${userId.slice(0, 8)}`;

  beforeAll(async () => {
    await db.insert(users).values({
      id: userId,
      username,
      passwordHash: "hash-not-used",
      name: "Productor Bridge",
      role: "propietario",
      farmId: DEFAULT_FARM_ID,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      await db.delete(agentMemories).where(eq(agentMemories.userId, userId));
      await db
        .delete(appSettings)
        .where(and(eq(appSettings.farmId, DEFAULT_FARM_ID), eq(appSettings.updatedBy, userId)));
    });
    await db.delete(users).where(eq(users.id, userId));
  });

  it("sintetiza e indexa idempotentemente memorias desde programas, clientes, proveedores y raciones en galpón", async () => {
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      const m1 = await learnFromFeedingProgramAction({
        userId,
        stageName: "Postura Pico",
        feedName: "Concentrado Ponedora 17%",
        feedUnit: "kg",
        percentage: 100,
        dailyAmountPerHen: 112,
      });
      expect(m1?.category).toBe("protocolo");
      expect(m1?.content).toContain("112 g/animal/día");

      // Idempotent update for the same stage+feed overwrites rather than duplicating
      const m1Updated = await learnFromFeedingProgramAction({
        userId,
        stageName: "Postura Pico",
        feedName: "Concentrado Ponedora 17%",
        feedUnit: "kg",
        percentage: 100,
        dailyAmountPerHen: 118,
      });
      expect(m1Updated?.id).toBe(m1?.id);
      expect(m1Updated?.content).toContain("118 g/animal/día");

      const m2 = await learnFromSaleAction({
        userId,
        buyer: "Don Carlos Tienda",
        productLine: "huevos",
        summary: "120 huevos AAA",
        unitPrice: 720,
        isCredit: true,
        entities: ["gallina"],
      });
      expect(m2?.category).toBe("comprador");
      expect(m2?.content).toContain("Don Carlos Tienda");

      const m3 = await learnFromExpenseAction({
        userId,
        counterparty: "Distribuidora Surcolombiana",
        category: "Control sanitario",
        description: "Vacuna Newcastle",
        amount: 95000,
        species: "gallina",
      });
      expect(m3?.category).toBe("proveedor");

      const m4 = await learnFromFeedMovementAction({
        userId,
        feedName: "Concentrado Ponedora 17%",
        unit: "bultos",
        quantity: 2,
        isEntry: false,
        movementType: "consumo_manual",
        locationName: "Galpón 3",
      });
      expect(m4?.category).toBe("instalacion");

      const cfg = buildPresetConfig("postura");
      cfg.widgets = cfg.widgets.map((w) =>
        w.id === "laying_rate" ? { ...w, pinnedToHome: true, customTarget: 91 } : w,
      );
      const m5 = await learnFromKpiDashboardConfigAction({ userId, config: cfg });
      expect(m5?.category).toBe("preferencia");
      expect(m5?.content).toContain("91");

      const recalledBuyer = await recallRelevantMemories(userId, "¿qué compra Don Carlos Tienda?", 5);
      expect(recalledBuyer.some((r) => r.id === m2?.id)).toBe(true);

      const recalledSupplier = await recallRelevantMemories(userId, "proveedor Distribuidora Surcolombiana", 5);
      expect(recalledSupplier.some((r) => r.id === m3?.id)).toBe(true);

      const recalledGalpon = await recallRelevantMemories(userId, "racion en Galpón 3", 5);
      expect(recalledGalpon.some((r) => r.id === m4?.id)).toBe(true);
    });
  });

  it("PUT /api/analisis/kpis/config actualiza la memoria del tablero del usuario automáticamente", async () => {
    vi.spyOn(authMod, "getSessionUser").mockResolvedValue({
      id: userId,
      username,
      name: "Productor Bridge",
      role: "propietario",
      farmId: DEFAULT_FARM_ID,
    });

    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      const customWidgets = buildPresetConfig("postura").widgets.map((w) =>
        w.id === "cost_per_egg" ? { ...w, pinnedToHome: true, customTarget: 390 } : w,
      );
      const req = mockRequest("http://localhost/api/analisis/kpis/config", {
        method: "PUT",
        body: { preset: "postura", widgets: customWidgets },
      });
      const res = await kpiConfigPUT(req);
      expect(res.status).toBe(200);

      const rows = await db
        .select()
        .from(agentMemories)
        .where(and(eq(agentMemories.userId, userId), eq(agentMemories.subjectKey, "tablero_kpis_metas_usuario")));
      expect(rows.length).toBe(1);
      expect(rows[0].content).toContain("390");
    });
  });
});
