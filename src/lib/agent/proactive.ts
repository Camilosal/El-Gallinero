import { db } from "@/db";
import {
  agentBriefings,
  budgets,
  budgetItems,
  dailyClosures,
  eggProduction,
  feedMovements,
  mortalityRecords,
  transactions,
} from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { addDaysIso, todayColombiaIso } from "@/lib/date-validation";
import { getFeedInventoryProjection } from "@/lib/feeding/inventory";
import { getProgressiveOnboardingState } from "@/lib/onboarding-server";
import { getLiveSituationalSnapshot } from "./situational";
import { getAgentConfig } from "./config";
import { callLlm } from "./llm";

/**
 * Agente proactivo (C1): briefings deterministas con narración LLM opcional.
 *
 * - Reutiliza la lógica existente (snapshot situacional, proyección de alimento,
 *   comparativo de presupuestos, criterios de adherencia de los KPIs de adopción).
 * - NUNCA ejecuta herramientas de escritura del agente: solo lee y narra.
 * - Idempotente por granja/día/tipo gracias al índice único de agent_briefings.
 */

export type BriefingKind = "diario" | "anomalia";
export type FindingSeverity = "critical" | "warning" | "info";

export interface BriefingFinding {
  code: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  href?: string;
}

export interface BriefingPayload {
  dateIso: string;
  kind: BriefingKind;
  scale: "PEQUENO" | "MEDIANO";
  findings: BriefingFinding[];
  narratedBy: "llm" | "template";
}

export interface BriefingRow {
  id: string;
  briefingDate: string;
  kind: string;
  payload: BriefingPayload;
  narrative: string;
  readAt: Date | null;
  createdAt: Date;
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = { critical: 0, warning: 1, info: 2 };
const MAX_FINDINGS_MEDIANO = 6;
const MAX_FINDINGS_PEQUENO = 3;

function sortFindings(findings: BriefingFinding[]): BriefingFinding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Mortalidad de hoy vs. media móvil de los 7 días previos (umbral configurable). */
export async function detectMortalityAnomaly(todayIso: string): Promise<BriefingFinding | null> {
  const sinceIso = addDaysIso(todayIso, -7);
  const rows = await db
    .select({ date: mortalityRecords.date, quantity: mortalityRecords.quantity })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, sinceIso));

  let todayTotal = 0;
  let previousTotal = 0;
  const previousDays = new Set<string>();
  for (const row of rows) {
    if (row.date === todayIso) todayTotal += row.quantity;
    else if (row.date < todayIso) {
      previousTotal += row.quantity;
      previousDays.add(row.date);
    }
  }
  // Media móvil sobre los 7 días calendario previos (días sin registro cuentan como 0).
  const movingAvg = previousTotal / 7;
  const settings = await getSettings();
  const factorRaw = Number(settings["assistant.mortality_anomaly_factor"]);
  const factor = Number.isFinite(factorRaw) && factorRaw >= 1.2 ? factorRaw : 2;

  // Piso mínimo de 3 unidades para no alertar por ruido de granjas pequeñas.
  if (todayTotal < 3) return null;
  if (todayTotal <= movingAvg * factor) return null;

  return {
    code: "mortalidad_anormal",
    severity: "critical",
    title: "Mortalidad por encima de lo normal",
    detail:
      `Hoy se registraron ${todayTotal} muertes, frente a un promedio de ${movingAvg.toFixed(1)} al día en la última semana ` +
      `(umbral ${factor}×). Revisa agua, temperatura y signos de enfermedad; si sigue subiendo, consulta al veterinario.`,
    href: "/produccion/mortalidad",
  };
}

/** Desviación > 10 % en rubros de presupuestos vigentes (mismo cálculo del comparativo). */
async function detectBudgetDeviations(todayIso: string): Promise<BriefingFinding[]> {
  const activeBudgets = await db
    .select()
    .from(budgets)
    .where(and(lte(budgets.periodStart, todayIso), gte(budgets.periodEnd, todayIso)));
  if (activeBudgets.length === 0) return [];

  const findings: BriefingFinding[] = [];
  for (const budget of activeBudgets.slice(0, 3)) {
    const items = await db.select().from(budgetItems).where(eq(budgetItems.budgetId, budget.id));
    for (const item of items) {
      const target = Number(item.monthlyTarget);
      if (!(target > 0)) continue;
      const [actualRow] = await db
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
        .from(transactions)
        .where(
          and(
            eq(transactions.category, item.category),
            gte(transactions.date, budget.periodStart),
            lte(transactions.date, budget.periodEnd),
          ),
        );
      const actual = parseFloat(actualRow?.total || "0");
      const variancePct = ((actual - target) / target) * 100;
      if (Math.abs(variancePct) <= 10) continue;
      const over = variancePct > 0;
      findings.push({
        code: "presupuesto_desviado",
        severity: "warning",
        title: `Presupuesto "${budget.name}": rubro ${item.category} desviado`,
        detail: over
          ? `Va ${variancePct.toFixed(0)} % por encima de la meta ($${Math.round(actual).toLocaleString("es-CO")} vs. $${Math.round(target).toLocaleString("es-CO")}). Revisa gastos de esa categoría.`
          : `Va ${Math.abs(variancePct).toFixed(0)} % por debajo de la meta ($${Math.round(actual).toLocaleString("es-CO")} vs. $${Math.round(target).toLocaleString("es-CO")}). Puede faltar registro de ingresos o producción.`,
        href: "/finanzas/presupuestos",
      });
    }
  }
  return findings;
}

/** Racha de captura en riesgo: racha viva de ≥3 días sin actividad registrada hoy. */
async function detectStreakAtRisk(todayIso: string): Promise<BriefingFinding | null> {
  const cutoff21d = addDaysIso(todayIso, -20);
  const [closures, eggs, feeds, morts] = await Promise.all([
    db
      .select({ date: dailyClosures.closureDate, status: dailyClosures.status })
      .from(dailyClosures)
      .where(gte(dailyClosures.closureDate, cutoff21d)),
    db.select({ date: eggProduction.date }).from(eggProduction).where(gte(eggProduction.date, cutoff21d)),
    db.select({ date: feedMovements.date }).from(feedMovements).where(gte(feedMovements.date, cutoff21d)),
    db.select({ date: mortalityRecords.date }).from(mortalityRecords).where(gte(mortalityRecords.date, cutoff21d)),
  ]);

  const activeDays = new Set<string>();
  for (const c of closures) if (c.status === "cerrado") activeDays.add(c.date);
  for (const row of [...eggs, ...feeds, ...morts]) if (row.date) activeDays.add(row.date);

  if (activeDays.has(todayIso)) return null;
  let streak = 0;
  let cursor = addDaysIso(todayIso, -1);
  while (activeDays.has(cursor) && streak < 21) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  if (streak < 3) return null;
  return {
    code: "racha_en_riesgo",
    severity: "warning",
    title: `Racha de ${streak} días en riesgo`,
    detail: `Llevas ${streak} días seguidos registrando y hoy aún no hay actividad. Un registro rápido (huevos, alimento o cierre) mantiene la racha viva.`,
    href: "/inicio",
  };
}

/** Hallazgos deterministas del día, priorizados por severidad. */
export async function collectBriefingFindings(todayIso: string = todayColombiaIso()): Promise<BriefingFinding[]> {
  const findings: BriefingFinding[] = [];
  const soonIso = addDaysIso(todayIso, 3);

  const [snapshot, feedProjection, mortalityAnomaly, budgetDeviations, streakRisk] = await Promise.all([
    getLiveSituationalSnapshot(),
    getFeedInventoryProjection(7).catch(() => []),
    detectMortalityAnomaly(todayIso).catch(() => null),
    detectBudgetDeviations(todayIso).catch(() => [] as BriefingFinding[]),
    detectStreakAtRisk(todayIso).catch(() => null),
  ]);

  // Cobertura de alimento (proyección existente de inventario, consumo últimos 7 días).
  for (const feed of feedProjection) {
    if (feed.daysRemaining === null) continue;
    if (feed.daysRemaining <= 3) {
      findings.push({
        code: "alimento_cobertura",
        severity: "critical",
        title: `Alimento para ${feed.daysRemaining} día(s): ${feed.name}`,
        detail: `Con el consumo actual quedan ${feed.daysRemaining} días de ${feed.name} en bodega. Pedir hoy evita cambios bruscos de dieta que tumban la postura.`,
        href: "/inventarios/alimentacion",
      });
    } else if (feed.daysRemaining <= 7) {
      findings.push({
        code: "alimento_cobertura",
        severity: "warning",
        title: `Alimento para ${feed.daysRemaining} días: ${feed.name}`,
        detail: `Quedan ${feed.daysRemaining} días de ${feed.name}. Programa la compra para no quedarte sin alimento.`,
        href: "/inventarios/alimentacion",
      });
    }
  }

  if (snapshot) {
    for (const routine of snapshot.overdueRoutines.slice(0, 4)) {
      const isVaccine = /vacun/i.test(routine.name);
      findings.push({
        code: isVaccine ? "vacuna_atrasada" : "rutina_vencida",
        severity: isVaccine ? "critical" : "warning",
        title: `${isVaccine ? "Vacuna atrasada" : "Rutina vencida"}: ${routine.name}`,
        detail: `Estaba programada para el ${routine.nextDueDate} y sigue pendiente. ${isVaccine ? "Las vacunas atrasadas dejan el lote expuesto a enfermedades." : "Ponla al día desde el calendario."}`,
        href: "/planeacion/calendario?tab=rutina",
      });
    }
    for (const withdrawal of snapshot.activeWithdrawals) {
      if (withdrawal.until > soonIso) continue;
      findings.push({
        code: "retiro_por_vencer",
        severity: "info",
        title: `Retiro sanitario por vencer: ${withdrawal.product || "tratamiento"}`,
        detail: `El retiro de ${withdrawal.product || "el tratamiento"} (${withdrawal.species || "aves"}) termina el ${withdrawal.until}. No vendas huevos ni carne de ese grupo antes de esa fecha.`,
        href: "/planeacion/calendario",
      });
    }
    if (snapshot.overdueReceivablesCount > 0 || snapshot.overduePayablesCount > 0) {
      findings.push({
        code: "cartera_vencida",
        severity: "warning",
        title: "Cartera vencida",
        detail: `${snapshot.overdueReceivablesCount} cuenta(s) por cobrar y ${snapshot.overduePayablesCount} por pagar están vencidas. Cobra y paga para mantener la caja sana.`,
        href: "/finanzas/cuentas",
      });
    }
    for (const maint of snapshot.overdueMaintenance.slice(0, 2)) {
      findings.push({
        code: "mantenimiento_vencido",
        severity: "info",
        title: `Mantenimiento vencido: ${maint.title}`,
        detail: `Programado para el ${maint.scheduledDate}. Reprograma o marca como completado.`,
        href: "/operaciones/mantenimiento",
      });
    }
    for (const compost of snapshot.compostingAlerts.slice(0, 2)) {
      findings.push({
        code: "compostaje_por_atender",
        severity: "info",
        title: `Compostaje por atender: ${compost.name}`,
        detail: `La pila ${compost.code} está en estado "${compost.status}"${compost.nextTurnDueDate ? ` y el volteo tocaba el ${compost.nextTurnDueDate}` : ""}.`,
        href: "/operaciones/compostaje",
      });
    }
  }

  if (mortalityAnomaly) findings.push(mortalityAnomaly);
  findings.push(...budgetDeviations);
  if (streakRisk) findings.push(streakRisk);

  return sortFindings(findings);
}

/** Plantilla determinista (sin LLM): mismas viñetas, lenguaje de granja. */
export function renderTemplateNarrative(findings: BriefingFinding[], dateIso: string, scale: "PEQUENO" | "MEDIANO"): string {
  const header = scale === "PEQUENO"
    ? `Buenos días. Esto es lo importante de tu granja hoy (${dateIso}):`
    : `Briefing diario de la granja (${dateIso}). Hallazgos priorizados:`;
  if (findings.length === 0) {
    return `${header}\n- Todo en orden: sin alertas críticas hoy. Mantén el registro diario al día.`;
  }
  const bullets = findings.map((f) => `- ${f.title}. ${f.detail}`);
  return `${header}\n${bullets.join("\n")}`;
}

async function narrateWithLlm(findings: BriefingFinding[], dateIso: string, scale: "PEQUENO" | "MEDIANO"): Promise<string | null> {
  const config = getAgentConfig();
  if (!config) return null;
  try {
    const maxBullets = scale === "PEQUENO" ? MAX_FINDINGS_PEQUENO : MAX_FINDINGS_MEDIANO;
    const assistant = await callLlm(
      [
        {
          role: "system",
          content:
            "Eres Gina, la asistente de granja de IwaGranja. Redacta un briefing diario en español de campo, cercano y sin tecnicismos. " +
            `Máximo ${maxBullets} viñetas priorizadas (primero lo crítico). No inventes cifras: usa solo los hallazgos entregados. ` +
            "No ejecutes acciones ni prometas registros: solo informas. Si un hallazgo trae enlace, menciónalo como ruta de la app.",
        },
        {
          role: "user",
          content: `Fecha: ${dateIso}. Escala del productor: ${scale}. Hallazgos deterministas (JSON):\n${JSON.stringify(findings, null, 2)}`,
        },
      ],
      [],
      config,
    );
    const text = (assistant.content || "").trim();
    return text || null;
  } catch {
    return null;
  }
}

function toBriefingRow(row: typeof agentBriefings.$inferSelect): BriefingRow {
  return {
    id: row.id,
    briefingDate: row.briefingDate,
    kind: row.kind,
    payload: row.payload as unknown as BriefingPayload,
    narrative: row.narrative,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

async function findExistingBriefing(dateIso: string, kind: BriefingKind): Promise<BriefingRow | null> {
  const [row] = await db
    .select()
    .from(agentBriefings)
    .where(and(eq(agentBriefings.briefingDate, dateIso), eq(agentBriefings.kind, kind)))
    .limit(1);
  return row ? toBriefingRow(row) : null;
}

/**
 * Construye (o recupera) el briefing del día. Idempotente: una segunda llamada
 * el mismo día devuelve el existente sin duplicar ni volver a narrar.
 */
export async function buildDailyBriefing(options?: {
  kind?: BriefingKind;
  todayIso?: string;
  extraFindings?: BriefingFinding[];
  /** false = plantilla determinista sin LLM (comandos inmediatos como /parte). */
  narrate?: boolean;
}): Promise<{ created: boolean; briefing: BriefingRow }> {
  const kind = options?.kind ?? "diario";
  const todayIso = options?.todayIso ?? todayColombiaIso();

  const existing = await findExistingBriefing(todayIso, kind);
  if (existing) return { created: false, briefing: existing };

  const [allFindings, onboarding] = await Promise.all([
    collectBriefingFindings(todayIso),
    getProgressiveOnboardingState({ evaluateTriggers: false }).catch(() => null),
  ]);
  const scale: "PEQUENO" | "MEDIANO" = onboarding?.config?.scale === "MEDIANO" ? "MEDIANO" : "PEQUENO";
  const maxFindings = scale === "PEQUENO" ? MAX_FINDINGS_PEQUENO : MAX_FINDINGS_MEDIANO;
  const findings = sortFindings([...(options?.extraFindings ?? []), ...allFindings]).slice(0, maxFindings);

  const llmNarrative = options?.narrate === false ? null : await narrateWithLlm(findings, todayIso, scale);
  const narrative = llmNarrative ?? renderTemplateNarrative(findings, todayIso, scale);
  const payload: BriefingPayload = {
    dateIso: todayIso,
    kind,
    scale,
    findings,
    narratedBy: llmNarrative ? "llm" : "template",
  };

  const [inserted] = await db
    .insert(agentBriefings)
    .values({ briefingDate: todayIso, kind, payload: payload as any, narrative })
    .onConflictDoNothing()
    .returning();

  if (inserted) return { created: true, briefing: toBriefingRow(inserted) };
  const raced = await findExistingBriefing(todayIso, kind);
  if (raced) return { created: false, briefing: raced };
  throw new Error("No se pudo crear ni recuperar el briefing del día");
}

/**
 * Disparo por evento (no polling): el sync batch lo invoca tras aplicar
 * mortalidad. Solo crea briefing de anomalía si el umbral se supera hoy.
 */
export async function maybeTriggerMortalityAnomalyBriefing(): Promise<{ created: boolean; briefing: BriefingRow } | null> {
  const todayIso = todayColombiaIso();
  const anomaly = await detectMortalityAnomaly(todayIso);
  if (!anomaly) return null;
  const result = await buildDailyBriefing({ kind: "anomalia", todayIso, extraFindings: [anomaly] });
  if (result.created) {
    // C2: anomalías críticas también se entregan por Telegram si está configurado.
    const { deliverBriefingViaTelegram } = await import("@/lib/telegram");
    await deliverBriefingViaTelegram(result.briefing).catch((error) => {
      console.error("[proactive] Entrega Telegram de anomalía fallida:", error);
    });
  }
  return result;
}

/** Lista briefings recientes de la granja activa (para inbox y widget). */
export async function listBriefings(limit = 10): Promise<BriefingRow[]> {
  const rows = await db
    .select()
    .from(agentBriefings)
    .orderBy(sql`${agentBriefings.createdAt} DESC`)
    .limit(Math.min(50, Math.max(1, limit)));
  return rows.map(toBriefingRow);
}

/** Marca un briefing como leído (idempotente). */
export async function markBriefingRead(id: string): Promise<BriefingRow | null> {
  const [row] = await db
    .update(agentBriefings)
    .set({ readAt: sql`COALESCE(${agentBriefings.readAt}, now())` })
    .where(eq(agentBriefings.id, id))
    .returning();
  return row ? toBriefingRow(row) : null;
}