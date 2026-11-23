/**
 * Diccionario Contractual Único de KPIs (Sección 4.3 de Auditoría · KPI-11).
 * Centraliza fórmula, unidad, fuentes, ventana temporal, regla de calidad y manejo de excepciones
 * para que Inicio, Soberanía, Finanzas, MicroInsightCard y Reportes compartan exactamente el mismo contrato.
 */

export type KpiQualityGrade = "confirmado" | "estimado" | "incompleto";

export interface KpiContractDefinition {
  metricKey: string;
  label: string;
  formula: string;
  unit: string;
  defaultPeriod: string;
  source: string;
  qualityRule: string;
  updateTrigger: string;
  exceptions: string;
  presentation: string;
}

export const KPI_CONTRACT_DICTIONARY: Readonly<Record<string, KpiContractDefinition>> = {
  household_eggs_allocated: {
    metricKey: "household_eggs_allocated",
    label: "Huevos destinados al hogar",
    formula: "Suma de egg_production.quantity_autoconsumo válidamente vinculados al periodo",
    unit: "unidades",
    defaultPeriod: "Últimos 30 días",
    source: "Producción de huevos (egg_production) y asignaciones de destino",
    qualityRule: "confirmado si proviene de recolección confirmada en servidor; estimado/incompleto si está en cola offline",
    updateTrigger: "Al guardar, editar o sincronizar una recolección o log de autoconsumo",
    exceptions: "Sin registros (0), conflicto de umbral biológico (409) o pendiente de sincronización (HTTP 202)",
    presentation: "Cantidad entera (unidades), origen y desglose sin doble conteo frente a excedente",
  },
  household_substitution_gross_value_cop: {
    metricKey: "household_substitution_gross_value_cop",
    label: "Valor bruto de sustitución estimado",
    formula: "cantidad_autoconsumo × precio_referencia_mercado (sin descontar costos de producción)",
    unit: "COP",
    defaultPeriod: "Acumulado del periodo consultado",
    source: "autoconsumo_logs vinculado a egg_productionId / slaughterId o registro manual",
    qualityRule: "estimado cuando usa precio de referencia; incompleto cuando no hay precio de referencia (sin_precio_referencia)",
    updateTrigger: "Al registrar o actualizar el evento de autoconsumo o los parámetros de especie",
    exceptions: "Precio de referencia ausente o en cero: conserva la cantidad física y marca valoración pendiente",
    presentation: "Valor COP etiquetado explícitamente como sustitución bruta estimada (no utilidad neta ni ingreso de caja)",
  },
  egg_saleable_value_cop: {
    metricKey: "egg_saleable_value_cop",
    label: "Valor comercializable de excedentes",
    formula: "huevos_excedente_comercializable × precio_unitario_referencia",
    unit: "COP",
    defaultPeriod: "Día de recolección / Inventario PEPS vigente",
    source: "Recolección neta descontando rotos, descartados, incubación y hogar",
    qualityRule: "estimado hasta ejecutarse una venta efectiva en egg_sales",
    updateTrigger: "Al registrar recolección de huevos o venta PEPS",
    exceptions: "Sin precio unitario definido o con destino aún pendiente de asignar",
    presentation: "Valor potencial en COP separado explícitamente de la sustitución familiar",
  },
  egg_partial_feed_margin_cop: {
    metricKey: "egg_partial_feed_margin_cop",
    label: "Margen parcial estimado sobre alimento",
    formula: "valor_comercializable_hoy − costo_alimento_registrado_hoy",
    unit: "COP",
    defaultPeriod: "Día observado",
    source: "Recolección diaria (huevos) y consumo de alimento imputado del día",
    qualityRule: "estimado (margen parcial que excluye mano de obra, sanidad, empaque y depreciación)",
    updateTrigger: "Al capturar huevos con registro de costo de ración del mismo día",
    exceptions: "Si no hay consumo de alimento valorizado o solo hubo autoconsumo familiar, se aclara el alcance en supuestos",
    presentation: "Monto COP con nota visible de supuestos y alcance parcial",
  },
  egg_daily_average_observed: {
    metricKey: "egg_daily_average_observed",
    label: "Promedio diario de postura por día observado",
    formula: "sum(total_collected) / count(distinct date)",
    unit: "huevos/día observado",
    defaultPeriod: "Registros filtrados en el tablero de producción",
    source: "egg_production agrupado por fecha calendario única",
    qualityRule: "confirmado sobre días con al menos una recolección registrada",
    updateTrigger: "Al crear, editar, filtrar o eliminar recolecciones",
    exceptions: "Sin registros devuelve 0; múltiples capturas el mismo día suman al mismo denominador diario",
    presentation: "Entero redondeado por día observado (nunca dividido por cantidad de clics/capturas)",
  },
  sale_unit_margin_cop: {
    metricKey: "sale_unit_margin_cop",
    label: "Margen unitario de venta",
    formula: "precio_unitario_venta − costo_unitario (trazable o paramétrico)",
    unit: "COP / unidad o kg",
    defaultPeriod: "Transacción individual",
    source: "Ventas registradas con referenceUnitCost trazable o parámetro fallback de referencia",
    qualityRule: "calculated cuando usa referenceUnitCost trazable; estimado cuando cae a costo paramétrico por defecto",
    updateTrigger: "Al confirmar una venta",
    exceptions: "Sin costo contable asignado en el lote: declara explícitamente costo paramétrico en supuestos",
    presentation: "Margen en COP y %, acompañado de etiqueta de fuente de costo",
  },
  time_to_first_value_minutes: {
    metricKey: "time_to_first_value_minutes",
    label: "Time to First Value (primera utilidad operativa)",
    formula: "(duración_onboarding_seg + duración_primera_captura_real_seg) / 60",
    unit: "minutos",
    defaultPeriod: "Desde activación inicial hasta primera operación productiva confirmada",
    source: "Telemetría de adopción (/api/analisis/kpis-adopcion) + registros operativos reales",
    qualityRule: "incompleto (null) si solo completó el onboarding sin capturar ninguna operación productiva",
    updateTrigger: "Al completar el primer registro productivo real post-onboarding",
    exceptions: "Onboarding descartado o pendiente offline (HTTP 202) no declara valor alcanzado",
    presentation: "Minutos con bandera booleana firstValueAchieved",
  },
  contextual_habit_adherence_pct: {
    metricKey: "contextual_habit_adherence_pct",
    label: "Adherencia de hábitos pertinentes por especie y propósito",
    formula: "pasos_pertinentes_completados_hoy / pasos_esenciales_del_contexto",
    unit: "pasos / días de racha",
    defaultPeriod: "Día actual y ventana de 45 días",
    source: "Actividad real verificada según especie y FarmPurposeKey",
    qualityRule: "confirmado; parte estrictamente desde 0 sin mínimos ni rachas artificiales",
    updateTrigger: "Al registrar operaciones aplicables a la especie/propósito de la granja",
    exceptions: "Especies no ponedoras omiten huevos; granjas de hogar omiten ventas financieras",
    presentation: "Conteo exacto (0..N) y racha real consecutiva",
  },
  farm_three_layer_profitability: {
    metricKey: "farm_three_layer_profitability",
    label: "Rentabilidad en 3 capas (Caja, Operativa y Patrimonio)",
    formula: "computeThreeLayerFinancials (flujo de caja, devengado operacional con depreciación y variación biológica)",
    unit: "COP",
    defaultPeriod: "Últimos 30 días o rango consultado",
    source: "/api/finanzas/finanzas (referencia financiera oficial)",
    qualityRule: "confirmado sobre asientos y movimientos de inventario conciliados",
    updateTrigger: "Al registrar ingresos, egresos, consumos de alimento/insumos o movimientos biológicos",
    exceptions: "Separar siempre flujo de caja de valorización biológica no realizada",
    presentation: "Tres capas financieras desacopladas en el módulo financiero",
  },
};

export function getKpiContract(metricKey: string): KpiContractDefinition | undefined {
  return KPI_CONTRACT_DICTIONARY[metricKey];
}

export function evaluateKpiQuality(input: {
  hasConfirmedRecords: boolean;
  usesFallbackPriceOrCost?: boolean;
  hasPendingOffline?: boolean;
}): KpiQualityGrade {
  if (!input.hasConfirmedRecords || input.hasPendingOffline) {
    return "incompleto";
  }
  if (input.usesFallbackPriceOrCost) {
    return "estimado";
  }
  return "confirmado";
}

/**
 * KPI-05: Calcula el promedio diario agrupando por fechas calendario observadas distintas,
 * evitando que registrar varias recolecciones en un mismo día distorsione el denominador.
 */
export function computeDailyEggAverage(
  records: ReadonlyArray<{ date: string; totalCollected: number }>,
): { totalEggs: number; observedDays: number; avgPerObservedDay: number } {
  if (!records.length) {
    return { totalEggs: 0, observedDays: 0, avgPerObservedDay: 0 };
  }
  const uniqueDates = new Set<string>();
  let totalEggs = 0;
  for (const r of records) {
    totalEggs += Number(r.totalCollected || 0);
    if (r.date) uniqueDates.add(String(r.date).slice(0, 10));
  }
  const observedDays = Math.max(1, uniqueDates.size);
  return {
    totalEggs,
    observedDays,
    avgPerObservedDay: Math.round(totalEggs / observedDays),
  };
}
