import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import { catalogos, farmLocations, farms, transactions } from "@/db/schema";

const createdFarmIds: string[] = [];

afterEach(async () => {
  for (const farmId of createdFarmIds.splice(0)) {
    await db.delete(transactions).where(eq(transactions.farmId, farmId));
    await db.delete(farmLocations).where(eq(farmLocations.farmId, farmId));
    await db.delete(catalogos).where(eq(catalogos.farmId, farmId));
    await db.delete(farms).where(eq(farms.id, farmId));
  }
});

describe("Multi-Tenancy & PostgreSQL RLS Isolation (Task A1)", () => {
  it("aisla completamente ubicaciones, transacciones y catálogos propios entre dos granjas vía RLS", async () => {
    const farmAId = crypto.randomUUID();
    const farmBId = crypto.randomUUID();
    createdFarmIds.push(farmAId, farmBId);

    await db.insert(farms).values([
      { id: farmAId, slug: `finca-a-${farmAId.slice(0, 8)}`, name: "Finca Alfa" },
      { id: farmBId, slug: `finca-b-${farmBId.slice(0, 8)}`, name: "Finca Beta" },
    ]);

    const codeShared = `GALP-RLS-${farmAId.slice(0, 6)}`;

    const [locA] = await runWithFarmContext(farmAId, async () => {
      const inserted = await db
        .insert(farmLocations)
        .values({ code: codeShared, name: "Galpón Alfa", type: "galpon" })
        .returning();

      await db.insert(transactions).values({
        date: "2026-11-13",
        type: "ingreso",
        category: "Venta de huevos",
        description: "Venta secreta Finca Alfa",
        amount: "95000",
      });

      await db.insert(catalogos).values({
        category: "raza",
        value: `Raza-Privada-Alfa-${farmAId.slice(0, 6)}`,
      });

      return inserted;
    });

    expect(locA.farmId).toBe(farmAId);

    // En contexto de Finca B: puede reutilizar el mismo código sin colisión única y no ve datos de Finca A
    await runWithFarmContext(farmBId, async () => {
      const visibleLocs = await db.select().from(farmLocations);
      expect(visibleLocs.some((l) => l.id === locA.id)).toBe(false);

      const visibleTxs = await db.select().from(transactions);
      expect(visibleTxs.some((t) => t.description === "Venta secreta Finca Alfa")).toBe(false);

      const [locB] = await db
        .insert(farmLocations)
        .values({ code: codeShared, name: "Galpón Beta", type: "galpon" })
        .returning();
      expect(locB.farmId).toBe(farmBId);

      // Intento de modificar o borrar registro de Finca A desde Finca B afecta 0 filas
      const updated = await db
        .update(farmLocations)
        .set({ name: "Hackeado" })
        .where(eq(farmLocations.id, locA.id))
        .returning();
      expect(updated).toHaveLength(0);

      const cats = await db.select().from(catalogos);
      expect(cats.some((c) => c.value === `Raza-Privada-Alfa-${farmAId.slice(0, 6)}`)).toBe(false);
    });

    // Verificar en Finca A que su registro sigue intacto
    await runWithFarmContext(farmAId, async () => {
      const [stillThere] = await db.select().from(farmLocations).where(eq(farmLocations.id, locA.id));
      expect(stillThere?.name).toBe("Galpón Alfa");
    });
  });
});

