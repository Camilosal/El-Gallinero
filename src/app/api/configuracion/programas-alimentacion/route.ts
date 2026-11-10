import { db } from "@/db";
import { catalogos, feedInventory, feedPrograms } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const [stages, feeds, programs] = await Promise.all([
    db.select().from(catalogos)
      .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
      .orderBy(asc(catalogos.sortOrder), asc(catalogos.value)),
    db.select().from(feedInventory).orderBy(asc(feedInventory.name)),
    db.select({
      id: feedPrograms.id,
      stageCatalogoId: feedPrograms.stageCatalogoId,
      feedId: feedPrograms.feedId,
      feedName: feedInventory.name,
      feedUnit: feedInventory.unit,
      percentage: feedPrograms.percentage,
      dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
    }).from(feedPrograms)
      .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
      .orderBy(asc(feedPrograms.stageCatalogoId)),
  ]);

  return NextResponse.json({
    stages: stages.map((s) => ({ id: s.id, value: s.value })),
    feeds: feeds.map((f) => ({ id: f.id, name: f.name, unit: f.unit })),
    programs,
  });
});

function normalize(body: Record<string, unknown>) {
  return {
    stageCatalogoId: String(body.stageCatalogoId || ""),
    feedId: String(body.feedId || ""),
    percentage: String(body.percentage ?? "0"),
    dailyAmountPerHen: String(body.dailyAmountPerHen ?? "0"),
  };
}

function validate(data: ReturnType<typeof normalize>): string | null {
  if (!data.stageCatalogoId) return "La etapa es requerida";
  if (!data.feedId) return "El alimento es requerido";
  const percentage = Number(data.percentage);
  const daily = Number(data.dailyAmountPerHen);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return "El porcentaje debe estar entre 0 y 100";
  if (!Number.isFinite(daily) || daily < 0) return "El consumo diario debe ser mayor o igual a 0";
  return null;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const data = normalize(body);
  const error = validate(data);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const [created] = await db.insert(feedPrograms).values(data).returning();
  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const data = normalize(body);
  const error = validate(data);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const [updated] = await db
    .update(feedPrograms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(feedPrograms.id, body.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.delete(feedPrograms).where(eq(feedPrograms.id, id));
  return NextResponse.json({ ok: true });
});
