import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { saveExternalSnapshot } from "@/lib/external-sources/snapshot-store";
import { parseIdeamHydroCsv } from "@/lib/external-sources/wave5-official-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 8_000_000;
const IDEAM_CSV_URL = "https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv";

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("integrations:manage");
  if (denied) return denied;

  const body = await safeParseJson(req);
  const action = String(body.action || "preview");
  const fileName = String(body.fileName || "").trim();
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (action !== "preview" && action !== "import") {
    return NextResponse.json({ error: "Acción de importación IDEAM no válida." }, { status: 400 });
  }
  if (!csv) {
    return NextResponse.json({ error: "Selecciona el CSV oficial de alertas hidrológicas IDEAM." }, { status: 400 });
  }
  if (Buffer.byteLength(csv, "utf8") > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "El CSV supera 8 MB; descarga el archivo oficial sin exportar datos adicionales." }, { status: 413 });
  }
  if (!fileName.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Este respaldo debe ser un archivo CSV." }, { status: 415 });
  }

  let alerts;
  try {
    alerts = parseIdeamHydroCsv(csv);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "El CSV IDEAM no pudo validarse." }, { status: 400 });
  }

  const preview = {
    ok: true,
    action,
    fileName: fileName.slice(0, 180),
    alertCount: alerts.length,
    alerts: alerts.slice(0, 10),
  };
  if (action === "preview") return NextResponse.json(preview);

  const summary = alerts.length + " alertas hidrológicas vigentes importadas desde " + fileName.slice(0, 100);
  const snapshot = await saveExternalSnapshot({
    sourceKey: "ideam_hydro_alerts",
    wave: 5,
    status: "manual",
    syncMode: "manual",
    providerName: "IDEAM · CSV oficial descargado por la granja",
    sourceUrl: IDEAM_CSV_URL,
    scopeKey: "global",
    payload: {
      datasetId: "h4gs-wsmg",
      datasetName: "Alertas hidrológicas vigentes · IDEAM",
      coverageScope: "nacional",
      coverageLabel: "Nacional · Alertas hidrológicas IDEAM",
      metadataUpdatedAt: null,
      alerts,
      importedFileName: fileName.slice(0, 180),
      note: "Archivo CSV oficial de alertas IDEAM importado por la granja. La fecha de consulta corresponde a la carga; confirme el boletín oficial antes de actuar.",
    },
    summary,
    ttlHours: 24,
  });

  return NextResponse.json({ ...preview, snapshotStatus: snapshot.status, summary });
});
