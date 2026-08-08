// ─── Salida de gallos y lotes por venta o sacrificio ───
// Valida y aplica/revertir los efectos de vincular una venta o sacrificio
// a un gallo reproductor o a un lote de engorde.

import { db } from "@/db";
import { roosters, broilerBatches } from "@/db/schema";
import { eq } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = any;

/** Estados de gallo que permiten venta/sacrificio */
export const ROOSTER_EXIT_STATUSES = ["activo", "enfermo"];

/** Estados de lote que permiten venta/sacrificio */
export const BATCH_EXIT_STATUSES = ["activo", "listo_sacrificio"];

/** Estado terminal del gallo según el motivo de salida */
export function roosterExitStatus(kind: "venta" | "sacrificio") {
  return kind === "venta" ? "vendido" : "faena";
}

/** Estado terminal del lote según el motivo de salida (solo si queda en 0) */
export function batchExitStatus(kind: "venta" | "sacrificio") {
  return kind === "venta" ? "vendido" : "faena";
}

/** Valida gallo disponible; devuelve mensaje de error o null */
export async function validateRoosterForExit(roosterId: string, client: DbLike = db): Promise<string | null> {
  const [rooster] = await client.select().from(roosters).where(eq(roosters.id, roosterId));
  if (!rooster) return "Gallo no encontrado";
  if (!ROOSTER_EXIT_STATUSES.includes(rooster.status)) {
    return `El gallo no está disponible para salida (estado: ${rooster.status})`;
  }
  return null;
}

/** Valida lote disponible con stock suficiente; devuelve mensaje de error o null */
export async function validateBatchForExit(batchId: string, qty: number, client: DbLike = db): Promise<string | null> {
  const [batch] = await client.select().from(broilerBatches).where(eq(broilerBatches.id, batchId));
  if (!batch) return "Lote no encontrado";
  if (!BATCH_EXIT_STATUSES.includes(batch.status)) {
    return `El lote no está disponible para salida (estado: ${batch.status})`;
  }
  if (qty > batch.currentQuantity) {
    return `Stock insuficiente del lote ${batch.code}: solo quedan ${batch.currentQuantity} aves`;
  }
  return null;
}

/** Descuenta cantidad del lote; si queda en 0 lo marca con el estado terminal */
export async function applyBatchExit(batchId: string, qty: number, kind: "venta" | "sacrificio", client: DbLike = db) {
  const [batch] = await client.select().from(broilerBatches).where(eq(broilerBatches.id, batchId));
  if (!batch) return;
  const newQty = Math.max(0, batch.currentQuantity - qty);
  await client.update(broilerBatches).set({
    currentQuantity: newQty,
    status: newQty === 0 ? batchExitStatus(kind) : batch.status,
    updatedAt: new Date(),
  }).where(eq(broilerBatches.id, batchId));
}

/** Revierte el descuento: devuelve cantidad al lote y lo reactiva si estaba terminal */
export async function restoreBatchExit(batchId: string, qty: number, client: DbLike = db) {
  const [batch] = await client.select().from(broilerBatches).where(eq(broilerBatches.id, batchId));
  if (!batch) return;
  const newQty = batch.currentQuantity + qty;
  const wasTerminal = batch.status === "vendido" || batch.status === "faena";
  await client.update(broilerBatches).set({
    currentQuantity: newQty,
    status: wasTerminal && newQty > 0 ? "activo" : batch.status,
    updatedAt: new Date(),
  }).where(eq(broilerBatches.id, batchId));
}

/** Marca el gallo con estado terminal */
export async function applyRoosterExit(roosterId: string, kind: "venta" | "sacrificio", client: DbLike = db) {
  await client.update(roosters).set({ status: roosterExitStatus(kind), updatedAt: new Date() }).where(eq(roosters.id, roosterId));
}

/** Revierte el estado terminal del gallo a activo */
export async function restoreRoosterExit(roosterId: string, client: DbLike = db) {
  await client.update(roosters).set({ status: "activo", updatedAt: new Date() }).where(eq(roosters.id, roosterId));
}
