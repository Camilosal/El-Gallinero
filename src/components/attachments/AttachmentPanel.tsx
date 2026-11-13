"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Paperclip,
  Sparkles,
  Trash2,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import {
  ATTACHMENT_CATEGORIES,
  parseColombianAgroDocument,
  prepareAttachmentFile,
  type AttachmentCategory,
  type AttachmentEntityType,
  type AttachmentRecord,
  type OcrExtractedPayload,
  type OcrExtractionMode,
} from "@/lib/attachments-shared";

interface AttachmentPanelProps {
  entityType: AttachmentEntityType;
  entityId: string;
  defaultCategory?: AttachmentCategory;
  ocrMode?: OcrExtractionMode;
  onOcrExtracted?: (data: OcrExtractedPayload) => void;
  title?: string;
  helpText?: string;
  compact?: boolean;
}

const OCR_MODE_LABELS: Record<OcrExtractionMode, { badge: string; placeholder: string }> = {
  factura_compra: {
    badge: "Autocompletar factura DIAN / bultos 40kg",
    placeholder:
      "Ej: Factura FE-1045 Proveedor: Italcol S.A. NIT 800123456-1 Fecha: 2026-03-15 10 Bultos de 40kg Concentrado Ponedora Valor unitario $92.000 Total $920.000",
  },
  etiqueta_ica: {
    badge: "Autocompletar Reg. ICA, lote y retiro",
    placeholder:
      "Ej: Producto: Vacuna Newcastle B1 Laboratorio: MSD Salud Animal Reg. ICA 4589-DB Lote: NK-2026A Vence: 2027-06-30 Tiempo de retiro: 21 días Temp: 2-8°C Vía ocular",
  },
  comprobante_pago: {
    badge: "Autocompletar comprobante Nequi / Banco",
    placeholder:
      "Ej: Comprobante Nequi Envío exitoso Valor: $450.000 Referencia: M94827162 Fecha: 2026-03-15 Para: Agroinsumos del Oriente",
  },
  rut_contacto: {
    badge: "Autocompletar RUT / NIT / Cédula",
    placeholder:
      "Ej: Razón social: Agropecuaria El Rosal SAS NIT: 901456789-2 Teléfono: 3124567890 Correo: ventas@elrosal.co Municipio: Rionegro Departamento: Antioquia Dirección: Km 4 Vía Llanogrande",
  },
};

export default function AttachmentPanel({
  entityType,
  entityId,
  defaultCategory = "general",
  ocrMode,
  onOcrExtracted,
  title = "Soportes fotográficos y documentos",
  helpText,
  compact = false,
}: AttachmentPanelProps) {
  const uid = useId();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [customCategory, setCustomCategory] = useState<AttachmentCategory | null>(null);
  const category = customCategory ?? defaultCategory;
  const [notes, setNotes] = useState("");
  const [textHint, setTextHint] = useState("");
  const [showTextOcrBox, setShowTextOcrBox] = useState(false);
  const [ocrSummary, setOcrSummary] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [previewItem, setPreviewItem] = useState<AttachmentRecord | null>(null);

  const loadAttachments = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/adjuntos?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          setItems(data);
        }
      }
    } catch {
      // Offline: conserva lista local
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void Promise.resolve().then(loadAttachments);
  }, [loadAttachments]);

  const runOcrExtraction = async (params: { dataUrl?: string; fileName?: string; hint?: string }) => {
    if (!ocrMode) return null;
    setOcrRunning(true);
    setError("");
    try {
      const res = await apiFetch("/api/asistente/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: ocrMode,
          dataUrl: params.dataUrl || "",
          fileName: params.fileName || "",
          textHint: params.hint ?? textHint,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.extracted) {
          const extracted = data.extracted as OcrExtractedPayload;
          setOcrSummary(extracted.summary || "Datos extraídos y aplicados al formulario.");
          onOcrExtracted?.(extracted);
          return extracted;
        }
      }
      // Fallback determinístico local si está sin conexión
      const localExtracted = parseColombianAgroDocument(
        ocrMode,
        params.hint ?? textHint,
        params.fileName || "",
      );
      setOcrSummary(localExtracted.summary);
      onOcrExtracted?.(localExtracted);
      return localExtracted;
    } catch {
      const localExtracted = parseColombianAgroDocument(
        ocrMode,
        params.hint ?? textHint,
        params.fileName || "",
      );
      setOcrSummary(localExtracted.summary);
      onOcrExtracted?.(localExtracted);
      return localExtracted;
    } finally {
      setOcrRunning(false);
    }
  };

  const handleFileSelected = async (file: File | null | undefined) => {
    if (!file || !entityId) return;
    setError("");
    setUploading(true);
    try {
      const prepared = await prepareAttachmentFile(file);
      let extractedPayload: OcrExtractedPayload | null = null;
      if (ocrMode) {
        extractedPayload = await runOcrExtraction({
          dataUrl: prepared.dataUrl,
          fileName: prepared.fileName,
          hint: textHint || notes,
        });
      }

      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : undefined;

      const payload = {
        ...(id ? { id } : {}),
        entityType,
        entityId,
        category,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        sizeBytes: prepared.sizeBytes,
        dataUrl: prepared.dataUrl,
        extractedText: textHint.trim() || extractedPayload?.summary || null,
        extractedData: extractedPayload ? (extractedPayload as unknown as Record<string, unknown>) : null,
        notes: notes.trim() || null,
      };

      const res = await apiFetch("/api/adjuntos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const isQueued = res.headers.get("X-Gallinero-Offline-Queued") === "1";
      const data = await res.json().catch(() => null);

      if (!res.ok && !isQueued) {
        setError(data?.error || "No se pudo guardar el adjunto.");
        return;
      }

      const createdRecord: AttachmentRecord =
        data && data.id && !isQueued
          ? (data as AttachmentRecord)
          : {
              id: id || `offline_${Date.now()}`,
              entityType,
              entityId,
              category,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
              sizeBytes: prepared.sizeBytes,
              dataUrl: prepared.dataUrl,
              extractedText: payload.extractedText,
              extractedData: payload.extractedData,
              notes: payload.notes,
              createdAt: new Date().toISOString(),
              _offlinePending: true,
            };

      setItems((prev) => [createdRecord, ...prev.filter((item) => item.id !== createdRecord.id)]);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al comprimir o adjuntar el archivo.");
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (id.startsWith("offline_")) return;
    try {
      await apiFetch(`/api/adjuntos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // Se sincronizará cuando regrese la red
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</span>
          {items.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              {items.length}
            </span>
          )}
        </div>
        {ocrMode && (
          <button
            type="button"
            onClick={() => setShowTextOcrBox((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{OCR_MODE_LABELS[ocrMode].badge}</span>
          </button>
        )}
      </div>

      {helpText && <p className="text-xs text-slate-500">{helpText}</p>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {ocrSummary && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <div className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <span className="font-bold">Lectura inteligente aplicada: </span>
              <span>{ocrSummary}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOcrSummary(null)}
            className="text-emerald-700 hover:text-emerald-950"
            aria-label="Cerrar aviso OCR"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Controles de captura con botones >= 48px aptos para uso rural con una mano */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          id={`${uid}-camera`}
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFileSelected(e.target.files?.[0])}
        />
        <input
          id={`${uid}-file`}
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => void handleFileSelected(e.target.files?.[0])}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{uploading ? "Comprimiendo (<250KB)..." : ocrMode ? "Tomar foto y autocompletar" : "Tomar foto de soporte"}</span>
        </button>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60"
        >
          <Upload className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
          <span>Subir imagen o PDF</span>
        </button>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Tipo de soporte</label>
            <select
              value={category}
              onChange={(e) => setCustomCategory(e.target.value as AttachmentCategory)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
            >
              {ATTACHMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">Nota del soporte (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Factura física firmada, lote visible..."
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
            />
          </div>
        </div>
      )}

      {ocrMode && showTextOcrBox && (
        <div className="rounded-xl border border-emerald-200 bg-white p-3 space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Pegar texto de factura, etiqueta ICA o comprobante para autocompletar sin foto:
          </label>
          <textarea
            rows={2}
            value={textHint}
            onChange={(e) => setTextHint(e.target.value)}
            placeholder={OCR_MODE_LABELS[ocrMode].placeholder}
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={ocrRunning || !textHint.trim()}
              onClick={() => void runOcrExtraction({ hint: textHint })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{ocrRunning ? "Analizando..." : "Extraer datos y llenar campos"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Lista de adjuntos */}
      {loading && items.length === 0 ? (
        <p className="text-xs text-slate-400">Cargando soportes adjuntos…</p>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const isPdf = item.mimeType === "application/pdf";
            const catLabel =
              ATTACHMENT_CATEGORIES.find((c) => c.value === item.category)?.label || item.category;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-white p-2 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isPdf ? (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-200">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                  ) : item.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.dataUrl}
                      alt={item.fileName}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Paperclip className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{item.fileName}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {catLabel} · {formatSize(item.sizeBytes)}
                    </p>
                    {item._offlinePending && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                        <WifiOff className="h-3 w-3" /> Guardado offline
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.dataUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      title="Ver soporte"
                      aria-label={`Ver ${item.fileName}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {item.dataUrl && (
                    <a
                      href={item.dataUrl}
                      download={item.fileName}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      title="Descargar"
                      aria-label={`Descargar ${item.fileName}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRemove(item.id)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    title="Eliminar adjunto"
                    aria-label={`Eliminar ${item.fileName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Visor modal (Lightbox) */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{previewItem.fileName}</h4>
                <p className="text-xs text-slate-500">
                  {ATTACHMENT_CATEGORIES.find((c) => c.value === previewItem.category)?.label || previewItem.category}
                  {" · "}
                  {formatSize(previewItem.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {previewItem.mimeType === "application/pdf" ? (
              <div className="text-center py-6 space-y-3">
                <FileText className="mx-auto h-12 w-12 text-red-600" />
                <p className="text-sm text-slate-700">Documento PDF adjunto ({formatSize(previewItem.sizeBytes)})</p>
                <a
                  href={previewItem.dataUrl}
                  download={previewItem.fileName}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Descargar PDF</span>
                </a>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewItem.dataUrl}
                alt={previewItem.fileName}
                className="mx-auto max-h-[68vh] rounded-xl object-contain"
              />
            )}

            {previewItem.extractedText && (
              <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">
                <strong>Datos extraídos OCR:</strong> {previewItem.extractedText}
              </div>
            )}
            {previewItem.notes && (
              <p className="text-xs text-slate-600">
                <strong>Nota:</strong> {previewItem.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

