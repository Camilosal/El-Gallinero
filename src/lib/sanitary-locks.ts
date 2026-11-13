import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { dailyClosures, farmLocations, healthControl } from "@/db/schema";
import { ApiHttpError } from "@/lib/api-handler";

type DbOrTx = any;

export interface WithdrawalCheckOptions {
  date: string;
  species?: string | null;
  locationId?: string | null;
  batchId?: string | null;
  henId?: string | null;
  roosterId?: string | null;
  operationLabel?: string;
}

function parseAffectedHens(raw: string | null): string[] {
  if (!raw || raw === "todas") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function assertNoActiveWithdrawal(tx: DbOrTx, opts: WithdrawalCheckOptions) {
  const rows = await tx
    .select({
      id: healthControl.id,
      date: healthControl.date,
      type: healthControl.type,
      product: healthControl.product,
      species: healthControl.species,
      locationId: healthControl.locationId,
      batchId: healthControl.batchId,
      affectedHens: healthControl.affectedHens,
      withdrawalUntilDate: healthControl.withdrawalUntilDate,
    })
    .from(healthControl)
    .where(
      and(
        isNotNull(healthControl.withdrawalUntilDate),
        gte(healthControl.withdrawalUntilDate, opts.date),
        lte(healthControl.date, opts.date),
      ),
    );

  for (const row of rows) {
    const isAllHens = row.affectedHens === "todas";
    const affectedIds = parseAffectedHens(row.affectedHens);
    const matchesHen = Boolean(opts.henId && (isAllHens || affectedIds.includes(opts.henId)));
    const matchesBatch = Boolean(opts.batchId && row.batchId && row.batchId === opts.batchId);
    const matchesLocation = Boolean(
      opts.locationId &&
        row.locationId === opts.locationId &&
        (!row.species || !opts.species || row.species === opts.species),
    );
    const matchesSpeciesGlobal = Boolean(
      !row.locationId &&
        !row.batchId &&
        (!row.species || (opts.species && row.species === opts.species)),
    );
    // When an egg sale omits locationId/batchId, guard by species or global flock treatments
    const matchesUnscopedEggSale = Boolean(
      !opts.locationId &&
        !opts.batchId &&
        !opts.henId &&
        !opts.roosterId &&
        (!row.species || !opts.species || row.species === opts.species),
    );

    if (matchesHen || matchesBatch || matchesLocation || matchesSpeciesGlobal || matchesUnscopedEggSale || isAllHens) {
      throw new ApiHttpError(
        409,
        `Bloqueo por tiempo de retiro activo (${row.product || row.type}) hasta ${row.withdrawalUntilDate}. No se puede registrar ${opts.operationLabel || "esta operación"} por inocuidad alimentaria.`,
        { code: "ACTIVE_WITHDRAWAL", withdrawalUntilDate: row.withdrawalUntilDate, healthControlId: row.id },
      );
    }
  }
}

export async function assertLocationEntryAllowed(
  tx: DbOrTx,
  opts: { locationId: string; species?: string | null; date: string; lock?: boolean },
) {
  const baseQuery = tx.select().from(farmLocations).where(eq(farmLocations.id, opts.locationId));
  const [location] = opts.lock ? await baseQuery.for("update") : await baseQuery;
  if (!location || location.status !== "activa") {
    throw new Error("El lugar seleccionado no existe o no está activo");
  }
  if (["fuera_servicio", "restringida"].includes(location.operationalStatus)) {
    throw new Error("El lugar seleccionado está restringido o fuera de servicio");
  }
  if (location.sanitaryEmptyUntil && location.sanitaryEmptyUntil >= opts.date) {
    throw new ApiHttpError(
      409,
      `El lugar "${location.name}" está en vacío sanitario (21 días) hasta ${location.sanitaryEmptyUntil} y no admite ingreso de animales.`,
      { code: "SANITARY_EMPTY_LOCK", sanitaryEmptyUntil: location.sanitaryEmptyUntil },
    );
  }
  const allowed = Array.isArray(location.allowedSpecies)
    ? location.allowedSpecies.map((item: unknown) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];
  const normalizedSpecies = opts.species ? String(opts.species).trim().toLowerCase() : null;
  if (allowed.length > 0 && normalizedSpecies && !allowed.includes(normalizedSpecies)) {
    throw new ApiHttpError(
      409,
      `Por bioseguridad e aislamiento multiespecie, "${location.name}" solo admite: ${allowed.join(", ")}.`,
      { code: "SPECIES_ISOLATION_LOCK", allowedSpecies: allowed },
    );
  }
  return location;
}

export async function assertDateNotClosed(
  tx: DbOrTx,
  opts: { date: string; userRole?: string | null },
) {
  const [closure] = await tx
    .select()
    .from(dailyClosures)
    .where(and(eq(dailyClosures.closureDate, opts.date), eq(dailyClosures.status, "cerrado")))
    .limit(1);
  if (closure) {
    throw new ApiHttpError(
      409,
      `La fecha ${opts.date} ya tiene cierre diario bloqueado. Un administrador o propietario debe reabrirla para registrar cambios.`,
      { code: "DAILY_CLOSURE_LOCK", closureDate: opts.date },
    );
  }
}
