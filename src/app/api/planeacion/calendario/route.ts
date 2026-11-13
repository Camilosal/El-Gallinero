import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  accountsPayable,
  accountsReceivable,
  appSettings,
  biosecurityLogs,
  broilerBatches,
  chickenSales,
  compostingPiles,
  dailyClosures,
  eggProduction,
  eggSales,
  farmAssets,
  farmLocations,
  feedMovements,
  healthControl,
  incubation,
  maintenance,
  manureSales,
  meatSales,
  mortalityRecords,
  reproductionEvents,
  sanitaryCalendar,
  transactions,
  weightLogs,
} from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import {
  DEFAULT_ROUTINE_TASKS,
  ROUTINE_COMPLETIONS_KEY,
  ROUTINE_SETTINGS_KEY,
  addDaysIso,
  doesRoutineApplyOnDate,
  getEffectiveAutoDetectSource,
  getTaskVerificationMode,
  normalizeRoutineTaskConfig,
  type DailyComplianceSummary,
  type RoutineTaskConfig,
  type UnifiedCalendarEvent,
  type UnifiedCalendarResponse,
} from "@/lib/unified-calendar";

export const dynamic = "force-dynamic";

type CompletionMap = Record<string, { completedAt: string; note?: string }>;

function getTodayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function loadRoutineConfig(): Promise<RoutineTaskConfig[]> {
  try {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, ROUTINE_SETTINGS_KEY))
      .limit(1);
    if (!rows[0]?.value) return DEFAULT_ROUTINE_TASKS.map(normalizeRoutineTaskConfig);
    const parsed = JSON.parse(rows[0].value) as RoutineTaskConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_ROUTINE_TASKS.map(normalizeRoutineTaskConfig);
    }
    return parsed.map(normalizeRoutineTaskConfig);
  } catch {
    return DEFAULT_ROUTINE_TASKS.map(normalizeRoutineTaskConfig);
  }
}

async function loadCompletionsMap(): Promise<CompletionMap> {
  try {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, ROUTINE_COMPLETIONS_KEY))
      .limit(1);
    if (!rows[0]?.value) return {};
    const parsed = JSON.parse(rows[0].value) as CompletionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function upsertAppSetting(key: string, value: string): Promise<void> {
  const existing = await db
    .select({ id: appSettings.id })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  if (existing[0]?.id) {
    await db
      .update(appSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(appSettings.id, existing[0].id));
  } else {
    await db.insert(appSettings).values({ key, value });
  }
}

export const GET = withApiHandler(async () => {
  const today = getTodayBogota();
  const fromDate = addDaysIso(today, -30);
  const toDate = addDaysIso(today, 90);

  const [
    routineConfig,
    completionsMap,
    eggRows,
    feedRows,
    mortRows,
    saleRows,
    birdSaleRows,
    meatSaleRows,
    manureSaleRows,
    txRows,
    arRows,
    apRows,
    sanitaryCalRows,
    healthRows,
    incRows,
    maintRows,
    batchRows,
    reproRows,
    compostRows,
    closureRows,
    biosecRows,
    weightRows,
  ] = await Promise.all([
    loadRoutineConfig(),
    loadCompletionsMap(),
    db
      .select({
        date: eggProduction.date,
        totalCollected: eggProduction.totalCollected,
      })
      .from(eggProduction)
      .where(gte(eggProduction.date, fromDate))
      .catch(() => []),
    db
      .select({
        date: feedMovements.date,
        quantity: feedMovements.quantity,
        isEntry: feedMovements.isEntry,
      })
      .from(feedMovements)
      .where(and(gte(feedMovements.date, fromDate), eq(feedMovements.isEntry, false)))
      .catch(() => []),
    db
      .select({
        date: mortalityRecords.date,
        quantity: mortalityRecords.quantity,
      })
      .from(mortalityRecords)
      .where(gte(mortalityRecords.date, fromDate))
      .catch(() => []),
    db
      .select({
        id: eggSales.id,
        date: eggSales.date,
        totalAmount: eggSales.totalAmount,
        buyer: eggSales.buyer,
      })
      .from(eggSales)
      .where(gte(eggSales.date, fromDate))
      .catch(() => []),
    db
      .select({
        id: chickenSales.id,
        date: chickenSales.date,
        totalAmount: chickenSales.totalAmount,
      })
      .from(chickenSales)
      .where(gte(chickenSales.date, fromDate))
      .catch(() => []),
    db
      .select({
        id: meatSales.id,
        date: meatSales.date,
        totalAmount: meatSales.totalAmount,
      })
      .from(meatSales)
      .where(gte(meatSales.date, fromDate))
      .catch(() => []),
    db
      .select({
        id: manureSales.id,
        date: manureSales.date,
        totalAmount: manureSales.totalAmount,
      })
      .from(manureSales)
      .where(gte(manureSales.date, fromDate))
      .catch(() => []),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        type: transactions.type,
        category: transactions.category,
        description: transactions.description,
        amount: transactions.amount,
        counterparty: transactions.counterparty,
        isCredit: transactions.isCredit,
      })
      .from(transactions)
      .where(gte(transactions.date, fromDate))
      .catch(() => []),
    db
      .select({
        id: accountsReceivable.id,
        buyer: accountsReceivable.buyer,
        totalAmount: accountsReceivable.totalAmount,
        pendingAmount: accountsReceivable.pendingAmount,
        dueDate: accountsReceivable.dueDate,
        status: accountsReceivable.status,
      })
      .from(accountsReceivable)
      .catch(() => []),
    db
      .select({
        id: accountsPayable.id,
        supplier: accountsPayable.supplier,
        totalAmount: accountsPayable.totalAmount,
        pendingAmount: accountsPayable.pendingAmount,
        dueDate: accountsPayable.dueDate,
        status: accountsPayable.status,
      })
      .from(accountsPayable)
      .catch(() => []),
    db
      .select()
      .from(sanitaryCalendar)
      .where(eq(sanitaryCalendar.isActive, true))
      .orderBy(asc(sanitaryCalendar.nextDueDate))
      .catch(() => []),
    db
      .select({
        id: healthControl.id,
        date: healthControl.date,
        type: healthControl.type,
        description: healthControl.description,
        product: healthControl.product,
        nextScheduled: healthControl.nextScheduled,
        withdrawalDays: healthControl.withdrawalDays,
        withdrawalUntilDate: healthControl.withdrawalUntilDate,
      })
      .from(healthControl)
      .where(gte(healthControl.date, addDaysIso(today, -60)))
      .catch(() => []),
    db
      .select()
      .from(incubation)
      .where(eq(incubation.isComplete, false))
      .catch(() => []),
    db
      .select({
        id: maintenance.id,
        title: maintenance.title,
        scheduledDate: maintenance.scheduledDate,
        completedDate: maintenance.completedDate,
        status: maintenance.status,
        locationName: farmLocations.name,
        assetName: farmAssets.name,
      })
      .from(maintenance)
      .leftJoin(farmLocations, eq(maintenance.locationId, farmLocations.id))
      .leftJoin(farmAssets, eq(maintenance.assetId, farmAssets.id))
      .where(and(gte(maintenance.scheduledDate, fromDate), lte(maintenance.scheduledDate, toDate)))
      .catch(() => []),
    db
      .select()
      .from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))
      .catch(() => []),
    db
      .select()
      .from(reproductionEvents)
      .where(ne(reproductionEvents.status, "destetada"))
      .catch(() => []),
    db
      .select()
      .from(compostingPiles)
      .where(ne(compostingPiles.status, "cosechada"))
      .catch(() => []),
    db
      .select({
        closureDate: dailyClosures.closureDate,
        status: dailyClosures.status,
      })
      .from(dailyClosures)
      .where(gte(dailyClosures.closureDate, fromDate))
      .catch(() => []),
    db
      .select({
        date: biosecurityLogs.date,
        logType: biosecurityLogs.logType,
      })
      .from(biosecurityLogs)
      .where(gte(biosecurityLogs.date, fromDate))
      .catch(() => []),
    db
      .select({
        date: weightLogs.date,
        avgWeightKg: weightLogs.avgWeightKg,
        sampleSize: weightLogs.sampleSize,
      })
      .from(weightLogs)
      .where(gte(weightLogs.date, fromDate))
      .catch(() => []),
  ]);

  // Index daily activity maps by date (YYYY-MM-DD)
  const eggsByDate = new Map<string, number>();
  for (const r of eggRows) {
    eggsByDate.set(r.date, (eggsByDate.get(r.date) || 0) + Number(r.totalCollected || 0));
  }

  const feedKgByDate = new Map<string, number>();
  for (const r of feedRows) {
    feedKgByDate.set(r.date, (feedKgByDate.get(r.date) || 0) + Number(r.quantity || 0));
  }

  const mortByDate = new Map<string, number>();
  for (const r of mortRows) {
    mortByDate.set(r.date, (mortByDate.get(r.date) || 0) + Number(r.quantity || 1));
  }

  const financeCountByDate = new Map<string, number>();
  for (const r of saleRows) {
    financeCountByDate.set(r.date, (financeCountByDate.get(r.date) || 0) + 1);
  }
  for (const r of birdSaleRows) {
    financeCountByDate.set(r.date, (financeCountByDate.get(r.date) || 0) + 1);
  }
  for (const r of meatSaleRows) {
    financeCountByDate.set(r.date, (financeCountByDate.get(r.date) || 0) + 1);
  }
  for (const r of manureSaleRows) {
    financeCountByDate.set(r.date, (financeCountByDate.get(r.date) || 0) + 1);
  }
  for (const r of txRows) {
    financeCountByDate.set(r.date, (financeCountByDate.get(r.date) || 0) + 1);
  }

  const healthByDate = new Map<string, number>();
  for (const r of healthRows) {
    healthByDate.set(r.date, (healthByDate.get(r.date) || 0) + 1);
  }

  const biosecByDate = new Map<string, number>();
  for (const r of biosecRows) {
    biosecByDate.set(r.date, (biosecByDate.get(r.date) || 0) + 1);
  }

  const weightsByDate = new Map<string, number>();
  for (const r of weightRows) {
    weightsByDate.set(r.date, (weightsByDate.get(r.date) || 0) + 1);
  }

  const closuresByDate = new Set<string>(
    closureRows.filter((c) => c.status === "cerrado").map((c) => c.closureDate),
  );

  // Helper to evaluate a routine task on any date
  function evaluateRoutineTaskOnDate(
    task: RoutineTaskConfig,
    dateIso: string,
  ): UnifiedCalendarEvent {
    const manualKey = `${dateIso}:${task.id}`;
    const manualEntry = completionsMap[manualKey];
    const effectiveSource = getEffectiveAutoDetectSource(task);
    const verificationMode = getTaskVerificationMode(task);

    let autoDone = false;
    let detail = "";

    switch (effectiveSource) {
      case "egg_production": {
        const count = eggsByDate.get(dateIso) || 0;
        if (count > 0) {
          autoDone = true;
          detail = `${count} huevos registrados`;
        }
        break;
      }
      case "feed_consumption": {
        const kg = feedKgByDate.get(dateIso) || 0;
        if (kg > 0) {
          autoDone = true;
          detail = `${Math.round(kg * 10) / 10} kg servidos`;
        }
        break;
      }
      case "mortality_or_check": {
        const bajas = mortByDate.get(dateIso) || 0;
        if (bajas > 0) {
          autoDone = true;
          detail = `${bajas} baja(s) reportada(s)`;
        }
        break;
      }
      case "sales_or_expenses": {
        const movs = financeCountByDate.get(dateIso) || 0;
        if (movs > 0) {
          autoDone = true;
          detail = `${movs} movimiento(s) hoy`;
        }
        break;
      }
      case "sanitary_control": {
        const count = (healthByDate.get(dateIso) || 0) + (biosecByDate.get(dateIso) || 0);
        if (count > 0) {
          autoDone = true;
          detail = `${count} control(es) sanitario(s)`;
        }
        break;
      }
      case "biosecurity_log": {
        const count = biosecByDate.get(dateIso) || 0;
        if (count > 0) {
          autoDone = true;
          detail = `${count} bitácora(s) de bioseguridad registrada(s)`;
        }
        break;
      }
      case "weight_records": {
        const count = weightsByDate.get(dateIso) || 0;
        if (count > 0) {
          autoDone = true;
          detail = `${count} pesaje(s) muestral(es) guardado(s)`;
        }
        break;
      }
      case "daily_closure": {
        if (closuresByDate.has(dateIso)) {
          autoDone = true;
          detail = "Jornada cerrada y auditada";
        }
        break;
      }
      default: {
        break;
      }
    }

    // Nunca aceptar un check manual antiguo ni directo para tareas record_required
    const allowManual = verificationMode !== "record_required";
    const manualAccepted =
      allowManual && Boolean(manualEntry) && Boolean(manualEntry.note?.trim());
    const isDone = autoDone || manualAccepted;

    if (!autoDone && manualAccepted && manualEntry) {
      detail = manualEntry.note?.trim() || "Verificada con evidencia ✓";
    }

    let status: UnifiedCalendarEvent["status"] = "upcoming";
    if (isDone) {
      status = "completed";
    } else if (dateIso === today) {
      status = "pending_today";
    } else if (dateIso < today) {
      status = "overdue";
    }

    return {
      id: `routine:${dateIso}:${task.id}`,
      date: dateIso,
      title: task.title,
      subtitle: detail || task.description,
      module: task.module,
      shift: task.shift,
      status,
      isRoutine: true,
      routineTaskId: task.id,
      autoCompleted: autoDone,
      verificationMode,
      evidenceNote: manualAccepted ? manualEntry?.note : undefined,
      completionDetail: detail || undefined,
      quickCaptureMode: task.quickCaptureMode,
      actionHref: task.actionHref,
      actionLabel: task.actionLabel,
      icon: task.icon,
      priority: task.shift === "manana" ? "alta" : "normal",
    };
  }

  const allEvents: UnifiedCalendarEvent[] = [];
  const dailyHistory: DailyComplianceSummary[] = [];

  // 1. Generate routine events for window [-14d .. +30d]
  for (let offset = -14; offset <= 30; offset++) {
    const dt = addDaysIso(today, offset);
    const applicableTasks = routineConfig.filter((t) => doesRoutineApplyOnDate(t, dt));
    const evaluated = applicableTasks.map((t) => evaluateRoutineTaskOnDate(t, dt));
    allEvents.push(...evaluated);

    if (offset <= 0) {
      const total = evaluated.length;
      const completed = evaluated.filter((e) => e.status === "completed").length;
      const overdue = evaluated.filter((e) => e.status === "overdue").length;
      const pendingToday = evaluated.filter((e) => e.status === "pending_today").length;
      dailyHistory.push({
        date: dt,
        totalScheduled: total,
        completedCount: completed,
        overdueCount: overdue,
        pendingTodayCount: pendingToday,
        compliancePct: total > 0 ? Math.round((completed / total) * 100) : 100,
      });
    }
  }

  // 2. Sanitary Calendar events
  for (const s of sanitaryCalRows) {
    if (!s.nextDueDate || s.nextDueDate < fromDate || s.nextDueDate > toDate) continue;
    const manualKey = `${s.nextDueDate}:sanitary:${s.id}`;
    const manualEntry = completionsMap[manualKey];
    const isDone = Boolean(manualEntry?.note?.trim());
    const status: UnifiedCalendarEvent["status"] = isDone
      ? "completed"
      : s.nextDueDate < today
        ? "overdue"
        : s.nextDueDate === today
          ? "pending_today"
          : "upcoming";

    allEvents.push({
      id: `sanitary:${s.id}:${s.nextDueDate}`,
      date: s.nextDueDate,
      title: `Sanidad: ${s.name}`,
      subtitle:
        manualEntry?.note?.trim() ||
        `${s.type.toUpperCase()}${s.targetBirds ? ` · ${s.targetBirds}` : ""}`,
      module: "sanidad",
      status,
      isRoutine: false,
      routineTaskId: `sanitary:${s.id}`,
      verificationMode: "evidence_required",
      evidenceNote: manualEntry?.note,
      completionDetail: manualEntry?.note || undefined,
      actionHref: `/dashboard/sanidad/control?pendiente=${s.id}`,
      actionLabel: "Aplicar control",
      icon: "pill",
      priority: "alta",
    });
  }

  // 3. Health Controls: nextScheduled + ICA Withdrawal Release dates
  for (const h of healthRows) {
    if (h.nextScheduled && h.nextScheduled >= fromDate && h.nextScheduled <= toDate) {
      const status: UnifiedCalendarEvent["status"] =
        h.nextScheduled < today
          ? "overdue"
          : h.nextScheduled === today
            ? "pending_today"
            : "upcoming";
      allEvents.push({
        id: `health-next:${h.id}`,
        date: h.nextScheduled,
        title: `Refuerzo sanitario: ${h.product || h.description}`,
        subtitle: `Programado desde control del ${h.date}`,
        module: "sanidad",
        status,
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/sanidad/control?nuevo=1",
        actionLabel: "Registrar refuerzo",
        icon: "vaccine",
        priority: "alta",
      });
    }
    if (
      h.withdrawalUntilDate &&
      Number(h.withdrawalDays || 0) > 0 &&
      h.withdrawalUntilDate >= fromDate &&
      h.withdrawalUntilDate <= toDate
    ) {
      allEvents.push({
        id: `withdrawal-end:${h.id}`,
        date: h.withdrawalUntilDate,
        title: `Liberación de Retiro ICA: ${h.product || h.description}`,
        subtitle: `Fin de los ${h.withdrawalDays} días de retiro farmacológico · Venta permitida desde esta fecha`,
        module: "sanidad",
        status: h.withdrawalUntilDate <= today ? "completed" : "upcoming",
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/sanidad/control",
        actionLabel: "Ver control ICA",
        icon: "shield",
        priority: "alta",
      });
    }
  }

  // 4. Active Incubations: Turn Stop Date + Expected Hatch Date
  for (const inc of incRows) {
    const sp = (inc.species || "gallina").toUpperCase();
    const label = inc.incubatorName || inc.trayCode || "Incubadora";
    if (inc.turnStopDate && inc.turnStopDate >= fromDate && inc.turnStopDate <= toDate) {
      const manualKey = `${inc.turnStopDate}:inc-turn:${inc.id}`;
      const manualEntry = completionsMap[manualKey];
      const isDone = Boolean(manualEntry?.note?.trim()) || inc.turnStopDate < today;
      allEvents.push({
        id: `inc-turn:${inc.id}`,
        date: inc.turnStopDate,
        title: `🛑 Suspender volteo de incubadora (${sp})`,
        subtitle:
          manualEntry?.note?.trim() ||
          `${label}${inc.trayCode ? ` · Bandeja ${inc.trayCode}` : ""} · Subir humedad final`,
        module: "incubacion",
        status: isDone
          ? "completed"
          : inc.turnStopDate === today
            ? "pending_today"
            : "upcoming",
        isRoutine: false,
        routineTaskId: `inc-turn:${inc.id}`,
        verificationMode: "evidence_required",
        evidenceNote: manualEntry?.note,
        completionDetail: manualEntry?.note || undefined,
        actionHref: "/dashboard/produccion?tab=incubacion",
        actionLabel: "Ver incubación",
        icon: "incubator",
        priority: "alta",
      });
    }
    if (inc.expectedHatchDate >= fromDate && inc.expectedHatchDate <= toDate) {
      allEvents.push({
        id: `inc-hatch:${inc.id}`,
        date: inc.expectedHatchDate,
        title: `🐣 Eclosión esperada (${sp} · ${inc.eggsSet} huevos)`,
        subtitle: `${label} · Registrar nacimientos y asignar a lote`,
        module: "incubacion",
        status:
          inc.expectedHatchDate < today
            ? "overdue"
            : inc.expectedHatchDate === today
              ? "pending_today"
              : "upcoming",
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/produccion?tab=incubacion&nuevo=eclosion",
        actionLabel: "Registrar eclosión",
        icon: "chick",
        priority: "alta",
      });
    }
  }

  // 5. Reproduction Events (Conejos & Cuyes): Palpación, Nidal, Parto
  for (const rep of reproRows) {
    const sp = rep.species.toUpperCase();
    if (
      rep.expectedPalpationDate &&
      rep.expectedPalpationDate >= fromDate &&
      rep.expectedPalpationDate <= toDate
    ) {
      allEvents.push({
        id: `repro-palp:${rep.id}`,
        date: rep.expectedPalpationDate,
        title: `Palpación gestacional: Hembra ${rep.damCode} (${sp})`,
        subtitle: `Día 18 post-empadre · Confirmar preñez`,
        module: "reproduccion",
        status:
          rep.palpationResult
            ? "completed"
            : rep.expectedPalpationDate < today
              ? "overdue"
              : rep.expectedPalpationDate === today
                ? "pending_today"
                : "upcoming",
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/produccion?tab=reproduccion",
        actionLabel: "Registrar palpación",
        icon: "rabbit",
        priority: "media",
      });
    }
    if (
      rep.expectedNestboxDate &&
      rep.expectedNestboxDate >= fromDate &&
      rep.expectedNestboxDate <= toDate
    ) {
      const manualKey = `${rep.expectedNestboxDate}:repro-nest:${rep.id}`;
      const manualEntry = completionsMap[manualKey];
      const isDone = Boolean(manualEntry?.note?.trim());
      allEvents.push({
        id: `repro-nest:${rep.id}`,
        date: rep.expectedNestboxDate,
        title: `Colocar nidal desinfectado: Hembra ${rep.damCode}`,
        subtitle:
          manualEntry?.note?.trim() ||
          `Día 26 post-empadre · Preparar cama limpia para parto`,
        module: "reproduccion",
        status: isDone
          ? "completed"
          : rep.expectedNestboxDate < today
            ? "overdue"
            : rep.expectedNestboxDate === today
              ? "pending_today"
              : "upcoming",
        isRoutine: false,
        routineTaskId: `repro-nest:${rep.id}`,
        verificationMode: "evidence_required",
        evidenceNote: manualEntry?.note,
        completionDetail: manualEntry?.note || undefined,
        actionHref: "/dashboard/produccion?tab=reproduccion",
        actionLabel: "Ver reproducción",
        icon: "home",
        priority: "alta",
      });
    }
    if (
      rep.expectedBirthDate &&
      rep.expectedBirthDate >= fromDate &&
      rep.expectedBirthDate <= toDate
    ) {
      allEvents.push({
        id: `repro-birth:${rep.id}`,
        date: rep.expectedBirthDate,
        title: `Parto esperado: Hembra ${rep.damCode} (${sp})`,
        subtitle: `Registrar nacidos vivos/muertos y activar lactancia`,
        module: "reproduccion",
        status:
          rep.bornAlive !== null
            ? "completed"
            : rep.expectedBirthDate < today
              ? "overdue"
              : rep.expectedBirthDate === today
                ? "pending_today"
                : "upcoming",
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/produccion?tab=reproduccion",
        actionLabel: "Registrar parto",
        icon: "heart",
        priority: "alta",
      });
    }
  }

  // 6. Active Batches: Optimal Biological Harvest Window (Pollo 42d, Pato 49d, Conejo 75d, Cuy 80d)
  const OPTIMAL_HARVEST_DAYS: Record<string, number> = {
    pollo: 42,
    pato: 49,
    conejo: 75,
    cuy: 80,
    codorniz: 42,
  };
  for (const batch of batchRows) {
    if (batch.purpose === "postura_huevo") continue;
    const cycleDays = OPTIMAL_HARVEST_DAYS[batch.species] || 45;
    const targetHarvestDate = addDaysIso(batch.startDate, cycleDays);
    if (targetHarvestDate < fromDate || targetHarvestDate > toDate) continue;

    allEvents.push({
      id: `batch-harvest:${batch.id}`,
      date: targetHarvestDate,
      title: `Ventana óptima de cosecha/beneficio: Lote ${batch.code}`,
      subtitle: `${batch.currentQuantity} ${batch.species}s (Día ${cycleDays}) · Evitar sobre-estadía y deterioro de FCR`,
      module: "lotes",
      status:
        targetHarvestDate < today
          ? "overdue"
          : targetHarvestDate === today
            ? "pending_today"
            : "upcoming",
      isRoutine: false,
      verificationMode: "record_required",
      actionHref: "/dashboard/produccion?tab=carne",
      actionLabel: "Programar beneficio",
      icon: "meat",
      priority: "alta",
    });
  }

  // 7. Maintenance Tasks
  for (const m of maintRows) {
    const isDone = m.status === "completado" || Boolean(m.completedDate);
    const status: UnifiedCalendarEvent["status"] = isDone
      ? "completed"
      : m.scheduledDate < today
        ? "overdue"
        : m.scheduledDate === today
          ? "pending_today"
          : "upcoming";
    allEvents.push({
      id: `maint:${m.id}`,
      date: m.scheduledDate,
      title: `Mantenimiento: ${m.title}`,
      subtitle: [m.assetName, m.locationName].filter(Boolean).join(" · ") || "Instalación general",
      module: "mantenimiento",
      status,
      isRoutine: false,
      verificationMode: "record_required",
      actionHref: "/dashboard/operaciones/mantenimiento",
      actionLabel: "Ver mantenimiento",
      icon: "wrench",
      priority: "media",
    });
  }

  // 8. Composting Piles (Res. ICA 30292/2017): Weekly Turn & 8-Week Harvest
  for (const pile of compostRows) {
    if (
      pile.nextTurnDueDate &&
      pile.nextTurnDueDate >= fromDate &&
      pile.nextTurnDueDate <= toDate
    ) {
      allEvents.push({
        id: `compost-turn:${pile.id}`,
        date: pile.nextTurnDueDate,
        title: `Volteo y control térmico: Pila ${pile.code}`,
        subtitle: `${pile.name} · Verificar T° < 70 °C y aireación (Res. ICA 30292)`,
        module: "compostaje",
        status:
          pile.nextTurnDueDate < today
            ? "overdue"
            : pile.nextTurnDueDate === today
              ? "pending_today"
              : "upcoming",
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/operaciones/compostaje",
        actionLabel: "Registrar volteo",
        icon: "sprout",
        priority: "media",
      });
    }
    if (
      pile.expectedHarvestDate &&
      pile.expectedHarvestDate >= fromDate &&
      pile.expectedHarvestDate <= toDate
    ) {
      allEvents.push({
        id: `compost-harvest:${pile.id}`,
        date: pile.expectedHarvestDate,
        title: `Cosecha de compost sanitizado: Pila ${pile.code}`,
        subtitle: `Validar humedad <= 20% antes de empacar o movilizar`,
        module: "compostaje",
        status:
          pile.expectedHarvestDate < today
            ? "overdue"
            : pile.expectedHarvestDate === today
              ? "pending_today"
              : "upcoming",
        isRoutine: false,
        verificationMode: "record_required",
        actionHref: "/dashboard/operaciones/compostaje",
        actionLabel: "Liberar lote",
        icon: "sprout",
        priority: "normal",
      });
    }
  }

  // 9. Financial Credit Due Dates (Accounts Receivable & Accounts Payable)
  for (const ar of arRows) {
    if (!ar.dueDate || ar.dueDate < fromDate || ar.dueDate > toDate) continue;
    const isPaid = ar.status === "pagado" || Number(ar.pendingAmount || 0) <= 0;
    const status: UnifiedCalendarEvent["status"] = isPaid
      ? "completed"
      : ar.dueDate < today
        ? "overdue"
        : ar.dueDate === today
          ? "pending_today"
          : "upcoming";
    allEvents.push({
      id: `ar-due:${ar.id}`,
      date: ar.dueDate,
      title: `Cobro de cartera: ${ar.buyer || "Cliente"}`,
      subtitle: `Saldo por cobrar $${Number(ar.pendingAmount || ar.totalAmount || 0).toLocaleString("es-CO")}`,
      module: "finanzas",
      status,
      isRoutine: false,
      verificationMode: "record_required",
      actionHref: "/dashboard/finanzas/cuentas",
      actionLabel: "Registrar abono",
      icon: "money",
      priority: "alta",
    });
  }

  for (const ap of apRows) {
    if (!ap.dueDate || ap.dueDate < fromDate || ap.dueDate > toDate) continue;
    const isPaid = ap.status === "pagado" || Number(ap.pendingAmount || 0) <= 0;
    const status: UnifiedCalendarEvent["status"] = isPaid
      ? "completed"
      : ap.dueDate < today
        ? "overdue"
        : ap.dueDate === today
          ? "pending_today"
          : "upcoming";
    allEvents.push({
      id: `ap-due:${ap.id}`,
      date: ap.dueDate,
      title: `Pago a proveedor: ${ap.supplier || "Proveedor"}`,
      subtitle: `Saldo pendiente $${Number(ap.pendingAmount || ap.totalAmount || 0).toLocaleString("es-CO")}`,
      module: "finanzas",
      status,
      isRoutine: false,
      verificationMode: "record_required",
      actionHref: "/dashboard/finanzas/cuentas",
      actionLabel: "Registrar pago",
      icon: "card",
      priority: "alta",
    });
  }

  // Sort all events chronologically
  allEvents.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  // Today's tasks = today's routine tasks + non-routine events due today
  const todayRoutineTasks = allEvents.filter((e) => e.date === today);

  // Overdue items (last 14 days for routine, any within range for non-routine)
  const overdueCutoff = addDaysIso(today, -7);
  const overdueItems = allEvents
    .filter(
      (e) =>
        e.status === "overdue" &&
        (!e.isRoutine || e.date >= overdueCutoff),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Medium & Long-term non-routine milestones (+ weekly/monthly special routines)
  const futureMilestones = allEvents.filter(
    (e) =>
      e.date > today &&
      (!e.isRoutine || e.routineTaskId !== "routine-feed-am" && e.routineTaskId !== "routine-eggs" && e.routineTaskId !== "routine-health-walk" && e.routineTaskId !== "routine-sales-cash"),
  );

  const next7Boundary = addDaysIso(today, 7);
  const next30Boundary = addDaysIso(today, 30);

  const next7Days = futureMilestones.filter((e) => e.date <= next7Boundary);
  const next30Days = futureMilestones.filter(
    (e) => e.date > next7Boundary && e.date <= next30Boundary,
  );
  const next90Days = futureMilestones.filter((e) => e.date > next30Boundary);

  const todayTotal = todayRoutineTasks.length;
  const todayCompleted = todayRoutineTasks.filter((e) => e.status === "completed").length;
  const todayPending = todayTotal - todayCompleted;
  const todayPct = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 100;

  const recent7 = dailyHistory.slice(-7);
  const compliance7dPct =
    recent7.length > 0
      ? Math.round(recent7.reduce((s, d) => s + d.compliancePct, 0) / recent7.length)
      : 100;
  const compliance30dPct =
    dailyHistory.length > 0
      ? Math.round(dailyHistory.reduce((s, d) => s + d.compliancePct, 0) / dailyHistory.length)
      : 100;

  const payload: UnifiedCalendarResponse = {
    today,
    routineConfig,
    todayRoutineTasks,
    overdueItems,
    upcomingMediumLongTerm: {
      next7Days,
      next30Days,
      next90Days,
    },
    allEvents,
    dailyHistory,
    metrics: {
      todayTotal,
      todayCompleted,
      todayPending,
      todayPct,
      overdueTotal: overdueItems.length,
      compliance7dPct,
      compliance30dPct,
      upcoming7dCount: next7Days.length,
      upcoming30dCount: next30Days.length,
      upcoming90dCount: next90Days.length,
    },
  };

  return NextResponse.json(payload);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = (await req.json()) as {
    date?: string;
    taskId?: string;
    completed?: boolean;
    note?: string;
  };

  const date = body.date || getTodayBogota();
  const taskId = String(body.taskId || "").trim();
  if (!taskId) {
    return NextResponse.json({ error: "taskId es requerido" }, { status: 400 });
  }

  const routineConfig = await loadRoutineConfig();
  const routineTask = routineConfig.find((t) => t.id === taskId);
  const verificationMode = routineTask
    ? getTaskVerificationMode(routineTask)
    : taskId.startsWith("sanitary:") ||
        taskId.startsWith("inc-turn:") ||
        taskId.startsWith("repro-nest:")
      ? "evidence_required"
      : taskId.startsWith("routine-")
        ? getTaskVerificationMode({ id: taskId })
        : "record_required";

  const completions = await loadCompletionsMap();
  const key = `${date}:${taskId}`;

  if (body.completed === false) {
    if (verificationMode === "record_required") {
      return NextResponse.json(
        { error: "Las tareas verificadas con registro de módulo no se desmarcan manualmente." },
        { status: 400 },
      );
    }
    delete completions[key];
  } else {
    if (verificationMode === "record_required") {
      return NextResponse.json(
        {
          error:
            "Esta tarea requiere registrar el evento real en su módulo; no se permite el marcado manual.",
        },
        { status: 400 },
      );
    }
    const trimmedNote = typeof body.note === "string" ? body.note.trim() : "";
    if (trimmedNote.length < 5) {
      return NextResponse.json(
        {
          error:
            "Debes ingresar una observación o evidencia real de campo (mínimo 5 caracteres) para confirmar esta tarea.",
        },
        { status: 400 },
      );
    }
    completions[key] = {
      completedAt: new Date().toISOString(),
      note: trimmedNote,
    };
  }

  await upsertAppSetting(ROUTINE_COMPLETIONS_KEY, JSON.stringify(completions));
  return NextResponse.json({
    ok: true,
    key,
    completed: body.completed !== false,
    verificationMode,
  });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { routineConfig?: RoutineTaskConfig[] };
  if (!Array.isArray(body.routineConfig) || body.routineConfig.length === 0) {
    return NextResponse.json(
      { error: "routineConfig debe ser una lista no vacía" },
      { status: 400 },
    );
  }

  const sanitized: RoutineTaskConfig[] = body.routineConfig.map((item, idx) =>
    normalizeRoutineTaskConfig({
      id: String(item.id || `routine-custom-${idx + 1}`),
      title: String(item.title || "Tarea operativa").trim(),
      description: String(item.description || "").trim(),
      module: item.module || "rutina",
      shift: item.shift || "manana",
      frequency: item.frequency || "diaria",
      daysOfWeek: Array.isArray(item.daysOfWeek) ? item.daysOfWeek : undefined,
      dayOfMonth: item.dayOfMonth ? Number(item.dayOfMonth) : undefined,
      enabled: Boolean(item.enabled),
      autoDetectSource: item.autoDetectSource || "manual",
      quickCaptureMode: item.quickCaptureMode,
      actionHref: String(item.actionHref || "/dashboard"),
      actionLabel: String(item.actionLabel || "Realizar tarea"),
      icon: String(item.icon || "clipboard"),
    }),
  );

  await upsertAppSetting(ROUTINE_SETTINGS_KEY, JSON.stringify(sanitized));
  return NextResponse.json({ ok: true, routineConfig: sanitized });
});

