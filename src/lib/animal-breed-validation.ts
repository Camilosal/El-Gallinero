import { catalogos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canonicalBreedType, normalizeManagedSpecies, type ManagedAnimalSpecies } from "@/lib/animal-breeds";

/** Returns an error when a chosen breed belongs to another species. */
export async function validateBreedAssociation(client: any, breed: string, species: ManagedAnimalSpecies): Promise<string | null> {
  const value = String(breed || "").trim();
  if (!value) return "Selecciona una raza o tipo del catálogo";

  const rows = await client
    .select({ value: catalogos.value, tipo: catalogos.tipo })
    .from(catalogos)
    .where(eq(catalogos.category, "raza"));
  const normalizedValue = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const row = rows.find((item: { value: string }) =>
    item.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedValue,
  );
  const associatedSpecies = row
    ? normalizeManagedSpecies(row.tipo) || (!row.tipo ? canonicalBreedType(row.value) || "gallina" : null)
    : canonicalBreedType(value);

  if (associatedSpecies !== species) {
    return `La raza “${value}” no está asociada a ${species}; selecciona una opción compatible.`;
  }
  return null;
}
