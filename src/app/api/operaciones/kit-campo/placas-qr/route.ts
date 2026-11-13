import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { broilerBatches, farmAssets, farmLocations, hens } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { generateEntityQrPayload, generateEntityQrUrl, type QrEntityType } from "@/lib/qr";
import { todayColombiaIso } from "@/lib/date-validation";

export const dynamic = "force-dynamic";

export interface QrPlateItem {
  uid: string;
  entityType: QrEntityType;
  entityId: string;
  code: string;
  title: string;
  subtitle: string;
  locationName: string | null;
  zoneType: string;
  allowedSpecies: string[];
  isQuarantine: boolean;
  sanitaryEmptyUntil: string | null;
  payload: string;
  scannerUrl: string;
}

const VALID_TYPES = new Set<QrEntityType>(["ubicacion", "lote", "activo", "gallina"]);

function parseRequestedTypes(raw: string | null): Set<QrEntityType> {
  if (!raw || !raw.trim()) {
    return new Set<QrEntityType>(["ubicacion", "lote", "activo"]);
  }
  const picked = new Set<QrEntityType>();
  for (const token of raw.split(",")) {
    const clean = token.trim().toLowerCase() as QrEntityType;
    if (VALID_TYPES.has(clean)) picked.add(clean);
  }
  return picked.size > 0 ? picked : new Set<QrEntityType>(["ubicacion", "lote", "activo"]);
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const requestedTypes = parseRequestedTypes(searchParams.get("types"));
  const rawLimit = Number(searchParams.get("hensLimit") || 80);
  const hensLimit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.trunc(rawLimit))) : 80;
  const origin = searchParams.get("origin") || "";

  // Siempre consultamos ubicaciones activas para mapear zona biosegura a lotes, activos y aves
  const locRows = await db
    .select()
    .from(farmLocations)
    .where(eq(farmLocations.status, "activa"))
    .orderBy(asc(farmLocations.zoneType), asc(farmLocations.code));

  const locMap = new Map(locRows.map((l) => [l.id, l]));
  const plates: QrPlateItem[] = [];

  if (requestedTypes.has("ubicacion")) {
    for (const loc of locRows) {
      plates.push({
        uid: `ubicacion:${loc.id}`,
        entityType: "ubicacion",
        entityId: loc.id,
        code: loc.code,
        title: loc.name,
        subtitle: [
          loc.type.toUpperCase(),
          loc.capacity ? `Cap. ${loc.capacity}` : null,
          loc.localReference || null,
        ]
          .filter(Boolean)
          .join(" · "),
        locationName: loc.name,
        zoneType: loc.isQuarantine ? "cuarentena" : loc.zoneType || "produccion",
        allowedSpecies: Array.isArray(loc.allowedSpecies) ? loc.allowedSpecies : [],
        isQuarantine: Boolean(loc.isQuarantine || loc.zoneType === "cuarentena"),
        sanitaryEmptyUntil: loc.sanitaryEmptyUntil || null,
        payload: generateEntityQrPayload("ubicacion", loc.id),
        scannerUrl: generateEntityQrUrl("ubicacion", loc.id, origin),
      });
    }
  }

  if (requestedTypes.has("lote")) {
    const batchRows = await db
      .select()
      .from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))
      .orderBy(asc(broilerBatches.code));

    for (const b of batchRows) {
      const parentLoc = b.locationId ? locMap.get(b.locationId) : undefined;
      plates.push({
        uid: `lote:${b.id}`,
        entityType: "lote",
        entityId: b.id,
        code: b.code,
        title: `${b.breed} (${b.species})`,
        subtitle: [
          `Cant: ${b.currentQuantity}`,
          b.purpose.replaceAll("_", " "),
          parentLoc ? parentLoc.name : "Sin lugar",
        ].join(" · "),
        locationName: parentLoc?.name || null,
        zoneType: parentLoc?.isQuarantine ? "cuarentena" : parentLoc?.zoneType || "produccion",
        allowedSpecies: parentLoc?.allowedSpecies?.length ? parentLoc.allowedSpecies : [b.species],
        isQuarantine: Boolean(parentLoc?.isQuarantine || parentLoc?.zoneType === "cuarentena"),
        sanitaryEmptyUntil: parentLoc?.sanitaryEmptyUntil || null,
        payload: generateEntityQrPayload("lote", b.id),
        scannerUrl: generateEntityQrUrl("lote", b.id, origin),
      });
    }
  }

  if (requestedTypes.has("activo")) {
    const assetRows = await db
      .select()
      .from(farmAssets)
      .where(ne(farmAssets.status, "retirado"))
      .orderBy(asc(farmAssets.category), asc(farmAssets.code));

    // Priorizar equipos (incubadoras, básculas, comederos) y estructuras (bodegas)
    const priorityRank = (cat: string) => (cat === "equipo" ? 0 : cat === "estructura" ? 1 : 2);
    assetRows.sort((a, b) => priorityRank(a.category) - priorityRank(b.category) || a.code.localeCompare(b.code));

    for (const a of assetRows) {
      const parentLoc = a.locationId ? locMap.get(a.locationId) : undefined;
      plates.push({
        uid: `activo:${a.id}`,
        entityType: "activo",
        entityId: a.id,
        code: a.code,
        title: a.name,
        subtitle: [
          a.category.toUpperCase(),
          [a.brand, a.model].filter(Boolean).join(" ") || null,
          parentLoc?.name || null,
        ]
          .filter(Boolean)
          .join(" · "),
        locationName: parentLoc?.name || null,
        zoneType: parentLoc?.zoneType || "almacen",
        allowedSpecies: parentLoc?.allowedSpecies || [],
        isQuarantine: Boolean(parentLoc?.isQuarantine),
        sanitaryEmptyUntil: parentLoc?.sanitaryEmptyUntil || null,
        payload: generateEntityQrPayload("activo", a.id),
        scannerUrl: generateEntityQrUrl("activo", a.id, origin),
      });
    }
  }

  if (requestedTypes.has("gallina")) {
    const henRows = await db
      .select()
      .from(hens)
      .where(and(eq(hens.status, "activa")))
      .orderBy(asc(hens.code))
      .limit(hensLimit);

    for (const h of henRows) {
      const parentLoc = h.locationId ? locMap.get(h.locationId) : undefined;
      plates.push({
        uid: `gallina:${h.id}`,
        entityType: "gallina",
        entityId: h.id,
        code: h.code,
        title: `${h.code} · ${h.breed}`,
        subtitle: [
          "Reproductora / Ponedora",
          parentLoc?.name || "Sin galpón",
        ].join(" · "),
        locationName: parentLoc?.name || null,
        zoneType: parentLoc?.isQuarantine ? "cuarentena" : parentLoc?.zoneType || "produccion",
        allowedSpecies: ["gallina"],
        isQuarantine: Boolean(parentLoc?.isQuarantine),
        sanitaryEmptyUntil: parentLoc?.sanitaryEmptyUntil || null,
        payload: generateEntityQrPayload("gallina", h.id),
        scannerUrl: generateEntityQrUrl("gallina", h.id, origin),
      });
    }
  }

  const counts = {
    ubicacion: plates.filter((p) => p.entityType === "ubicacion").length,
    lote: plates.filter((p) => p.entityType === "lote").length,
    activo: plates.filter((p) => p.entityType === "activo").length,
    gallina: plates.filter((p) => p.entityType === "gallina").length,
    total: plates.length,
  };

  return NextResponse.json({
    generatedAt: todayColombiaIso(),
    counts,
    plates,
  });
});

