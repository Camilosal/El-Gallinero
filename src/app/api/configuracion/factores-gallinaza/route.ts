import { db } from "@/db";
import { catalogos, manureFactors } from "@/db/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

interface ManureFactorGroup {
  id: string;
  key: string;
  label: string;
  birdGroup: string;
  stageCatalogoId: string | null;
  kgPerBirdPerDay: number;
}

async function ensureFactor(stageCatalogoId: string | null, birdGroup: string): Promise<void> {
  const existing = stageCatalogoId
    ? await db.select().from(manureFactors).where(
        and(eq(manureFactors.stageCatalogoId, stageCatalogoId), eq(manureFactors.birdGroup, birdGroup)),
      )
    : await db.select().from(manureFactors).where(
        and(isNull(manureFactors.stageCatalogoId), eq(manureFactors.birdGroup, birdGroup)),
      );

  if (existing.length === 0) {
    await db.insert(manureFactors).values({
      stageCatalogoId,
      birdGroup,
      kgPerBirdPerDay: "0",
    }).onConflictDoNothing();
  }
}

export const GET = withApiHandler(async () => {
  const stages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(asc(catalogos.sortOrder), asc(catalogos.value));

  // Asegurar que cada grupo tenga un factor editable.
  for (const stage of stages) {
    await ensureFactor(stage.id, "etapa");
  }
  await ensureFactor(null, "gallo");
  await ensureFactor(null, "lote");

  const factors = await db.select().from(manureFactors);
  const byStage = new Map(factors.filter((f) => f.stageCatalogoId).map((f) => [f.stageCatalogoId as string, f]));
  const galloFactor = factors.find((f) => !f.stageCatalogoId && f.birdGroup === "gallo");
  const loteFactor = factors.find((f) => !f.stageCatalogoId && f.birdGroup === "lote");

  const groups: ManureFactorGroup[] = [
    ...stages.map((stage) => {
      const factor = byStage.get(stage.id);
      return {
        id: factor?.id || "",
        key: stage.id,
        label: stage.value,
        birdGroup: "etapa",
        stageCatalogoId: stage.id,
        kgPerBirdPerDay: Number(factor?.kgPerBirdPerDay || 0),
      };
    }),
    {
      id: galloFactor?.id || "",
      key: "gallo",
      label: "Gallos",
      birdGroup: "gallo",
      stageCatalogoId: null,
      kgPerBirdPerDay: Number(galloFactor?.kgPerBirdPerDay || 0),
    },
    {
      id: loteFactor?.id || "",
      key: "lote",
      label: "Lotes de engorde / otras especies",
      birdGroup: "lote",
      stageCatalogoId: null,
      kgPerBirdPerDay: Number(loteFactor?.kgPerBirdPerDay || 0),
    },
  ];

  return NextResponse.json(groups);
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const kg = Number(body.kgPerBirdPerDay);
  if (!Number.isFinite(kg) || kg < 0) {
    return NextResponse.json({ error: "El factor debe ser un número mayor o igual a 0" }, { status: 400 });
  }

  const [updated] = await db
    .update(manureFactors)
    .set({ kgPerBirdPerDay: kg.toFixed(3), updatedAt: new Date() })
    .where(eq(manureFactors.id, body.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Factor no encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});
