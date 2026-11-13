import { db } from "@/db";
import { broilerBatches, farmLocations, hens, roosters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeFeedingSpecies } from "@/lib/species";

type Client = Pick<typeof db, "select">;

/** Dimensiones analíticas de una transacción: permiten rentabilidad por especie, lugar y lote. */
export type TransactionDimensions = {
  species: string | null;
  locationId: string | null;
  batchId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const blank = (value: unknown) => value === undefined || value === null || value === "";

/**
 * Valida y completa las dimensiones recibidas. Si se indica un lote, la especie
 * y el lugar se derivan de él cuando no vienen explícitos (el usuario no digita lo que ya sabemos).
 */
export async function resolveDimensions(
  client: Client,
  input: { species?: unknown; locationId?: unknown; batchId?: unknown },
): Promise<{ dimensions: TransactionDimensions } | { error: string }> {
  let species: string | null = null;
  let locationId: string | null = null;
  let batchId: string | null = null;

  if (!blank(input.species)) {
    species = normalizeFeedingSpecies(input.species);
    if (!species) return { error: "Especie no válida" };
  }
  if (!blank(input.locationId)) {
    if (typeof input.locationId !== "string" || !UUID.test(input.locationId)) return { error: "Lugar no válido" };
    const [location] = await client.select({ id: farmLocations.id }).from(farmLocations).where(eq(farmLocations.id, input.locationId));
    if (!location) return { error: "El lugar indicado no existe" };
    locationId = location.id;
  }
  if (!blank(input.batchId)) {
    if (typeof input.batchId !== "string" || !UUID.test(input.batchId)) return { error: "Lote no válido" };
    const [batch] = await client.select({ id: broilerBatches.id, species: broilerBatches.species, locationId: broilerBatches.locationId })
      .from(broilerBatches).where(eq(broilerBatches.id, input.batchId));
    if (!batch) return { error: "El lote indicado no existe" };
    batchId = batch.id;
    species = species ?? batch.species;
    locationId = locationId ?? batch.locationId;
  }
  return { dimensions: { species, locationId, batchId } };
}

/** Deriva las dimensiones de la venta de un animal individual o de un lote. */
export async function dimensionsFromAnimals(
  client: Client,
  input: { henId?: unknown; roosterId?: unknown; batchId?: unknown },
): Promise<TransactionDimensions> {
  const dimensions: TransactionDimensions = { species: null, locationId: null, batchId: null };
  if (typeof input.batchId === "string" && UUID.test(input.batchId)) {
    const resolved = await resolveDimensions(client, { batchId: input.batchId });
    if ("dimensions" in resolved) return resolved.dimensions;
  }
  if (typeof input.henId === "string" && UUID.test(input.henId)) {
    const [hen] = await client.select({ locationId: hens.locationId }).from(hens).where(eq(hens.id, input.henId));
    if (hen) return { species: "gallina", locationId: hen.locationId, batchId: null };
  }
  if (typeof input.roosterId === "string" && UUID.test(input.roosterId)) {
    const [rooster] = await client.select({ locationId: roosters.locationId }).from(roosters).where(eq(roosters.id, input.roosterId));
    if (rooster) return { species: "gallo", locationId: rooster.locationId, batchId: null };
  }
  return dimensions;
}

