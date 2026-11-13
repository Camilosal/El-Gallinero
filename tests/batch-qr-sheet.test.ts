import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import { broilerBatches, farmAssets, farmLocations, farms, hens } from "@/db/schema";
import * as authMod from "@/lib/auth";
import { parseQrTarget } from "@/lib/qr";
import { GET as getBatchQrPlates } from "@/app/api/operaciones/kit-campo/placas-qr/route";

describe("Ruta 2 — Plancha de Impresión QR en Lote (GET /api/operaciones/kit-campo/placas-qr)", () => {
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
      await db.delete(hens).where(eq(hens.farmId, farmId));
      await db.delete(farmAssets).where(eq(farmAssets.farmId, farmId));
      await db.delete(broilerBatches).where(eq(broilerBatches.farmId, farmId));
      await db.delete(farmLocations).where(eq(farmLocations.farmId, farmId));
      await db.delete(farms).where(eq(farms.id, farmId));
    }
  });

  it("retorna placas enriquecidas con zoneType, payloads parseables y aislamiento estricto por finca", async () => {
    const farmAId = crypto.randomUUID();
    const farmBId = crypto.randomUUID();
    createdFarmIds.push(farmAId, farmBId);

    await db.insert(farms).values([
      { id: farmAId, slug: `qr-a-${farmAId.slice(0, 8)}`, name: "Granja QR Alfa" },
      { id: farmBId, slug: `qr-b-${farmBId.slice(0, 8)}`, name: "Granja QR Beta" },
    ]);

    const [locA] = await runWithFarmContext(farmAId, async () => {
      const inserted = await db
        .insert(farmLocations)
        .values({
          code: "GALP-ALFA-01",
          name: "Galpón Ponederos Alfa",
          type: "galpon",
          zoneType: "limpia",
          allowedSpecies: ["gallina"],
          isQuarantine: false,
        })
        .returning();

      await db.insert(broilerBatches).values({
        code: "LOTE-ALFA-01",
        species: "pollo",
        purpose: "engorde_carne",
        breed: "Ross 308",
        startDate: "2026-11-01",
        initialQuantity: 250,
        currentQuantity: 245,
        locationId: inserted[0].id,
      });

      await db.insert(farmAssets).values({
        code: "INC-ALFA-01",
        name: "Incubadora Digital 200 H",
        category: "equipo",
        locationId: inserted[0].id,
      });

      await db.insert(hens).values({
        code: "GAL-ALFA-007",
        breed: "Lohmann Brown",
        birthDate: "2026-04-01",
        locationId: inserted[0].id,
      });

      return inserted;
    });

    await runWithFarmContext(farmBId, async () => {
      await db.insert(farmLocations).values({
        code: "CUAR-BETA-99",
        name: "Cuarentena Externa Beta",
        type: "cuarentena",
        zoneType: "cuarentena",
        isQuarantine: true,
        allowedSpecies: ["cuy"],
      });
    });

    // Consultar bajo sesión de Finca Alfa incluyendo las 4 entidades
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "user-alfa",
      username: "alfa_owner",
      name: "Propietario Alfa",
      role: "propietario",
      farmId: farmAId,
    });

    const req = new NextRequest(
      "http://localhost:3000/api/operaciones/kit-campo/placas-qr?types=ubicacion,lote,activo,gallina",
    );
    const res = await getBatchQrPlates(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.counts.ubicacion).toBe(1);
    expect(body.counts.lote).toBe(1);
    expect(body.counts.activo).toBe(1);
    expect(body.counts.gallina).toBe(1);
    expect(body.plates).toHaveLength(4);

    const codes = body.plates.map((p: { code: string }) => p.code);
    expect(codes).toContain("GALP-ALFA-01");
    expect(codes).toContain("LOTE-ALFA-01");
    expect(codes).toContain("INC-ALFA-01");
    expect(codes).toContain("GAL-ALFA-007");
    expect(codes).not.toContain("CUAR-BETA-99");

    const locPlate = body.plates.find((p: { entityType: string }) => p.entityType === "ubicacion");
    expect(locPlate.zoneType).toBe("limpia");
    expect(locPlate.allowedSpecies).toEqual(["gallina"]);

    // Todos los payloads deben ser parseables por src/lib/qr.ts
    for (const plate of body.plates) {
      const parsed = parseQrTarget(plate.payload);
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe(plate.entityType);
      expect(parsed?.id).toBe(plate.entityId);
    }

    // Consultar bajo sesión de Finca Beta no ve NADA de Finca Alfa
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "user-beta",
      username: "beta_owner",
      name: "Propietario Beta",
      role: "propietario",
      farmId: farmBId,
    });

    const betaRes = await getBatchQrPlates(
      new NextRequest("http://localhost:3000/api/operaciones/kit-campo/placas-qr?types=ubicacion,lote"),
    );
    expect(betaRes.status).toBe(200);
    const betaBody = await betaRes.json();
    expect(betaBody.counts.ubicacion).toBe(1);
    expect(betaBody.plates[0].code).toBe("CUAR-BETA-99");
    expect(betaBody.plates[0].isQuarantine).toBe(true);
    expect(locA.id).not.toBe(betaBody.plates[0].entityId);
  });
});

