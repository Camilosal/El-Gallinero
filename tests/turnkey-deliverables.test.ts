import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  appSettings,
  broilerBatches,
  compostingPiles,
  dailyClosures,
  eggProduction,
  eggSales,
  eggSalesItems,
  farmLocations,
  farms,
  farmSubscriptions,
  feedInventory,
  feedMovements,
  healthControl,
  transactions,
  users,
} from "@/db/schema";
import * as authMod from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { addDaysIso, todayColombiaIso } from "@/lib/date-validation";
import {
  buildBarnQuickGuidePdf,
  buildCompostingPoePdf,
  buildWeek4HandoverActPdf,
  buildZonificationMapPdf,
} from "@/lib/export/turnkey-pdf";
import { GET as getDeliverable } from "@/app/api/operaciones/entregables-ruta2/route";

describe("Ruta 2 — Motor PDF y 4 Entregables Formales (/api/operaciones/entregables-ruta2)", () => {
  const createdFarmIds: string[] = [];

  afterEach(async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    });

    for (const farmId of createdFarmIds.splice(0)) {
      await db.delete(eggSalesItems).where(eq(eggSalesItems.farmId, farmId));
      await db.delete(eggSales).where(eq(eggSales.farmId, farmId));
      await db.delete(eggProduction).where(eq(eggProduction.farmId, farmId));
      await db.delete(feedMovements).where(eq(feedMovements.farmId, farmId));
      await db.delete(feedInventory).where(eq(feedInventory.farmId, farmId));
      await db.delete(transactions).where(eq(transactions.farmId, farmId));
      await db.delete(dailyClosures).where(eq(dailyClosures.farmId, farmId));
      await db.delete(compostingPiles).where(eq(compostingPiles.farmId, farmId));
      await db.delete(healthControl).where(eq(healthControl.farmId, farmId));
      await db.delete(broilerBatches).where(eq(broilerBatches.farmId, farmId));
      await db.delete(farmLocations).where(eq(farmLocations.farmId, farmId));
      await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
      await db.delete(users).where(eq(users.farmId, farmId));
      await db.delete(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId));
      await db.delete(farms).where(eq(farms.id, farmId));
    }
  });

  it("genera buffers %PDF-1.4 válidos con %%EOF y tabla xref para las 4 plantillas puras", () => {
    const today = todayColombiaIso();

    const p1 = buildZonificationMapPdf({
      farmName: "Granja Demo PDF",
      municipality: "Villa de Leyva",
      altitudeMeters: "2149",
      generatedAt: today,
      locations: [
        {
          code: "GALP-1",
          name: "Galpón Ponederos",
          type: "galpon",
          zoneType: "limpia",
          allowedSpecies: ["gallina"],
          capacity: 600,
          sanitaryStatus: "cumple",
          sanitaryEmptyUntil: null,
          isQuarantine: false,
        },
      ],
      hasMixedSpeciesConflict: false,
      mixedLocations: [],
      hasQuarantineZone: false,
      hasCompostZone: false,
      correctiveActions: ["Designar área de cuarentena."],
    });

    const p2 = buildBarnQuickGuidePdf({
      farmName: "Granja Demo PDF",
      municipality: "Villa de Leyva",
      generatedAt: today,
      activeWithdrawals: [
        {
          date: today,
          type: "tratamiento",
          product: "Oxitetraciclina 20%",
          species: "gallina",
          locationName: "Galpón 1",
          batchCode: "LOTE-01",
          withdrawalUntilDate: addDaysIso(today, 5),
        },
      ],
    });

    const p3 = buildCompostingPoePdf({
      farmName: "Granja Demo PDF",
      municipality: "Villa de Leyva",
      generatedAt: today,
      piles: [
        {
          code: "COMP-01",
          name: "Pila Principal",
          formulaRatio: "3:1:1",
          startDate: today,
          currentTempC: "59.5",
          moisturePct: "54.0",
          turnCount: 2,
          nextTurnDueDate: addDaysIso(today, 4),
          expectedHarvestDate: addDaysIso(today, 42),
          status: "activa",
          locationName: "Zona Sucia",
        },
      ],
      recentBiosecurityCount30d: 4,
      sanitaryEmptyDaysRequired: 21,
    });

    const p4 = buildWeek4HandoverActPdf({
      farmName: "Granja Demo PDF",
      municipality: "Villa de Leyva",
      altitudeMeters: "2149",
      scale: "MEDIANO",
      planCode: "MEDIANO_MENSUAL",
      generatedAt: today,
      periodFrom: `${today.slice(0, 4)}-01-01`,
      periodTo: today,
      roadmap: [
        { week: 1, title: "Zonificación", status: "completado", evidence: "2 lugares" },
        { week: 2, title: "QR y Genealogía", status: "completado", evidence: "4 placas" },
        { week: 3, title: "Analítica e ICA", status: "en_progreso", evidence: "1 pila" },
        { week: 4, title: "Roles y Marcha Blanca", status: "pendiente", evidence: "en curso" },
      ],
      team: [
        {
          name: "Doña Marta",
          username: "marta_owner",
          role: "propietario",
          roleLabel: "Propietario",
          keyPermissions: "Control total + reapertura",
        },
      ],
      census: [{ species: "gallina", label: "Gallinas", count: 550 }],
      totalLiveAnimals: 550,
      lastClosure: {
        closureDate: today,
        status: "cerrado",
        closedByName: "Doña Marta",
        eggsCollected: 480,
        mortalityCount: 0,
        dayIncome: 290000,
        dayExpense: 120000,
      },
      unitEconomics: {
        directRevenue: 4500000,
        directCost: 3100000,
        proratedCost: 250000,
        totalCost: 3350000,
        netProfit: 1150000,
        realCostPerEgg: 385,
        realCostPerTray30: 11550,
        avgSalePricePerEgg: 520,
        eggBreakevenAlert: false,
        realCostPerLiveKg: 6200,
        realCostPerCarcassKg: 8600,
        avgMeatSalePricePerKg: 11000,
        meatBreakevenAlert: false,
      },
    });

    for (const [label, buf, expectedKeyword] of [
      ["zonificacion", p1, "Zonificaci"],
      ["guia-galpon", p2, "NTC 1240"],
      ["compostaje-poe", p3, "AGROSAVIA"],
      ["acta-entrega", p4, "Acta de Entrega"],
    ] as const) {
      expect(buf.byteLength, label).toBeGreaterThan(1500);
      const raw = buf.toString("latin1");
      expect(raw.startsWith("%PDF-1.4\n"), label).toBe(true);
      expect(raw.trimEnd().endsWith("%%EOF"), label).toBe(true);
      expect(raw.includes("xref\n"), label).toBe(true);
      expect(raw.includes(expectedKeyword), label).toBe(true);
    }
  });

  it("ensambla datos reales multi-tenant desde BD (zonas mixtas, retiro activo, compostaje, cierre y RBAC)", async () => {
    const farmId = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    const operatorId = crypto.randomUUID();
    createdFarmIds.push(farmId);

    const today = todayColombiaIso();
    const futureWithdrawal = addDaysIso(today, 7);

    await db.insert(farms).values({
      id: farmId,
      slug: `ruta2-${farmId.slice(0, 8)}`,
      name: "Hacienda La Pradera",
      municipality: "Duitama",
      planCode: "MEDIANO_MENSUAL",
    });

    await db.insert(farmSubscriptions).values({
      farmId,
      planCode: "MEDIANO_MENSUAL",
      status: "activa",
      maxUsers: 15,
    });

    const pwHash = await hashPassword("ClavePrueba2026!");
    await db.insert(users).values([
      {
        id: ownerId,
        farmId,
        username: `owner_${farmId.slice(0, 6)}`,
        passwordHash: pwHash,
        name: "Carlos Propietario",
        role: "propietario",
      },
      {
        id: operatorId,
        farmId,
        username: `op_${farmId.slice(0, 6)}`,
        passwordHash: pwHash,
        name: "Pedro Operario",
        role: "operario",
      },
    ]);

    await runWithFarmContext(farmId, async () => {
      const [locMix, locQuar] = await db
        .insert(farmLocations)
        .values([
          {
            code: "GALP-MIX",
            name: "Galpón Compartido",
            type: "galpon",
            zoneType: "produccion",
            allowedSpecies: ["gallina", "cuy"],
            capacity: 400,
          },
          {
            code: "CUAR-01",
            name: "Enfermería / Cuarentena",
            type: "cuarentena",
            zoneType: "cuarentena",
            allowedSpecies: ["gallina"],
            isQuarantine: true,
            capacity: 40,
          },
        ])
        .returning();

      const [batch] = await db
        .insert(broilerBatches)
        .values({
          code: "LOTE-POST-01",
          species: "gallina",
          purpose: "postura_huevo",
          breed: "Hy-Line Brown",
          startDate: today,
          initialQuantity: 300,
          currentQuantity: 295,
          locationId: locMix.id,
        })
        .returning();

      await db.insert(healthControl).values({
        date: today,
        species: "gallina",
        locationId: locMix.id,
        batchId: batch.id,
        type: "tratamiento",
        description: "Antibiótico de choque",
        product: "Enrofloxacina 10%",
        withdrawalDays: 7,
        withdrawalUntilDate: futureWithdrawal,
      });

      await db.insert(compostingPiles).values({
        code: "COMP-PRAD-1",
        name: "Cajón Compostaje Norte",
        startDate: today,
        formulaRatio: "7:2:2",
        manureKg: "210",
        mortalityKg: "60",
        carbonMaterialKg: "60",
        currentTempC: "61.0",
        moisturePct: "55.0",
        status: "activa",
        locationId: locQuar.id,
      });

      await db.insert(dailyClosures).values({
        closureDate: today,
        status: "cerrado",
        closedBy: ownerId,
        summarySnapshot: {
          eggsCollected: 250,
          mortalityUnits: 1,
          incomeCop: 160000,
          expenseCop: 85000,
        },
      });
    });

    // Operario NO puede emitir Acta de Entrega Semana 4 (403)
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: operatorId,
      username: `op_${farmId.slice(0, 6)}`,
      name: "Pedro Operario",
      role: "operario",
      farmId,
    });
    const deniedRes = await getDeliverable(
      new NextRequest("http://localhost:3000/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=pdf"),
    );
    expect(deniedRes.status).toBe(403);

    // Operario SÍ puede descargar Guía Rápida de Galpón en PDF
    const opGuideRes = await getDeliverable(
      new NextRequest("http://localhost:3000/api/operaciones/entregables-ruta2?tipo=guia-galpon&format=pdf"),
    );
    expect(opGuideRes.status).toBe(200);
    expect(opGuideRes.headers.get("content-type")).toBe("application/pdf");
    const opGuideBuf = Buffer.from(await opGuideRes.arrayBuffer());
    expect(opGuideBuf.toString("latin1").startsWith("%PDF-1.4\n")).toBe(true);
    expect(opGuideBuf.toString("latin1")).toContain("Enrofloxacina");

    // Propietario consulta JSON completo y PDFs de zonificación, compostaje y acta
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: ownerId,
      username: `owner_${farmId.slice(0, 6)}`,
      name: "Carlos Propietario",
      role: "propietario",
      farmId,
    });

    const jsonRes = await getDeliverable(
      new NextRequest("http://localhost:3000/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=json"),
    );
    expect(jsonRes.status).toBe(200);
    const jsonBody = await jsonRes.json();

    expect(jsonBody.farm.farmName).toBe("Hacienda La Pradera");
    expect(jsonBody.zonification.hasMixedSpeciesConflict).toBe(true);
    expect(jsonBody.zonification.mixedLocations[0]).toContain("Galpón Compartido");
    expect(jsonBody.barnQuickGuide.activeWithdrawals).toHaveLength(1);
    expect(jsonBody.barnQuickGuide.activeWithdrawals[0].product).toBe("Enrofloxacina 10%");
    expect(jsonBody.compostingPoe.piles).toHaveLength(1);
    expect(jsonBody.handoverAct.lastClosure.eggsCollected).toBe(250);
    expect(jsonBody.roadmap).toHaveLength(4);
    expect(jsonBody.roadmap[3].status).toBe("completado");

    for (const tipo of ["zonificacion", "guia-galpon", "compostaje-poe", "acta-entrega"]) {
      const pdfRes = await getDeliverable(
        new NextRequest(`http://localhost:3000/api/operaciones/entregables-ruta2?tipo=${tipo}&format=pdf`),
      );
      expect(pdfRes.status, tipo).toBe(200);
      expect(pdfRes.headers.get("content-type"), tipo).toBe("application/pdf");
      expect(pdfRes.headers.get("content-disposition"), tipo).toContain(`iwage-${tipo}-${today}.pdf`);
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      const str = pdfBuf.toString("latin1");
      expect(str.startsWith("%PDF-1.4\n"), tipo).toBe(true);
      expect(str.trimEnd().endsWith("%%EOF"), tipo).toBe(true);
    }
  });
});
