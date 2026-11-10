import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { manureProduction } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockAndReadManureStock } from "@/lib/manure-stock";
import { AUTO_MANURE_SOURCE, isTodayOrEarlierManureDate } from "@/lib/manure";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async () => {
  const data = await db.select().from(manureProduction).orderBy(desc(manureProduction.date));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date)) return NextResponse.json({ error: "Fecha inválida o futura" }, { status: 400 });
  const kgProduced = Number(Number(body.kgProduced).toFixed(2));
  if (!Number.isFinite(kgProduced) || kgProduced <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (body.source === AUTO_MANURE_SOURCE) {
    return NextResponse.json({ error: "El origen de acumulación automática está reservado" }, { status: 400 });
  }

  const [created] = await db.transaction(async (tx) => {
    await lockAndReadManureStock(tx);
    return tx.insert(manureProduction).values({
      date: body.date,
      kgProduced: kgProduced.toFixed(2),
      source: body.source || "estimado",
      notes: body.notes || null,
    }).returning();
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date)) return NextResponse.json({ error: "Fecha inválida o futura" }, { status: 400 });

  const kgProduced = Number(Number(body.kgProduced).toFixed(2));
  if (!Number.isFinite(kgProduced) || kgProduced <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const stock = await lockAndReadManureStock(tx);
    const [current] = await tx.select().from(manureProduction).where(eq(manureProduction.id, body.id));
    if (!current) return { status: "missing" as const };
    if (current.source === AUTO_MANURE_SOURCE) return { status: "protected" as const };
    if (stock - Number(current.kgProduced) + kgProduced < -0.001) {
      throw new Error("No se puede reducir la producción por debajo de la gallinaza ya vendida");
    }
    const [updated] = await tx.update(manureProduction).set({
      date: body.date,
      kgProduced: kgProduced.toFixed(2),
      source: body.source || "estimado",
      notes: body.notes || null,
    }).where(eq(manureProduction.id, body.id)).returning();
    return { status: "updated" as const, updated };
  });

  if (result.status === "missing") return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (result.status === "protected") return NextResponse.json({ error: "La acumulación automática no se puede editar" }, { status: 409 });

  return NextResponse.json(result.updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const stock = await lockAndReadManureStock(tx);
    const [production] = await tx.select().from(manureProduction).where(eq(manureProduction.id, id));
    if (!production) return "missing" as const;
    if (production.source === AUTO_MANURE_SOURCE) return "protected" as const;
    if (stock - Number(production.kgProduced) < -0.001) {
      throw new Error("No se puede eliminar una producción con gallinaza ya vendida");
    }
    await tx.delete(manureProduction).where(eq(manureProduction.id, id));
    return "deleted" as const;
  });
  if (result === "missing") return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (result === "protected") return NextResponse.json({ error: "La acumulación automática no se puede eliminar" }, { status: 409 });
  return NextResponse.json({ ok: true });
});
