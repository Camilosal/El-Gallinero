"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import {
  Bird,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Egg,
  ExternalLink,
  HeartPulse,
  Layers,
  MapPin,
  Pill,
  Receipt,
  Skull,
  Wheat,
  WifiOff,
  Wrench,
} from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import { Card, Button, Badge, Modal, Input, Select, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { apiFetch } from "@/lib/fetch";
import { todayColombiaIso } from "@/lib/date-validation";
import { parseQrTarget } from "@/lib/qr";
import { HEN_PRESENT_STATUSES, isHenAvailableForExit } from "@/lib/animal-status";
import { LOCATION_TYPE_LABELS, type FarmLocation, useFarmLocations } from "@/lib/useFarmLocations";
import { getCachedCatalog } from "@/lib/offline/db";
import { openQuickCapture, QUICK_CAPTURE_SAVED_EVENT } from "@/lib/quick-capture-events";
import { SPECIES_LABEL } from "@/lib/species-params";

interface Hen {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  stage?: string | null;
  ageWeeks?: number;
  locationId?: string | null;
}

interface Batch {
  id: string;
  code: string;
  species: string;
  breed: string;
  purpose?: string | null;
  currentQuantity: number;
  initialQuantity: number;
  status: string;
  ageWeeks?: number;
  locationId?: string | null;
  locationName?: string | null;
}

interface FarmAsset {
  id: string;
  code: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: string;
  locationId?: string | null;
  locationName?: string | null;
}

type ScannedSelection =
  | { type: "gallina"; hen: Hen }
  | { type: "ubicacion"; location: FarmLocation }
  | { type: "lote"; batch: Batch }
  | { type: "activo"; asset: FarmAsset };

interface UnifiedMatch {
  key: string;
  type: "gallina" | "ubicacion" | "lote" | "activo";
  title: string;
  subtitle: string;
  badgeText: string;
  badgeColor: string;
  selection: ScannedSelection;
}

const statusLabels: Record<string, string> = {
  activa: "Activa",
  empollando: "Empollando",
  enferma: "Enferma",
  descarte: "Descarte",
  recomendada_sacrificio: "Sugerida faena",
  vendida: "Vendida",
  muerta: "Muerta",
  sacrificada: "Sacrificada",
};

const statusColors: Record<string, string> = {
  activa: "green",
  empollando: "purple",
  enferma: "red",
  descarte: "yellow",
  recomendada_sacrificio: "orange",
  vendida: "blue",
  muerta: "gray",
  sacrificada: "gray",
};

const batchStatusLabels: Record<string, { label: string; color: string }> = {
  activo: { label: "En crianza", color: "green" },
  listo_sacrificio: { label: "Listo sacrificio", color: "orange" },
  vendido: { label: "Vendido", color: "blue" },
  faena: { label: "Faena", color: "gray" },
};

const assetStatusLabels: Record<string, { label: string; color: string }> = {
  operativo: { label: "Operativo", color: "green" },
  requiere_mantenimiento: { label: "Requiere atención", color: "yellow" },
  fuera_servicio: { label: "Fuera de servicio", color: "red" },
  retirado: { label: "Retirado", color: "gray" },
};

export default function EscanearPage() {
  const { locations } = useFarmLocations(false);
  const [hens, setHens] = useState<Hen[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assets, setAssets] = useState<FarmAsset[]>([]);
  const [online, setOnline] = useState(true);

  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<ScannedSelection | null>(null);
  const [error, setError] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [quickToast, setQuickToast] = useState("");

  // Hen-specific quick modals preserved for compatibility
  const [actionModal, setActionModal] = useState<"vender" | "tratar" | "muerte" | null>(null);
  const [actionForm, setActionForm] = useState<Record<string, string>>({});
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const actionSubmittingRef = useRef(false);
  const queryAppliedRef = useRef(false);

  const refreshCatalogs = useCallback(async () => {
    const [cHens, cBatches, cAssets] = await Promise.all([
      getCachedCatalog<Hen[]>("hens_all"),
      getCachedCatalog<Batch[]>("broiler_batches_all"),
      getCachedCatalog<FarmAsset[]>("farm_assets_active"),
    ]);
    if (Array.isArray(cHens)) setHens(cHens);
    if (Array.isArray(cBatches)) setBatches(cBatches);
    if (Array.isArray(cAssets)) setAssets(cAssets);

    if (typeof navigator !== "undefined" && navigator.onLine !== false) {
      try {
        const [hRes, bRes, aRes] = await Promise.all([
          apiFetch("/api/produccion/gallinas").catch(() => null),
          apiFetch("/api/produccion/pollos").catch(() => null),
          apiFetch("/api/operaciones/activos").catch(() => null),
        ]);
        if (hRes?.ok) {
          const data = await hRes.json().catch(() => null);
          if (Array.isArray(data)) setHens(data);
        }
        if (bRes?.ok) {
          const data = await bRes.json().catch(() => null);
          if (Array.isArray(data)) setBatches(data);
        }
        if (aRes?.ok) {
          const data = await aRes.json().catch(() => null);
          if (Array.isArray(data)) setAssets(data);
        }
      } catch {
        // Offline: mantener datos en caché
      }
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (typeof navigator !== "undefined") setOnline(navigator.onLine);
      void refreshCatalogs();
    });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onSaved = () => {
      setQuickToast("Registro guardado correctamente.");
      void refreshCatalogs();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(QUICK_CAPTURE_SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(QUICK_CAPTURE_SAVED_EVENT, onSaved);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [refreshCatalogs]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const resolvePayload = useCallback(
    (raw: string): boolean => {
      const clean = raw.trim();
      if (!clean) return false;

      const parsed = parseQrTarget(clean);
      if (parsed) {
        if (parsed.type === "ubicacion") {
          const foundLoc = locations.find(
            (l) => l.id === parsed.id || l.code.toLowerCase() === parsed.id.toLowerCase(),
          );
          if (foundLoc) {
            setSelected({ type: "ubicacion", location: foundLoc });
            setError("");
            return true;
          }
          setError(`No se encontró la ubicación "${parsed.id}" en caché.`);
          return false;
        }
        if (parsed.type === "lote") {
          const foundBatch = batches.find(
            (b) => b.id === parsed.id || b.code.toLowerCase() === parsed.id.toLowerCase(),
          );
          if (foundBatch) {
            setSelected({ type: "lote", batch: foundBatch });
            setError("");
            return true;
          }
          setError(`No se encontró el lote "${parsed.id}" en caché.`);
          return false;
        }
        if (parsed.type === "activo") {
          const foundAsset = assets.find(
            (a) => a.id === parsed.id || a.code.toLowerCase() === parsed.id.toLowerCase(),
          );
          if (foundAsset) {
            setSelected({ type: "activo", asset: foundAsset });
            setError("");
            return true;
          }
          setError(`No se encontró el activo "${parsed.id}" en caché.`);
          return false;
        }
        const foundHen = hens.find(
          (h) => h.id === parsed.id || h.code.toLowerCase() === parsed.id.toLowerCase(),
        );
        if (foundHen) {
          setSelected({ type: "gallina", hen: foundHen });
          setError("");
          return true;
        }
        setError(`No se encontró el ave "${parsed.id}" en caché.`);
        return false;
      }

      // Direct search by code or ID across entities
      const lower = clean.toLowerCase();
      const locExact = locations.find(
        (l) => l.id === clean || l.code.toLowerCase() === lower || l.name.toLowerCase() === lower,
      );
      if (locExact) {
        setSelected({ type: "ubicacion", location: locExact });
        setError("");
        return true;
      }
      const batchExact = batches.find((b) => b.id === clean || b.code.toLowerCase() === lower);
      if (batchExact) {
        setSelected({ type: "lote", batch: batchExact });
        setError("");
        return true;
      }
      const assetExact = assets.find(
        (a) => a.id === clean || a.code.toLowerCase() === lower || a.name.toLowerCase() === lower,
      );
      if (assetExact) {
        setSelected({ type: "activo", asset: assetExact });
        setError("");
        return true;
      }
      const henExact = hens.find((h) => h.id === clean || h.code.toLowerCase() === lower);
      if (henExact) {
        setSelected({ type: "gallina", hen: henExact });
        setError("");
        return true;
      }

      setError(`No se encontró ningún lugar, lote, equipo ni ave con "${clean}".`);
      return false;
    },
    [assets, batches, hens, locations],
  );

  // Resolve ?qr=... URL parameter once catalogs arrive
  useEffect(() => {
    if (queryAppliedRef.current || typeof window === "undefined") return;
    const qrParam = new URLSearchParams(window.location.search).get("qr");
    if (!qrParam) {
      queryAppliedRef.current = true;
      return;
    }
    if (locations.length === 0 && hens.length === 0 && batches.length === 0 && assets.length === 0) {
      return;
    }
    void Promise.resolve().then(() => {
      if (resolvePayload(qrParam)) {
        queryAppliedRef.current = true;
      }
    });
  }, [assets.length, batches.length, hens.length, locations.length, resolvePayload]);

  const startScanner = async () => {
    setError("");
    setSelected(null);
    setQuickToast("");
    setScanning(true);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void stopScanner();
          resolvePayload(decodedText);
        },
        () => {},
      );
    } catch {
      setScanning(false);
      setError("No se pudo acceder a la cámara. Verifica los permisos o usa el buscador manual.");
    }
  };

  const unifiedMatches = useMemo((): UnifiedMatch[] => {
    const q = manualInput.trim();
    if (!q) return [];
    const results: UnifiedMatch[] = [];

    for (const loc of locations) {
      if (matchesTextQuery(q, [loc.code, loc.name, LOCATION_TYPE_LABELS[loc.type] || loc.type, loc.localReference])) {
        results.push({
          key: `loc-${loc.id}`,
          type: "ubicacion",
          title: `${loc.name} (${loc.code})`,
          subtitle: `Lugar · ${LOCATION_TYPE_LABELS[loc.type] || loc.type}${loc.animals ? ` · ${loc.animals} aves` : ""}`,
          badgeText: loc.status === "activa" ? "Activa" : "Inactiva",
          badgeColor: loc.status === "activa" ? "green" : "gray",
          selection: { type: "ubicacion", location: loc },
        });
      }
    }

    for (const batch of batches) {
      const sp = SPECIES_LABEL[batch.species || "pollo"] || batch.species;
      const st = batchStatusLabels[batch.status] || { label: batch.status, color: "gray" };
      if (matchesTextQuery(q, [batch.code, batch.breed, sp, st.label])) {
        results.push({
          key: `lote-${batch.id}`,
          type: "lote",
          title: `${batch.code} · ${sp}`,
          subtitle: `Lote · ${batch.breed} · ${batch.currentQuantity} aves`,
          badgeText: st.label,
          badgeColor: st.color,
          selection: { type: "lote", batch },
        });
      }
    }

    for (const asset of assets) {
      const st = assetStatusLabels[asset.status] || { label: asset.status, color: "gray" };
      if (matchesTextQuery(q, [asset.code, asset.name, asset.category, asset.locationName, asset.brand])) {
        results.push({
          key: `act-${asset.id}`,
          type: "activo",
          title: `${asset.name} (${asset.code})`,
          subtitle: `Equipo · ${asset.category}${asset.locationName ? ` · ${asset.locationName}` : ""}`,
          badgeText: st.label,
          badgeColor: st.color,
          selection: { type: "activo", asset },
        });
      }
    }

    for (const h of hens) {
      if (matchesTextQuery(q, [h.code, h.breed, h.stage, statusLabels[h.status] || h.status])) {
        results.push({
          key: `hen-${h.id}`,
          type: "gallina",
          title: `${h.code} · ${h.breed}`,
          subtitle: `Ave · ${h.stage || "Sin etapa"}${h.ageWeeks ? ` · ${h.ageWeeks} sem` : ""}`,
          badgeText: statusLabels[h.status] || h.status,
          badgeColor: statusColors[h.status] || "gray",
          selection: { type: "gallina", hen: h },
        });
      }
    }

    return results.slice(0, 10);
  }, [assets, batches, hens, locations, manualInput]);

  const handleManualSubmit = () => {
    if (unifiedMatches.length === 1) {
      setSelected(unifiedMatches[0].selection);
      setManualInput("");
      setError("");
      return;
    }
    if (resolvePayload(manualInput)) {
      setManualInput("");
    }
  };

  const scannedHen = selected?.type === "gallina" ? selected.hen : null;

  const openHenAction = (action: "vender" | "tratar" | "muerte") => {
    if (!scannedHen) return;
    setActionModal(action);
    setActionError("");
    setActionSuccess("");
    if (action === "vender") {
      setActionForm({ buyer: "", pricePerUnit: "15000", weightKg: scannedHen.weight || "" });
    } else if (action === "tratar") {
      setActionForm({
        date: todayColombiaIso(),
        type: "tratamiento",
        description: "",
        product: "",
        cost: "0",
      });
    } else {
      setActionForm({
        date: todayColombiaIso(),
        cause: "causa_natural",
        description: "",
      });
    }
  };

  const submitHenAction = async () => {
    if (!scannedHen || actionSubmittingRef.current) return;
    actionSubmittingRef.current = true;
    setActionSubmitting(true);
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
            date: todayColombiaIso(),
            birdType: "gallina_descarte",
            quantity: 1,
            weightKg: actionForm.weightKg ? weight : null,
            pricePerUnit: price,
            priceMode: "por_ave",
            totalAmount: price,
            buyer: actionForm.buyer,
            henId: scannedHen.id,
          }),
        });
        const queued = res.headers.get("X-Gallinero-Offline-Queued") === "1";
        if (!res.ok && !queued) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar venta");
        }
        setActionSuccess(queued ? "Venta guardada en modo offline" : "Venta registrada correctamente");
      } else if (actionModal === "tratar") {
        const res = await apiFetch("/api/sanidad/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: actionForm.date,
            locationId: scannedHen.locationId || locations[0]?.id || undefined,
            type: actionForm.type,
            description: actionForm.description,
            affectedHens: JSON.stringify([scannedHen.id]),
            product: actionForm.product,
            cost: actionForm.cost,
          }),
        });
        const queued = res.headers.get("X-Gallinero-Offline-Queued") === "1";
        if (!res.ok && !queued) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar tratamiento");
        }
        setActionSuccess(queued ? "Tratamiento guardado en modo offline" : "Tratamiento registrado correctamente");
      } else if (actionModal === "muerte") {
        const res = await apiFetch("/api/produccion/mortalidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: actionForm.date,
            birdType: "gallina",
            quantity: 1,
            cause: actionForm.cause,
            henId: scannedHen.id,
            locationId: scannedHen.locationId || locations[0]?.id || undefined,
            description: actionForm.description,
          }),
        });
        const queued = res.headers.get("X-Gallinero-Offline-Queued") === "1";
        if (!res.ok && !queued) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar mortalidad");
        }
        setActionSuccess(queued ? "Baja guardada en modo offline" : "Mortalidad registrada correctamente");
      }

      const updatedStatus =
        actionModal === "vender"
          ? "vendida"
          : actionModal === "muerte"
            ? "muerta"
            : actionModal === "tratar" && actionForm.type === "tratamiento"
              ? "enferma"
              : scannedHen.status;

      setHens((current) => current.map((item) => (item.id === scannedHen.id ? { ...item, status: updatedStatus } : item)));
      setSelected(null);
      setTimeout(() => setActionModal(null), 1300);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      actionSubmittingRef.current = false;
      setActionSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <HeroBanner
        theme="escanear"
        compact
        icon={<Camera className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Escáner QR de Granja"
        description="Escanea la puerta del galpón, un lote, un equipo o una gallina para registrar acciones al instante"
        helpTitle="Escáner QR Multifunción"
        help="Escanea códigos QR impresos en puertas de galpones/corrales, lotes, equipos o bandas de aves. También funciona offline usando los catálogos guardados en el dispositivo."
      />

      {!online && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Modo sin conexión activo: puedes escanear y registrar usando tus catálogos guardados.</span>
        </div>
      )}

      {quickToast && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span>{quickToast}</span>
          </span>
          <button type="button" onClick={() => setQuickToast("")} className="underline">Ocultar</button>
        </div>
      )}

      <Card className="mb-4">
        <div id="qr-reader" ref={containerRef} className="w-full rounded-lg overflow-hidden mb-3" />

        {!scanning ? (
          <div className="space-y-4">
            {selected?.type === "ubicacion" && (
              <div className="text-left space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <MapPin className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {selected.location.code} · {LOCATION_TYPE_LABELS[selected.location.type] || selected.location.type}
                        </p>
                        <h2 className="text-lg font-bold text-slate-800">{selected.location.name}</h2>
                      </div>
                    </div>
                    <Badge color={selected.location.status === "activa" ? "green" : "gray"}>
                      {selected.location.status === "activa" ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white p-2 border border-slate-100">
                      <p className="text-slate-500">Animales</p>
                      <p className="text-sm font-bold text-slate-800">{selected.location.animals ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-slate-100">
                      <p className="text-slate-500">Huevos 30d</p>
                      <p className="text-sm font-bold text-slate-800">{selected.location.eggsPeriod ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-slate-100">
                      <p className="text-slate-500">Pendientes</p>
                      <p className="text-sm font-bold text-slate-800">{selected.location.pendingMaintenance ?? 0}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openQuickCapture({ mode: "huevos", locationId: selected.location.id })}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 p-3.5 text-yellow-900 hover:bg-yellow-100 transition-colors"
                  >
                    <Egg className="h-5 w-5 text-yellow-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Recoger huevos aquí</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuickCapture({ mode: "alimentacion", locationId: selected.location.id })}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    <Wheat className="h-5 w-5 text-amber-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Dar alimento aquí</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuickCapture({ mode: "mortalidad", locationId: selected.location.id })}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-800 hover:bg-red-100 transition-colors"
                  >
                    <HeartPulse className="h-5 w-5 text-red-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Reportar baja aquí</span>
                  </button>
                  <Link
                    href={`/dashboard/ubicaciones/${selected.location.id}`}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <ClipboardList className="h-5 w-5 text-slate-600" aria-hidden="true" />
                    <span className="text-xs font-semibold">Ver ficha completa</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelected(null); void startScanner(); }}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Escanear otro código
                </button>
              </div>
            )}

            {selected?.type === "lote" && (
              <div className="text-left space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                        <Layers className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {selected.batch.code} · {SPECIES_LABEL[selected.batch.species || "pollo"] || selected.batch.species}
                        </p>
                        <h2 className="text-lg font-bold text-slate-800">{selected.batch.breed}</h2>
                      </div>
                    </div>
                    <Badge color={batchStatusLabels[selected.batch.status]?.color || "gray"}>
                      {batchStatusLabels[selected.batch.status]?.label || selected.batch.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white p-2 border border-slate-100">
                      <p className="text-slate-500">Actuales</p>
                      <p className="text-sm font-bold text-slate-800">{selected.batch.currentQuantity}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-slate-100">
                      <p className="text-slate-500">Edad</p>
                      <p className="text-sm font-bold text-slate-800">{selected.batch.ageWeeks ? `${selected.batch.ageWeeks} sem` : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-slate-100">
                      <p className="text-slate-500">Lugar</p>
                      <p className="truncate text-sm font-semibold text-slate-800">{selected.batch.locationName || "Sin lugar"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {selected.batch.purpose === "postura_huevo" && ["codorniz", "pato"].includes(selected.batch.species) && (
                    <button
                      type="button"
                      onClick={() =>
                        openQuickCapture({
                          mode: "huevos",
                          batchId: selected.batch.id,
                          locationId: selected.batch.locationId || undefined,
                          species: selected.batch.species,
                        })
                      }
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 p-3.5 text-yellow-900 hover:bg-yellow-100 transition-colors"
                    >
                      <Egg className="h-5 w-5 text-yellow-700" aria-hidden="true" />
                      <span className="text-xs font-semibold">Recoger huevos lote</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openQuickCapture({ mode: "alimentacion", locationId: selected.batch.locationId || undefined })}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    <Wheat className="h-5 w-5 text-amber-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Dar alimento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openQuickCapture({
                        mode: "mortalidad",
                        batchId: selected.batch.id,
                        locationId: selected.batch.locationId || undefined,
                        species: selected.batch.species,
                      })
                    }
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-800 hover:bg-red-100 transition-colors"
                  >
                    <HeartPulse className="h-5 w-5 text-red-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Reportar baja lote</span>
                  </button>
                  <Link
                    href={`/lote/${selected.batch.id}`}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <ExternalLink className="h-5 w-5 text-slate-600" aria-hidden="true" />
                    <span className="text-xs font-semibold">Trazabilidad lote</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelected(null); void startScanner(); }}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Escanear otro código
                </button>
              </div>
            )}

            {selected?.type === "activo" && (
              <div className="text-left space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <Wrench className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {selected.asset.code} · {selected.asset.category}
                        </p>
                        <h2 className="text-lg font-bold text-slate-800">{selected.asset.name}</h2>
                        {(selected.asset.brand || selected.asset.model) && (
                          <p className="text-xs text-slate-500">
                            {[selected.asset.brand, selected.asset.model].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge color={assetStatusLabels[selected.asset.status]?.color || "gray"}>
                      {assetStatusLabels[selected.asset.status]?.label || selected.asset.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Ubicación: <strong>{selected.asset.locationName || "Finca / sin lugar específico"}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openQuickCapture({ mode: "gasto" })}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <Receipt className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Registrar gasto/repuesto</span>
                  </button>
                  <Link
                    href="/dashboard/operaciones/mantenimiento"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    <Wrench className="h-5 w-5 text-blue-700" aria-hidden="true" />
                    <span className="text-xs font-semibold">Ver mantenimientos</span>
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelected(null); void startScanner(); }}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Escanear otro código
                </button>
              </div>
            )}

            {selected?.type === "gallina" && (
              <div className="text-left">
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-green-700 shrink-0">
                      <Bird className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-slate-800">{selected.hen.code}</h2>
                      <p className="text-sm text-slate-500">{selected.hen.breed}</p>
                    </div>
                    <Badge color={statusColors[selected.hen.status] || "gray"}>
                      {statusLabels[selected.hen.status] || selected.hen.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-slate-500 text-xs">Peso</p>
                      <p className="font-semibold">{selected.hen.weight ? `${selected.hen.weight} kg` : "—"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-slate-500 text-xs">Etapa</p>
                      <p className="font-semibold">{selected.hen.stage || "—"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-slate-500 text-xs">Edad</p>
                      <p className="font-semibold">{selected.hen.ageWeeks ? `${selected.hen.ageWeeks} sem` : "—"}</p>
                    </div>
                  </div>
                </div>

                {HEN_PRESENT_STATUSES.includes(selected.hen.status) ? (
                  <div className={`grid gap-2 mb-3 ${isHenAvailableForExit(selected.hen.status) ? "grid-cols-3" : "grid-cols-2"}`}>
                    {isHenAvailableForExit(selected.hen.status) && (
                      <button
                        onClick={() => openHenAction("vender")}
                        className="flex flex-col items-center gap-1.5 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                      >
                        <CircleDollarSign className="w-5 h-5 text-green-700" aria-hidden="true" />
                        <span className="text-xs font-medium text-green-700">Vender</span>
                      </button>
                    )}
                    <button
                      onClick={() => openHenAction("tratar")}
                      className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      <Pill className="w-5 h-5 text-blue-700" aria-hidden="true" />
                      <span className="text-xs font-medium text-blue-700">Tratar</span>
                    </button>
                    <button
                      onClick={() => openHenAction("muerte")}
                      className="flex flex-col items-center gap-1.5 p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Skull className="w-5 h-5 text-red-700" aria-hidden="true" />
                      <span className="text-xs font-medium text-red-700">Muerte</span>
                    </button>
                  </div>
                ) : (
                  <p className="mb-3 rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">
                    Esta ave ya salió del inventario y no admite nuevas acciones.
                  </p>
                )}

                <Link
                  href={`/dashboard/produccion/gallinas/${selected.hen.id}`}
                  className="flex items-center justify-center gap-2 w-full text-center p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                >
                  <ClipboardList className="w-4 h-4" aria-hidden="true" />
                  <span>Ver historial completo</span>
                </Link>

                <button
                  type="button"
                  onClick={() => { setSelected(null); void startScanner(); }}
                  className="w-full mt-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Escanear otro código
                </button>
              </div>
            )}

            {!selected && (
              <div className="text-center space-y-3">
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <Button onClick={() => void startScanner()}>
                  <span className="inline-flex items-center gap-1.5">
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Abrir cámara</span>
                  </span>
                </Button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400">o busca galpón, lote, equipo o ave</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                <div className="space-y-2 text-left">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleManualSubmit();
                    }}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <TableSearch
                      value={manualInput}
                      onChange={setManualInput}
                      placeholder="Buscar: Galpón 1, LP-001, G-001, bomba..."
                      resultCount={unifiedMatches.length}
                      totalCount={locations.length + batches.length + assets.length + hens.length}
                      className="flex-1"
                    />
                    <Button type="submit" variant="secondary" disabled={!manualInput.trim()}>
                      Abrir ficha
                    </Button>
                  </form>
                  {manualInput.trim() && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1">
                      {unifiedMatches.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-slate-500">Sin coincidencias con “{manualInput}”</p>
                      ) : (
                        unifiedMatches.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              setSelected(item.selection);
                              setManualInput("");
                              setError("");
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-left text-xs shadow-2xs transition-colors hover:bg-green-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-800">{item.title}</span>
                              <span className="block truncate text-[11px] text-slate-500">{item.subtitle}</span>
                            </span>
                            <Badge color={item.badgeColor}>{item.badgeText}</Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-2">Apunta la cámara al código QR de la puerta, lote, equipo o banda</p>
            <Button variant="secondary" onClick={() => void stopScanner()}>Cancelar escaneo</Button>
          </div>
        )}
      </Card>

      <Modal
        open={!!actionModal}
        onClose={() => !actionSubmitting && setActionModal(null)}
        title={
          actionModal === "vender"
            ? "Registrar venta rápida"
            : actionModal === "tratar"
              ? "Registrar tratamiento"
              : "Registrar mortalidad"
        }
      >
        {actionSuccess ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-9 h-9 text-green-600 mx-auto mb-2" aria-hidden="true" />
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
                />
                <Input
                  label="Peso (kg)"
                  type="number"
                  step="0.01"
                  value={actionForm.weightKg || ""}
                  onChange={(e) => setActionForm({ ...actionForm, weightKg: e.target.value })}
                  placeholder="Ej: 2.5"
                />
                <Input
                  label="Precio por ave ($)"
                  type="number"
                  value={actionForm.pricePerUnit || ""}
                  onChange={(e) => setActionForm({ ...actionForm, pricePerUnit: e.target.value })}
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
                />
                <Select
                  label="Tipo"
                  value={actionForm.type || "tratamiento"}
                  onChange={(e) => setActionForm({ ...actionForm, type: e.target.value })}
                >
                  <option value="vacunacion">Vacunación</option>
                  <option value="desparasitacion">Desparasitación</option>
                  <option value="tratamiento">Tratamiento</option>
                  <option value="vitaminas">Vitaminas</option>
                  <option value="otro">Otro</option>
                </Select>
                <Input
                  label="Descripción"
                  value={actionForm.description || ""}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                  placeholder="Ej: Tratamiento respiratorio"
                />
                <Input
                  label="Producto"
                  value={actionForm.product || ""}
                  onChange={(e) => setActionForm({ ...actionForm, product: e.target.value })}
                  placeholder="Nombre del producto"
                />
                <Input
                  label="Costo ($)"
                  type="number"
                  value={actionForm.cost || "0"}
                  onChange={(e) => setActionForm({ ...actionForm, cost: e.target.value })}
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
                />
                <Select
                  label="Causa"
                  value={actionForm.cause || "causa_natural"}
                  onChange={(e) => setActionForm({ ...actionForm, cause: e.target.value })}
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
                />
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={() => void submitHenAction()} disabled={actionSubmitting}>
                {actionSubmitting ? "Guardando…" : "Registrar"}
              </Button>
              <Button variant="secondary" onClick={() => setActionModal(null)} disabled={actionSubmitting}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
