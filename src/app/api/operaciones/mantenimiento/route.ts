import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { maintenance, transactions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts, upsertExpenseTransaction } from "@/lib/financial-records";

export const dynamic = "force-dynamic";

const MAINTENANCE_STATUSES = new Set(["pendiente", "en_progreso", "completado"]);


function validateMaintenanceInput(input: { title?: unknown; scheduledDate?: unknown; completedDate?: unknown; status?: unknown; cost?: unknown }) {
  if (typeof input.title !== "string" || !input.title.trim()) return "Título requerido";
  if (!isDateOnly(input.scheduledDate)) return "Fecha programada inválida";
  if (input.completedDate !== undefined && input.completedDate !== null && input.completedDate !== "" && !isDateOnly(input.completedDate)) {
    return "Fecha completada inválida";
  }
  if (!MAINTENANCE_STATUSES.has(String(input.status))) return "Estado de mantenimiento inválido";
  const cost = Number(input.cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) return "Costo inválido";
  return null;
}

export const GET = withApiHandler(async () => {
  const data = await db.select().from(maintenance).orderBy(desc(maintenance.scheduledDate));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const values = {
    title: typeof body.title === "string" ? body.title.trim() : body.title,
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    scheduledDate: body.scheduledDate,
    completedDate: body.completedDate || null,
    status: body.status || "pendiente",
    cost: Number(body.cost ?? 0).toFixed(2),
  };
  const error = validateMaintenanceInput(values);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(maintenance).values(values).returning();
    await upsertExpenseTransaction(tx, {
      condition: and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, row.id)),
      date: values.completedDate || values.scheduledDate,
      category: "Mantenimiento",
      description: `Mantenimiento: ${values.title}`,
      amount: values.status === "completado" ? values.cost : "0",
      sourceType: "mantenimiento",
      sourceId: row.id,
    });
    return row;
  });
  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const inputError = validateMaintenanceInput(body);
  if (inputError) return NextResponse.json({ error: inputError }, { status: 400 });

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(maintenance).where(eq(maintenance.id, body.id)).for("update");
    if (!existing) throw new Error("No encontrado");
    const [updated] = await tx.update(maintenance).set({
      title: body.title.trim(),
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      scheduledDate: body.scheduledDate,
      completedDate: body.completedDate || null,
      status: body.status,
      cost: Number(body.cost ?? 0).toFixed(2),
    }).where(eq(maintenance.id, body.id)).returning();

    if (!updated) throw new Error("No encontrado");

    // Sync one source expense in place; avoid duplicate rows and preserve credit links.
    await upsertExpenseTransaction(tx, {
      condition: and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, body.id)),
      date: body.completedDate || body.scheduledDate,
      category: "Mantenimiento",
      description: `Mantenimiento: ${body.title}`,
      amount: body.status === "completado" ? Number(body.cost ?? 0).toFixed(2) : "0",
      sourceType: "mantenimiento",
      sourceId: body.id,
    });

    return updated;
    });
  } catch (e: any) {
    if (e.message === "No encontrado") {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json(result);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(maintenance).where(eq(maintenance.id, id));
    await deleteTransactionsAndUnpaidAccounts(
      tx,
      and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, id)),
    );
  });
  return NextResponse.json({ ok: true });
});
