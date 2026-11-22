export interface SensorAlertEvaluation {
  triggered: boolean;
  reason: string | null;
}

export function computeIth(tempC: number, humidityPct: number): number {
  const hr = Math.max(0, Math.min(100, humidityPct));
  const ith = 1.8 * tempC + 32 - (0.55 - 0.0055 * hr) * (1.8 * tempC - 26);
  return Number(ith.toFixed(2));
}

export function evaluateSensorAlert(
  metricType: string,
  value: number,
  ithIndex: number | null,
): SensorAlertEvaluation {
  if (ithIndex != null && ithIndex >= 72) {
    return {
      triggered: true,
      reason: ithIndex >= 78
        ? `Estrés calórico severo (ITH ${ithIndex} ≥ 78)`
        : `Alerta estrés calórico moderado (ITH ${ithIndex} ≥ 72)`,
    };
  }
  if (metricType === "amoniaco_ppm" && value >= 20) {
    return {
      triggered: true,
      reason: `Nivel crítico de amoníaco NH3 (${value} ppm ≥ 20 ppm): reforzar ventilación`,
    };
  }
  if (metricType === "temperatura" && (value > 32 || value < 10)) {
    return {
      triggered: true,
      reason: `Temperatura fuera de rango confortable (${value} °C)`,
    };
  }
  if (metricType === "humedad" && (value > 85 || value < 40)) {
    return {
      triggered: true,
      reason: `Humedad relativa fuera de rango (${value} %)`,
    };
  }
  if (metricType === "ith" && value >= 72) {
    return {
      triggered: true,
      reason: `Estrés calórico detectado (ITH ${value} ≥ 72)`,
    };
  }
  return { triggered: false, reason: null };
}
