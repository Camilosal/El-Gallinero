import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { catalogos, contacts } from "@/db/schema";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import {
  computeContactStatsMap,
  hasContactOperations,
  normalizeContactInput,
  propagateContactRename,
  syncContactToCatalog,
  syncLegacyCatalogContacts,
} from "@/lib/contacts";
import { contactMatchesRole, normalizeContactNameKey } from "@/lib/contacts-shared";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  await syncLegacyCatalogContacts();

  const { searchParams } = new URL(req.url);
  const roleParam = (searchParams.get("role") || "all").trim().toLowerCase();
  const roleFilter: "cliente" | "proveedor" | "ambos" | "all" =
    roleParam === "cliente" || roleParam === "proveedor" || roleParam === "ambos"
      ? roleParam
      : "all";
  const activeOnly = searchParams.get("activeOnly") === "1";
  const includeStats = searchParams.get("includeStats") === "1";

  const rows = await db
    .select()
    .from(contacts)
    .orderBy(asc(contacts.name));

  const filtered = rows.filter((row) => {
    if (activeOnly && !row.isActive) return false;
    return contactMatchesRole(row.role, roleFilter);
  });

  if (!includeStats) {
    return NextResponse.json(filtered);
  }

  const statsMap = await computeContactStatsMap();
  const emptyStats = {
    salesCount: 0,
    totalSalesAmount: 0,
    receivablePending: 0,
    overdueReceivables: 0,
    purchasesCount: 0,
    totalPurchasesAmount: 0,
    payablePending: 0,
    overduePayables: 0,
    associatedCatalogItems: 0,
    lastActivityDate: null,
  };

  return NextResponse.json(
    filtered.map((row) => ({
      ...row,
      stats: statsMap.get(normalizeContactNameKey(row.name)) || emptyStats,
    })),
  );
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const input = normalizeContactInput(body as Record<string, unknown>, "cliente");
  if (!input.name) {
    return NextResponse.json({ error: "El nombre o razón social es requerido" }, { status: 400 });
  }

  const mergeIfExists = (body as Record<string, unknown>).mergeIfExists === true;

  const outcome = await db.transaction(async (tx) => {
    await syncLegacyCatalogContacts(tx);

    const existingRows = await tx.select().from(contacts);
    const key = normalizeContactNameKey(input.name);
    const existing = existingRows.find((row) => normalizeContactNameKey(row.name) === key);

    if (existing) {
      if (mergeIfExists) {
        const mergedRole =
          existing.role === input.role || existing.role === "ambos"
            ? existing.role
            : "ambos";
        const [updated] = await tx
          .update(contacts)
          .set({
            role: mergedRole,
            personType: input.personType || existing.personType,
            documentType: input.documentType ?? existing.documentType,
            documentNumber: input.documentNumber ?? existing.documentNumber,
            contactName: input.contactName ?? existing.contactName,
            phone: input.phone ?? existing.phone,
            whatsapp: input.whatsapp ?? existing.whatsapp,
            email: input.email ?? existing.email,
            address: input.address ?? existing.address,
            city: input.city ?? existing.city,
            department: input.department ?? existing.department,
            zone: input.zone ?? existing.zone,
            locationNotes: input.locationNotes ?? existing.locationNotes,
            categoryTag: input.categoryTag ?? existing.categoryTag,
            paymentMethod: input.paymentMethod ?? existing.paymentMethod,
            creditDays: input.creditDays > 0 ? input.creditDays : existing.creditDays,
            deliverySchedule: input.deliverySchedule ?? existing.deliverySchedule,
            notes: input.notes ?? existing.notes,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing.id))
          .returning();

        await syncContactToCatalog(tx, updated);
        return { kind: "merged" as const, record: updated };
      }

      return { kind: "conflict" as const, existing };
    }

    const [created] = await tx
      .insert(contacts)
      .values(input)
      .returning();

    await syncContactToCatalog(tx, created);
    return { kind: "created" as const, record: created };
  });

  if (outcome.kind === "conflict") {
    const roleLabel =
      outcome.existing.role === "ambos"
        ? "Cliente y Proveedor"
        : outcome.existing.role === "proveedor"
          ? "Proveedor"
          : "Cliente";
    return NextResponse.json(
      {
        error: `Ya existe un contacto llamado "${outcome.existing.name}" (${roleLabel}). Puedes seleccionarlo o editar su ficha.`,
        existingContact: outcome.existing,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(outcome.record, { status: outcome.kind === "merged" ? 200 : 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || !body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.id, String(body.id)));

    if (!existing) {
      return { kind: "not_found" as const };
    }

    const bodyRecord = body as Record<string, unknown>;
    const isStatusOnlyToggle =
      bodyRecord.name === undefined && bodyRecord.isActive !== undefined;

    const nextName = isStatusOnlyToggle
      ? existing.name
      : String(bodyRecord.name || "").trim().slice(0, 200);

    if (!nextName) {
      return { kind: "invalid" as const, error: "El nombre o razón social es requerido" };
    }

    const otherRows = await tx
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(sql`${contacts.id} <> ${existing.id}`);
    const conflict = otherRows.find(
      (row) => normalizeContactNameKey(row.name) === normalizeContactNameKey(nextName),
    );
    if (conflict) {
      return { kind: "conflict" as const, error: `Ya existe otro contacto con el nombre "${conflict.name}"` };
    }

    const input = isStatusOnlyToggle
      ? {
          name: existing.name,
          role: (existing.role as "cliente" | "proveedor" | "ambos") || "cliente",
          personType: (existing.personType as "natural" | "juridica") || "natural",
          documentType: existing.documentType,
          documentNumber: existing.documentNumber,
          contactName: existing.contactName,
          phone: existing.phone,
          whatsapp: existing.whatsapp,
          email: existing.email,
          address: existing.address,
          city: existing.city,
          department: existing.department,
          zone: existing.zone,
          locationNotes: existing.locationNotes,
          categoryTag: existing.categoryTag,
          paymentMethod: existing.paymentMethod,
          creditDays: existing.creditDays,
          deliverySchedule: existing.deliverySchedule,
          notes: existing.notes,
          isActive: Boolean(bodyRecord.isActive),
        }
      : normalizeContactInput(bodyRecord, (existing.role as "cliente" | "proveedor" | "ambos") || "cliente");

    const [updated] = await tx
      .update(contacts)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, existing.id))
      .returning();

    if (existing.name !== updated.name) {
      await propagateContactRename(tx, existing.name, updated.name);
    }

    await syncContactToCatalog(tx, updated, existing.name);
    return { kind: "updated" as const, record: updated };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }
  if (outcome.kind === "invalid") {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  if (outcome.kind === "conflict") {
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }

  return NextResponse.json(outcome.record);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(contacts).where(eq(contacts.id, id));
    if (!existing) {
      return { kind: "not_found" as const };
    }

    const used = await hasContactOperations(tx, existing.name);
    if (used) {
      const [deactivatedRecord] = await tx
        .update(contacts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      await syncContactToCatalog(tx, deactivatedRecord);
      return { kind: "deactivated" as const };
    }

    await tx
      .delete(catalogos)
      .where(and(inArray(catalogos.category, ["comprador", "proveedor"]), eq(catalogos.value, existing.name)));
    await tx.delete(contacts).where(eq(contacts.id, id));
    return { kind: "deleted" as const };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    deactivated: outcome.kind === "deactivated",
  });
});

