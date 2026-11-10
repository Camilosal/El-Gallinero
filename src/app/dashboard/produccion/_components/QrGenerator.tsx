"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Button, Modal } from "@/components/ui";
import { generateQrPayload } from "@/lib/qr";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";

interface Hen {
  id: string;
  code: string;
  breed: string;
  status: string;
}

export function QrGeneratorButton({ hens }: { hens: Hen[] }) {
  const [open, setOpen] = useState(false);
  const activeHens = hens.filter((h) => HEN_PRESENT_STATUSES.includes(h.status));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        🏷️ Etiquetas QR
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Etiquetas QR de Gallinas">
        <QrGeneratorContent hens={activeHens} />
      </Modal>
    </>
  );
}

function QrGeneratorContent({ hens }: { hens: Hen[] }) {
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generate = async () => {
      setGenerating(true);
      const urls: Record<string, string> = {};
      for (const hen of hens) {
        const payload = generateQrPayload(hen.id);
        try {
          urls[hen.id] = await QRCode.toDataURL(payload, {
            width: 200,
            margin: 1,
            color: { dark: "#1e293b", light: "#ffffff" },
          });
        } catch {
          // skip failed QR generation
        }
      }
      setQrUrls(urls);
      setGenerating(false);
    };
    generate();
  }, [hens]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas QR — El Gallinero</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: sans-serif; padding: 10mm; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
          .label { border: 1px solid #ccc; border-radius: 4px; padding: 3mm; text-align: center; page-break-inside: avoid; }
          .label img { width: 22mm; height: 22mm; }
          .label .code { font-size: 10pt; font-weight: bold; margin-top: 2mm; }
          .label .breed { font-size: 8pt; color: #666; margin-top: 1mm; }
          @media print {
            body { padding: 5mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:10mm;text-align:center;">
          <button onclick="window.print()" style="padding:8px 20px;font-size:12pt;cursor:pointer;">🖨️ Imprimir</button>
        </div>
        <div class="grid">
          ${hens
            .filter((h) => qrUrls[h.id])
            .map(
              (h) => `
            <div class="label">
              <img src="${qrUrls[h.id]}" alt="QR" />
              <div class="code">${h.code}</div>
              <div class="breed">${h.breed}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (hens.length === 0) {
    return <p className="text-center text-slate-400 py-6">No hay gallinas activas para generar etiquetas.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          {hens.length} etiqueta{hens.length !== 1 ? "s" : ""} lista{hens.length !== 1 ? "s" : ""} para imprimir
        </p>
        <Button onClick={handlePrint} disabled={generating || Object.keys(qrUrls).length === 0}>
          🖨️ Imprimir etiquetas
        </Button>
      </div>

      {generating ? (
        <p className="text-center text-slate-400 py-8">Generando códigos QR...</p>
      ) : (
        <div ref={printRef} className="grid grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
          {hens.map((hen) => (
            <div key={hen.id} className="border border-slate-200 rounded-lg p-2 text-center">
              {qrUrls[hen.id] ? (
                <>
                  <Image src={qrUrls[hen.id]} alt={`QR ${hen.code}`} width={200} height={200} unoptimized className="w-full aspect-square object-contain" />
                  <p className="text-xs font-bold text-slate-700 mt-1">{hen.code}</p>
                  <p className="text-[10px] text-slate-500 truncate">{hen.breed}</p>
                </>
              ) : (
                <div className="w-full aspect-square bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs">
                  Error
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
