import { NextResponse } from "next/server";
import { loadSpeciesParams } from "@/lib/species-db";
import { calcularRentabilidadLote } from "@/lib/species-params";

/**
 * GET /api/especies/params
 * Parámetros productivos por especie. Se leen de Catálogos (params_especie)
 * y, si no hay datos, se usa la referencia estática como respaldo.
 *
 * GET /api/especies/params?species=conejo&quantity=20&acquisition=50000&autoconsumo=5&excedente=15
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get("species") || undefined;
  const quantity = Number(searchParams.get("quantity") || "0");
  const acquisitionCost = Number(searchParams.get("acquisition") || "0");
  const headsAutoconsumo = Number(searchParams.get("autoconsumo") || "0");
  const headsExcedente = searchParams.get("excedente") ? Number(searchParams.get("excedente")) : undefined;

  const params = await loadSpeciesParams(species);

  if (species && params.length === 0) {
    return NextResponse.json({ error: `Especie '${species}' no encontrada` }, { status: 404 });
  }

  const result = params.map((p) => {
    const base: Record<string, unknown> = { ...p };
    if (quantity > 0) {
      base.proyeccion = calcularRentabilidadLote(p, quantity, acquisitionCost, headsAutoconsumo, headsExcedente);
    }
    return base;
  });

  return NextResponse.json(species && result.length === 1 ? result[0] : result);
}
