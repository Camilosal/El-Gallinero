import { db } from "@/db";
import { vaccinationTemplates } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get("species");
  const breed = searchParams.get("breed");

  const conditions = [];
  if (species) conditions.push(eq(vaccinationTemplates.species, species));
  if (breed) conditions.push(eq(vaccinationTemplates.breed, breed));

  const rows = conditions.length
    ? await db.select().from(vaccinationTemplates).where(and(...conditions))
        .orderBy(asc(vaccinationTemplates.species), asc(vaccinationTemplates.breed), asc(vaccinationTemplates.weekNumber))
    : await db.select().from(vaccinationTemplates)
        .orderBy(asc(vaccinationTemplates.species), asc(vaccinationTemplates.breed), asc(vaccinationTemplates.weekNumber));

  return NextResponse.json(rows);
});

function normalize(body: Record<string, unknown>) {
  return {
    species: String(body.species || "gallina").trim(),
    breed: String(body.breed || "").trim(),
    weekNumber: Number(body.weekNumber),
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description) : null,
    type: String(body.type || "vacunacion"),
    frequencyDays: body.frequencyDays === "" || body.frequencyDays == null ? null : Number(body.frequencyDays),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const data = normalize(body);

  if (!data.name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (!Number.isInteger(data.weekNumber) || data.weekNumber < 0) {
    return NextResponse.json({ error: "La semana debe ser un entero mayor o igual a 0" }, { status: 400 });
  }

  try {
    const [created] = await db.insert(vaccinationTemplates).values(data).returning();
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe una plantilla con esa especie, raza, semana y nombre" }, { status: 409 });
  }
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const data = normalize(body);
  if (!data.name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (!Number.isInteger(data.weekNumber) || data.weekNumber < 0) {
    return NextResponse.json({ error: "La semana debe ser un entero mayor o igual a 0" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(vaccinationTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vaccinationTemplates.id, body.id))
      .returning();

    if (!updated) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Ya existe una plantilla con esa especie, raza, semana y nombre" }, { status: 409 });
  }
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.delete(vaccinationTemplates).where(eq(vaccinationTemplates.id, id));
  return NextResponse.json({ ok: true });
});
