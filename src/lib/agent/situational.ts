import { db } from "@/db";
import {
  accountsPayable,
  accountsReceivable,
  broilerBatches,
  compostingPiles,
  dailyClosures,
  farmLocations,
  feedInventory,
  healthControl,
  hens,
  maintenance,
  roosters,
  sanitaryCalendar,
  sensorReadings,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";

export interface SituationalSnapshot {
  dateIso: string;
  activeHens: number;
  activeRoosters: number;
  activeBatches: number;
  batchAnimals: number;
  activeLocations: number;
  overdueRoutines: Array<{ id: string; name: string; nextDueDate: string }>;
  dueSoonRoutines: Array<{ id: string; name: string; nextDueDate: string }>;
  activeWithdrawals: Array<{ species: string | null; product: string | null; until: string }>;
  lowStockFeeds: Array<{ name: string; stock: string; minStock: string; unit: string }>;
  compostingAlerts: Array<{ code: string; name: string; status: string; nextTurnDueDate: string | null }>;
  sensorAlertsRecent: Array<{ metricType: string; value: string; unit: string; ithIndex: string | null }>;
  overdueMaintenance: Array<{ title: string; scheduledDate: string }>;
  overdueReceivablesCount: number;
  overduePayablesCount: number;
  todayClosed: boolean;
}

function todayBogotaIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(baseIso: string, deltaDays: number): string {
  const date = new Date(`${baseIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export async function getLiveSituationalSnapshot(): Promise<SituationalSnapshot | null> {
  try {
    const todayIso = todayBogotaIso();
    const soonIso = addDaysIso(todayIso, 3);
    const recentSince = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [
      henCountRow,
      roosterCountRow,
      batchSummaryRow,
      locationCountRow,
      routineRows,
      withdrawalRows,
      lowFeedRows,
      compostRows,
      sensorAlertRows,
      maintRows,
      arOverdueRow,
      apOverdueRow,
      closureRow,
    ] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(hens)
        .where(inArray(hens.status, ["activa", "empollando", "enferma", "recomendada_sacrificio"])),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(roosters)
        .where(inArray(roosters.status, ["activo", "enfermo"])),
      db
        .select({
          batches: sql<number>`count(*)::int`,
          animals: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}), 0)::int`,
        })
        .from(broilerBatches)
        .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(farmLocations)
        .where(eq(farmLocations.status, "activa")),
      db
        .select({
          id: sanitaryCalendar.id,
          name: sanitaryCalendar.name,
          nextDueDate: sanitaryCalendar.nextDueDate,
        })
        .from(sanitaryCalendar)
        .where(and(eq(sanitaryCalendar.isActive, true), lte(sanitaryCalendar.nextDueDate, soonIso)))
        .orderBy(sanitaryCalendar.nextDueDate)
        .limit(10),
      db
        .select({
          species: healthControl.species,
          product: healthControl.product,
          until: healthControl.withdrawalUntilDate,
        })
        .from(healthControl)
        .where(gte(healthControl.withdrawalUntilDate, todayIso))
        .orderBy(healthControl.withdrawalUntilDate)
        .limit(6),
      db
        .select({
          name: feedInventory.name,
          stock: feedInventory.currentStock,
          minStock: feedInventory.minStock,
          unit: feedInventory.unit,
        })
        .from(feedInventory)
        .where(
          or(
            sql`${feedInventory.currentStock}::numeric <= 0`,
            sql`(${feedInventory.minStock}::numeric > 0 AND ${feedInventory.currentStock}::numeric <= ${feedInventory.minStock}::numeric)`,
          ),
        )
        .limit(6),
      db
        .select({
          code: compostingPiles.code,
          name: compostingPiles.name,
          status: compostingPiles.status,
          nextTurnDueDate: compostingPiles.nextTurnDueDate,
        })
        .from(compostingPiles)
        .where(
          and(
            ne(compostingPiles.status, "cosechada"),
            or(eq(compostingPiles.status, "alerta"), lte(compostingPiles.nextTurnDueDate, todayIso)),
          ),
        )
        .limit(5),
      db
        .select({
          metricType: sensorReadings.metricType,
          value: sensorReadings.value,
          unit: sensorReadings.unit,
          ithIndex: sensorReadings.ithIndex,
        })
        .from(sensorReadings)
        .where(and(eq(sensorReadings.alertTriggered, true), gte(sensorReadings.recordedAt, recentSince)))
        .orderBy(desc(sensorReadings.recordedAt))
        .limit(5),
      db
        .select({
          title: maintenance.title,
          scheduledDate: maintenance.scheduledDate,
        })
        .from(maintenance)
        .where(and(ne(maintenance.status, "completado"), lte(maintenance.scheduledDate, todayIso)))
        .limit(5),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(accountsReceivable)
        .where(and(ne(accountsReceivable.status, "pagado"), lte(accountsReceivable.dueDate, todayIso))),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(accountsPayable)
        .where(and(ne(accountsPayable.status, "pagado"), lte(accountsPayable.dueDate, todayIso))),
      db
        .select({ status: dailyClosures.status })
        .from(dailyClosures)
        .where(eq(dailyClosures.closureDate, todayIso))
        .limit(1),
    ]);

    const overdueRoutines = routineRows.filter((r) => r.nextDueDate < todayIso);
    const dueSoonRoutines = routineRows.filter((r) => r.nextDueDate >= todayIso);

    return {
      dateIso: todayIso,
      activeHens: henCountRow[0]?.total || 0,
      activeRoosters: roosterCountRow[0]?.total || 0,
      activeBatches: batchSummaryRow[0]?.batches || 0,
      batchAnimals: batchSummaryRow[0]?.animals || 0,
      activeLocations: locationCountRow[0]?.total || 0,
      overdueRoutines,
      dueSoonRoutines,
      activeWithdrawals: withdrawalRows.filter((w): w is { species: string | null; product: string | null; until: string } => Boolean(w.until)),
      lowStockFeeds: lowFeedRows.map((f) => ({
        name: f.name,
        stock: String(f.stock),
        minStock: String(f.minStock),
        unit: f.unit,
      })),
      compostingAlerts: compostRows,
      sensorAlertsRecent: sensorAlertRows.map((s) => ({
        metricType: s.metricType,
        value: String(s.value),
        unit: s.unit,
        ithIndex: s.ithIndex ? String(s.ithIndex) : null,
      })),
      overdueMaintenance: maintRows,
      overdueReceivablesCount: arOverdueRow[0]?.total || 0,
      overduePayablesCount: apOverdueRow[0]?.total || 0,
      todayClosed: closureRow[0]?.status === "cerrado",
    };
  } catch {
    return null;
  }
}

export function formatSituationalBrief(snapshot: SituationalSnapshot | null): string {
  if (!snapshot) return "";

  const lines: string[] = [
    `Población actual: ${snapshot.activeHens} gallinas, ${snapshot.activeRoosters} gallos, ${snapshot.activeBatches} lotes activos (${snapshot.batchAnimals} animales) en ${snapshot.activeLocations} lugares.`,
    `Cierre diario (${snapshot.dateIso}): ${snapshot.todayClosed ? "CERRADO (evitar registros retroactivos en esa fecha)" : "abierto"}.`,
  ];

  if (snapshot.overdueRoutines.length > 0) {
    lines.push(
      `Rutinas vencidas (${snapshot.overdueRoutines.length}): ${snapshot.overdueRoutines
        .slice(0, 3)
        .map((r) => `${r.name} [${r.nextDueDate}]`)
        .join(", ")}.`,
    );
  }
  if (snapshot.dueSoonRoutines.length > 0) {
    lines.push(
      `Rutinas hoy/próximas 72h (${snapshot.dueSoonRoutines.length}): ${snapshot.dueSoonRoutines
        .slice(0, 3)
        .map((r) => `${r.name} [${r.nextDueDate}]`)
        .join(", ")}.`,
    );
  }
  if (snapshot.activeWithdrawals.length > 0) {
    lines.push(
      `RETIROS SANITARIOS ACTIVOS: ${snapshot.activeWithdrawals
        .map((w) => `${w.product || "tratamiento"} (${w.species || "aves"}, hasta ${w.until})`)
        .join("; ")}.`,
    );
  }
  if (snapshot.lowStockFeeds.length > 0) {
    lines.push(
      `Alimentos en stock bajo: ${snapshot.lowStockFeeds
        .map((f) => `${f.name}: ${f.stock} ${f.unit} (mín ${f.minStock})`)
        .join(", ")}.`,
    );
  }
  if (snapshot.sensorAlertsRecent.length > 0) {
    lines.push(
      `Alertas ambientales 48h: ${snapshot.sensorAlertsRecent
        .map((s) => `${s.metricType}=${s.value}${s.unit}${s.ithIndex ? ` ITH:${s.ithIndex}` : ""}`)
        .join(", ")}.`,
    );
  }
  if (snapshot.compostingAlerts.length > 0) {
    lines.push(
      `Compostaje por atender: ${snapshot.compostingAlerts
        .map((c) => `${c.code} ${c.name} (${c.status})`)
        .join(", ")}.`,
    );
  }
  if (snapshot.overdueMaintenance.length > 0) {
    lines.push(
      `Mantenimientos vencidos (${snapshot.overdueMaintenance.length}): ${snapshot.overdueMaintenance
        .map((m) => m.title)
        .join(", ")}.`,
    );
  }
  if (snapshot.overdueReceivablesCount > 0 || snapshot.overduePayablesCount > 0) {
    lines.push(
      `Cartera vencida: ${snapshot.overdueReceivablesCount} por cobrar, ${snapshot.overduePayablesCount} por pagar.`,
    );
  }

  return lines.join("\n- ");
}
