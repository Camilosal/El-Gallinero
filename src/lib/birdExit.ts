// ─── Salida de gallos y lotes por venta o sacrificio ───
// Valida y aplica/revertir los efectos de vincular una venta o sacrificio
// a un gallo reproductor o a un lote de engorde.

import { db } from "@/db";
import { hens, roosters, broilerBatches } from "@/db/schema";
import { eq } from "drizzle-orm";

type DbLike = any;

export interface AnimalExitSnapshot {
  status: string;
  currentQuantity?: number;
}

export type AnimalExitSnapshots = Record<string, AnimalExitSnapshot>;

export async function captureAnimalExitSnapshots(
  client: DbLike,
  refs: { henId?: string | null; roosterId?: string | null; batchId?: string | null },
): Promise<AnimalExitSnapshots> {
  const snapshots: AnimalExitSnapshots = {};
  if (refs.henId) {
    const [hen] = await client.select({ status: hens.status }).from(hens).where(eq(hens.id, refs.henId)).for("update");
    if (hen) snapshots[`hen:${refs.henId}`] = { status: hen.status };
  }
  if (refs.roosterId) {
    const [rooster] = await client.select({ status: roosters.status }).from(roosters).where(eq(roosters.id, refs.roosterId)).for("update");
    if (rooster) snapshots[`rooster:${refs.roosterId}`] = { status: rooster.status };
  }
  if (refs.batchId) {
    const [batch] = await client.select({ status: broilerBatches.status, currentQuantity: broilerBatches.currentQuantity })
      .from(broilerBatches).where(eq(broilerBatches.id, refs.batchId)).for("update");
    if (batch) snapshots[`batch:${refs.batchId}`] = { status: batch.status, currentQuantity: batch.currentQuantity };
  }
  return snapshots;
}

export async function restoreHenExit(henId: string, status: string = "activa", client: DbLike = db) {
  await client.update(hens).set({ status: status as any, updatedAt: new Date() }).where(eq(hens.id, henId));
}

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
  const [rooster] = await client.select().from(roosters).where(eq(roosters.id, roosterId)).for("update");
  if (!rooster) return "Gallo no encontrado";
  if (!ROOSTER_EXIT_STATUSES.includes(rooster.status)) {
    return `El gallo no está disponible para salida (estado: ${rooster.status})`;
  }
  return null;
}

/** Valida lote disponible con stock suficiente; devuelve mensaje de error o null */
export async function validateBatchForExit(batchId: string, qty: number, client: DbLike = db): Promise<string | null> {
  const [batch] = await client.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
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
  const [batch] = await client.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
  if (!batch) return;
  if (qty > batch.currentQuantity) throw new Error(`Stock insuficiente del lote ${batch.code}: solo quedan ${batch.currentQuantity} aves`);
  const newQty = batch.currentQuantity - qty;
  await client.update(broilerBatches).set({
    currentQuantity: newQty,
    status: newQty === 0 ? batchExitStatus(kind) : batch.status,
    updatedAt: new Date(),
  }).where(eq(broilerBatches.id, batchId));
}

/** Revierte el descuento: devuelve cantidad al lote y lo reactiva si estaba terminal */
export async function restoreBatchExit(
  batchId: string,
  qty: number,
  client: DbLike = db,
  previousState?: AnimalExitSnapshot,
) {
  const [batch] = await client.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
  if (!batch) return;
  const newQty = batch.currentQuantity + qty;
  const wasTerminal = batch.status === "vendido" || batch.status === "faena";
  await client.update(broilerBatches).set({
    currentQuantity: newQty,
    status: wasTerminal && newQty > 0 ? (previousState?.status as any) || "activo" : batch.status,
    updatedAt: new Date(),
  }).where(eq(broilerBatches.id, batchId));
}

/** Marca el gallo con estado terminal */
export async function applyRoosterExit(roosterId: string, kind: "venta" | "sacrificio", client: DbLike = db) {
  await client.update(roosters).set({ status: roosterExitStatus(kind), updatedAt: new Date() }).where(eq(roosters.id, roosterId));
}

/** Revierte el estado terminal del gallo a activo */
export async function restoreRoosterExit(roosterId: string, client: DbLike = db, previousStatus = "activo") {
  await client.update(roosters).set({ status: previousStatus as any, updatedAt: new Date() }).where(eq(roosters.id, roosterId));
}
