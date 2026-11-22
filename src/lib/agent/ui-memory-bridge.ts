import { getSessionUser } from "@/lib/auth";
import { KPI_WIDGET_CATALOG, type KpiDashboardConfig } from "@/lib/kpi-dashboard";
import {
  extractFarmEntities,
  normalizeSubjectKey,
  saveFarmMemory,
  type FarmMemoryRecord,
} from "@/lib/agent/memory";

/**
 * Puente no bloqueante de aprendizaje desde acciones en UI hacia la memoria operativa de Gina (Capacidad 4).
 *
 * Sintetiza hechos deterministas (dietas, metas de KPI, compradores, proveedores y raciones por galpón)
 * sobre `agent_memories` sin bloquear ni hacer fallar las operaciones transaccionales del productor.
 */

async function resolveTargetUserId(explicitUserId?: string | null): Promise<string | null> {
  if (explicitUserId && explicitUserId.trim()) return explicitUserId.trim();
  try {
    const user = await getSessionUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

function formatCopSimple(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-CO")} COP`;
}

export async function learnFromFeedingProgramAction(params: {
  userId?: string | null;
  stageName: string;
  feedName: string;
  feedUnit?: string | null;
  percentage: number;
  dailyAmountPerHen: number;
}): Promise<FarmMemoryRecord | null> {
  try {
    const userId = await resolveTargetUserId(params.userId);
    if (!userId) return null;

    const stage = String(params.stageName || "").trim();
    const feed = String(params.feedName || "").trim();
    if (!stage || !feed) return null;

    const pctText = Number.isFinite(params.percentage) ? `${Math.round(params.percentage * 10) / 10}%` : "sin %";
    const dailyText = Number.isFinite(params.dailyAmountPerHen) ? `${params.dailyAmountPerHen} g/animal/día` : "";

    const content = `Programa de alimentación configurado en UI para etapa ${stage}: ${feed} al ${pctText} de la mezcla${dailyText ? ` (${dailyText})` : ""}.`;
    return await saveFarmMemory({
      userId,
      category: "protocolo",
      subjectKey: normalizeSubjectKey(`dieta_etapa_${stage}_${feed}`),
      content,
      entities: extractFarmEntities(`${stage} ${feed} alimentacion`),
      importance: 4,
    });
  } catch {
    return null;
  }
}

export async function learnFromKpiDashboardConfigAction(params: {
  userId: string;
  config: KpiDashboardConfig;
}): Promise<FarmMemoryRecord | null> {
  try {
    const userId = await resolveTargetUserId(params.userId);
    if (!userId) return null;

    const pinnedTitles: string[] = [];
    const customTargets: string[] = [];

    for (const widget of params.config.widgets || []) {
      const meta = KPI_WIDGET_CATALOG[widget.id];
      if (!meta) continue;
      if (widget.pinnedToHome) {
        pinnedTitles.push(meta.shortTitle || meta.title);
      }
      if (widget.customTarget !== null && Number.isFinite(widget.customTarget)) {
        customTargets.push(`${meta.shortTitle}: ${widget.customTarget} ${meta.unit}`.trim());
      }
    }

    const parts = [
      `Tablero de KPIs configurado por el usuario en modo "${params.config.preset}".`,
      pinnedTitles.length > 0 ? `Indicadores fijados en inicio: ${pinnedTitles.join(", ")}.` : null,
      customTargets.length > 0 ? `Metas personalizadas definidas: ${customTargets.join("; ")}.` : null,
    ].filter(Boolean);

    return await saveFarmMemory({
      userId,
      category: "preferencia",
      subjectKey: "tablero_kpis_metas_usuario",
      content: parts.join(" "),
      entities: ["kpi", "tablero", ...pinnedTitles.map((t) => t.toLowerCase())].slice(0, 12),
      importance: 4,
    });
  } catch {
    return null;
  }
}

export async function learnFromSaleAction(params: {
  userId?: string | null;
  buyer?: string | null;
  productLine: string;
  summary: string;
  unitPrice?: number | string | null;
  isCredit?: boolean;
  entities?: string[];
}): Promise<FarmMemoryRecord | null> {
  try {
    const buyer = String(params.buyer || "").trim();
    if (buyer.length < 2) return null;

    const userId = await resolveTargetUserId(params.userId);
    if (!userId) return null;

    const line = String(params.productLine || "general").trim().toLowerCase();
    const priceNum = params.unitPrice != null ? Number(params.unitPrice) : NaN;
    const priceClause = Number.isFinite(priceNum) && priceNum > 0 ? ` a ${formatCopSimple(priceNum)}/u` : "";
    const creditClause = params.isCredit ? " (habitualmente a crédito)" : " (de contado)";
    const content = `Cliente ${buyer} compra ${line} desde UI: ${params.summary}${priceClause}${creditClause}.`;

    return await saveFarmMemory({
      userId,
      category: "comprador",
      subjectKey: normalizeSubjectKey(`cliente_${line}_${buyer}`),
      content,
      entities: Array.from(
        new Set([
          buyer.toLowerCase(),
          line,
          ...(params.entities || []),
          ...extractFarmEntities(content),
        ]),
      ).slice(0, 12),
      importance: 4,
    });
  } catch {
    return null;
  }
}

export async function learnFromExpenseAction(params: {
  userId?: string | null;
  counterparty?: string | null;
  category: string;
  description: string;
  amount: number;
  species?: string | null;
}): Promise<FarmMemoryRecord | null> {
  try {
    const counterparty = String(params.counterparty || "").trim();
    const category = String(params.category || "").trim();
    const description = String(params.description || "").trim();
    if (counterparty.length < 2 && !category) return null;

    const userId = await resolveTargetUserId(params.userId);
    if (!userId) return null;

    const hasSupplier = counterparty.length >= 2;
    const speciesText = params.species ? ` para ${params.species}` : "";
    const amountText = Number.isFinite(params.amount) && params.amount > 0 ? ` (${formatCopSimple(params.amount)})` : "";
    const content = hasSupplier
      ? `Proveedor ${counterparty} atiende rubro "${category}"${speciesText}: ${description || category}${amountText}.`
      : `Gasto frecuente en "${category}"${speciesText}: ${description || category}${amountText}.`;

    return await saveFarmMemory({
      userId,
      category: hasSupplier ? "proveedor" : "hecho",
      subjectKey: normalizeSubjectKey(
        hasSupplier ? `proveedor_${counterparty}_${category}` : `gasto_frecuente_${category}`,
      ),
      content,
      entities: Array.from(
        new Set([
          ...(hasSupplier ? [counterparty.toLowerCase()] : []),
          ...(params.species ? [params.species.toLowerCase()] : []),
          ...extractFarmEntities(`${category} ${description}`),
        ]),
      ).slice(0, 12),
      importance: 3,
    });
  } catch {
    return null;
  }
}

export async function learnFromFeedMovementAction(params: {
  userId?: string | null;
  feedName: string;
  unit: string;
  quantity: number;
  isEntry: boolean;
  movementType: string;
  locationName?: string | null;
  unitCost?: number | string | null;
}): Promise<FarmMemoryRecord | null> {
  try {
    const userId = await resolveTargetUserId(params.userId);
    if (!userId) return null;

    const feed = String(params.feedName || "").trim();
    const unit = String(params.unit || "kg").trim();
    const qtyText = Number.isFinite(params.quantity) ? `${params.quantity} ${unit}` : unit;
    const loc = String(params.locationName || "").trim();

    if (!params.isEntry && loc) {
      const content = `Ración registrada en ${loc}: ${qtyText} de ${feed} (${params.movementType}).`;
      return await saveFarmMemory({
        userId,
        category: "instalacion",
        subjectKey: normalizeSubjectKey(`racion_instalacion_${loc}`),
        content,
        entities: extractFarmEntities(`${loc} ${feed} alimento`),
        importance: 3,
      });
    }

    if (params.isEntry && feed) {
      const costNum = params.unitCost != null ? Number(params.unitCost) : NaN;
      const costText = Number.isFinite(costNum) && costNum > 0 ? ` a ${formatCopSimple(costNum)}/${unit}` : "";
      const content = `Ingreso/compra de alimento registrado en UI: ${qtyText} de ${feed}${costText}.`;
      return await saveFarmMemory({
        userId,
        category: "proveedor",
        subjectKey: normalizeSubjectKey(`compra_alimento_${feed}`),
        content,
        entities: extractFarmEntities(`${feed} alimento concentrado`),
        importance: 3,
      });
    }

    return null;
  } catch {
    return null;
  }
}

export async function learnFromBiologicalCalibrationAction(params: {
  userId?: string | null;
  species: string;
  breed?: string | null;
  weekNumber?: number | null;
  avgWeightKg: number;
  sampleSize?: number | null;
  empiricalFactor?: number | null;
  confidencePct?: number | null;
}): Promise<FarmMemoryRecord | null> {
  try {
    const userId = await resolveTargetUserId(params.userId);
    if (!userId) return null;

    const sp = String(params.species || "ave").trim().toLowerCase();
    const breed = String(params.breed || "general").trim();
    const weekClause = params.weekNumber != null ? ` en semana ${params.weekNumber}` : "";
    const factor = params.empiricalFactor != null && Number.isFinite(params.empiricalFactor) ? params.empiricalFactor : null;
    const factorPct = factor != null ? Math.round((factor - 1) * 1000) / 10 : null;
    const factorClause =
      factorPct != null
        ? ` Factor empírico local: ${factorPct >= 0 ? `+${factorPct}%` : `${factorPct}%`} (confianza ${params.confidencePct ?? 0}%).`
        : "";
    const weightG = Math.round(Number(params.avgWeightKg) * 1000);
    const content = `Biometría registrada para ${sp} (${breed})${weekClause}: promedio ${weightG} g${params.sampleSize ? ` (n=${params.sampleSize})` : ""}.${factorClause}`;

    return await saveFarmMemory({
      userId,
      category: "lote",
      subjectKey: normalizeSubjectKey(`biometria_calibracion_${sp}_${breed}`),
      content,
      entities: extractFarmEntities(`${sp} ${breed} peso biometria`),
      importance: 4,
    });
  } catch {
    return null;
  }
}
