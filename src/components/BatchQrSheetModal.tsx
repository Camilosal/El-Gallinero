"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckSquare, Printer, QrCode, Square } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import type { QrEntityType } from "@/lib/qr";
import type { QrPlateItem } from "@/app/api/operaciones/kit-campo/placas-qr/route";

type SheetLayout = "2x2" | "2x4";

const ENTITY_FILTER_OPTIONS: { type: QrEntityType; label: string }[] = [
  { type: "ubicacion", label: "Ubicaciones / Galpones" },
  { type: "lote", label: "Lotes activos" },
  { type: "activo", label: "Equipos / Incubadoras" },
  { type: "gallina", label: "Aves identificadas" },
];

const ZONE_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  limpia: { label: "ZONA LIMPIA", bg: "#ecfdf5", text: "#065f46", border: "#059669" },
  produccion: { label: "ZONA PRODUCCIÓN", bg: "#eff6ff", text: "#1e40af", border: "#2563eb" },
  almacen: { label: "BODEGA / ALMACÉN", bg: "#fefce8", text: "#854d0e", border: "#ca8a04" },
  forraje: { label: "BANCO FORRAJE", bg: "#f0fdf4", text: "#166534", border: "#16a34a" },
  sucia: { label: "ZONA SUCIA", bg: "#fff7ed", text: "#9a3412", border: "#ea580c" },
  cuarentena: { label: "CUARENTENA", bg: "#fef2f2", text: "#991b1b", border: "#dc2626" },
};

function getZoneStyle(zoneType: string, isQuarantine: boolean) {
  if (isQuarantine) return ZONE_META.cuarentena;
  return ZONE_META[zoneType] || ZONE_META.produccion;
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export default function BatchQrSheetModal({
  open,
  onClose,
  defaultTypes = ["ubicacion", "lote", "activo"],
}: {
  open: boolean;
  onClose: () => void;
  defaultTypes?: QrEntityType[];
}) {
  const [selectedTypes, setSelectedTypes] = useState<QrEntityType[]>(defaultTypes);
  const [layout, setLayout] = useState<SheetLayout>("2x4");
  const [plates, setPlates] = useState<QrPlateItem[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [renderingProgress, setRenderingProgress] = useState<{ done: number; total: number } | null>(null);

  const typesQuery = useMemo(() => {
    const clean = selectedTypes.length > 0 ? selectedTypes : ["ubicacion" as QrEntityType];
    return clean.join(",");
  }, [selectedTypes]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`/api/operaciones/kit-campo/placas-qr?types=${encodeURIComponent(typesQuery)}`);
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "No se pudieron cargar las placas QR");
          setPlates([]);
          return;
        }
        const list: QrPlateItem[] = Array.isArray(data.plates) ? data.plates : [];
        setPlates(list);
        setSelectedUids(new Set(list.map((p) => p.uid)));
      } catch {
        if (active) setError("Sin conexión para cargar el inventario de placas QR");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [open, typesQuery]);

  function toggleType(type: QrEntityType) {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((t) => t !== type);
        return next.length > 0 ? next : prev;
      }
      return [...prev, type];
    });
  }

  function toggleUid(uid: string) {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  const chosenPlates = useMemo(
    () => plates.filter((p) => selectedUids.has(p.uid)),
    [plates, selectedUids],
  );

  async function handlePrintSheet() {
    if (chosenPlates.length === 0 || typeof window === "undefined") return;
    setError("");
    setRenderingProgress({ done: 0, total: chosenPlates.length });

    try {
      const rendered: { plate: QrPlateItem; dataUrl: string }[] = [];
      const qrSize = layout === "2x2" ? 320 : 220;

      for (let i = 0; i < chosenPlates.length; i++) {
        const plate = chosenPlates[i];
        const dataUrl = await QRCode.toDataURL(plate.payload, { width: qrSize, margin: 2 });
        rendered.push({ plate, dataUrl });
        if (i % 4 === 0 || i === chosenPlates.length - 1) {
          setRenderingProgress({ done: i + 1, total: chosenPlates.length });
        }
      }

      const win = window.open("", "_blank");
      if (!win) {
        setError("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para imprimir.");
        setRenderingProgress(null);
        return;
      }

      const perPage = layout === "2x2" ? 4 : 8;
      const pages = chunkArray(rendered, perPage);
      const isDoor = layout === "2x2";

      const pagesHtml = pages
        .map((pageItems) => {
          const cardsHtml = pageItems
            .map(({ plate, dataUrl }) => {
              const zone = getZoneStyle(plate.zoneType, plate.isQuarantine);
              const speciesText = plate.allowedSpecies.length > 0
                ? plate.allowedSpecies.join(", ").toUpperCase()
                : "MULTI-ESPECIE";
              return `
                <div class="plate ${isDoor ? "plate-door" : "plate-compact"}" style="border-color:${zone.border};">
                  <div class="zone-band" style="background:${zone.bg};color:${zone.text};border-bottom:1.5px solid ${zone.border};">
                    <span>${escapeHtml(zone.label)}</span>
                    <span>${escapeHtml(plate.code)}</span>
                  </div>
                  <div class="plate-body">
                    <img class="qr" src="${dataUrl}" alt="QR ${escapeHtml(plate.code)}" />
                    <div class="info">
                      <div class="entity-kind">${escapeHtml(plate.entityType.toUpperCase())}</div>
                      <div class="title">${escapeHtml(plate.title)}</div>
                      ${plate.subtitle ? `<div class="sub">${escapeHtml(plate.subtitle)}</div>` : ""}
                      <div class="species">Especies: ${escapeHtml(speciesText)}</div>
                      <div class="offline-note">Escanear sin señal desde el menú Escáner QR</div>
                      <div class="payload">${escapeHtml(plate.payload)}</div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("");

          return `<section class="sheet-page ${isDoor ? "grid-2x2" : "grid-2x4"}">${cardsHtml}</section>`;
        })
        .join("");

      win.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>Plancha QR en Lote · Iwagé Granja (${escapeHtml(layout)})</title>
            <style>
              * { box-sizing: border-box; }
              @page { size: A4; margin: 10mm; }
              body {
                margin: 0;
                padding: 12px;
                font-family: Arial, Helvetica, sans-serif;
                color: #0f172a;
                background: #f8fafc;
              }
              .toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                background: #0f172a;
                color: #fff;
                padding: 10px 14px;
                border-radius: 10px;
                margin-bottom: 14px;
              }
              .toolbar button {
                background: #10b981;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 10px 16px;
                font-weight: bold;
                cursor: pointer;
              }
              .sheet-page {
                background: #fff;
                width: 190mm;
                margin: 0 auto 14px;
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 6mm;
                page-break-after: always;
              }
              .sheet-page:last-child { page-break-after: auto; }
              .grid-2x2 .plate { min-height: 130mm; }
              .grid-2x4 .plate { min-height: 62mm; border-style: dashed; }
              .plate {
                border: 2px solid #334155;
                border-radius: 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                background: #fff;
              }
              .zone-band {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 8px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.04em;
              }
              .plate-body {
                flex: 1;
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 10px;
                padding: 8px 10px;
              }
              .plate-door .plate-body {
                flex-direction: column;
                justify-content: center;
                text-align: center;
                padding: 14px;
              }
              .plate-door .qr { width: 155px; height: 155px; }
              .plate-compact .qr { width: 92px; height: 92px; flex-shrink: 0; }
              .info { min-width: 0; flex: 1; }
              .entity-kind {
                font-size: 9px;
                font-weight: 700;
                color: #475569;
                letter-spacing: 0.06em;
              }
              .title {
                font-size: 14px;
                font-weight: 800;
                color: #0f172a;
                margin: 2px 0;
                line-height: 1.2;
              }
              .plate-door .title { font-size: 17px; margin-top: 6px; }
              .sub { font-size: 10.5px; color: #334155; margin-bottom: 4px; }
              .species {
                font-size: 10px;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 4px;
              }
              .offline-note {
                font-size: 9.5px;
                font-weight: 600;
                color: #065f46;
                background: #ecfdf5;
                border: 1px solid #a7f3d0;
                border-radius: 4px;
                padding: 2px 5px;
                display: inline-block;
              }
              .payload {
                font-family: monospace;
                font-size: 8px;
                color: #64748b;
                word-break: break-all;
                margin-top: 4px;
              }
              @media print {
                body { padding: 0; background: #fff; }
                .no-print { display: none !important; }
                .sheet-page { margin: 0; width: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="toolbar no-print">
              <div>
                <strong>Kit de Campo · Plancha QR (${escapeHtml(layout)})</strong>
                <div style="font-size:12px;opacity:.85">${rendered.length} placa(s) · Listas para imprimir en A4 y plastificar</div>
              </div>
              <button onclick="window.print()">Imprimir / Guardar PDF A4</button>
            </div>
            ${pagesHtml}
            <script>setTimeout(() => window.print(), 300);</script>
          </body>
        </html>
      `);
      win.document.close();
    } catch {
      setError("Ocurrió un error generando los códigos QR de la plancha.");
    } finally {
      setRenderingProgress(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Plancha de Impresión QR en Lote (A4 Plastificable)">
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-slate-600">
          Genera todas las placas de puertas, jaulas, lotes e incubadoras listas para laminar en frío o caliente y escanear sin internet en galpón.
        </p>

        {/* Filtros de tipo */}
        <div className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-700">
            Incluir entidades en la plancha
          </span>
          <div className="flex flex-wrap gap-2">
            {ENTITY_FILTER_OPTIONS.map((opt) => {
              const active = selectedTypes.includes(opt.type);
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => toggleType(opt.type)}
                  className={`min-h-[48px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition ${
                    active
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {active ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de formato A4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLayout("2x2")}
            className={`min-h-[56px] p-3 rounded-xl border text-left transition ${
              layout === "2x2"
                ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="text-sm font-bold">Formato Puerta / Galpón (2×2 A4)</div>
            <div className="text-xs text-slate-600">4 placas grandes por hoja con banda de zona biosegura</div>
          </button>

          <button
            type="button"
            onClick={() => setLayout("2x4")}
            className={`min-h-[56px] p-3 rounded-xl border text-left transition ${
              layout === "2x4"
                ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="text-sm font-bold">Formato Jaula / Poza / Incubadora (2×4 A4)</div>
            <div className="text-xs text-slate-600">8 placas compactas por hoja con guías de corte para plastificar</div>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-xs sm:text-sm text-red-900">
            {error}
          </div>
        )}

        {/* Lista seleccionable */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              {selectedUids.size} de {plates.length} placa(s) seleccionada(s)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedUids(new Set(plates.map((p) => p.uid)))}
                className="text-xs font-semibold text-emerald-800 hover:underline px-2 py-1"
              >
                Seleccionar todas
              </button>
              <button
                type="button"
                onClick={() => setSelectedUids(new Set())}
                className="text-xs font-semibold text-slate-600 hover:underline px-2 py-1"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">Cargando placas del predio...</div>
            ) : plates.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No hay registros activos en las categorías seleccionadas.
              </div>
            ) : (
              plates.map((plate) => {
                const checked = selectedUids.has(plate.uid);
                const zone = getZoneStyle(plate.zoneType, plate.isQuarantine);
                return (
                  <label
                    key={plate.uid}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUid(plate.uid)}
                      className="h-5 w-5 rounded border-slate-300 text-emerald-700"
                    />
                    <QrCode className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-700">{plate.code}</span>
                        <span className="text-sm font-semibold text-slate-900 truncate">{plate.title}</span>
                      </div>
                      {plate.subtitle && (
                        <p className="text-xs text-slate-500 truncate">{plate.subtitle}</p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                      style={{ backgroundColor: zone.bg, color: zone.text, borderColor: zone.border }}
                    >
                      {zone.label}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {renderingProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-emerald-900">
              <span>Renderizando códigos QR de alta densidad...</span>
              <span>
                {renderingProgress.done} / {renderingProgress.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{
                  width: `${Math.round((renderingProgress.done / Math.max(1, renderingProgress.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => void handlePrintSheet()}
            disabled={chosenPlates.length === 0 || Boolean(renderingProgress)}
            className="inline-flex items-center gap-2 min-h-[48px]"
          >
            <Printer className="w-4 h-4" />
            <span>
              Imprimir plancha A4 ({chosenPlates.length})
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
