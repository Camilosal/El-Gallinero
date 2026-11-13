import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  GET as contactosGET,
  POST as contactosPOST,
  PUT as contactosPUT,
  DELETE as contactosDELETE,
} from "@/app/api/contactos/route";
import { POST as catalogosPOST } from "@/app/api/configuracion/catalogos/route";
import { GET as tareasGET } from "@/app/api/dashboard/tareas-pendientes/route";
import {
  accountsReceivable,
  catalogos,
  contacts,
  eggSales,
  feedInventory,
  transactions,
} from "@/db/schema";
import {
  buildWhatsAppUrl,
  computeCreditDueDate,
  contactMatchesRole,
  getContactCompleteness,
} from "@/lib/contacts-shared";
import { db, mockRequest, parseJson } from "./helpers";

const cleanupTracker = {
  contactNames: [] as string[],
  eggSaleIds: [] as string[],
  receivableIds: [] as string[],
  transactionIds: [] as string[],
  feedIds: [] as string[],
};

afterEach(async () => {
  if (cleanupTracker.eggSaleIds.length) {
    await db.delete(eggSales).where(inArray(eggSales.id, cleanupTracker.eggSaleIds));
  }
  if (cleanupTracker.receivableIds.length) {
    await db
      .delete(accountsReceivable)
      .where(inArray(accountsReceivable.id, cleanupTracker.receivableIds));
  }
  if (cleanupTracker.transactionIds.length) {
    await db
      .delete(transactions)
      .where(inArray(transactions.id, cleanupTracker.transactionIds));
  }
  if (cleanupTracker.feedIds.length) {
    await db.delete(feedInventory).where(inArray(feedInventory.id, cleanupTracker.feedIds));
  }
  if (cleanupTracker.contactNames.length) {
    await db
      .delete(catalogos)
      .where(
        and(
          inArray(catalogos.category, ["comprador", "proveedor"]),
          inArray(catalogos.value, cleanupTracker.contactNames),
        ),
      );
    await db.delete(contacts).where(inArray(contacts.name, cleanupTracker.contactNames));
  }
  cleanupTracker.contactNames = [];
  cleanupTracker.eggSaleIds = [];
  cleanupTracker.receivableIds = [];
  cleanupTracker.transactionIds = [];
  cleanupTracker.feedIds = [];
});

describe("Contactos enriquecidos (Clientes y Proveedores)", () => {
  it("calcula fechas de vencimiento, enlaces WhatsApp y porcentaje de completitud", () => {
    expect(computeCreditDueDate("2026-11-01", 15)).toBe("2026-11-16");
    expect(computeCreditDueDate("2026-11-01", 0)).toBe("2026-11-01");
    expect(buildWhatsAppUrl("310 555 1234")).toBe("https://wa.me/573105551234");
    expect(buildWhatsAppUrl("+57 315 000 0000")).toBe("https://wa.me/573150000000");

    expect(contactMatchesRole("ambos", "cliente")).toBe(true);
    expect(contactMatchesRole("ambos", "proveedor")).toBe(true);
    expect(contactMatchesRole("cliente", "proveedor")).toBe(false);

    const partial = getContactCompleteness({ name: "Solo nombre" });
    expect(partial.scorePct).toBe(0);
    expect(partial.missingFields.length).toBe(4);

    const full = getContactCompleteness({
      name: "Completo",
      phone: "3105551234",
      city: "Fusagasugá",
      documentNumber: "900123",
      paymentMethod: "credito",
      creditDays: 15,
    });
    expect(full.scorePct).toBe(100);
    expect(full.missingFields).toEqual([]);
  });

  it("migra listas legacy de catalogos y combina coincidencias en rol ambos", async () => {
    cleanupTracker.contactNames.push(
      "Tienda Legacy Test",
      "Agro Legacy Test",
      "Mixto Legacy Test",
    );

    await db.insert(catalogos).values([
      { category: "comprador", value: "Tienda Legacy Test", isActive: true },
      { category: "proveedor", value: "Agro Legacy Test", isActive: true },
      { category: "comprador", value: "Mixto Legacy Test", isActive: true },
      { category: "proveedor", value: "Mixto Legacy Test", isActive: true },
    ]);

    const res = await contactosGET(mockRequest("http://localhost/api/contactos"));
    expect(res.status).toBe(200);
    const list = await parseJson(res);

    const client = list.find((c: { name: string }) => c.name === "Tienda Legacy Test");
    const supplier = list.find((c: { name: string }) => c.name === "Agro Legacy Test");
    const both = list.find((c: { name: string }) => c.name === "Mixto Legacy Test");

    expect(client?.role).toBe("cliente");
    expect(supplier?.role).toBe("proveedor");
    expect(both?.role).toBe("ambos");
  });

  it("crea fichas completas, sincroniza catalogos, fusiona duplicados, propaga renombrados y protege el historial", async () => {
    const initialName = "Restaurante La Vereda Test";
    const renamedName = "Restaurante Vereda Renombrado";
    const tempName = "Contacto Temporal Sin Uso Test";
    const fromCatalogName = "Veterinaria Desde Lista Test";
    cleanupTracker.contactNames.push(initialName, renamedName, tempName, fromCatalogName);

    // 1. Creación completa como cliente
    const createRes = await contactosPOST(
      mockRequest("http://localhost/api/contactos", {
        method: "POST",
        body: {
          name: initialName,
          role: "cliente",
          personType: "juridica",
          documentType: "NIT",
          documentNumber: "900123456-7",
          contactName: "María Gómez",
          phone: "3105551234",
          whatsapp: "3105551234",
          email: "compras@vereda.co",
          address: "Km 4 vía Pasca",
          city: "Fusagasugá",
          department: "Cundinamarca",
          zone: "Vereda El Rosal",
          categoryTag: "Restaurante / Panadería",
          paymentMethod: "credito",
          creditDays: 15,
          deliverySchedule: "Martes y Viernes 7am",
        },
      }),
    );
    expect(createRes.status).toBe(201);
    const created = await parseJson(createRes);
    expect(created.city).toBe("Fusagasugá");
    expect(created.creditDays).toBe(15);

    const syncedClientCat = await db
      .select()
      .from(catalogos)
      .where(and(eq(catalogos.category, "comprador"), eq(catalogos.value, initialName)));
    expect(syncedClientCat).toHaveLength(1);

    // 2. Conflicto 409 por nombre duplicado + fusión con mergeIfExists a "ambos"
    const conflictRes = await contactosPOST(
      mockRequest("http://localhost/api/contactos", {
        method: "POST",
        body: { name: "  restaurante la vereda test  ", role: "proveedor" },
      }),
    );
    expect(conflictRes.status).toBe(409);
    const conflictBody = await parseJson(conflictRes);
    expect(conflictBody.existingContact?.id).toBe(created.id);

    const mergeRes = await contactosPOST(
      mockRequest("http://localhost/api/contactos", {
        method: "POST",
        body: {
          name: initialName,
          role: "proveedor",
          notes: "También provee cubetas",
          mergeIfExists: true,
        },
      }),
    );
    expect(mergeRes.status).toBe(200);
    const merged = await parseJson(mergeRes);
    expect(merged.role).toBe("ambos");
    expect(merged.phone).toBe("3105551234");
    expect(merged.creditDays).toBe(15);

    const syncedSupplierCat = await db
      .select()
      .from(catalogos)
      .where(and(eq(catalogos.category, "proveedor"), eq(catalogos.value, initialName)));
    expect(syncedSupplierCat).toHaveLength(1);

    // 3. Operaciones históricas para estadísticas y propagación al renombrar
    const [saleRow] = await db
      .insert(eggSales)
      .values({
        date: "2026-11-10",
        quantity: 60,
        pricePerUnit: "750",
        totalAmount: "45000",
        buyer: initialName,
      })
      .returning();
    cleanupTracker.eggSaleIds.push(saleRow.id);

    const [saleTxRow] = await db
      .insert(transactions)
      .values({
        date: "2026-11-10",
        type: "ingreso",
        category: "Venta de huevos",
        description: "Venta huevos prueba",
        amount: "45000",
        counterparty: initialName,
        sourceType: "venta_huevo",
        sourceId: saleRow.id,
      })
      .returning();
    cleanupTracker.transactionIds.push(saleTxRow.id);

    const [arRow] = await db
      .insert(accountsReceivable)
      .values({
        transactionId: saleTxRow.id,
        buyer: initialName,
        totalAmount: "45000",
        paidAmount: "0",
        pendingAmount: "45000",
        dueDate: "2024-01-01",
        status: "pendiente",
      })
      .returning();
    cleanupTracker.receivableIds.push(arRow.id);

    const [txRow] = await db
      .insert(transactions)
      .values({
        date: "2026-11-11",
        type: "egreso",
        category: "Compra de insumos",
        description: "Cubetas recicladas",
        amount: "12000",
        counterparty: initialName,
      })
      .returning();
    cleanupTracker.transactionIds.push(txRow.id);

    const [feedRow] = await db
      .insert(feedInventory)
      .values({
        name: "Maíz molido prueba",
        category: "Concentrado",
        feedType: "concentrado_comercial",
        unit: "kg",
        currentStock: "10",
        minStock: "5",
        costPerUnit: "2500",
        supplier: initialName,
      })
      .returning();
    cleanupTracker.feedIds.push(feedRow.id);

    const statsRes = await contactosGET(
      mockRequest("http://localhost/api/contactos?includeStats=1"),
    );
    expect(statsRes.status).toBe(200);
    const statsList = await parseJson(statsRes);
    const withStats = statsList.find((c: { id: string }) => c.id === created.id);
    expect(withStats.stats.salesCount).toBe(1);
    expect(withStats.stats.totalSalesAmount).toBe(45000);
    expect(withStats.stats.receivablePending).toBe(45000);
    expect(withStats.stats.overdueReceivables).toBe(1);
    expect(withStats.stats.purchasesCount).toBe(1);
    expect(withStats.stats.totalPurchasesAmount).toBe(12000);
    expect(withStats.stats.associatedCatalogItems).toBe(1);

    // 4. Renombrar propaga a tablas históricas y catálogos
    const renameRes = await contactosPUT(
      mockRequest("http://localhost/api/contactos", {
        method: "PUT",
        body: { ...merged, id: created.id, name: renamedName },
      }),
    );
    expect(renameRes.status).toBe(200);

    const [renamedSale] = await db.select().from(eggSales).where(eq(eggSales.id, saleRow.id));
    const [renamedAr] = await db
      .select()
      .from(accountsReceivable)
      .where(eq(accountsReceivable.id, arRow.id));
    const [renamedTx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txRow.id));
    const [renamedFeed] = await db
      .select()
      .from(feedInventory)
      .where(eq(feedInventory.id, feedRow.id));

    expect(renamedSale.buyer).toBe(renamedName);
    expect(renamedAr.buyer).toBe(renamedName);
    expect(renamedTx.counterparty).toBe(renamedName);
    expect(renamedFeed.supplier).toBe(renamedName);

    // 5. Eliminar contacto con historial -> desactiva; sin historial -> elimina
    const softDelRes = await contactosDELETE(
      mockRequest(`http://localhost/api/contactos?id=${created.id}`, { method: "DELETE" }),
    );
    expect(softDelRes.status).toBe(200);
    expect((await parseJson(softDelRes)).deactivated).toBe(true);

    const [inactiveContact] = await db.select().from(contacts).where(eq(contacts.id, created.id));
    expect(inactiveContact.isActive).toBe(false);

    const tempRes = await contactosPOST(
      mockRequest("http://localhost/api/contactos", {
        method: "POST",
        body: { name: tempName, role: "cliente" },
      }),
    );
    const temp = await parseJson(tempRes);
    const hardDelRes = await contactosDELETE(
      mockRequest(`http://localhost/api/contactos?id=${temp.id}`, { method: "DELETE" }),
    );
    expect(hardDelRes.status).toBe(200);
    expect((await parseJson(hardDelRes)).deactivated).toBe(false);

    // 6. Compatibilidad: alta vía /api/configuracion/catalogos sincroniza hacia contacts
    const legacyPostRes = await catalogosPOST(
      mockRequest("http://localhost/api/configuracion/catalogos", {
        method: "POST",
        body: { category: "proveedor", value: fromCatalogName },
      }),
    );
    expect(legacyPostRes.status).toBe(201);
    const [syncedContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.name, fromCatalogName));
    expect(syncedContact?.role).toBe("proveedor");

    // 7. Checklist de preparación reconoce contactos configurados
    const tareasRes = await tareasGET(mockRequest("http://localhost/api/dashboard/tareas-pendientes"));
    expect(tareasRes.status).toBe(200);
    const tareasBody = await parseJson(tareasRes);
    expect(typeof tareasBody.setup.contactsConfigured).toBe("boolean");
  });
});

