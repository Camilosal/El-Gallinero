"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Dna,
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  MapPin,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import BatchQrSheetModal from "@/components/BatchQrSheetModal";
import { apiFetch } from "@/lib/fetch";
import { exportDay1StarterCsvTemplate } from "@/lib/onboarding";
import type {
  BarnQuickGuidePdfData,
  CompostingPoePdfData,
  Week4HandoverActPdfData,
  WeekStatusItem,
  ZonificationMapPdfData,
} from "@/lib/export/turnkey-pdf";

interface DeliverablesJsonResponse {
  generatedAt: string;
  farm: {
    farmId: string;
    farmName: string;
    municipality: string;
    altitudeMeters: string;
    scale: string;
    planCode: string;
  };
  roadmap: WeekStatusItem[];
  zonification: ZonificationMapPdfData;
  barnQuickGuide: BarnQuickGuidePdfData;
  compostingPoe: CompostingPoePdfData;
  handoverAct: Week4HandoverActPdfData;
}

function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function statusBadge(status: WeekStatusItem["status"]) {
  if (status === "completado") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Completado
      </span>
    );
  }
  if (status === "en_progreso") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
        <Clock className="w-3.5 h-3.5" />
        En progreso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
      <Clock className="w-3.5 h-3.5" />
      Pendiente
    </span>
  );
}

export default function KitCampoRuta2Page() {
  const [data, setData] = useState<DeliverablesJsonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restrictedAct, setRestrictedAct] = useState(false);
  const [batchQrOpen, setBatchQrOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        let res = await apiFetch("/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=json");
        if (res.status === 403) {
          if (active) setRestrictedAct(true);
          res = await apiFetch("/api/operaciones/entregables-ruta2?tipo=zonificacion&format=json");
        }
        const body = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(body.error || "No se pudo cargar el estado de entrega Ruta 2.");
          return;
        }
        setData(body as DeliverablesJsonResponse);
      } catch {
        if (active) setError("Error de conexión cargando el centro Llave en Mano.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  function handleDownloadCsvTemplate() {
    const csv = exportDay1StarterCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_arranque_dia1.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const completedWeeks = data?.roadmap.filter((w) => w.status === "completado").length ?? 0;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/configuracion"
          className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Configuración
        </Link>
        {data && (
          <div className="text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl">
            {data.farm.farmName} · Escala {data.farm.scale} · Plan {data.farm.planCode} ({completedWeeks}/4 semanas)
          </div>
        )}
      </div>

      <HeroBanner
        theme="guia"
        icon={<ClipboardCheck className="w-4 h-4 text-amber-200" aria-hidden="true" />}
        title='Implementación "Llave en Mano" y Kit de Campo (Ruta 2)'
        description="Cronograma vivo de 4 semanas para granjas comerciales, plancha QR plastificable en lote y entregables PDF formales."
      />

      {error && (
        <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-sm font-medium text-red-900">
          {error}
        </div>
      )}

      {restrictedAct && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-950">
          Tu rol actual permite descargar placas QR, Mapa de Zonificación, Guía Rápida y Ficha de Compostaje. El Acta de Entrega Semana 4 está reservada para Propietario, Gerente o Veterinario.
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
          Calculando indicadores vivos de las 4 semanas...
        </div>
      ) : data ? (
        <>
          {/* Cronograma Vivo de 4 Semanas */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Cronograma Vivo de 4 Semanas (Mediano Productor)
              </h2>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                Corte: {data.generatedAt}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Semana 1 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Semana 1</p>
                      <h3 className="text-base font-bold text-slate-900">Diagnóstico y Zonificación Biosegura</h3>
                    </div>
                    {statusBadge(data.roadmap[0]?.status || "pendiente")}
                  </div>
                  <p className="text-xs text-slate-600">
                    Mapeo de áreas (limpia, producción, cuarentena, compostaje) y separación física entre aves y mamíferos (Res. MADR 205/2022).
                  </p>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-1">
                    <div>
                      <strong>Lugares activos:</strong> {data.zonification.locations.length} ·{" "}
                      <strong>Cuarentena:</strong> {data.zonification.hasQuarantineZone ? "Sí" : "Pendiente"} ·{" "}
                      <strong>Compostaje:</strong> {data.zonification.hasCompostZone ? "Sí" : "Pendiente"}
                    </div>
                    {data.zonification.hasMixedSpeciesConflict && (
                      <div className="text-red-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Cruce aves/mamíferos en: {data.zonification.mixedLocations.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/operaciones/entregables-ruta2?tipo=zonificacion&format=pdf"
                    download={`iwage-zonificacion-${data.generatedAt}.pdf`}
                    className="min-h-[48px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Mapa de Zonificación PDF
                  </a>
                  <Link
                    href="/dashboard/ubicaciones"
                    className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <MapPin className="w-4 h-4" />
                    Lugares
                  </Link>
                </div>
              </div>

              {/* Semana 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Semana 2</p>
                      <h3 className="text-base font-bold text-slate-900">Identificación QR y Genealogía</h3>
                    </div>
                    {statusBadge(data.roadmap[1]?.status || "pendiente")}
                  </div>
                  <p className="text-xs text-slate-600">
                    Placas plastificables por galpón/jaula/incubadora y control anti-consanguinidad de 3 generaciones en reproductores.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800">
                    <strong>Evidencia actual:</strong> {data.roadmap[1]?.evidence || "Sin registros aún"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchQrOpen(true)}
                    className="min-h-[48px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Abrir Plancha QR en Lote
                  </button>
                  <Link
                    href="/dashboard/produccion?tab=reproduccion"
                    className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <Dna className="w-4 h-4" />
                    Genealogía
                  </Link>
                </div>
              </div>

              {/* Semana 3 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Semana 3</p>
                      <h3 className="text-base font-bold text-slate-900">Analítica, Bodega 40 kg e ICA / NTC 1240</h3>
                    </div>
                    {statusBadge(data.roadmap[2]?.status || "pendiente")}
                  </div>
                  <p className="text-xs text-slate-600">
                    Bultos de 40 kg, prorrateo multi-especie, semáforo de tiempo de retiro y compostaje AGROSAVIA (Res. ICA 30292/2017).
                  </p>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-1">
                    <div>{data.roadmap[2]?.evidence}</div>
                    <div>
                      <strong>Retiros activos hoy:</strong> {data.barnQuickGuide.activeWithdrawals.length} ·{" "}
                      <strong>Pilas compostaje:</strong> {data.compostingPoe.piles.length}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/operaciones/entregables-ruta2?tipo=guia-galpon&format=pdf"
                    download={`iwage-guia-galpon-${data.generatedAt}.pdf`}
                    className="min-h-[48px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Guía Rápida PDF
                  </a>
                  <a
                    href="/api/operaciones/entregables-ruta2?tipo=compostaje-poe&format=pdf"
                    download={`iwage-compostaje-poe-${data.generatedAt}.pdf`}
                    className="min-h-[48px] px-3.5 rounded-xl border border-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Flame className="w-4 h-4" />
                    Ficha Compostaje / POE PDF
                  </a>
                </div>
              </div>

              {/* Semana 4 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Semana 4</p>
                      <h3 className="text-base font-bold text-slate-900">Roles RBAC y Marcha Blanca Auditada</h3>
                    </div>
                    {statusBadge(data.roadmap[3]?.status || "pendiente")}
                  </div>
                  <p className="text-xs text-slate-600">
                    Equipo configurado con permisos por rol, primer cierre diario auditado y entrega formal de punto de equilibrio unitario.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-1">
                    <div>
                      <strong>Equipo:</strong> {data.handoverAct.team.length} usuario(s) ·{" "}
                      <strong>Último cierre:</strong>{" "}
                      {data.handoverAct.lastClosure
                        ? `${data.handoverAct.lastClosure.closureDate} (${data.handoverAct.lastClosure.status})`
                        : "Pendiente"}
                    </div>
                    <div>
                      <strong>Costo real huevo / cubeta:</strong>{" "}
                      {formatCop(data.handoverAct.unitEconomics.realCostPerEgg)} /{" "}
                      {formatCop(data.handoverAct.unitEconomics.realCostPerTray30)} ·{" "}
                      <strong>Canal kg:</strong> {formatCop(data.handoverAct.unitEconomics.realCostPerCarcassKg)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!restrictedAct && (
                    <a
                      href="/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=pdf"
                      download={`iwage-acta-entrega-${data.generatedAt}.pdf`}
                      className="min-h-[48px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Acta de Entrega Semana 4 PDF
                    </a>
                  )}
                  <Link
                    href="/dashboard/configuracion/usuarios"
                    className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4" />
                    Usuarios y Roles
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Kit Estándar de Materiales de Campo (Sección 7) */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  Kit Estándar de Materiales de Campo (Sección 7)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Descarga e imprime los materiales físicos listos para laminar y entregar al equipo de granja.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBatchQrOpen(true)}
                className="min-h-[56px] p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left flex items-center gap-3 transition"
              >
                <QrCode className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-900">7.1 Plancha QR Plastificable (2×2 y 2×4 A4)</div>
                  <div className="text-xs text-slate-600">Puertas, jaulas, pozas de cuy, incubadoras y lotes activos</div>
                </div>
              </button>

              <a
                href="/api/operaciones/entregables-ruta2?tipo=guia-galpon&format=pdf"
                download={`iwage-guia-galpon-${data.generatedAt}.pdf`}
                className="min-h-[56px] p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left flex items-center gap-3 transition"
              >
                <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-900">7.2 Guía Rápida de Galpón Plastificable (PDF)</div>
                  <div className="text-xs text-slate-600">Flujo diario &lt; 2 min, semáforo de retiro y tabla NTC 1240</div>
                </div>
              </a>

              <a
                href="/api/operaciones/entregables-ruta2?tipo=zonificacion&format=pdf"
                download={`iwage-zonificacion-${data.generatedAt}.pdf`}
                className="min-h-[56px] p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left flex items-center gap-3 transition"
              >
                <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-900">7.3 Mapa de Zonificación Biosegura ICA (PDF)</div>
                  <div className="text-xs text-slate-600">Inventario de zonas y chequeo aves vs. mamíferos</div>
                </div>
              </a>

              <a
                href="/api/operaciones/entregables-ruta2?tipo=compostaje-poe&format=pdf"
                download={`iwage-compostaje-poe-${data.generatedAt}.pdf`}
                className="min-h-[56px] p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left flex items-center gap-3 transition"
              >
                <Flame className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-900">7.4 Ficha Compostaje AGROSAVIA y POE (PDF)</div>
                  <div className="text-xs text-slate-600">Fórmulas 3:1:1 y 7:2:2, pilas activas y vacío de 21 días</div>
                </div>
              </a>

              {!restrictedAct && (
                <a
                  href="/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=pdf"
                  download={`iwage-acta-entrega-${data.generatedAt}.pdf`}
                  className="min-h-[56px] p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left flex items-center gap-3 transition"
                >
                  <ClipboardCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">7.5 Acta Formal de Entrega Semana 4 (PDF)</div>
                    <div className="text-xs text-slate-600">Censo, cierre auditado, punto de equilibrio y firmas</div>
                  </div>
                </a>
              )}

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="min-h-[56px] p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left flex items-center gap-3 transition"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-slate-900">7.6 Plantilla CSV de Arranque Día 1</div>
                  <div className="text-xs text-slate-600">Archivo plantilla_arranque_dia1.csv para censo vivo inicial</div>
                </div>
              </button>
            </div>
          </section>
        </>
      ) : null}

      <BatchQrSheetModal
        open={batchQrOpen}
        onClose={() => setBatchQrOpen(false)}
        defaultTypes={["ubicacion", "lote", "activo"]}
      />
    </div>
  );
}
