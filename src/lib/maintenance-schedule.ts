/** Calcula la siguiente fecha sin depender de la zona horaria del navegador/servidor. */
export function nextMaintenanceDate(date: string, intervalDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha programada inválida");
  if (!Number.isSafeInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
    throw new Error("La repetición debe estar entre 1 y 3650 días");
  }
  const result = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== date) throw new Error("Fecha programada inválida");
  result.setUTCDate(result.getUTCDate() + intervalDays);
  return result.toISOString().slice(0, 10);
}
