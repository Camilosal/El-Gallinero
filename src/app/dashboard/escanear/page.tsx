"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, Button, Badge, Modal, Input, Select, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { parseQrPayload } from "@/lib/qr";
import Link from "next/link";

interface Hen {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  stage?: string | null;
  ageWeeks?: number;
}

const statusLabels: Record<string, string> = {
  activa: "Activa",
  empollando: "Empollando",
  enferma: "Enferma",
  descarte: "Descarte",
  recomendada_sacrificio: "Recomendada sacrificio",
  vendida: "Vendida",
  faena: "Faena",
  muerta: "Muerta",
};

const statusColors: Record<string, string> = {
  activa: "green",
  empollando: "purple",
  enferma: "red",
  descarte: "orange",
  recomendada_sacrificio: "orange",
  vendida: "gray",
  faena: "blue",
  muerta: "gray",
};

export default function EscanearPage() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [hen, setHen] = useState<Hen | null>(null);
  const [hens, setHens] = useState<Hen[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [scanHelp, setScanHelp] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [actionModal, setActionModal] = useState<"vender" | "tratar" | "muerte" | null>(null);
  const [actionForm, setActionForm] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Load all hens for lookup
  useEffect(() => {
    apiFetch("/api/produccion/gallinas")
      .then((r) => r.json())
      .then(setHens)
      .catch(() => {});
  }, []);

  const lookupHen = useCallback(
    (henId: string) => {
      const found = hens.find((h) => h.id === henId);
      if (found) {
        setHen(found);
        setError("");
      } else {
        // Try fetching directly if not in cache
        apiFetch("/api/produccion/gallinas")
          .then((r) => r.json())
          .then((allHens: Hen[]) => {
            setHens(allHens);
            const h = allHens.find((x: Hen) => x.id === henId);
            if (h) {
              setHen(h);
              setError("");
            } else {
              setError("Gallina no encontrada");
              setHen(null);
            }
          })
          .catch(() => {
            setError("Error buscando gallina");
          });
      }
    },
    [hens],
  );

  const startScanner = async () => {
    setError("");
    setHen(null);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const henId = parseQrPayload(decodedText);
          if (henId) {
            lookupHen(henId);
            scanner.stop().catch(() => {});
            setScanning(false);
          } else {
            setError("QR no reconocido. Formato esperado: GALLINERO:<id>");
          }
        },
        () => {
          // scan failure callback (called each frame when no QR found) — ignore
        },
      );
    } catch (err) {
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualLookup = () => {
    if (!manualInput.trim()) return;
    // Try to find by code (case-insensitive)
    const found = hens.find((h) => h.code.toLowerCase() === manualInput.trim().toLowerCase());
    if (found) {
      setHen(found);
      setError("");
    } else {
      // Try as UUID directly
      lookupHen(manualInput.trim());
    }
    setManualInput("");
  };

  const openAction = (action: "vender" | "tratar" | "muerte") => {
    setActionModal(action);
    setActionError("");
    setActionSuccess("");
    if (action === "vender") {
      setActionForm({ buyer: "", pricePerUnit: "15000", weightKg: hen?.weight || "" });
    } else if (action === "tratar") {
      setActionForm({
        date: new Date().toISOString().split("T")[0],
        type: "tratamiento",
        description: "",
        product: "",
        cost: "0",
      });
    } else {
      setActionForm({
        date: new Date().toISOString().split("T")[0],
        cause: "causa_natural",
        description: "",
      });
    }
  };

  const submitAction = async () => {
    if (!hen) return;
    setActionError("");
    setActionSuccess("");

    try {
      if (actionModal === "vender") {
        const weight = Number(actionForm.weightKg) || 0;
        const price = Number(actionForm.pricePerUnit) || 0;
        const res = await apiFetch("/api/finanzas/finanzas/ventas-aves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: new Date().toISOString().split("T")[0],
            birdType: "gallina_descarte",
            quantity: 1,
            weightKg: weight,
            pricePerUnit: price,
            priceMode: "por_ave",
            totalAmount: price,
            buyer: actionForm.buyer,
            henId: hen.id,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar venta");
        }
        // Update hen status
        await apiFetch("/api/produccion/gallinas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: hen.id, code: hen.code, breed: hen.breed, birthDate: hen.birthDate, status: "vendida", weight: hen.weight }),
        });
        setActionSuccess("Venta registrada correctamente");
      } else if (actionModal === "tratar") {
        const res = await apiFetch("/api/sanidad/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: actionForm.date,
            type: actionForm.type,
            description: actionForm.description,
            affectedHens: JSON.stringify([hen.id]),
            product: actionForm.product,
            cost: actionForm.cost,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar tratamiento");
        }
        setActionSuccess("Tratamiento registrado correctamente");
      } else if (actionModal === "muerte") {
        const res = await apiFetch("/api/produccion/mortalidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: actionForm.date,
            birdType: "gallina",
            quantity: 1,
            cause: actionForm.cause,
            henId: hen.id,
            description: actionForm.description,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar mortalidad");
        }
        setActionSuccess("Mortalidad registrada correctamente");
      }
      setHen(null); // Go back to scanner
      setTimeout(() => setActionModal(null), 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al registrar");
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">📷 Escanear Ave</h1>
            <p className="text-slate-500 text-sm mt-1">Escanea el código QR de la banda de pata para identificar la gallina</p>
          </div>
          <button onClick={() => setScanHelp(!scanHelp)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mt-1">❓ Ayuda</button>
        </div>
        {scanHelp && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Escáner QR</p>
            <p>Usa la cámara para escanear el código QR de la banda de pata de cada gallina. Al identificarla verás su información completa: raza, edad, peso, estado y etapa productiva. Desde aquí puedes registrar acciones rápidas: vender la gallina, registrar un tratamiento sanitario o reportar su muerte. También puedes buscar manualmente por código o ID.</p>
          </div>
        )}
      </div>

      {/* Scanner area */}
      <Card className="mb-4">
        <div id="qr-reader" ref={containerRef} className="w-full rounded-lg overflow-hidden mb-3" />

        {!scanning ? (
          <div className="text-center space-y-3">
            {hen ? (
              <div className="text-left">
                {/* Hen card */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">🐔</span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">{hen.code}</h2>
                      <p className="text-sm text-slate-500">{hen.breed}</p>
                    </div>
                    <Badge color={statusColors[hen.status] || "gray"}>{statusLabels[hen.status] || hen.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-slate-500 text-xs">Peso</p>
                      <p className="font-semibold">{hen.weight ? `${hen.weight} kg` : "—"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-slate-500 text-xs">Etapa</p>
                      <p className="font-semibold">{hen.stage || "—"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-slate-500 text-xs">Edad</p>
                      <p className="font-semibold">{hen.ageWeeks ? `${hen.ageWeeks} sem` : "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    onClick={() => openAction("vender")}
                    className="flex flex-col items-center gap-1 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                  >
                    <span className="text-2xl">💰</span>
                    <span className="text-xs font-medium text-green-700">Vender</span>
                  </button>
                  <button
                    onClick={() => openAction("tratar")}
                    className="flex flex-col items-center gap-1 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <span className="text-2xl">💊</span>
                    <span className="text-xs font-medium text-blue-700">Tratar</span>
                  </button>
                  <button
                    onClick={() => openAction("muerte")}
                    className="flex flex-col items-center gap-1 p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    <span className="text-2xl">💀</span>
                    <span className="text-xs font-medium text-red-700">Muerte</span>
                  </button>
                </div>

                <Link
                  href={`/produccion/gallinas/${hen.id}`}
                  className="block w-full text-center p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                >
                  📋 Ver historial completo
                </Link>

                <button
                  onClick={() => { setHen(null); startScanner(); }}
                  className="w-full mt-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Escanear otra ave
                </button>
              </div>
            ) : (
              <>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <Button onClick={startScanner}>📷 Abrir cámara</Button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400">o busca por código</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                    placeholder="Ej: G-001"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <Button onClick={handleManualLookup} variant="secondary">
                    Buscar
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-slate-600 mb-2">Apunta la cámara al código QR de la banda de pata</p>
            <Button variant="secondary" onClick={stopScanner}>
              Detener cámara
            </Button>
          </div>
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        open={actionModal !== null}
        onClose={() => setActionModal(null)}
        title={
          actionModal === "vender" ? "💰 Vender Ave" : actionModal === "tratar" ? "💊 Registrar Tratamiento" : "💀 Registrar Muerte"
        }
      >
        {actionSuccess ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-green-700 font-medium">{actionSuccess}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

            {actionModal === "vender" && (
              <>
                <Input
                  label="Comprador"
                  value={actionForm.buyer || ""}
                  onChange={(e) => setActionForm({ ...actionForm, buyer: e.target.value })}
                  placeholder="Nombre del comprador"
                  help="Quién compra el ave"
                />
                <Input
                  label="Peso (kg)"
                  type="number"
                  step="0.01"
                  value={actionForm.weightKg || ""}
                  onChange={(e) => setActionForm({ ...actionForm, weightKg: e.target.value })}
                  placeholder="Ej: 2.5"
                  help="Peso en vivo del ave en kilogramos"
                />
                <Input
                  label="Precio por ave ($)"
                  type="number"
                  value={actionForm.pricePerUnit || ""}
                  onChange={(e) => setActionForm({ ...actionForm, pricePerUnit: e.target.value })}
                  help="Precio total de venta por esta ave"
                />
              </>
            )}

            {actionModal === "tratar" && (
              <>
                <Input
                  label="Fecha"
                  type="date"
                  value={actionForm.date || ""}
                  onChange={(e) => setActionForm({ ...actionForm, date: e.target.value })}
                  help="Fecha del tratamiento"
                />
                <Select
                  label="Tipo"
                  value={actionForm.type || "tratamiento"}
                  onChange={(e) => setActionForm({ ...actionForm, type: e.target.value })}
                  help="Tipo de intervención sanitaria"
                >
                  <option value="vacunacion">💉 Vacunación</option>
                  <option value="desparasitacion">🪱 Desparasitación</option>
                  <option value="tratamiento">💊 Tratamiento</option>
                  <option value="vitaminas">💧 Vitaminas</option>
                  <option value="otro">📋 Otro</option>
                </Select>
                <Input
                  label="Descripción"
                  value={actionForm.description || ""}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                  placeholder="Ej: Tratamiento respiratorio"
                  help="Detalles del tratamiento aplicado"
                />
                <Input
                  label="Producto"
                  value={actionForm.product || ""}
                  onChange={(e) => setActionForm({ ...actionForm, product: e.target.value })}
                  placeholder="Nombre del producto"
                  help="Nombre del medicamento o producto utilizado"
                />
                <Input
                  label="Costo ($)"
                  type="number"
                  value={actionForm.cost || "0"}
                  onChange={(e) => setActionForm({ ...actionForm, cost: e.target.value })}
                  help="Costo del tratamiento (medicamento + aplicación)"
                />
              </>
            )}

            {actionModal === "muerte" && (
              <>
                <Input
                  label="Fecha"
                  type="date"
                  value={actionForm.date || ""}
                  onChange={(e) => setActionForm({ ...actionForm, date: e.target.value })}
                  help="Fecha en que se encontró el ave muerta"
                />
                <Select
                  label="Causa"
                  value={actionForm.cause || "causa_natural"}
                  onChange={(e) => setActionForm({ ...actionForm, cause: e.target.value })}
                  help="Causa principal de la muerte"
                >
                  <option value="enfermedad">Enfermedad</option>
                  <option value="depredador">Depredador</option>
                  <option value="accidente">Accidente</option>
                  <option value="sacrificio_sanitario">Sacrificio sanitario</option>
                  <option value="causa_natural">Causa natural</option>
                  <option value="otro">Otro</option>
                </Select>
                <Textarea
                  label="Descripción"
                  value={actionForm.description || ""}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                  placeholder="Observaciones..."
                  help="Detalles adicionales sobre el suceso"
                />
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={submitAction}>Registrar</Button>
              <Button variant="secondary" onClick={() => setActionModal(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
