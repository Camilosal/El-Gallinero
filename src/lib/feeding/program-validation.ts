import { db } from "@/db";
import { feedInventory, feedPrograms } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

type Client = Pick<typeof db, "select" | "update">;

export type NormalizedProgramEntry = {
  feedId: string;
  dailyAmountPerHen: string;
  percentage: string;
};

const MAX_GRAMS = 9999.99;

/**
 * Normaliza las filas de una dieta combinada. El porcentaje siempre se deriva
 * de los gramos (dosis / total de la etapa), así nunca queda inconsistente con
 * el consumo real, que se calcula únicamente con `dailyAmountPerHen`.
 */
export function normalizeProgramEntries(raw: unknown): { entries: NormalizedProgramEntry[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Agrega al menos un alimento al programa" };
  const parsed: { feedId: string; grams: number }[] = [];
  for (const item of raw) {
    const feedId = typeof item?.feedId === "string" ? item.feedId.trim() : "";
    const grams = Number(item?.dailyAmountPerHen);
    if (!feedId || !Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) {
      return { error: "Cada alimento requiere una dosis mayor a 0 g y hasta 9999.99 g por animal al día" };
    }
    if (parsed.some((entry) => entry.feedId === feedId)) {
      return { error: "No repitas un alimento en el mismo programa" };
    }
    parsed.push({ feedId, grams: Math.round(grams * 100) / 100 });
  }
  return { entries: withDerivedPercentages(parsed) };
}

/** Reparte 100.00 % en proporción a los gramos; el residuo de redondeo va al mayor componente. */
export function withDerivedPercentages(items: { feedId: string; grams: number }[]): NormalizedProgramEntry[] {
  const total = items.reduce((sum, item) => sum + item.grams, 0);
  const pct = items.map((item) => (total > 0 ? Math.round((item.grams / total) * 10000) / 100 : 0));
  const drift = Math.round((100 - pct.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (total > 0 && drift !== 0) {
    const largest = pct.indexOf(Math.max(...pct));
    pct[largest] = Math.round((pct[largest] + drift) * 100) / 100;
  }
  return items.map((item, index) => ({
    feedId: item.feedId,
    dailyAmountPerHen: item.grams.toFixed(2),
    percentage: pct[index].toFixed(2),
  }));
}

/** Devuelve los feedId que no existen en el inventario. */
export async function findMissingFeeds(client: Client, feedIds: string[]): Promise<string[]> {
  if (feedIds.length === 0) return [];
  const rows = await client.select({ id: feedInventory.id }).from(feedInventory).where(inArray(feedInventory.id, feedIds));
  const found = new Set(rows.map((row) => row.id));
  return feedIds.filter((id) => !found.has(id));
}

/** Recalcula `percentage` de todas las filas de una etapa a partir de sus gramos. */
export async function recomputeStagePercentages(client: Client, stageCatalogoId: string): Promise<void> {
  const rows = await client.select().from(feedPrograms).where(eq(feedPrograms.stageCatalogoId, stageCatalogoId));
  const derived = withDerivedPercentages(rows.map((row) => ({ feedId: row.feedId, grams: Number(row.dailyAmountPerHen) })));
  for (const row of rows) {
    const next = derived.find((entry) => entry.feedId === row.feedId);
    if (next && next.percentage !== Number(row.percentage).toFixed(2)) {
      await client.update(feedPrograms).set({ percentage: next.percentage, updatedAt: new Date() }).where(eq(feedPrograms.id, row.id));
    }
  }
}

