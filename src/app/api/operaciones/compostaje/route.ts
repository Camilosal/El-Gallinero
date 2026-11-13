import { db } from "@/db";
import { compostingPiles, farmLocations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { addDaysIso, isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { requirePermission } from "@/lib/rbac-server";
import { assertDateNotClosed } from "@/lib/sanitary-locks";

export const dynamic = "force-dynamic";

export function suggestCarbonKg(formulaRatio: string, manureKg: number, mortalityKg: number): number {
  const m = Math.max(0, Number(manureKg) || 0);
  const mort = Math.max(0, Number(mortalityKg) || 0);
  if (formulaRatio === "3:1:1") {
    // 3 partes cama/gallinaza : 1 mortalidad : 1 material carbonoso
    return Number((m > 0 ? m / 3 : mort).toFixed(2));
  }
  if (formulaRatio === "7:2:2") {
    // 7 partes cama/gallinaza : 2 mortalidad : 2 material carbonoso
    return Number((m > 0 ? (m * 2) / 7 : mort).toFixed(2));
  }
  return Number(((m + mort) * 0.3).toFixed(2));
}

function evaluatePileAlerts(pile: {
  currentTempC: string | number | null;
  moisturePct: string | number | null;
  status: string;
  nextTurnDueDate: string | null;
  expectedHarvestDate: string | null;
}, today: string): string[] {
  const alerts: string[] = [];
  const temp = pile.currentTempC != null ? Number(pile.currentTempC) : null;
  const moist = pile.moisturePct != null ? Number(pile.moisturePct) : null;

  if (temp != null && temp > 70) {
    alerts.push(`Sobrecalentamiento (${temp}°C > 70°C): realizar volteo urgente para oxigenar`);
  }
  if (moist != null && pile.status === "cosechada" && moist > 20) {
    alerts.push(`Humedad de cosecha (${moist}% > 20%): secar antes de embolsar o aplicar`);
  }
  if (moist != null && pile.status === "madurando" && moist > 20) {
    alerts.push(`Humedad actual ${moist}%: esperar estabilización ≤20% para cosecha final`);
  }
  if (pile.status !== "cosechada" && pile.nextTurnDueDate && pile.nextTurnDueDate <= today) {
    alerts.push(`Volteo programado pendiente (desde ${pile.nextTurnDueDate})`);
  }
  if (pile.status !== "cosechada" && pile.expectedHarvestDate && pile.expectedHarvestDate <= today) {
    alerts.push(`Cumplió 8 semanas (${pile.expectedHarvestDate}): lista para validar humedad y cosechar`);
  }
  return alerts;
}

export const GET = withApiHandler(async () => {
  const today = todayColombiaIso();
  const [piles, locations] = await Promise.all([
    db.select().from(compostingPiles).orderBy(desc(compostingPiles.startDate), desc(compostingPiles.createdAt)),
    db.select().from(farmLocations),
  ]);
  const locMap = new Map(locations.map((l) => [l.id, l.name]));

  const rows = piles.map((p) => {
    const alerts = evaluatePileAlerts(p, today);
    return {
      ...p,
      locationName: p.locationId ? locMap.get(p.locationId) || null : null,
      alerts,
    };
  });

  return NextResponse.json({
    piles: rows,
    summary: {
      total: rows.length,
      active: rows.filter((p) => p.status === "activa" || p.status === "madurando" || p.status === "alerta").length,
      harvested: rows.filter((p) => p.status === "cosechada").length,
      harvestedTotalKg: Number(rows.reduce((s, p) => s + (Number(p.harvestedKg) || 0), 0).toFixed(2)),
      alertsCount: rows.filter((p) => p.alerts.length > 0).length,
    },
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("production:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!isDateOnly(body.startDate)) {
    return NextResponse.json({ error: "Fecha de inicio inválida" }, { status: 400 });
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nombre de pila requerido" }, { status: 400 });
  }

  const formulaRatio = ["3:1:1", "7:2:2", "otra"].includes(String(body.formulaRatio || "3:1:1"))
    ? String(body.formulaRatio || "3:1:1")
    : "3:1:1";
  const manureKg = Math.max(0, Number(body.manureKg ?? 0));
  const mortalityKg = Math.max(0, Number(body.mortalityKg ?? 0));
  if (!Number.isFinite(manureKg) || !Number.isFinite(mortalityKg) || manureKg + mortalityKg <= 0) {
    return NextResponse.json({ error: "Ingresa al menos gallinaza o mortalidad > 0 kg" }, { status: 400 });
  }

  const carbonMaterialKg = body.carbonMaterialKg !== undefined && body.carbonMaterialKg !== null && body.carbonMaterialKg !== ""
    ? Math.max(0, Number(body.carbonMaterialKg))
    : suggestCarbonKg(formulaRatio, manureKg, mortalityKg);

  const currentTempC = body.currentTempC !== undefined && body.currentTempC !== null && body.currentTempC !== ""
    ? Number(body.currentTempC)
    : null;
  const moisturePct = body.moisturePct !== undefined && body.moisturePct !== null && body.moisturePct !== ""
    ? Number(body.moisturePct)
    : null;

  const startDate = String(body.startDate);
  const nextTurnDueDate = addDaysIso(startDate, 7);
  const expectedHarvestDate = addDaysIso(startDate, 56); // 8 semanas
  const code = typeof body.code === "string" && body.code.trim()
    ? body.code.trim().slice(0, 50)
    : `COMP-${startDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const status = currentTempC != null && currentTempC > 70 ? "alerta" : "activa";

  const created = await db.transaction(async (tx) => {
    await assertDateNotClosed(tx, { date: startDate });
    const [row] = await tx.insert(compostingPiles).values({
      code,
      name,
      startDate,
      locationId: typeof body.locationId === "string" && body.locationId ? body.locationId : null,
      species: typeof body.species === "string" && body.species ? body.species : null,
      formulaRatio,
      manureKg: manureKg.toFixed(2),
      mortalityKg: mortalityKg.toFixed(2),
      carbonMaterialKg: carbonMaterialKg.toFixed(2),
      carbonMaterialType: typeof body.carbonMaterialType === "string" && body.carbonMaterialType.trim() ? body.carbonMaterialType.trim() : "Cascarilla / aserrín",
      currentTempC: currentTempC != null && Number.isFinite(currentTempC) ? currentTempC.toFixed(1) : null,
      moisturePct: moisturePct != null && Number.isFinite(moisturePct) ? moisturePct.toFixed(1) : null,
      turnCount: 0,
      nextTurnDueDate,
      expectedHarvestDate,
      status,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    }).returning();
    return row;
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("production:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const today = todayColombiaIso();
  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(compostingPiles).where(eq(compostingPiles.id, body.id)).limit(1);
    if (!existing) throw new Error("No encontrado");

    const action = typeof body.action === "string" ? body.action : "update";
    const actionDate = isDateOnly(body.actionDate) ? String(body.actionDate) : today;
    await assertDateNotClosed(tx, { date: actionDate });

    const nextTemp = body.currentTempC !== undefined && body.currentTempC !== null && body.currentTempC !== ""
      ? Number(body.currentTempC)
      : existing.currentTempC != null ? Number(existing.currentTempC) : null;
    const nextMoisture = body.moisturePct !== undefined && body.moisturePct !== null && body.moisturePct !== ""
      ? Number(body.moisturePct)
      : existing.moisturePct != null ? Number(existing.moisturePct) : null;

    let status = typeof body.status === "string" ? body.status : existing.status;
    let turnCount = existing.turnCount;
    let lastTurnDate = existing.lastTurnDate;
    let nextTurnDueDate = existing.nextTurnDueDate;
    let harvestedKg = existing.harvestedKg;

    if (action === "turn") {
      turnCount += 1;
      lastTurnDate = actionDate;
      nextTurnDueDate = addDaysIso(actionDate, 7);
      if (turnCount >= 4 && status === "activa") status = "madurando";
    } else if (action === "harvest") {
      const hKg = Number(body.harvestedKg ?? 0);
      if (!Number.isFinite(hKg) || hKg <= 0) {
        throw new Error("Cantidad inválida de compost cosechado");
      }
      harvestedKg = hKg.toFixed(2);
      status = "cosechada";
      nextTurnDueDate = null;
    }

    if (nextTemp != null && nextTemp > 70 && status !== "cosechada") {
      status = "alerta";
    } else if (status === "alerta" && (nextTemp == null || nextTemp <= 70)) {
      status = turnCount >= 4 ? "madurando" : "activa";
    }

    const [row] = await tx.update(compostingPiles).set({
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
      currentTempC: nextTemp != null ? nextTemp.toFixed(1) : null,
      moisturePct: nextMoisture != null ? nextMoisture.toFixed(1) : null,
      turnCount,
      lastTurnDate,
      nextTurnDueDate,
      status,
      harvestedKg,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : existing.notes,
      updatedAt: new Date(),
    }).where(eq(compostingPiles.id, body.id)).returning();

    return row;
  });

  return NextResponse.json({
    ...updated,
    alerts: evaluatePileAlerts(updated, today),
  });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("sanitary:write");
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(compostingPiles).where(eq(compostingPiles.id, id)).limit(1);
    if (!existing) throw new Error("No encontrado");
    await assertDateNotClosed(tx, { date: existing.startDate });
    await tx.delete(compostingPiles).where(eq(compostingPiles.id, id));
  });

  return NextResponse.json({ ok: true });
});
