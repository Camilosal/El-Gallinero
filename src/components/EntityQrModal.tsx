"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, Printer, QrCode } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { generateEntityQrPayload, generateEntityQrUrl, type QrEntityType } from "@/lib/qr";

const ENTITY_TYPE_LABEL: Record<QrEntityType, string> = {
  ubicacion: "Puerta / Galpón / Corral",
  lote: "Lote de crianza / postura",
  activo: "Activo / Equipo",
  gallina: "Gallina / Banda",
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function EntityQrModal({
  open,
  onClose,
  entityType,
  entityId,
  title,
  subtitle,
  code,
}: {
  open: boolean;
  onClose: () => void;
  entityType: QrEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  code?: string;
}) {
  const [qrState, setQrState] = useState<{ payload: string; dataUrl: string }>({
    payload: "",
    dataUrl: "",
  });
  const [copied, setCopied] = useState(false);

  const payload = entityId ? generateEntityQrPayload(entityType, entityId) : "";
  const scannerUrl = entityId ? generateEntityQrUrl(entityType, entityId) : "/dashboard/escanear";

  useEffect(() => {
    if (!open || !payload) return;
    let active = true;
    QRCode.toDataURL(payload, { width: 320, margin: 2 })
      .then((url) => {
        if (active) setQrState({ payload, dataUrl: url });
      })
      .catch(() => {
        if (active) setQrState({ payload, dataUrl: "" });
      });
    return () => {
      active = false;
    };
  }, [open, payload]);

  const dataUrl = qrState.payload === payload ? qrState.dataUrl : "";

  const handleCopy = async () => {
    if (!payload || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignorar si el navegador bloquea el portapapeles
    }
  };

  const handlePrint = () => {
    if (!dataUrl || typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Etiqueta QR · ${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; background: #fff; color: #0f172a; }
            .tag { border: 2px solid #0f172a; border-radius: 14px; padding: 18px; width: 280px; text-align: center; }
            .badge { display: inline-block; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
            .qr { width: 200px; height: 200px; margin: 12px auto 8px; display: block; }
            .code { font-size: 13px; font-weight: bold; color: #475569; margin: 4px 0 0; }
            .title { font-size: 18px; font-weight: bold; margin: 6px 0 2px; }
            .sub { font-size: 12px; color: #475569; margin: 0 0 8px; }
            .payload { font-family: monospace; font-size: 10px; color: #64748b; word-break: break-all; margin-top: 8px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 14px;font-weight:bold;">Imprimir etiqueta</button>
          <div class="tag">
            <span class="badge">${escapeHtml(ENTITY_TYPE_LABEL[entityType])}</span>
            <img class="qr" src="${dataUrl}" alt="Código QR ${escapeHtml(title)}" />
            ${code ? `<p class="code">${escapeHtml(code)}</p>` : ""}
            <p class="title">${escapeHtml(title)}</p>
            ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ""}
            <p class="payload">${escapeHtml(payload)}</p>
          </div>
          <script>setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Etiqueta QR · ${title}`}>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{ENTITY_TYPE_LABEL[entityType]}</span>
          </span>

          <div className="my-3 flex justify-center">
            {dataUrl ? (
              <Image
                src={dataUrl}
                alt={`QR ${title}`}
                width={208}
                height={208}
                unoptimized
                className="h-52 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs"
              />
            ) : (
              <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-400">
                Generando QR…
              </div>
            )}
          </div>

          {code && <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{code}</p>}
          <p className="text-base font-bold text-slate-800">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          <p className="mt-2 break-all rounded-md bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 border border-slate-200">
            {payload}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          Imprime y plastifica esta etiqueta en la puerta del galpón, jaula o equipo para escanearla incluso sin internet y registrar huevos, alimento o bajas en segundos.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handlePrint} disabled={!dataUrl} className="flex-1 inline-flex items-center justify-center gap-1.5">
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Imprimir etiqueta</span>
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleCopy()} className="inline-flex items-center gap-1.5">
            {copied ? <Check className="h-4 w-4 text-green-700" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            <span>{copied ? "Copiado" : "Copiar código"}</span>
          </Button>
        </div>

        <div className="text-center">
          <Link
            href={scannerUrl}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
          >
            <span>Abrir acciones en Escáner</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
