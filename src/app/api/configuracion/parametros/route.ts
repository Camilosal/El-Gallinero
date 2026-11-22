import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { getSettings, getSettingsForApi, updateSettings } from "@/lib/settings";
import { resolveZoneWithFallback } from "@/lib/divipola-catalog";
import {
  syncDivipolaSnapshot,
  syncMarketPricesSnapshot,
  syncWeatherSnapshot,
} from "@/lib/external-sources/wave1-territory-weather-market";
import { syncIcaVademecumAndAlertsSnapshot } from "@/lib/external-sources/wave2-standards-sanitary-ica";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** GET /api/configuracion/parametros — parámetros globales con su valor efectivo. */
export const GET = withApiHandler(async () => {
  return NextResponse.json(await getSettingsForApi());
});

/** PUT /api/configuracion/parametros — actualiza uno o varios parámetros. */
export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("catalogs:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const updates = Array.isArray(body.updates)
    ? body.updates
    : body.key
      ? [{ key: body.key, value: body.value }]
      : [];

  if (updates.length === 0) {
    return NextResponse.json({ error: "Envíe al menos un parámetro" }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    const userId = user?.id ?? null;
    await updateSettings(updates, userId);

    const updatedKeys = new Set(
      updates
        .map((u: unknown) =>
          u && typeof u === "object" && "key" in u ? String((u as { key: unknown }).key) : "",
        )
        .filter(Boolean),
    );
    const locationTouched =
      updatedKeys.has("farm.country") ||
      updatedKeys.has("farm.department") ||
      updatedKeys.has("farm.city") ||
      updatedKeys.has("farm.dane_municipality_code");

    if (locationTouched) {
      const current = await getSettings();
      const country = (current["farm.country"] || "Colombia").trim();
      const isColombia = country === "" || country.toLowerCase().includes("colombia");

      if (isColombia) {
        const zone = resolveZoneWithFallback({
          daneCode: updatedKeys.has("farm.dane_municipality_code")
            ? current["farm.dane_municipality_code"]
            : updatedKeys.has("farm.city") || updatedKeys.has("farm.department")
              ? undefined
              : current["farm.dane_municipality_code"],
          city: current["farm.city"],
          department:
            updatedKeys.has("farm.city") && !updatedKeys.has("farm.department")
              ? undefined
              : current["farm.department"],
          country,
        });

        if (zone.coverageScope === "local") {
          const backfill: Array<{ key: string; value: string }> = [];
          if (!updatedKeys.has("farm.dane_municipality_code")) {
            backfill.push({ key: "farm.dane_municipality_code", value: zone.municipality.daneCode });
          }
          if (!updatedKeys.has("farm.department")) {
            backfill.push({ key: "farm.department", value: zone.municipality.department });
          }
          if (!updatedKeys.has("farm.city")) {
            backfill.push({ key: "farm.city", value: zone.municipality.municipality });
          }
          if (!updatedKeys.has("farm.altitude_meters")) {
            backfill.push({ key: "farm.altitude_meters", value: String(zone.municipality.altitudeMeters) });
          }
          if (!updatedKeys.has("farm.latitude")) {
            backfill.push({ key: "farm.latitude", value: String(zone.municipality.latitude) });
          }
          if (!updatedKeys.has("farm.longitude")) {
            backfill.push({ key: "farm.longitude", value: String(zone.municipality.longitude) });
          }
          if (backfill.length > 0) {
            await updateSettings(backfill, userId);
          }
        } else if (
          (updatedKeys.has("farm.city") || updatedKeys.has("farm.department") || updatedKeys.has("farm.country")) &&
          !updatedKeys.has("farm.dane_municipality_code") &&
          current["farm.dane_municipality_code"]
        ) {
          await updateSettings([{ key: "farm.dane_municipality_code", value: "" }], userId);
        }
      }

      if (current["external.sync_enabled"] === "true") {
        await Promise.allSettled([
          syncDivipolaSnapshot({ forceRefresh: true }),
          syncWeatherSnapshot({ forceRefresh: true }),
          syncMarketPricesSnapshot({ forceRefresh: true }),
          syncIcaVademecumAndAlertsSnapshot({ forceRefresh: true }),
        ]);
      }
    }

    return NextResponse.json(await getSettingsForApi());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar parámetros";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
