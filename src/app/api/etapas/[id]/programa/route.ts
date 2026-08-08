import { db } from "@/db";
import { feedPrograms, feedInventory, catalogos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/etapas/[id]/programa — lista el programa alimenticio de una etapa */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await db
    .select({
      id: feedPrograms.id,
      stageCatalogoId: feedPrograms.stageCatalogoId,
      feedId: feedPrograms.feedId,
      feedName: feedInventory.name,
      feedUnit: feedInventory.unit,
      percentage: feedPrograms.percentage,
      dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
      createdAt: feedPrograms.createdAt,
      updatedAt: feedPrograms.updatedAt,
    })
    .from(feedPrograms)
    .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
    .where(eq(feedPrograms.stageCatalogoId, id));
  return NextResponse.json(data);
}

/** POST /api/etapas/[id]/programa — agregar o actualizar entradas del programa */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageCatalogoId } = await params;
  const body = await req.json();

  // Validar que la etapa existe
  const [stage] = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.id, stageCatalogoId), eq(catalogos.category, "etapa_crecimiento")));
  if (!stage) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
  }

  // body.entries = [{ feedId, percentage, dailyAmountPerHen }]
  const entries: { feedId: string; percentage: string; dailyAmountPerHen: string }[] = body.entries || [];
  if (entries.length === 0) {
    return NextResponse.json({ error: "Debe enviar al menos una entrada de programa" }, { status: 400 });
  }

  // Upsert: eliminar entradas existentes para esta etapa y re-insertar
  await db.delete(feedPrograms).where(eq(feedPrograms.stageCatalogoId, stageCatalogoId));

  const inserted = await db
    .insert(feedPrograms)
    .values(
      entries.map((e) => ({
        stageCatalogoId,
        feedId: e.feedId,
        percentage: e.percentage,
        dailyAmountPerHen: e.dailyAmountPerHen,
        updatedAt: new Date(),
      }))
    )
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}

/** DELETE /api/etapas/[id]/programa — eliminar una entrada específica del programa */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageCatalogoId } = await params;
  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) {
    return NextResponse.json({ error: "programId requerido" }, { status: 400 });
  }
  await db
    .delete(feedPrograms)
    .where(and(eq(feedPrograms.id, programId), eq(feedPrograms.stageCatalogoId, stageCatalogoId)));
  return NextResponse.json({ ok: true });
}
