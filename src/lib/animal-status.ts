/**
 * Definiciones compartidas de estados de animales.
 *
 * Esta es la fuente única para decidir qué animal sigue en el gallinero.
 * La regla central es:
 *
 * - "Presente" (o "activo" en la UI) = no vendido, no faenado, no muerto.
 * - "En postura" = gallina en estado "activa".
 * - "Disponible para salida" = gallina activa, empollando o recomendada
 *   para sacrificio (puede venderse o faenarse).
 *
 * Cualquier conteo de inventario debe usar estos helpers para que el inicio,
 * el listado de gallinas, adquisiciones, balance y KPIs muestren la misma
 * realidad.
 */

/** Gallinas que ya salieron del sistema. */
export const HEN_TERMINAL_STATUSES: string[] = ["vendida", "faena", "muerta"];

/** Gallos que ya salieron del sistema. */
export const ROOSTER_TERMINAL_STATUSES: string[] = ["vendido", "faena", "muerto"];

/** Lotes que ya salieron del sistema. */
export const BATCH_TERMINAL_STATUSES: string[] = ["vendido", "faena"];

/** Estados de gallina que siguen en el gallinero. */
export const HEN_PRESENT_STATUSES: string[] = [
  "activa",
  "empollando",
  "enferma",
  "descarte",
  "recomendada_sacrificio",
];

/** Estados de gallo que siguen en el gallinero. */
export const ROOSTER_PRESENT_STATUSES: string[] = ["activo", "enfermo"];

/** Estados de lote que siguen en el gallinero. */
export const BATCH_PRESENT_STATUSES: string[] = ["activo", "listo_sacrificio"];

/** Gallinas que pueden destinarse a venta o sacrificio. */
export const HEN_EXIT_AVAILABLE_STATUSES: string[] = [
  "activa",
  "empollando",
  "recomendada_sacrificio",
];

/** Gallinas que se consideran en postura. */
export const HEN_LAYING_STATUSES: string[] = ["activa"];

const HEN_TERMINAL = new Set(HEN_TERMINAL_STATUSES);
const ROOSTER_TERMINAL = new Set(ROOSTER_TERMINAL_STATUSES);
const BATCH_TERMINAL = new Set(BATCH_TERMINAL_STATUSES);

/** ¿La gallina sigue en el gallinero? */
export function isHenPresent(status: string): boolean {
  return !HEN_TERMINAL.has(status);
}

/** ¿El gallo sigue en el gallinero? */
export function isRoosterPresent(status: string): boolean {
  return !ROOSTER_TERMINAL.has(status);
}

/** ¿El lote sigue en el gallinero y tiene animales? */
export function isBatchPresent(status: string, currentQuantity = 1): boolean {
  return !BATCH_TERMINAL.has(status) && Number(currentQuantity) > 0;
}

/** ¿La gallina está en postura? */
export function isHenLaying(status: string): boolean {
  return HEN_LAYING_STATUSES.includes(status);
}

/** ¿La gallina puede venderse o faenarse? */
export function isHenAvailableForExit(status: string): boolean {
  return HEN_EXIT_AVAILABLE_STATUSES.includes(status);
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface HenStatusSummary {
  /** Gallinas registradas en total (incluye vendidas, faenadas y muertas). */
  registered: number;
  /** Gallinas que siguen en el gallinero. */
  present: number;
  /** Alias de present, para compatibilidad con la UI. */
  active: number;
  /** Gallinas en estado "activa" (en postura). */
  laying: number;
  broody: number;
  sick: number;
  discard: number;
  recommendedForSlaughter: number;
  sold: number;
  slaughtered: number;
  dead: number;
}

export interface RoosterStatusSummary {
  registered: number;
  present: number;
  /** Alias de present, para compatibilidad con la UI. */
  active: number;
  sick: number;
  sold: number;
  slaughtered: number;
  dead: number;
}

function totalCount(rows: readonly StatusCount[], statuses: readonly string[]): number {
  const allowed = new Set(statuses);
  return rows.reduce((sum, row) => sum + (allowed.has(row.status) ? Number(row.count || 0) : 0), 0);
}

function sumPresent(
  rows: readonly StatusCount[],
  isPresent: (status: string) => boolean,
): number {
  return rows.reduce((sum, row) => sum + (isPresent(row.status) ? Number(row.count || 0) : 0), 0);
}

/** Resume los conteos agrupados por estado de gallina. */
export function summarizeHens(rows: readonly StatusCount[]): HenStatusSummary {
  const present = sumPresent(rows, isHenPresent);
  return {
    registered: rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    present,
    active: present,
    laying: totalCount(rows, HEN_LAYING_STATUSES),
    broody: totalCount(rows, ["empollando"]),
    sick: totalCount(rows, ["enferma"]),
    discard: totalCount(rows, ["descarte"]),
    recommendedForSlaughter: totalCount(rows, ["recomendada_sacrificio"]),
    sold: totalCount(rows, ["vendida"]),
    slaughtered: totalCount(rows, ["faena"]),
    dead: totalCount(rows, ["muerta"]),
  };
}

/** Resume los conteos agrupados por estado de gallo. */
export function summarizeRoosters(rows: readonly StatusCount[]): RoosterStatusSummary {
  const present = sumPresent(rows, isRoosterPresent);
  return {
    registered: rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    present,
    active: present,
    sick: totalCount(rows, ["enfermo"]),
    sold: totalCount(rows, ["vendido"]),
    slaughtered: totalCount(rows, ["faena"]),
    dead: totalCount(rows, ["muerto"]),
  };
}
