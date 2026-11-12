export const FARM_TIMEZONE = "America/Bogota";

/** Validates a real calendar date in YYYY-MM-DD form, independent of local timezone. */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Returns the current YYYY-MM-DD calendar date in America/Bogota regardless of host/browser UTC offset. */
export function todayColombiaIso(referenceDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    // Colombia does not observe DST (UTC-5 year-round).
    return new Date(referenceDate.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/** Returns YYYY-01-01 for the current year in America/Bogota. */
export function startOfColombiaYearIso(referenceDate: Date = new Date()): string {
  return `${todayColombiaIso(referenceDate).slice(0, 4)}-01-01`;
}

/** Adds whole calendar days to a YYYY-MM-DD date using UTC calendar math to avoid DST/offset drift. */
export function addDaysIso(dateIso: string, days: number): string {
  if (!isDateOnly(dateIso)) {
    throw new Error(`Fecha inválida: ${String(dateIso)}`);
  }
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Math.trunc(days));
  return d.toISOString().slice(0, 10);
}
