import { db } from "@/db";
import { breedWeightStandards } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const breed = searchParams.get("breed");
  const gender = searchParams.get("gender");

  const conditions = [];
  if (breed) conditions.push(eq(breedWeightStandards.breed, breed));
  if (gender) conditions.push(eq(breedWeightStandards.gender, gender));

  const rows = conditions.length
    ? await db.select().from(breedWeightStandards).where(and(...conditions))
        .orderBy(asc(breedWeightStandards.breed), asc(breedWeightStandards.gender), asc(breedWeightStandards.weekNumber))
    : await db.select().from(breedWeightStandards)
        .orderBy(asc(breedWeightStandards.breed), asc(breedWeightStandards.gender), asc(breedWeightStandards.weekNumber));

  return NextResponse.json(rows);
});

function normalize(body: Record<string, unknown>) {
  return {
    breed: String(body.breed || "").trim(),
    gender: String(body.gender || "hembra").trim(),
    weekNumber: Number(body.weekNumber),
    targetWeightG: String(body.targetWeightG ?? ""),
    minWeightG: body.minWeightG === "" || body.minWeightG == null ? null : String(body.minWeightG),
    maxWeightG: body.maxWeightG === "" || body.maxWeightG == null ? null : String(body.maxWeightG),
  };
}

function validate(data: ReturnType<typeof normalize>): string | null {
  if (!data.breed) return "La raza es requerida";
  if (!Number.isInteger(data.weekNumber) || data.weekNumber < 0) return "La semana debe ser un entero mayor o igual a 0";
  if (!data.targetWeightG || Number.isNaN(Number(data.targetWeightG)) || Number(data.targetWeightG) <= 0) {
    return "El peso objetivo debe ser un número mayor a 0";
  }
  return null;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const data = normalize(body);
  const error = validate(data);
  if (error) return NextResponse.json({ error }, { status: 400 });

  try {
    const [created] = await db.insert(breedWeightStandards).values(data).returning();
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe un estándar para esa raza, sexo y semana" }, { status: 409 });
  }
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const data = normalize(body);
  const error = validate(data);
  if (error) return NextResponse.json({ error }, { status: 400 });

  try {
    const [updated] = await db
      .update(breedWeightStandards)
      .set(data)
      .where(eq(breedWeightStandards.id, body.id))
      .returning();

    if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Ya existe un estándar para esa raza, sexo y semana" }, { status: 409 });
  }
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.delete(breedWeightStandards).where(eq(breedWeightStandards.id, id));
  return NextResponse.json({ ok: true });
});
