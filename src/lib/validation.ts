import { db } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Validate a numeric value. Returns the parsed number or throws an error.
 */
export function validateNumber(
  value: any,
  fieldName: string,
  options?: { min?: number; max?: number; required?: boolean },
): number {
  if (options?.required && (value === undefined || value === null || value === "")) {
    throw new Error(`${fieldName} es requerido`);
  }

  if (value === undefined || value === null || value === "") {
    return NaN;
  }

  const num = Number(value);

  if (isNaN(num)) {
    throw new Error(`${fieldName} debe ser numérico`);
  }

  if (options?.min !== undefined && num < options.min) {
    throw new Error(`${fieldName} debe ser >= ${options.min}`);
  }

  if (options?.max !== undefined && num > options.max) {
    throw new Error(`${fieldName} debe ser <= ${options.max}`);
  }

  return num;
}

/**
 * Validate a date value. Returns ISO date string (YYYY-MM-DD) or throws.
 */
export function validateDate(value: any, fieldName: string): string {
  if (!value) {
    throw new Error(`${fieldName} es requerida`);
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }

  return date.toISOString().split("T")[0];
}

/**
 * Validate that a foreign key reference exists. Throws if not found.
 */
export async function validateExists(
  id: string,
  table: any,
  fieldName: string,
  client: any = db,
): Promise<void> {
  if (!id) {
    throw new Error(`${fieldName} es requerido`);
  }

  const [row] = await client.select().from(table).where(eq(table.id, id)).limit(1);
  if (!row) {
    throw new Error(`${fieldName} no encontrado`);
  }
}
